import { useEffect } from "react";
import { Badge } from "../components/Badge";
import { ScreenHeader } from "../components/ScreenHeader";
import { LanguageToggle } from "../components/LanguageToggle";
import { PushNudge } from "../components/PushNudge";
import { enablePush } from "../lib/push";
import type { BloodType } from "../blood";
import type { Lang } from "../i18n";

export interface DonorThankYouProps {
    lang: Lang;
    onLangChange: (lang: Lang) => void;
    bloodType: BloodType;
    /** Donor's profile id (auth uid) — required to register the alert token. */
    supabaseId: string | null;
    onContinue: () => void;
}

/**
 * Donor Thank You screen — shown immediately after a donor completes
 * registration. Confirms their blood type, then offers alert opt-in via the
 * shared PushNudge (the single source of install/enable UI). Continuing is a
 * quiet skip link that never blocks the donor from leaving.
 *
 * Port of Donor Thank You.dc.html, wired to the real push infra in lib/push.
 */
export function DonorThankYou({
    lang,
    onLangChange,
    bloodType,
    supabaseId,
    onContinue,
}: DonorThankYouProps) {
    const bodyFont = lang === "my" ? "var(--font-burmese)" : "var(--font-sans)";

    // Side effect only: if permission was already granted before this screen
    // (e.g. a returning donor), silently refresh the FCM token. Reads permission
    // directly — never prompts. PushNudge handles the tap-to-enable path.
    useEffect(() => {
        const granted =
            typeof Notification !== "undefined" &&
            Notification.permission === "granted";
        if (granted && supabaseId) void enablePush(supabaseId);
    }, [supabaseId]);

    const t = {
        my: {
            headline: "ကျေးဇူးတင်ပါတယ်။",
            subheadline: "တစ်စုံတစ်ယောက်၏ အသက်ကို ကယ်တင်နိုင်ပါပြီ။",
            bloodTypeLabel: "သင့်သွေးအုပ်စု —",
            body: "သွေးလှူရှင်အဖြစ် ပါဝင်ခဲ့သည့်အတွက် ကျေးဇူးအများကြီး တင်ပါသည်။ သင့်အနီးနားတွင် ကိုက်ညီသော သွေးအုပ်စု လိုအပ်သည့်အခါ ချက်ချင်း အကြောင်းကြားပေးပါမည် ဖြစ်ပါသည်။",
            skip: "ပင်မစာမျက်နှာသို့ ဆက်သွားရန်",
        },
        en: {
            headline: "Thank you!",
            subheadline: "You can now help save a life",
            bloodTypeLabel: "Your blood type —",
            body: "Thank you for joining as a blood donor. When someone nearby needs a matching blood type, we'll alert you right away.",
            skip: "Continue to home",
        },
    };

    const s = t[lang];

    return (
        <div className="phone-entry-stage">
            <div
                className="phone-entry-card"
                style={{
                    display: "flex",
                    flexDirection: "column",
                    fontFamily: bodyFont,
                }}
            >
                {/* Top bar: left wordmark + language toggle (matches Phone Entry) */}
                <ScreenHeader
                    variant="brand"
                    align="left"
                    right={
                        <LanguageToggle lang={lang} onChange={onLangChange} />
                    }
                />

                {/* Main content — flows from the top, centered horizontally */}
                <div
                    style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        textAlign: "center",
                        padding: "24px 12px 12px",
                    }}
                >
                    {/* Heart icon */}
                    <div
                        style={{
                            width: "88px",
                            height: "88px",
                            borderRadius: "999px",
                            background: "var(--color-primary-tint)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            marginBottom: "24px",
                            flex: "none",
                        }}
                    >
                        <svg
                            width="40"
                            height="40"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="var(--color-primary)"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ display: "block" }}
                        >
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                        </svg>
                    </div>

                    {/* Headline */}
                    <h1
                        style={{
                            margin: 0,
                            fontFamily: bodyFont,
                            fontSize: "26px",
                            fontWeight: 400,
                            lineHeight: 1.3,
                            color: "var(--text-primary)",
                        }}
                    >
                        {s.headline}
                    </h1>

                    {/* Subheadline */}
                    <p
                        style={{
                            margin: "18px 0 0",
                            fontFamily: bodyFont,
                            fontSize: "16px",
                            fontWeight: 500,
                            lineHeight: 1.55,
                            color: "var(--text-secondary)",
                        }}
                    >
                        {s.subheadline}
                    </p>

                    {/* Blood type badge */}
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "10px",
                            marginTop: "24px",
                        }}
                    >
                        <span
                            style={{
                                fontFamily: bodyFont,
                                fontSize: "14px",
                                color: "var(--text-secondary)",
                            }}
                        >
                            {s.bloodTypeLabel}
                        </span>
                        <Badge>{bloodType}</Badge>
                    </div>

                    {/* Warm message */}
                    <p
                        style={{
                            margin: "24px 0 0",
                            fontFamily: bodyFont,
                            fontSize: 16,
                            lineHeight: 1.75,
                            color: "var(--text-secondary)",
                            maxWidth: "300px",
                        }}
                    >
                        {s.body}
                    </p>
                </div>

                {/* Primary action: alert opt-in nudge, then a quiet skip link.
                    PushNudge self-hides if alerts are already on or unavailable. */}
                <div style={{ flex: "none", padding: "0 12px 24px" }}>
                    <PushNudge lang={lang} supabaseId={supabaseId} />

                    <button
                        type="button"
                        onClick={onContinue}
                        style={{
                            display: "block",
                            width: "100%",
                            marginTop: "16px",
                            padding: "10px 0",
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            fontFamily: bodyFont,
                            fontSize: "15px",
                            fontWeight: 500,
                            color: "var(--text-secondary)",
                        }}
                    >
                        {s.skip}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default DonorThankYou;
