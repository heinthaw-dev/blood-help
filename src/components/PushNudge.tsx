import type { CSSProperties, ReactNode } from 'react'
import { useState } from 'react'
import { Card } from './Card'
import { Button } from './Button'
import { usePwaState } from '../lib/pwa'
import { enablePush, promptAndroidInstall } from '../lib/push'
import type { PushResult } from '../lib/push'
import type { Lang } from '../i18n'

export interface PushNudgeProps {
  lang: Lang
  /** Auth uid — required to register the alert token when the user enables alerts. */
  supabaseId: string | null
  /** Optional spacing/layout override applied to the rendered card. */
  style?: CSSProperties
  /** When provided, an actionable nudge shows a dismiss (×) in the corner. */
  onDismiss?: () => void
}

// ── Icons (inline, token-tinted) ───────────────────────────────────────────

function Glyph({ size, color, children }: { size: number; color: string; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'block', flex: 'none' }}
    >
      {children}
    </svg>
  )
}

/** iOS "Share" glyph — box with an arrow leaving the top. */
const ShareIcon = ({ size, color }: { size: number; color: string }) => (
  <Glyph size={size} color={color}>
    <path d="M12 16V4" />
    <path d="m8 8 4-4 4 4" />
    <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
  </Glyph>
)

const BellIcon = ({ size, color }: { size: number; color: string }) => (
  <Glyph size={size} color={color}>
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </Glyph>
)

const DownloadIcon = ({ size, color }: { size: number; color: string }) => (
  <Glyph size={size} color={color}>
    <path d="M12 3v12" />
    <path d="m8 11 4 4 4-4" />
    <path d="M5 21h14" />
  </Glyph>
)

const LinkIcon = ({ size, color }: { size: number; color: string }) => (
  <Glyph size={size} color={color}>
    <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
    <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
  </Glyph>
)

const ArrowDownIcon = ({ size, color }: { size: number; color: string }) => (
  <Glyph size={size} color={color}>
    <path d="M12 5v14" />
    <path d="m19 12-7 7-7-7" />
  </Glyph>
)

const CheckIcon = ({ size, color }: { size: number; color: string }) => (
  <Glyph size={size} color={color}>
    <polyline points="20 6 9 17 4 12" />
  </Glyph>
)

// ── Shared layout ──────────────────────────────────────────────────────────

/** 42px round tinted chip that holds a state icon — matches DonorThankYou's opt-in card. */
function IconChip({ bg, children }: { bg: string; children: ReactNode }) {
  return (
    <div
      style={{
        width: 42,
        height: 42,
        flex: 'none',
        borderRadius: 999,
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </div>
  )
}

/** Info card: icon chip + guidance text, with optional action / footer slots below. */
function NudgeShell({
  icon,
  chipBg,
  text,
  bodyFont,
  action,
  footer,
  style,
  onDismiss,
}: {
  icon: ReactNode
  chipBg: string
  text: string
  bodyFont: string
  action?: ReactNode
  footer?: ReactNode
  style?: CSSProperties
  onDismiss?: () => void
}) {
  return (
    <Card
      padding="lg"
      style={{ boxShadow: 'var(--shadow-card)', position: 'relative', ...style }}
    >
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            width: 30,
            height: 30,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-hint)',
          }}
        >
          <Glyph size={16} color="currentColor">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </Glyph>
        </button>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 13 }}>
        <IconChip bg={chipBg}>{icon}</IconChip>
        <p
          style={{
            margin: 0,
            flex: 1,
            minWidth: 0,
            textAlign: 'left',
            paddingRight: onDismiss ? 22 : 0,
            fontFamily: bodyFont,
            fontSize: 14,
            fontWeight: 500,
            lineHeight: 1.6,
            color: 'var(--text-primary)',
          }}
        >
          {text}
        </p>
      </div>
      {action}
      {footer}
    </Card>
  )
}

// ── Copy ────────────────────────────────────────────────────────────────────

const STRINGS: Record<
  Lang,
  {
    addToHome: string
    addToHomeHint: string
    openInSafari: string
    copyLink: string
    copied: string
    enablePrompt: string
    enableCta: string
    installPrompt: string
    installCta: string
    enabledLabel: string
    enableDeniedError: string
    enableFailedError: string
  }
