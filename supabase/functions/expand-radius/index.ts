import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { initializeApp, cert, getApps } from 'npm:firebase-admin/app'
import { getMessaging } from 'npm:firebase-admin/messaging'
import { COMPATIBLE_DONOR_TYPES } from '../_shared/compatibility.ts'
import { sanitizeLength } from '../_shared/validate.ts'
import { pruneDeadTokens } from '../_shared/prune.ts'

/**
 * expand-radius — delivers the alerts a widening owes.
 *
 * run_radius_expansion() (pg_cron, every minute) widens due requests and records
 * each newly reached band in radius_expansion_events, then pokes this worker. The
 * split is deliberate: the radius must move even when FCM, the network, or this
 * function is down, because the number on the requester's screen is what tells them
 * the search is still going. Delivery is the fallible half, so it retries.
 *
 * Alerts go to the ring ONLY — the 10-15 km band on a 10→15 km widening. Donors
 * inside the old radius were alerted when the request was posted and must not be
 * buzzed again for the same request.
 *
 * No CORS handling and no OPTIONS branch: the only caller is pg_cron over pg_net,
 * server to server. A browser has no business here.
 */

/** Rings drained per invocation. The cron tick is every minute, so a backlog clears fast. */
const CLAIM_LIMIT = 50

interface ClaimedEvent {
  event_id: string
  request_id: string
  inner_km: number
  outer_km: number
  blood_type: string
  lat: number
  lng: number
  urgency: string
  current_address: string | null
  still_alerting: boolean
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  // ── Caller verification ─────────────────────────────────────────────────
  // The bearer is a token Postgres minted for itself (vault: radius_job_token) and
  // Postgres is what checks it — claim_radius_expansion_events rejects any caller
  // that cannot present it. Verifying inside the claim rather than here means there
  // is no code path that drains the queue without the token, and no second copy of
  // the secret in this function's environment to rot out of sync.
  // verify_jwt is off on this function because pg_cron has no user session to present.
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer /, '')

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Claiming bumps attempts in the same statement that selects, so two overlapping
    // drains cannot both pick up the same ring and push it twice.
    const { data, error: claimErr } = await supabase.rpc('claim_radius_expansion_events', {
      p_token: token,
      p_limit: CLAIM_LIMIT,
    })
    if (claimErr) {
      // 42501 is the claim's own "unauthorized" — a caller without the job token.
      if (claimErr.code === '42501') {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      console.error('[expand-radius] claim failed:', claimErr.code, claimErr.message)
      return new Response(JSON.stringify({ error: 'claim_failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const events = (data ?? []) as ClaimedEvent[]
    if (events.length === 0) {
      return new Response(JSON.stringify({ drained: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Initialised only once there is something to send — an idle project should not
    // pay for Firebase startup on every tick.
    if (getApps().length === 0) {
      initializeApp({ credential: cert(JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT')!)) })
    }

    /** Terminal: this ring is done and will not be claimed again. */
    const settle = (id: string, note: string | null) =>
      supabase
        .from('radius_expansion_events')
        .update({ notified_at: new Date().toISOString(), last_error: note })
        .eq('id', id)

    /** Non-terminal: record why, leave the ring owed so the next tick retries it. */
    const recordFailure = (id: string, note: string) =>
      supabase.from('radius_expansion_events').update({ last_error: note }).eq('id', id)

    let sent = 0
    let settled = 0
    let retrying = 0

    for (const ev of events) {
      // One bad ring must not abort the rest of the drain.
      try {
        // Answered or closed between the widening and this drain — nothing is owed.
        if (!ev.still_alerting) {
          await settle(ev.event_id, 'skipped: request no longer alerting')
          settled++
          continue
        }

        const { data: ring, error: ringErr } = await supabase.rpc('donors_in_ring', {
          p_lat: ev.lat,
          p_lng: ev.lng,
          p_inner_km: ev.inner_km,
          p_outer_km: ev.outer_km,
        })
        if (ringErr) {
          // Transient by assumption — keep it owed rather than dropping the band.
          console.error('[expand-radius] donors_in_ring failed:', ringErr.code, ringErr.message)
          await recordFailure(ev.event_id, `donors_in_ring: ${ringErr.code}`)
          retrying++
          continue
        }

        const compatible = COMPATIBLE_DONOR_TYPES[ev.blood_type] ?? []
        const profileIds: string[] = (ring ?? [])
          .filter((d: { blood_type: string }) => compatible.includes(d.blood_type))
          .map((d: { profile_id: string }) => d.profile_id)

        // Empty bands are the normal case for a rare type, not a failure: the ring
        // genuinely contains nobody to alert, and a retry would find the same nobody.
        if (profileIds.length === 0) {
          await settle(ev.event_id, 'no compatible donors in ring')
          settled++
          continue
        }

        const { data: tokenRows } = await supabase
          .from('device_tokens')
          .select('fcm_token')
          .in('profile_id', profileIds)
        const tokens: string[] = (tokenRows ?? [])
          .map((r: { fcm_token: string }) => r.fcm_token)
          .filter(Boolean)

        if (tokens.length === 0) {
          await settle(ev.event_id, 'no device tokens in ring')
          settled++
          continue
        }

        const address = sanitizeLength(ev.current_address, 200)
        const deepLink =
          `/?fcm_type=donor_alert` +
          `&request_id=${encodeURIComponent(ev.request_id)}` +
          `&blood_type=${encodeURIComponent(ev.blood_type)}` +
          `&urgency=${encodeURIComponent(ev.urgency ?? 'today')}` +
          `&address=${encodeURIComponent(address)}`

        // Same data-only shape as notify-donors, so the service worker's existing
        // donor_alert branch renders it — a widening is the same alert, reaching further.
        const result = await getMessaging().sendEachForMulticast({
          tokens,
          data: {
            fcm_type: 'donor_alert',
            request_id: ev.request_id,
            blood_type: ev.blood_type,
            urgency: String(ev.urgency ?? 'today'),
            address,
          },
          webpush: { fcmOptions: { link: deepLink } },
        })

        if (result.failureCount > 0) {
          await pruneDeadTokens(supabase, tokens, result.responses, '[expand-radius]')
        }

        if (result.successCount === 0) {
          // Every token failed. Dead ones were just pruned, so a retry either reaches
          // a live device or finds no tokens at all and settles then.
          console.warn(
            `[expand-radius] ring ${ev.inner_km}-${ev.outer_km}km: all ${result.failureCount} send(s) failed`,
          )
          await recordFailure(ev.event_id, `all ${result.failureCount} send(s) failed`)
          retrying++
          continue
        }

        sent += result.successCount
        settled++
        await settle(ev.event_id, null)
        console.log(
          `[expand-radius] ring ${ev.inner_km}-${ev.outer_km}km — sent ${result.successCount}, failed ${result.failureCount}`,
        )
      } catch (err) {
        console.error('[expand-radius] ring failed:', err instanceof Error ? err.message : 'unknown')
        await recordFailure(ev.event_id, 'unexpected error')
        retrying++
      }
    }

    console.log(`[expand-radius] drained ${events.length} — settled ${settled}, retrying ${retrying}, pushes ${sent}`)
    return new Response(JSON.stringify({ drained: events.length, settled, retrying, sent }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    console.error('[expand-radius] unexpected error')
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
