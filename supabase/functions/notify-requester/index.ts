import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { initializeApp, cert, getApps } from 'npm:firebase-admin/app'
import { getMessaging } from 'npm:firebase-admin/messaging'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const { requestId, responderId } = await req.json()
    console.log('[notify-requester] payload:', { requestId, responderId })

    if (getApps().length === 0) {
      const serviceAccount = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT')!)
      initializeApp({ credential: cert(serviceAccount) })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Only send notification for the very first "Will Help" response on this request
    const { count } = await supabase
      .from('request_responses')
      .select('*', { count: 'exact', head: true })
      .eq('request_id', String(requestId))
      .eq('status', 'responding')
    console.log('[notify-requester] response count for this request:', count)

    if (count !== 1) {
      console.log('[notify-requester] not first response — skipping FCM')
      return new Response(JSON.stringify({ sent: 0, reason: 'not_first' }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const { data: request } = await supabase
      .from('blood_requests')
      .select('requester_id')
      .eq('id', String(requestId))
      .single()
    console.log('[notify-requester] requester_id:', request?.requester_id ?? 'NOT FOUND')

    if (!request) {
      return new Response(JSON.stringify({ error: 'request_not_found' }), {
        status: 404,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    // Fetch responder name, phone, blood_type in parallel
    const [{ data: donorRow }, { data: profileRow }] = await Promise.all([
      supabase.from('donors').select('blood_type').eq('profile_id', String(responderId)).single(),
      supabase.from('profiles').select('name, phone').eq('id', String(responderId)).single(),
    ])

    const responderName = profileRow?.name ?? 'A donor'
    const responderBloodType = String(donorRow?.blood_type ?? '')
    const responderPhone = profileRow?.phone ?? ''
    console.log('[notify-requester] responder:', { responderName, responderBloodType, responderPhone })

    // Get the requester's most recently registered device token
    const { data: tokenRow } = await supabase
      .from('device_tokens')
      .select('fcm_token')
      .eq('profile_id', request.requester_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    console.log('[notify-requester] requester device token found:', !!tokenRow)

    if (!tokenRow) {
      console.log('[notify-requester] no device token for requester — skipping FCM')
      return new Response(JSON.stringify({ sent: 0, reason: 'no_token' }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const deepLink =
      `/?fcm_type=requester_alert` +
      `&responder_name=${encodeURIComponent(responderName)}` +
      `&responder_phone=${encodeURIComponent(responderPhone)}` +
      `&responder_blood_type=${encodeURIComponent(responderBloodType)}` +
      `&request_id=${encodeURIComponent(String(requestId))}`

    // Data-only message — see notify-donors for rationale (duplicate prevention).
    console.log('[notify-requester] sending FCM to requester...')
    await getMessaging().send({
      token: tokenRow.fcm_token,
      data: {
        fcm_type: 'requester_alert',
        responder_name: responderName,
        responder_phone: responderPhone,
        responder_blood_type: responderBloodType,
        request_id: String(requestId),
      },
      webpush: {
        fcmOptions: { link: deepLink },
      },
    })

    console.log('[notify-requester] FCM sent successfully')
    return new Response(JSON.stringify({ sent: 1 }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('notify-requester error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
})
