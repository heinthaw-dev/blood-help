import QRCode from "react-qr-code";
import { Switch } from "../components/Switch";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { BottomNav } from "../components/BottomNav";
import { ScreenHeader } from "../components/ScreenHeader";
import { LanguageToggle } from "../components/LanguageToggle";
import { NotificationBell } from "../components/NotificationBell";
import type { Tab } from "../components/BottomNav";
import type { BloodType } from "../blood";
import type { Lang } from "../i18n";
import { formatNumber } from "../i18n";

// ---- QR code ----

/** Real scannable QR code encoding the donor's 5-char donor_code. */
function DonorQR({ code }: { code: string }) {
    return (
        <QRCode
            value={code.toUpperCase()}
            size={168}
            bgColor="#ffffff"
            fgColor="var(--color-ink-900)"
            style={{ display: "block" }}
        />
    );
}

// ---- props ----

export interface ProfileProps {
    lang: Lang;
    onLangChange: (lang: Lang) => void;
    name: string;
    bloodType: BloodType;
    donationCount: number;
    lastDonation: string | null;
    /** Whether the user has completed donor profile setup. */
    isDonor: boolean;
    /** 5-character donor confirmation code shown on the QR card. */
    donorCode: string;
    /** Show the "eligible to donate again" cooldown notice. */
    showCooldown?: boolean;
    /** ISO date string (YYYY-MM-DD) for when the donor can donate again, or null if unknown. */
    availableAfter: string | null;
    available: boolean;
    onAvailableChange: (v: boolean) => void;
    /** Controls whether requesters can see the donor's number in an emergency. */
    emergencyCallable: boolean;
    onEmergencyChange: (v: boolean) => void;
    onEditProfile: () => void;
    onRegisterDonor: () => void;
    onLogout: () => void;
    onNavigate: (tab: Tab) => void;
    /** Open the notifications screen (header bell). */
    onOpenNotifications: () => void;
}

const EN_MONTHS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
];
const MY_MONTHS = [
    "ဇန်နဝါရီ",
    "ဖေဖော်ဝါရီ",
    "မတ်",
    "ဧပြီ",
    "မေ",
    "ဇွန်",
    "ဇူလိုင်",
    "သြဂုတ်",
    "စက်တင်ဘာ",
    "အောက်တိုဘာ",
    "နိုဝင်ဘာ",
    "ဒီဇင်ဘာ",
];

/** Format a YYYY-MM-DD date string for display, e.g. "23 Aug 2026" / "၂၀၂၆ သြဂုတ် ၂၃". */
function formatDate(iso: string, lang: Lang): string {
    const [y, m, d] = iso.split("-").map(Number);
    if (lang === "my") {
        const yr = String(y).replace(/[0-9]/g, (c) => "၀၁၂၃၄၅၆၇၈၉"[+c]);
        const dy = String(d).replace(/[0-9]/g, (c) => "၀၁၂၃၄၅၆၇၈၉"[+c]);
        return `${yr} ${MY_MONTHS[m - 1]} ${dy}`;
    }
    return `${d} ${EN_MONTHS[m - 1]} ${y}`;
}

/**
 * Profile — logged-in user profile with stats, donor QR code, and settings.
 * Port of Profile v2.dc.html.
 */
