/**
 * Supabase session helpers. Replaces the dummy localStorage auth.
 */
import { supabase } from './lib/supabase'
import type { Session, AuthError } from '@supabase/supabase-js'

export type SessionResult =
  | { ok: true; session: Session }
  | { ok: false; error: AuthError | null }

/** Get the current Supabase session, if one exists. */
export async function getSession(): Promise<SessionResult> {
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session) {
    return { ok: false, error: error ?? null }
  }
  return { ok: true, session: data.session }
}

/** Subscribe to auth state changes. Returns an unsubscribe function. */
export function onAuthStateChange(callback: (session: Session | null) => void): () => void {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session)
  })
  return () => subscription.unsubscribe()
}
