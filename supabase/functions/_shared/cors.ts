/**
 * CORS configuration for Blood Help Edge Functions.
 * In production, restrict to the app's origin. During development,
 * allow localhost origins.
 */
// Every origin the app is actually served from. A missing entry does not degrade
// gracefully: the browser fails the preflight and the POST never leaves the device, so
// the Edge Function is never reached and the only symptom is a push that does not arrive.
// The app moved to Vercel while this list still named only the Firebase Hosting origins,
// which silently disabled both notify functions in production. Anything that serves the
// app — including a new preview domain — has to be added here.
const ALLOWED_ORIGINS = [
  'https://blood-help-ten.vercel.app',
  'https://blood-help-ff50b.web.app',
  'https://blood-help-ff50b.firebaseapp.com',
]

function getCorsHeaders(reqOrigin: string | null): Record<string, string> {
  const allowed = ALLOWED_ORIGINS.includes(reqOrigin ?? '')
    ? (reqOrigin ?? ALLOWED_ORIGINS[0])
    : ALLOWED_ORIGINS[0]

  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

export { getCorsHeaders }
