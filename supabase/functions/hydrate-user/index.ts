import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    // Use the caller's JWT so RLS applies — never trust a client-supplied uid.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    )

    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const uid = user.id
    const body = await req.json().catch(() => ({}))
    const lastSeenAt: string | null = body.lastSeenAt ?? null

    // All queries are RLS-scoped to the caller's uid and run in parallel server-side (~0.5ms each).
    const [profileRes, donorRes, requestRes, responsesRes, donationRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
      supabase.from('donors').select('*').eq('profile_id', uid).maybeSingle(),
      supabase
        .from('blood_requests')
        .select('*')
        .eq('requester_id', uid)
        .eq('status', 'active')
        .maybeSingle(),
      supabase
        .from('request_responses')
        .select('request_id')
        .eq('donor_id', uid)
        .eq('status', 'responding'),
      lastSeenAt
        ? supabase
            .from('donations')
            .select('id, created_at')
            .eq('donor_id', uid)
            .gt('created_at', lastSeenAt)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ])

    if (profileRes.error) console.error('[hydrate-user] profile error:', profileRes.error.message)
    if (donorRes.error) console.error('[hydrate-user] donor error:', donorRes.error.message)
    if (requestRes.error) console.error('[hydrate-user] request error:', requestRes.error.message)

    return new Response(
      JSON.stringify({
        profile: profileRes.data,
        donor: donorRes.data,
        activeRequest: requestRes.data,
        ownResponses: responsesRes.data ?? [],
        unseenDonation: donationRes.data,
      }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('[hydrate-user] error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
})
