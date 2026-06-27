import type { CSSProperties } from "react";
import { useState } from "react";
import { Button } from "../components/Button";
import type { Lang } from "../i18n";
import { formatNumber } from "../i18n";

const MILESTONES = [5, 10, 25, 50, 100];

function ordinal(n: number): string {
    const suffixes = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
}

/**
 * Burmese ordinal phrase for a donation count.
 * 1 → ပထမဆုံး, 2 → ဒုတိယ, 3 → တတိယအကြိမ်
 * n ≥ 4 → Myanmar numeral + " ကြိမ်မြောက်" so the caller can
 * drop the suffix from the surrounding template string for all cases.
 */
function burmOrdinal(n: number): string {
    if (n === 1) return "ပထမဆုံးအကြိမ်";
    if (n === 2) return "ဒုတိယအကြိမ်";
    if (n === 3) return "တတိယအကြိမ်";
    return formatNumber(n, "my") + " ကြိမ်မြောက်";
}

/** One decorative sparkle star placed around the heart motif. */
function Sparkle({ size, style }: { size: number; style: CSSProperties }) {
    return (
        <span className="bh-spark" style={style}>
            <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill="currentColor"
            >
                <path d="M12 2l1.6 6.4L20 10l-6.4 1.6L12 18l-1.6-6.4L4 10l6.4-1.6z" />
            </svg>
        </span>
    );
}

export interface DonorCongratsProps {
    lang: Lang;
    donationCount: number;
    onDone: () => void;
    onLeaderboard: () => void;
}

/**
 * Donor Congrats screen — shown after a donation is confirmed.
 * Animated heart motif, optional milestone badge at 5/10/25/50/100 donations,
 * and a bilingual count chip. Port of Donor Congrats v2.dc.html.
 */
