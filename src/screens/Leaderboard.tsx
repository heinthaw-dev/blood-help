import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { BottomNav } from "../components/BottomNav";
import { ScreenHeader } from "../components/ScreenHeader";
import type { Tab } from "../components/BottomNav";
import type { Lang } from "../i18n";
import { formatNumber } from "../i18n";
import { supabase } from "../lib/supabase";

// ---- types ----

interface LeaderboardRow {
    profileId: string;
    name: string;
    bloodType: string;
    count: number;
    rank: number;
    isUser: boolean;
}

interface LeaderboardProps {
    lang: Lang;
    onNavigate: (tab: Tab) => void;
    /** Logged-in user's Supabase auth id — highlights their row as "You". */
    currentUserId: string | null;
}

// ---- constants ----

/** How many ranked donors to pull. */
const ROW_LIMIT = 50;

/**
 * Medal palette for the top-3 hero cards. These gold/silver/bronze hues are a
 * one-off decorative treatment that intentionally lives OUTSIDE the design-token
 * system (same precedent as Home.tsx's inline amber #B45309 extend banner): they
 * appear only on this screen and would add noise to the global token set.
 */
const MEDALS = {
    gold: {
        ring: "#D9A227",
        avatarBg: "#FBF0D6",
        avatarColor: "#9A6B0E",
        cardBg: "#FCF7EC",
        cardBorder: "#EFE0BB",
        cardShadow: "0 4px 16px rgba(190,150,40,.16)",
        labelBg: "#F6ECCF",
    },
    silver: {
        ring: "#AEB3BA",
        avatarBg: "#F2F3F5",
        avatarColor: "#6E6E6E",
        cardBg: "var(--surface-card)",
        cardBorder: "var(--border-card)",
        cardShadow: "none",
        labelBg: "transparent",
    },
    bronze: {
        ring: "#C0875A",
        avatarBg: "#F6ECE3",
        avatarColor: "#8A5A33",
        cardBg: "var(--surface-card)",
        cardBorder: "var(--border-card)",
        cardShadow: "none",
        labelBg: "transparent",
    },
} as const;

/** Top-3 rank → medal key. */
const MEDAL_BY_RANK = ["gold", "silver", "bronze"] as const;

/**
 * Leaderboard — top blood donors ranked by lifetime donation count, fed by the
 * `leaderboard_top_donors` SECURITY DEFINER RPC (a plain client query can't read
 * other users' donor/profile rows under the owner-only RLS policies). Port of
 * "Leaderboard v2": community impact banner, top-3 medal hero cards, and a full
 * ranked list. Privacy: the RPC returns name / blood type / count only — never
 * phone numbers or location.
 */
