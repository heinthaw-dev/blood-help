/**
 * Prune FCM tokens that FCM itself reports as dead.
 *
 * The client used to clear stale tokens by deleting every row for the profile
 * on each registration, which also deleted the user's OTHER devices — an
 * iPhone and an Android phone on one account would ping-pong, each
 * registration killing the other. Cleanup belongs here instead: the send
 * response tells us exactly which tokens are unusable, so nothing live is ever
 * removed.
 */

/** FCM error codes that mean the token will never be deliverable again. */
const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
])

interface SendResponse {
  success: boolean
  error?: { code?: string }
}

/** Supabase client surface used here — kept structural to avoid a type import. */
interface TokenDeleter {
  from(table: string): {
    delete(): { in(column: string, values: string[]): Promise<{ error: unknown }> }
  }
}

/**
 * Delete the tokens whose send response carries a permanent-failure code.
 * `responses` must be positionally aligned with `tokens`, as returned by
 * `sendEachForMulticast`. Best-effort: a failure to prune is logged, never thrown,
 * because the notification itself has already been delivered to the live tokens.
 *
 * @returns how many tokens were pruned
 */
export async function pruneDeadTokens(
  supabase: TokenDeleter,
  tokens: string[],
  responses: SendResponse[],
  logPrefix: string,
): Promise<number> {
  const dead = tokens.filter((_, i) => {
    const res = responses[i]
    return res && !res.success && DEAD_TOKEN_CODES.has(res.error?.code ?? '')
  })

  if (dead.length === 0) return 0

  const { error } = await supabase.from('device_tokens').delete().in('fcm_token', dead)
  if (error) {
    console.error(`${logPrefix} failed to prune ${dead.length} dead token(s)`)
    return 0
  }

  console.log(`${logPrefix} pruned ${dead.length} dead token(s)`)
  return dead.length
}