export function DonorCongrats({
    lang,
    donationCount,
    onDone,
    onLeaderboard,
}: DonorCongratsProps) {
    const [lbHover, setLbHover] = useState(false);

    const isMy = lang === "my";
    const bodyFont = isMy ? "var(--font-burmese)" : "var(--font-sans)";
    const countFmt = formatNumber(donationCount, lang);
    const isMilestone = MILESTONES.includes(donationCount);

    const t = {
        my: {
            headline: "ကျေးဇူးအထူး တင်ပါသည်!",
            subheadline:
                "သင့်သွေးဖြင့် အသက်တစ်ချောင်းကို ကယ်တင်ပေးနိုင်ခဲ့ပါပြီ။",
            supporting:
                "သင့်ရဲ့ သွေးလှူဒါန်းမှုက တစ်စုံတစ်ယောက်ရဲ့ ဘဝအတွက် အများကြီး အဓိပ္ပါယ်ရှိစေပါသည်။ ထို့ကြောင့် သင့်ရဲ့ သဒ္ဒါတရားအား အသိအမှတ်ပြုအပ်ပါသည်။",
            milestoneLine: `${countFmt} ကြိမ်မြောက် လှူဒါန်းမှု ပြည့်ပါပြီ!`,
            countLine: `ယခုအကြိမ်သည် သင်၏ ${burmOrdinal(donationCount)} သွေးလှူဒါန်းမှုအဖြစ် မှတ်တမ်းတင်အပ်ပါသည်။`,
            countSub: `This is your ${ordinal(donationCount)} donation.`,
            done: "ပြီးပါပြီ",
            leaderboard: "သွေးလှုရှင်စာရင်း ကြည့်ရန်",
        },
        en: {
            headline: "Thank You So Much!",
            subheadline: "You just saved a life.",
            supporting:
                "Your blood donation means everything to someone's life. Thank you for your compassion.",
            milestoneLine: `${ordinal(donationCount)} donation milestone reached!`,
            countLine: `This is your ${ordinal(donationCount)} donation.`,
            countSub: "",
            done: "Done",
            leaderboard: "View Leaderboard",
        },
    };

    const s = t[lang];

    return (
        <div className="phone-entry-stage">
            <div className="phone-entry-card" style={{ fontFamily: bodyFont }}>
                {/* Scrollable center */}
                <div
                    style={{
                        flex: 1,
                        overflowY: "auto",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        textAlign: "center",
                        padding: "40px 30px",
                    }}
                >
                    {/* Animated heart motif */}
                    <div
                        aria-hidden="true"
                        style={{
                            position: "relative",
                            flex: "none",
                            marginBottom: "30px",
                        }}
                    >
                        <div
                            className="bh-motif"
                            style={{
                                width: "128px",
                                height: "128px",
                                borderRadius: "999px",
                                background: "var(--color-primary-wash)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <svg
                                width="60"
                                height="60"
                                viewBox="0 0 24 24"
                                fill="none"
                                style={{ display: "block" }}
                            >
                                <path
                                    d="M20.8 6.2a5.2 5.2 0 0 0-7.4 0L12 7.6l-1.4-1.4a5.2 5.2 0 0 0-7.4 7.4l1.4 1.4L12 22l7.4-7.4 1.4-1.4a5.2 5.2 0 0 0 0-7.4z"
                                    fill="var(--color-primary)"
                                />
                                <path
                                    d="M12 9.4s2.5 2.6 2.5 4.4a2.5 2.5 0 0 1-5 0c0-1.8 2.5-4.4 2.5-4.4z"
                                    fill="#fff"
                                />
                            </svg>
                        </div>
                        <Sparkle
                            size={16}
                            style={{
                                position: "absolute",
                                top: "6px",
                                right: "8px",
                                color: "var(--color-primary)",
                            }}
                        />
                        <Sparkle
                            size={11}
                            style={{
                                position: "absolute",
                                bottom: "10px",
                                left: "2px",
                                color: "var(--color-primary)",
                                animationDelay: "160ms",
                            }}
                        />
                        <Sparkle
                            size={8}
                            style={{
                                position: "absolute",
                                top: "18px",
                                left: "-6px",
                                color: "var(--color-primary)",
                                animationDelay: "300ms",
                            }}
                        />
                    </div>

                    {/* Milestone badge — only shown at milestone donation counts */}
                    {isMilestone && (
                        <div
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "7px",
                                marginBottom: "18px",
                                padding: "8px 14px",
                                borderRadius: "var(--radius-pill)",
                                background: "var(--color-primary)",
                                color: "#fff",
                            }}
                        >
                            <span style={{ fontSize: "15px", lineHeight: 1 }}>
                                🎉
                            </span>
                            <span
                                style={{
                                    fontFamily: bodyFont,
                                    fontSize: "13px",
                                    fontWeight: 600,
                                    lineHeight: 1.3,
                                }}
                            >
                                {s.milestoneLine}
                            </span>
                        </div>
                    )}

                    <h1
                        style={{
                            margin: 0,
                            fontFamily: bodyFont,
                            fontSize: "28px",
                            fontWeight: 600,
                            lineHeight: 1.4,
                            color: "var(--text-primary)",
                        }}
                    >
                        {s.headline}
                    </h1>

                    <p
                        style={{
                            margin: "14px 0 0",
                            fontFamily: bodyFont,
                            fontSize: "17px",
                            fontWeight: 500,
                            lineHeight: 1.6,
                            color: "var(--color-primary)",
                        }}
                    >
                        {s.subheadline}
                    </p>

                    <p
                        style={{
                            margin: "14px 0 0",
                            fontFamily: bodyFont,
                            fontSize: "14px",
                            lineHeight: 1.85,
                            color: "var(--text-secondary)",
                            maxWidth: "300px",
                        }}
                    >
                        {s.supporting}
                    </p>

                    {/* Donation count chip */}
                    <div
                        style={{
                            marginTop: "26px",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: "4px",
                            background: "var(--surface-card)",
                            border: "1px solid var(--border-card)",
                            borderRadius: "var(--radius-card)",
                            padding: "16px 22px",
                            maxWidth: "300px",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "9px",
                            }}
                        >
                            <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="var(--color-primary)"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                style={{ display: "block", flex: "none" }}
                            >
                                <path d="M12 2.7s6 6 6 10.3a6 6 0 0 1-12 0c0-4.3 6-10.3 6-10.3z" />
                            </svg>
                            <span
                                style={{
                                    fontFamily: bodyFont,
                                    fontSize: 16,
                                    fontWeight: 600,
                                    lineHeight: 1.5,
                                    color: "var(--text-primary)",
                                }}
                            >
                                {s.countLine}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Sticky footer actions */}
                <div
                    style={{
                        flex: "none",
                        padding:
                            "0 30px calc(28px + env(safe-area-inset-bottom))",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "6px",
                    }}
                >
                    <Button fullWidth onClick={onDone}>
                        <span style={{ fontFamily: bodyFont }}>{s.done}</span>
                    </Button>
                    <button
                        onClick={onLeaderboard}
                        onMouseEnter={() => setLbHover(true)}
                        onMouseLeave={() => setLbHover(false)}
                        style={{
                            marginTop: "6px",
                            background: "none",
                            border: "none",
                            padding: "10px 12px",
                            cursor: "pointer",
                            fontFamily: bodyFont,
                            fontSize: "14px",
                            fontWeight: 600,
                            color: lbHover
                                ? "var(--color-primary)"
                                : "var(--text-secondary)",
                            transition: "color 120ms ease",
                        }}
                    >
                        {s.leaderboard}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default DonorCongrats;
