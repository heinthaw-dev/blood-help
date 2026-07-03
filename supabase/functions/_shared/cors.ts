/**
 * CORS configuration for Blood Help Edge Functions.
 * In production, restrict to the app's origin. During development,
 * allow localhost origins.
 */
const ALLOWED_ORIGINS = [
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