export function Leaderboard({
    lang,
    onNavigate,
    currentUserId,
}: LeaderboardProps) {
    const isMy = lang === "my";
    const burmeseFont = "var(--font-burmese)";
    const bodyFont = isMy ? burmeseFont : "var(--font-sans)";

    const [rows, setRows] = useState<LeaderboardRow[]>([]);
    const [livesSaved, setLivesSaved] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        async function loadLeaderboard() {
            const { data, error } = await supabase.rpc(
                "leaderboard_top_donors",
                { p_limit: ROW_LIMIT },
            );
            if (cancelled) return;
            if (error || !data) {
                // Network/RPC failure resolves to the empty state (same silent posture as
                // the Home feed) — the UI shows the "be the first donor" encouragement.
                setRows([]);
                setLivesSaved(0);
                setLoading(false);
                return;
            }
            setRows(
                data.map((d) => ({
                    profileId: d.profile_id,
                    name: d.name,
                    bloodType: d.blood_type,
                    count: d.donation_count,
                    rank: d.rank,
                    isUser:
                        currentUserId != null && d.profile_id === currentUserId,
                })),
            );
            setLivesSaved(data[0]?.total_donations ?? 0);
            setLoading(false);
        }
        void loadLeaderboard();
        return () => {
            cancelled = true;
        };
    }, [currentUserId]);

    const t = {
        my: {
            title: "လူ့အသက် ကယ်တင်ခဲ့သူများ",
            subtitle:
                "လှူဒါန်းမှုတိုင်းသည် တစ်စုံတစ်ဦးအတွက် ဒုတိယအခွင့်အရေး ဖြစ်ပါသည်",
            impactPrefix: "ကျွန်ုပ်တို့ စုပေါင်း၍ အသက် ",
            impactSuffix: " ခု ကယ်တင်ခဲ့ပါသည်",
            lowData: "ပထမဆုံး သွေးလှူရှင် ဖြစ်လိုက်ပါ။",
            topDonor: "ထိပ်ဆုံး သွေးလှူရှင်",
            allDonors: "သွေးလှူရှင်များ အားလုံး",
            times: "ကြိမ်",
            you: "သင်",
            loading: "ဖွင့်နေသည်…",
            fallbackName: "သွေးလှူရှင်",
        },
        en: {
            title: "People who've saved lives",
            subtitle: "Every donation is a second chance for someone",
            impactPrefix: "Together we've saved ",
            impactSuffix: " lives",
            lowData: "Be the first blood donor.",
            topDonor: "Top donor",
            allDonors: "All donors",
            times: "times",
            you: "You",
            loading: "Loading…",
            fallbackName: "Donor",
        },
    }[lang];

    const displayName = (name: string) => name.trim() || t.fallbackName;
    const initialOf = (name: string) => displayName(name)[0] ?? "·";

    const top3 = rows.slice(0, 3);
    const rest = rows.slice(3);

    // Shared pill style for the blood-type chip.
    const bloodPill: CSSProperties = {
        flex: "none",
        display: "inline-flex",
        fontFamily: "var(--font-sans)",
        fontSize: 12,
        fontWeight: 600,
        lineHeight: 1,
        color: "var(--color-primary)",
        background: "var(--color-primary-tint)",
        borderRadius: "var(--radius-pill)",
        padding: "5px 9px",
    };

    const youPill: CSSProperties = {
        flex: "none",
        display: "inline-flex",
        fontFamily: bodyFont,
        fontSize: 12,
        fontWeight: 600,
        lineHeight: 1,
        color: "#fff",
        background: "var(--color-primary)",
        borderRadius: "var(--radius-pill)",
        padding: "4px 9px",
    };

    return (
        <div className="phone-entry-stage">
            <div className="phone-entry-card" style={{ height: "100dvh" }}>
                {/* Header */}
                <ScreenHeader variant="brand" align="left" />

                {/* Scrollable body */}
                <div
                    style={{
                        flex: 1,
                        minHeight: 0,
                        overflowY: "auto",
                        scrollbarWidth: "none",
                        padding: "4px 20px 24px",
                    }}
                >
                    {/* Title block */}
                    <div style={{ textAlign: "center", padding: "6px 4px 0" }}>
                        <h1
                            style={{
                                margin: 0,
                                fontFamily: bodyFont,
                                fontSize: 23,
                                fontWeight: 600,
                                lineHeight: 1.35,
                                color: "var(--text-primary)",
                            }}
                        >
                            {t.title}
                        </h1>
                        <p
                            style={{
                                margin: "12px auto 0",
                                maxWidth: 300,
                                fontFamily: bodyFont,
                                fontSize: 14,
                                lineHeight: 1.6,
                                color: "var(--text-secondary)",
                            }}
                        >
                            {t.subtitle}
                        </p>
                    </div>

                    {loading ? (
                        <div
                            style={{
                                textAlign: "center",
                                padding: "48px 24px",
                                fontFamily: bodyFont,
                                fontSize: 14,
                                color: "var(--text-hint)",
                            }}
                        >
                            {t.loading}
                        </div>
                    ) : rows.length === 0 ? (
                        /* Low-data empty state — nobody has donated yet */
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                textAlign: "center",
                                padding: "48px 24px 24px",
                            }}
                        >
                            <div
                                style={{
                                    width: 64,
                                    height: 64,
                                    borderRadius: 999,
                                    background: "var(--surface-card)",
                                    border: "1px solid var(--border-card)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    marginBottom: 18,
                                }}
                            >
                                <svg
                                    width="28"
                                    height="28"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="var(--color-primary)"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    style={{ display: "block" }}
                                >
                                    <path d="M12 2.7s6 6 6 10.3a6 6 0 0 1-12 0c0-4.3 6-10.3 6-10.3z" />
                                </svg>
                            </div>
                            <div
                                style={{
                                    fontFamily: bodyFont,
                                    fontSize: 18,
                                    fontWeight: 600,
                                    lineHeight: 1.6,
                                    color: "var(--text-primary)",
                                    maxWidth: 280,
                                }}
                            >
                                {t.lowData}
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Community impact banner */}
                            <div
                                style={{
                                    marginTop: 20,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 12,
                                    background: "var(--color-primary-tint)",
                                    borderRadius: "var(--radius-card)",
                                    padding: "16px 18px",
                                }}
                            >
                                <div
                                    style={{
                                        width: 40,
                                        height: 40,
                                        flex: "none",
                                        borderRadius: 999,
                                        background: "var(--surface-card)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                >
                                    <svg
                                        width="20"
                                        height="20"
                                        viewBox="0 0 24 24"
                                        fill="var(--color-primary)"
                                        style={{ display: "block" }}
                                    >
                                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                                    </svg>
                                </div>
                                <div
                                    style={{
                                        minWidth: 0,
                                        fontFamily: bodyFont,
                                        fontSize: 15,
                                        lineHeight: 1.5,
                                        color: "var(--text-primary)",
                                    }}
                                >
                                    {t.impactPrefix}
                                    <strong
                                        style={{
                                            fontWeight: 600,
                                            color: "var(--color-primary)",
                                        }}
                                    >
                                        {formatNumber(livesSaved, lang)}
                                    </strong>
                                    {t.impactSuffix}
                                </div>
                            </div>

                            {/* Top-3 hero cards */}
                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 12,
                                    marginTop: 22,
                                }}
                            >
                                {top3.map((row) => {
                                    const medal =
                                        MEDALS[
                                            MEDAL_BY_RANK[row.rank - 1] ??
                                                "bronze"
                                        ];
                                    const isFirst = row.rank === 1;
                                    return (
                                        <div
                                            key={row.profileId}
                                            style={{
                                                position: "relative",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 16,
                                                padding: 18,
                                                borderRadius:
                                                    "var(--radius-card)",
                                                background: medal.cardBg,
                                                border: `1px solid ${medal.cardBorder}`,
                                                boxShadow: medal.cardShadow,
                                            }}
                                        >
                                            {/* Avatar with medal ring + rank badge */}
                                            <div
                                                style={{
                                                    position: "relative",
                                                    flex: "none",
                                                }}
                                            >
                                                {isFirst && (
                                                    <svg
                                                        width="26"
                                                        height="18"
                                                        viewBox="0 0 26 18"
                                                        fill="none"
                                                        style={{
                                                            position:
                                                                "absolute",
                                                            left: "50%",
                                                            top: -15,
                                                            transform:
                                                                "translateX(-50%)",
                                                            display: "block",
                                                        }}
                                                    >
                                                        <path
                                                            d="M2 4.5l4.5 4 6.5-7 6.5 7 4.5-4-2 12H4L2 4.5z"
                                                            fill={medal.ring}
                                                            stroke={medal.ring}
                                                            strokeWidth="1.4"
                                                            strokeLinejoin="round"
                                                        />
                                                        <circle
                                                            cx="2"
                                                            cy="4.5"
                                                            r="1.8"
                                                            fill={medal.ring}
                                                        />
                                                        <circle
                                                            cx="24"
                                                            cy="4.5"
                                                            r="1.8"
                                                            fill={medal.ring}
                                                        />
                                                        <circle
                                                            cx="13"
                                                            cy="1.6"
                                                            r="1.8"
                                                            fill={medal.ring}
                                                        />
                                                    </svg>
                                                )}
                                                <div
                                                    style={{
                                                        width: 58,
                                                        height: 58,
                                                        borderRadius: 999,
                                                        background:
                                                            medal.avatarBg,
                                                        border: `3px solid ${medal.ring}`,
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent:
                                                            "center",
                                                        fontFamily: burmeseFont,
                                                        fontSize: 22,
                                                        fontWeight: 600,
                                                        color: medal.avatarColor,
                                                    }}
                                                >
                                                    {initialOf(row.name)}
                                                </div>
                                                <div
                                                    style={{
                                                        position: "absolute",
                                                        right: -3,
                                                        bottom: -3,
                                                        width: 22,
                                                        height: 22,
                                                        borderRadius: 999,
                                                        background: medal.ring,
                                                        border: `2px solid ${medal.cardBg}`,
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent:
                                                            "center",
                                                        fontFamily:
                                                            "var(--font-sans)",
                                                        fontSize: 12,
                                                        fontWeight: 700,
                                                        color: "#fff",
                                                        lineHeight: 1,
                                                    }}
                                                >
                                                    {row.rank}
                                                </div>
                                            </div>

                                            {/* Name / label / blood */}
                                            <div
                                                style={{ flex: 1, minWidth: 0 }}
                                            >
                                                {isFirst && (
                                                    <div
                                                        style={{
                                                            display:
                                                                "inline-flex",
                                                            alignItems:
                                                                "center",
                                                            gap: 6,
                                                            fontFamily:
                                                                bodyFont,
                                                            fontSize: 11,
                                                            fontWeight: 600,
                                                            color: medal.ring,
                                                            background:
                                                                medal.labelBg,
                                                            borderRadius:
                                                                "var(--radius-pill)",
                                                            padding: "3px 9px",
                                                            marginBottom: 6,
                                                        }}
                                                    >
                                                        {t.topDonor}
                                                    </div>
                                                )}
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 8,
                                                    }}
                                                >
                                                    <span
                                                        style={{
                                                            fontFamily:
                                                                burmeseFont,
                                                            fontSize: 18,
                                                            fontWeight: 600,
                                                            color: "var(--text-primary)",
                                                            overflow: "hidden",
                                                            textOverflow:
                                                                "ellipsis",
                                                            whiteSpace:
                                                                "nowrap",
                                                        }}
                                                    >
                                                        {displayName(row.name)}
                                                    </span>
                                                    {row.isUser && (
                                                        <span style={youPill}>
                                                            {t.you}
                                                        </span>
                                                    )}
                                                </div>
                                                <div
                                                    style={{
                                                        ...bloodPill,
                                                        marginTop: 6,
                                                    }}
                                                >
                                                    {row.bloodType}
                                                </div>
                                            </div>

                                            {/* Count */}
                                            <div
                                                style={{
                                                    flex: "none",
                                                    textAlign: "right",
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        fontFamily: burmeseFont,
                                                        fontSize: isFirst
                                                            ? 28
                                                            : 24,
                                                        fontWeight: 600,
                                                        lineHeight: 1,
                                                        color: "var(--text-primary)",
                                                    }}
                                                >
                                                    {formatNumber(
                                                        row.count,
                                                        lang,
                                                    )}
                                                </div>
                                                <div
                                                    style={{
                                                        fontFamily: burmeseFont,
                                                        fontSize: 13,
                                                        color: "var(--text-secondary)",
                                                        marginTop: 3,
                                                    }}
                                                >
                                                    {t.times}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* All donors (rank 4+) */}
                            {rest.length > 0 && (
                                <>
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "baseline",
                                            gap: 8,
                                            margin: "26px 2px 12px",
                                        }}
                                    >
                                        <span
                                            style={{
                                                fontFamily: bodyFont,
                                                fontSize: 16,
                                                fontWeight: 600,
                                                color: "var(--text-primary)",
                                            }}
                                        >
                                            {t.allDonors}
                                        </span>
                                    </div>

                                    <div
                                        style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 8,
                                        }}
                                    >
                                        {rest.map((row) => (
                                            <div
                                                key={row.profileId}
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 14,
                                                    padding: "12px 14px",
                                                    borderRadius:
                                                        "var(--radius-card)",
                                                    background: row.isUser
                                                        ? "var(--color-primary-tint)"
                                                        : "var(--surface-card)",
                                                    border: `1px solid ${row.isUser ? "transparent" : "var(--border-card)"}`,
                                                }}
                                            >
                                                {/* rank */}
                                                <div
                                                    style={{
                                                        width: 24,
                                                        flex: "none",
                                                        textAlign: "center",
                                                        fontFamily:
                                                            "var(--font-sans)",
                                                        fontSize: 15,
                                                        fontWeight: 700,
                                                        lineHeight: 1,
                                                        color: "var(--text-hint)",
                                                    }}
                                                >
                                                    {row.rank}
                                                </div>
                                                {/* avatar */}
                                                <div
                                                    style={{
                                                        width: 38,
                                                        height: 38,
                                                        flex: "none",
                                                        borderRadius: 999,
                                                        background: row.isUser
                                                            ? "var(--surface-card)"
                                                            : "var(--color-bg)",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent:
                                                            "center",
                                                        fontFamily: burmeseFont,
                                                        fontSize: 15,
                                                        fontWeight: 600,
                                                        color: row.isUser
                                                            ? "var(--color-primary)"
                                                            : "var(--text-secondary)",
                                                    }}
                                                >
                                                    {initialOf(row.name)}
                                                </div>
                                                {/* name + badges */}
                                                <div
                                                    style={{
                                                        flex: 1,
                                                        minWidth: 0,
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 8,
                                                    }}
                                                >
                                                    <span
                                                        style={{
                                                            fontFamily:
                                                                burmeseFont,
                                                            fontSize: 16,
                                                            fontWeight:
                                                                row.isUser
                                                                    ? 600
                                                                    : 500,
                                                            color: "var(--text-primary)",
                                                            overflow: "hidden",
                                                            textOverflow:
                                                                "ellipsis",
                                                            whiteSpace:
                                                                "nowrap",
                                                        }}
                                                    >
                                                        {displayName(row.name)}
                                                    </span>
                                                    {row.isUser && (
                                                        <span style={youPill}>
                                                            {t.you}
                                                        </span>
                                                    )}
                                                    <span
                                                        style={{
                                                            ...bloodPill,
                                                            padding: "4px 8px",
                                                        }}
                                                    >
                                                        {row.bloodType}
                                                    </span>
                                                </div>
                                                {/* count */}
                                                <div
                                                    style={{
                                                        flex: "none",
                                                        textAlign: "right",
                                                    }}
                                                >
                                                    <span
                                                        style={{
                                                            fontFamily:
                                                                burmeseFont,
                                                            fontSize: 16,
                                                            fontWeight: 600,
                                                            color: "var(--text-primary)",
                                                        }}
                                                    >
                                                        {formatNumber(
                                                            row.count,
                                                            lang,
                                                        )}
                                                    </span>
                                                    <span
                                                        style={{
                                                            fontFamily:
                                                                burmeseFont,
                                                            fontSize: 16,
                                                            color: "var(--text-secondary)",
                                                        }}
                                                    >
                                                        {" "}
                                                        {t.times}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>

                {/* Bottom nav */}
                <BottomNav
                    active="leaderboard"
                    lang={lang}
                    onNavigate={onNavigate}
                />
            </div>
        </div>
    );
}

export default Leaderboard;