export function Profile({
    lang,
    onLangChange,
    name,
    bloodType,
    donationCount,
    lastDonation,
    isDonor,
    donorCode,
    showCooldown = false,
    availableAfter,
    available,
    onAvailableChange,
    emergencyCallable,
    onEmergencyChange,
    onEditProfile,
    onRegisterDonor,
    onLogout,
    onNavigate,
    onOpenNotifications,
}: ProfileProps) {
    const isMy = lang === "my";
    const langFont = isMy ? "var(--font-burmese)" : "var(--font-sans)";
    const count = formatNumber(donationCount, lang);
    const initial = (name.trim()[0] || "?").toUpperCase();

    const t = {
        my: {
            donatedLine:
                donationCount > 0
                    ? "လှူဒါန်းမှု " + count + " ကြိမ်"
                    : "ယခု app တွင် သွေးလှုဒါန်းထားခြင်း မရှိသေးပါ။",
            lastLine: lastDonation
                ? "နောက်ဆုံး လှူဒါန်းသည့်ရက် — " +
                  formatDate(lastDonation, "my")
                : "နောက်ဆုံး လှူဒါန်းသည့်ရက် — —",
            cooldownLine: availableAfter
                ? "နောက်တစ်ကြိမ် လှူဒါန်းနိုင်သည့်ရက် — " +
                  formatDate(availableAfter, "my")
                : "နောက်တစ်ကြိမ် လှူဒါန်းနိုင်သည့်ရက် — —",
            qrTitle: "သင့် QR ကုဒ်",
            qrCaption:
                "သွေးလှူဒါန်းမှုပြီးပါက အတည်ပြုနိုင်ရန် တောင်းခံသူအား ပြပေးပါ",
            codeLabel: "ကုဒ်ဖြင့် အတည်ပြုရန်",
            nudgeTitle: "သွေးလှူရှင် အချက်အလက် ဖြည့်ပါ",
            settingsHeader: "ဆက်တင်များ",
            availLabel: "သွေးလှူရန် အသင့်ရှိသည်",
            emergencyLabel:
                "သင့်နံပါတ်ကို အကူအညီ တောင်းခံသူများအား တိုက်ရိုက်ခေါ်ဆိုခွင့်ပြုမည်",
            emergencyHelp:
                "ဖွင့်ထားပါက — သွေးလိုအပ်သူများ သင့်ထံ တိုက်ရိုက် ဖုန်းဆက်နိုင်သည်။ ပိတ်ထားပါက — သင့်ထံ ခွင့်ပြုချက် အရင်တောင်းခံပြီးမှသာ ဖုန်းနံပတ်ကို ဖော်ပြပေးပါမည်။",
            languageLabel: "ဘာသာစကား",
            editLabel: "အချက်အလက် ပြင်ဆင်ရန်",
            editSub: "အမည်၊ မြို့နယ်၊ သွေးအုပ်စုနှင့် ဖုန်းနံပါတ်",
            logoutLabel: "ထွက်ရန်",
        },
        en: {
            donatedLine:
                donationCount > 0
                    ? "Donated " + count + " times"
                    : "there is no previous donations",
            lastLine: lastDonation
                ? "Last donation — " + formatDate(lastDonation, "en")
                : "Last donation — —",
            cooldownLine: availableAfter
                ? "Eligible to donate again — " +
                  formatDate(availableAfter, "en")
                : "Eligible to donate again — —",
            qrTitle: "Your QR Code",
            qrCaption: "Show this to the requester to confirm your donation",
            codeLabel: "Or confirm by code",
            nudgeTitle: "Complete your donor profile",
            settingsHeader: "Settings",
            availLabel: "Available to donate",
            emergencyLabel: "Let requesters call me directly in an emergency",
            emergencyHelp:
                "Your number is never shown in lists — this only allows it to be revealed in an emergency.",
            languageLabel: "Language",
            editLabel: "Edit profile",
            editSub: "Name, township, blood type and phone",
            logoutLabel: "Log out",
        },
    }[lang];

    const divider = (
        <div
            style={{
                height: 1,
                background: "var(--border-card)",
                margin: "0 16px",
            }}
        />
    );

    return (
        <div className="phone-entry-stage">
            <div className="phone-entry-card" style={{ height: "100dvh" }}>
                {/* Top bar */}
                <ScreenHeader
                    variant="brand"
                    align="left"
                    right={<NotificationBell onClick={onOpenNotifications} />}
                />

                {/* Scrollable content */}
                <div
                    className="bh-scroll"
                    style={{
                        flex: 1,
                        minHeight: 0,
                        overflowY: "auto",
                        padding: "8px 12px 24px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 20,
                    }}
                >
                    {/* Avatar + name + blood badge */}
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            textAlign: "center",
                        }}
                    >
                        <div
                            style={{
                                width: 84,
                                height: 84,
                                borderRadius: "999px",
                                background: "var(--color-primary-tint)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontFamily: "var(--font-burmese)",
                                fontSize: 34,
                                fontWeight: 600,
                                color: "var(--color-primary)",
                            }}
                        >
                            {initial}
                        </div>
                        <div
                            style={{
                                marginTop: 14,
                                fontFamily: langFont,
                                fontSize: 22,
                                fontWeight: 600,
                                lineHeight: 1.3,
                                color: "var(--text-primary)",
                            }}
                        >
                            {name}
                        </div>
                        <div style={{ marginTop: 10 }}>
                            <Badge>{bloodType}</Badge>
                        </div>
                    </div>

                    {/* Stats card */}
                    <Card
                        padding="md"
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 14,
                        }}
                    >
                        {/* Donation count row */}
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 14,
                            }}
                        >
                            <span
                                style={{
                                    flexShrink: 0,
                                    width: 40,
                                    height: 40,
                                    borderRadius: "999px",
                                    background: "var(--color-primary-tint)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
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
                                    style={{ display: "block", flexShrink: 0 }}
                                >
                                    <path d="M12 2.7s6 6 6 10.3a6 6 0 0 1-12 0c0-4.3 6-10.3 6-10.3z" />
                                </svg>
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div
                                    style={{
                                        fontFamily: langFont,
                                        fontSize: 16,
                                        fontWeight: 600,
                                        lineHeight: 1.4,
                                        color: "var(--text-primary)",
                                    }}
                                >
                                    {t.donatedLine}
                                </div>
                            </div>
                        </div>

                        {divider}

                        {/* Last donation row */}
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 14,
                            }}
                        >
                            <span
                                style={{
                                    flexShrink: 0,
                                    width: 40,
                                    height: 40,
                                    borderRadius: "999px",
                                    background: "var(--color-bg)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <svg
                                    width="20"
                                    height="20"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="var(--text-secondary)"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    style={{ display: "block", flexShrink: 0 }}
                                >
                                    <circle cx="12" cy="12" r="9" />
                                    <polyline points="12 7 12 12 15 14" />
                                </svg>
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div
                                    style={{
                                        fontFamily: langFont,
                                        fontSize: 16,
                                        fontWeight: 500,
                                        lineHeight: 1.4,
                                        color: "var(--text-primary)",
                                    }}
                                >
                                    {t.lastLine}
                                </div>
                            </div>
                        </div>

                        {/* Cooldown notice */}
                        {showCooldown && (
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 26,
                                    padding: "10px 12px",
                                    background: "var(--color-bg)",
                                    borderRadius: 10,
                                }}
                            >
                                <span
                                    style={{
                                        flexShrink: 0,
                                        marginTop: 1,
                                        display: "flex",
                                    }}
                                >
                                    <svg
                                        width="15"
                                        height="15"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="var(--text-hint)"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        style={{
                                            display: "block",
                                            flexShrink: 0,
                                        }}
                                    >
                                        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                                        <path d="M13.5 21a1.7 1.7 0 0 1-3 0" />
                                    </svg>
                                </span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div
                                        style={{
                                            fontFamily: langFont,
                                            fontSize: 13,
                                            lineHeight: 1.5,
                                            color: "var(--text-secondary)",
                                        }}
                                    >
                                        {t.cooldownLine}
                                    </div>
                                </div>
                            </div>
                        )}
                    </Card>

                    {/* Donor QR code card */}
                    {isDonor ? (
                        <Card
                            padding="lg"
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                textAlign: "center",
                            }}
                        >
                            <div
                                style={{
                                    fontFamily: langFont,
                                    fontSize: 18,
                                    fontWeight: 600,
                                    lineHeight: 1.4,
                                    color: "var(--text-primary)",
                                }}
                            >
                                {t.qrTitle}
                            </div>
                            <div
                                style={{
                                    fontFamily: langFont,
                                    fontSize: 13,
                                    lineHeight: 1.6,
                                    color: "var(--text-secondary)",
                                    marginTop: 6,
                                    maxWidth: 260,
                                }}
                            >
                                {t.qrCaption}
                            </div>

                            {/* QR code */}
                            <div
                                style={{
                                    width: 184,
                                    height: 184,
                                    marginTop: 18,
                                    padding: 12,
                                    background: "#fff",
                                    border: "1px solid var(--border-card)",
                                    borderRadius: 14,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <DonorQR code={donorCode} />
                            </div>

                            {/* 5-char code */}
                            <div
                                style={{
                                    width: "100%",
                                    marginTop: 18,
                                    paddingTop: 16,
                                    borderTop: "1px solid var(--border-card)",
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                }}
                            >
                                <div
                                    style={{
                                        fontFamily: langFont,
                                        fontSize: 12,
                                        fontWeight: 600,
                                        letterSpacing: ".04em",
                                        textTransform: "uppercase",
                                        color: "var(--text-hint)",
                                    }}
                                >
                                    {t.codeLabel}
                                </div>
                                <div
                                    style={{
                                        marginTop: 8,
                                        fontFamily:
                                            "ui-monospace, SFMono-Regular, Menlo, monospace",
                                        fontSize: 34,
                                        fontWeight: 600,
                                        letterSpacing: ".32em",
                                        color: "var(--text-primary)",
                                        paddingLeft: ".32em",
                                    }}
                                >
                                    {donorCode.toUpperCase()}
                                </div>
                            </div>
                        </Card>
                    ) : (
                        /* Not-a-donor nudge */
                        <button
                            type="button"
                            onClick={onRegisterDonor}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 14,
                                width: "100%",
                                textAlign: "left",
                                background: "var(--color-primary-tint)",
                                border: "none",
                                borderRadius: "var(--radius-card)",
                                padding: 16,
                                cursor: "pointer",
                            }}
                        >
                            <span
                                style={{
                                    flexShrink: 0,
                                    width: 44,
                                    height: 44,
                                    borderRadius: "999px",
                                    background: "#fff",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <svg
                                    width="22"
                                    height="22"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="var(--color-primary)"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    style={{ display: "block", flexShrink: 0 }}
                                >
                                    <path d="M12 2.7s6 6 6 10.3a6 6 0 0 1-12 0c0-4.3 6-10.3 6-10.3z" />
                                </svg>
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div
                                    style={{
                                        fontFamily: langFont,
                                        fontSize: 16,
                                        fontWeight: 600,
                                        lineHeight: 1.5,
                                        color: "var(--color-primary)",
                                    }}
                                >
                                    {t.nudgeTitle}
                                </div>
                            </div>
                            <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="var(--color-primary)"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                style={{ display: "block", flexShrink: 0 }}
                            >
                                <polyline points="9 18 15 12 9 6" />
                            </svg>
                        </button>
                    )}

                    {/* Settings */}
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 10,
                        }}
                    >
                        <div
                            style={{
                                fontFamily: langFont,
                                fontSize: 13,
                                fontWeight: 600,
                                letterSpacing: ".02em",
                                color: "var(--text-hint)",
                                padding: "0 4px",
                                textTransform: "uppercase",
                            }}
                        >
                            {t.settingsHeader}
                        </div>
                        <div
                            style={{
                                background: "var(--surface-card)",
                                border: "1px solid var(--border-card)",
                                borderRadius: "var(--radius-card)",
                                overflow: "hidden",
                            }}
                        >
                            {/* Available + Emergency toggles — only shown to users who completed donor setup */}
                            {isDonor && (
                                <>
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 16,
                                            padding: 16,
                                        }}
                                    >
                                        <span
                                            style={{
                                                flex: 1,
                                                minWidth: 0,
                                                fontFamily: langFont,
                                                fontSize: 16,
                                                lineHeight: 1.4,
                                                color: "var(--text-primary)",
                                            }}
                                        >
                                            {t.availLabel}
                                        </span>
                                        <Switch
                                            checked={available}
                                            onChange={onAvailableChange}
                                            ariaLabel={t.availLabel}
                                        />
                                    </div>
                                    {divider}
                                    <div style={{ padding: 16 }}>
                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "flex-start",
                                                gap: 16,
                                            }}
                                        >
                                            <span
                                                style={{
                                                    flex: 1,
                                                    minWidth: 0,
                                                    fontFamily: langFont,
                                                    fontSize: 16,
                                                    lineHeight: 1.45,
                                                    color: "var(--text-primary)",
                                                }}
                                            >
                                                {t.emergencyLabel}
                                            </span>
                                            <div
                                                style={{
                                                    flexShrink: 0,
                                                    marginTop: 1,
                                                }}
                                            >
                                                <Switch
                                                    checked={emergencyCallable}
                                                    onChange={onEmergencyChange}
                                                    ariaLabel={t.emergencyLabel}
                                                />
                                            </div>
                                        </div>
                                        <div
                                            style={{
                                                fontFamily: langFont,
                                                fontSize: 13,
                                                lineHeight: 1.6,
                                                color: "var(--text-secondary)",
                                                marginTop: 8,
                                            }}
                                        >
                                            {t.emergencyHelp}
                                        </div>
                                    </div>
                                    {divider}
                                </>
                            )}

                            {/* Language segmented control */}
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 16,
                                    padding: 16,
                                }}
                            >
                                <span
                                    style={{
                                        flex: 1,
                                        minWidth: 0,
                                        fontFamily: langFont,
                                        fontSize: 16,
                                        lineHeight: 1.4,
                                        color: "var(--text-primary)",
                                    }}
                                >
                                    {t.languageLabel}
                                </span>
                                <LanguageToggle
                                    lang={lang}
                                    onChange={onLangChange}
                                    track="bg"
                                />
                            </div>
                            {divider}

                            {/* Edit profile */}
                            <button
                                type="button"
                                onClick={onEditProfile}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 16,
                                    width: "100%",
                                    textAlign: "left",
                                    background: "none",
                                    border: "none",
                                    padding: 16,
                                    cursor: "pointer",
                                }}
                            >
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div
                                        style={{
                                            fontFamily: langFont,
                                            fontSize: 16,
                                            lineHeight: 1.4,
                                            color: "var(--text-primary)",
                                        }}
                                    >
                                        {t.editLabel}
                                    </div>
                                    <div
                                        style={{
                                            fontFamily: langFont,
                                            fontSize: 13,
                                            lineHeight: 1.4,
                                            color: "var(--text-secondary)",
                                            marginTop: 2,
                                        }}
                                    >
                                        {t.editSub}
                                    </div>
                                </div>
                                <svg
                                    width="20"
                                    height="20"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="var(--text-hint)"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    style={{ display: "block", flexShrink: 0 }}
                                >
                                    <polyline points="9 18 15 12 9 6" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Log out */}
                    <Button
                        tone="danger"
                        fullWidth
                        height={54}
                        onClick={onLogout}
                    >
                        {t.logoutLabel}
                    </Button>
                </div>

                {/* Bottom nav */}
                <BottomNav
                    active="profile"
                    lang={lang}
                    onNavigate={onNavigate}
                />
            </div>
        </div>
    );
}

export default Profile;