> = {
  my: {
    addToHome:
      "အသိပေးချက်များ ရရှိရန် — အောက်ခြေရှိ 'မျှဝေရန်' (Share) ကို နှိပ်ပြီး 'Add to Home Screen' ကို ရွေးပါ။",
    addToHomeHint: 'အောက်ခြေ Share ခလုတ်',
    openInSafari:
      'iPhone တွင် အသိပေးချက်များ ရရှိရန် Blood Help ကို Safari ဖြင့် ဖွင့်ပါ။',
    copyLink: 'လင့်ခ် ကူးယူရန်',
    copied: 'ကူးယူပြီးပါပြီ',
    enablePrompt:
      'အရေးပေါ် သွေးလိုအပ်မှုများကို ချက်ချင်း သိရှိနိုင်ရန် အသိပေးချက်များ ဖွင့်ပါ။',
    enableCta: 'အသိပေးချက်များ ဖွင့်ရန်',
    installPrompt:
      'မြန်ဆန်စွာ အသုံးပြုနိုင်ရန်နှင့် အသိပေးချက်များ ရရှိရန် Blood Help ကို ထည့်သွင်းပါ။',
    installCta: 'ထည့်သွင်းရန်',
    enabledLabel: 'အသိပေးချက်များ ဖွင့်ထားပြီးပါပြီ',
    enableDeniedError:
      'အသိပေးချက်များကို ပိတ်ထားပါသည်။ ဖုန်း Settings ထဲတွင် Blood Help အတွက် Notifications ကို ဖွင့်ပေးပါ။',
    enableFailedError:
      'အသိပေးချက်များ ဖွင့်၍ မရသေးပါ။ အင်တာနက် ချိတ်ဆက်မှုကို စစ်ဆေးပြီး ထပ်မံ ကြိုးစားပါ။',
  },
  en: {
    addToHome: "To get alerts — tap Share below, then choose 'Add to Home Screen'.",
    addToHomeHint: "Safari's Share button",
    openInSafari: 'For alerts on iPhone, open Blood Help in Safari.',
    copyLink: 'Copy link',
    copied: 'Copied',
    enablePrompt:
      "Turn on alerts so you'll know the moment blood is urgently needed nearby.",
    enableCta: 'Enable alerts',
    installPrompt: 'Install Blood Help for faster access and alerts.',
    installCta: 'Install',
    enabledLabel: 'Alerts are on',
    enableDeniedError:
      'Alerts are blocked. Turn on Notifications for Blood Help in your device settings.',
    enableFailedError:
      "We couldn't turn alerts on. Check your connection and try again.",
  },
}

// ── Component ─────────────────────────────────────────────────────────────

/**
 * PushNudge — a single, self-hiding onboarding card that reads {@link usePwaState}
 * and shows the ONE next step a visitor needs to receive alerts:
 *
 *  - `ios-add-to-home`   → Share → Add to Home Screen guidance (no button; iOS has no install API)
 *  - `ios-open-in-safari`→ "open in Safari" + a copy-link button
 *  - `ios-enable-push`   → red "Enable alerts" button → {@link enablePush}
 *  - `android-install`   → red "Install" button → {@link promptAndroidInstall}
 *  - `granted` / `hidden`→ renders nothing
 *
 * On a successful enable/install it shows a green "Alerts are on" confirmation.
 * Burmese-first copy, driven by `lang`. Drop it anywhere — it returns null when
 * there is nothing to prompt.
 */
