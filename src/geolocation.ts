/** Result of a geolocation request. */
export type GeoResult =
  | { ok: true; lat: number; lng: number; accuracy: number }
  | { ok: false; reason: 'denied' | 'unavailable' | 'timeout' | 'unsupported' }

/**
 * Request the device's current position via the browser geolocation API.
 * Triggers the native permission prompt if not yet granted. The caller should
 * warn the user beforehand (pre-permission dialog) so they know it's coming.
 */
export function getCurrentPosition(): Promise<GeoResult> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) {
      resolve({ ok: false, reason: 'unsupported' })
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          ok: true,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) => {
        const reason =
          err.code === err.PERMISSION_DENIED
            ? 'denied'
            : err.code === err.TIMEOUT
              ? 'timeout'
              : 'unavailable'
        resolve({ ok: false, reason })
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  })
}

/**
 * Coarsen GPS coordinates to ~1km grid (~2 decimal places) for privacy.
 * MUST be called before writing any lat/lng to the database.
 * Raw GeoResult coordinates are never written to Supabase directly.
 */
export function coarsenCoordinates(lat: number, lng: number): { lat: number; lng: number } {
  return {
    lat: Math.round(lat * 100) / 100,
    lng: Math.round(lng * 100) / 100,
  }
}