export function PushNudge({ lang, supabaseId, style, onDismiss }: PushNudgeProps) {
  const { state } = usePwaState()
  const [succeeded, setSucceeded] = useState(false)
  const [copied, setCopied] = useState(false)
  // Non-'granted' outcome of the last enable attempt, or null when there is
  // nothing to report. Without this the user taps, grants permission, and gets
  // no feedback at all when token registration fails downstream.
  const [enableError, setEnableError] = useState<Exclude<PushResult, 'granted'> | null>(null)

  const bodyFont = lang === 'my' ? 'var(--font-burmese)' : 'var(--font-sans)'
  const s = STRINGS[lang]

  const handleEnable = async () => {
    if (!supabaseId) return
    setEnableError(null) // clear any prior failure so a retry starts clean
    const result = await enablePush(supabaseId)
    if (result === 'granted') setSucceeded(true)
    else setEnableError(result)
  }

  /** Bilingual line shown under the enable button after a failed attempt. */
  const errorNotice = enableError && (
    <p
      role="alert"
      style={{
        margin: '10px 0 0',
        textAlign: 'left',
        fontFamily: bodyFont,
        fontSize: 13,
        fontWeight: 500,
        lineHeight: 1.6,
        color: 'var(--color-primary)',
      }}
    >
      {enableError === 'denied' ? s.enableDeniedError : s.enableFailedError}
    </p>
  )

  // Installing a PWA requests no notification permission and registers no token,
  // so an accepted install must chain into enablePush before we can claim alerts
  // are on. Previously this set succeeded on the install alone — a false green.
  const handleInstall = async () => {
    if ((await promptAndroidInstall()) !== 'accepted') return
    await handleEnable()
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
    } catch {
      // Clipboard blocked (older iOS / denied) — leave the label unchanged.
    }
  }

  // Success confirmation — shown immediately, since usePwaState may not re-derive
  // `granted` until the next focus (Notification.permission has no change event).
  if (succeeded) {
    return (
      <Card
        padding="lg"
        background="var(--color-success-tint)"
        borderColor="var(--color-success-tint)"
        style={{ display: 'flex', alignItems: 'center', gap: 13, ...style }}
      >
        <IconChip bg="var(--color-success)">
          <CheckIcon size={22} color="#fff" />
        </IconChip>
        <p
          style={{
            margin: 0,
            flex: 1,
            minWidth: 0,
            textAlign: 'left',
            fontFamily: bodyFont,
            fontSize: 16,
            fontWeight: 600,
            lineHeight: 1.5,
            color: 'var(--color-success)',
          }}
        >
          {s.enabledLabel}
        </p>
      </Card>
    )
  }

  switch (state) {
    case 'ios-add-to-home':
      return (
        <NudgeShell
          icon={<ShareIcon size={20} color="var(--color-primary)" />}
          chipBg="var(--color-primary-tint)"
          text={s.addToHome}
          bodyFont={bodyFont}
          style={style}
          onDismiss={onDismiss}
          footer={
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                marginTop: 14,
              }}
            >
              <span style={{ fontSize: 12, color: 'var(--text-hint)', fontFamily: bodyFont }}>
                {s.addToHomeHint}
              </span>
              <ArrowDownIcon size={22} color="var(--color-primary)" />
            </div>
          }
        />
      )

    case 'ios-open-in-safari':
      return (
        <NudgeShell
          icon={<BellIcon size={20} color="var(--color-primary)" />}
          chipBg="var(--color-primary-tint)"
          text={s.openInSafari}
          bodyFont={bodyFont}
          style={style}
          onDismiss={onDismiss}
          action={
            <Button
              type="button"
              fullWidth
              tone="secondary"
              onClick={handleCopyLink}
              icon={<LinkIcon size={18} color="var(--text-primary)" />}
              style={{ marginTop: 16, fontFamily: bodyFont }}
            >
              {copied ? s.copied : s.copyLink}
            </Button>
          }
        />
      )

    // Same card for both platforms — the only difference is how the user got
    // here (iOS must install first; Android/desktop can enable straight away).
    case 'ios-enable-push':
    case 'android-enable-push':
      return (
        <NudgeShell
          icon={<BellIcon size={20} color="var(--color-primary)" />}
          chipBg="var(--color-primary-tint)"
          text={s.enablePrompt}
          bodyFont={bodyFont}
          style={style}
          onDismiss={onDismiss}
          action={
            <>
              <Button
                type="button"
                fullWidth
                onClick={handleEnable}
                disabled={!supabaseId}
                icon={<BellIcon size={19} color="#fff" />}
                style={{ marginTop: 16, fontFamily: bodyFont }}
              >
                {s.enableCta}
              </Button>
              {errorNotice}
            </>
          }
        />
      )

    case 'android-install':
      return (
        <NudgeShell
          icon={<DownloadIcon size={20} color="var(--color-primary)" />}
          chipBg="var(--color-primary-tint)"
          text={s.installPrompt}
          bodyFont={bodyFont}
          style={style}
          onDismiss={onDismiss}
          action={
            <Button
              type="button"
              fullWidth
              onClick={handleInstall}
              icon={<DownloadIcon size={19} color="#fff" />}
              style={{ marginTop: 16, fontFamily: bodyFont }}
            >
              {s.installCta}
            </Button>
          }
        />
      )

    case 'granted':
    case 'hidden':
    default:
      return null
  }
}

export default PushNudge
