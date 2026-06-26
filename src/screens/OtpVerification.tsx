import { useEffect, useRef, useState } from "react";
import { Button } from "../components/Button";
import { ScreenHeader } from "../components/ScreenHeader";
import { LanguageToggle } from "../components/LanguageToggle";
import type { Lang } from "../i18n";

const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;
/** Dummy flow: the "SMS" code auto-fills this many ms after the screen opens. */
const AUTOFILL_MS = 2000;

interface OtpVerificationProps {
    /** Phone number to show in the subtitle, formatted for display (e.g. "+95 9 7XX XXX XXX"). */
    phoneDisplay: string;
    lang: Lang;
    onLangChange: (lang: Lang) => void;
    onBack: () => void;
    /** Called with the verified 6-digit code once the user taps Verify. */
    onVerified: (code: string) => void;
    /** While true, the button shows a spinner and is disabled — set by App while handleVerified runs. */
    verifying?: boolean;
}

function randomOtp(): string {
    let s = "";
    for (let i = 0; i < OTP_LENGTH; i++) s += Math.floor(Math.random() * 10);
    return s;
}

/**
 * OTP Verification screen — port of OTP Verification.dc.html.
 * Dummy flow: a random 6-digit code auto-fills 3s after the screen opens
 * (standing in for a real SMS). Verify accepts whatever is entered — no real
 * server check. 6 auto-advancing boxes, 30s resend countdown.
 */
export function OtpVerification({
    phoneDisplay,
    lang,
    onLangChange,
    onBack,
    onVerified,
    verifying = false,
}: OtpVerificationProps) {
    const [code, setCode] = useState("");
    const [error, setError] = useState(false);
    const [countdown, setCountdown] = useState(RESEND_SECONDS);

    const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

    const isMy = lang === "my";
    const bodyFont = isMy ? "var(--font-burmese)" : "var(--font-sans)";
    const lh = isMy ? 1.75 : 1.5;
    const canResend = countdown === 0;
    const verifyDisabled = code.length < OTP_LENGTH;
    const isCodeEmpty = code === "";

    // Resend countdown.
    useEffect(() => {
        if (countdown === 0) return;
        const t = setInterval(
            () => setCountdown((c) => (c <= 1 ? 0 : c - 1)),
            1000,
        );
        return () => clearInterval(t);
    }, [countdown]);

    // Dummy SMS: auto-fill a random code 3s after the boxes are empty — on first
    // open and again after Resend clears them. Skips while the user is typing.
    useEffect(() => {
        if (!isCodeEmpty) return;
        const t = setTimeout(() => {
            setCode(randomOtp());
            setError(false);
            inputRefs.current[OTP_LENGTH - 1]?.focus();
        }, AUTOFILL_MS);
        return () => clearTimeout(t);
    }, [isCodeEmpty]);

    const strings = {
        my: {
            title: "ကုဒ် ထည့်ပါ",
            subtitle:
                phoneDisplay + " သို့ ဂဏန်း ၆ လုံး ကုဒ်ကို ပို့လိုက်ပါပြီ။ ",
            change: "ပြောင်းရန်",
            resendWaiting:
                "ကုဒ် မရဘူးလား? " + countdown + "s နောက် ပြန်ပို့နိုင်သည်",
            resendPrefix: "ကုဒ် မရဘူးလား? ",
            resendLink: "ကုဒ် ပြန်ပို့ရန်",
            cta: "အတည်ပြုရန်",
            errorMsg: "ကုဒ် မှားနေပါသည်။ ထပ်မံ ကြိုးစားပါ။",
        },
        en: {
            title: "Enter the code",
            subtitle: "We sent a 6-digit code to " + phoneDisplay + ". ",
            change: "Change",
            resendWaiting: "Didn't get it? Resend in " + countdown + "s.",
            resendPrefix: "Didn't get it? ",
            resendLink: "Resend code",
            cta: "Verify",
            errorMsg: "That code didn't match. Try again.",
        },
    };
    const copy = strings[lang];

    const handleChange = (i: number, raw: string) => {
        const digit = raw.replace(/\D/g, "").slice(-1);
        const arr = code.padEnd(OTP_LENGTH, " ").split("");
        arr[i] = digit || " ";
        const joined = arr.join("").replace(/ /g, "");
        setCode(joined.slice(0, OTP_LENGTH));
        setError(false);
        if (digit && i < OTP_LENGTH - 1) inputRefs.current[i + 1]?.focus();
    };

    const handleKeyDown = (i: number, key: string) => {
        if (key === "Backspace" && !code[i] && i > 0)
            inputRefs.current[i - 1]?.focus();
    };

    const handleResend = () => {
        setCode("");
        setError(false);
        setCountdown(RESEND_SECONDS);
        inputRefs.current[0]?.focus();
    };

    const handleVerify = () => {
        if (code.length === OTP_LENGTH) onVerified(code);
    };

    return (
        <div className="phone-entry-stage">
            <div className="phone-entry-card">
                {/* Top bar: back arrow + language toggle */}
                <ScreenHeader
                    variant="nav"
                    onBack={onBack}
                    right={<LanguageToggle lang={lang} onChange={onLangChange} />}
                />

                {/* Content */}
                <div
                    style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        padding: "28px 24px",
                    }}
                >
                    <h1
                        style={{
                            margin: 0,
                            fontFamily: bodyFont,
                            fontSize: 26,
                            fontWeight: 600,
                            lineHeight: isMy ? 1.55 : 1.3,
                            color: "var(--text-primary)",
                            letterSpacing: isMy ? "normal" : "-0.01em",
                        }}
                    >
                        {copy.title}
                    </h1>
                    <p
                        style={{
                            margin: "12px 0 0",
                            fontFamily: bodyFont,
                            fontSize: 15,
                            fontWeight: 400,
                            lineHeight: lh,
                            color: "var(--text-secondary)",
                        }}
                    >
                        {copy.subtitle}
                        <button
                            type="button"
                            onClick={onBack}
                            style={{
                                background: "none",
                                border: "none",
                                padding: 0,
                                cursor: "pointer",
                                fontFamily: bodyFont,
                                fontSize: 15,
                                fontWeight: 500,
                                color: "var(--color-primary)",
                            }}
                        >
                            {copy.change}
                        </button>
                    </p>

                    {/* OTP boxes */}
                    <div style={{ marginTop: 36 }}>
                        <div style={{ display: "flex", gap: 10 }}>
                            {Array.from({ length: OTP_LENGTH }, (_, i) => {
                                // Border tracks whether the code has arrived:
                                // empty box → muted grey, filled → primary red.
                                const filled = !!code[i];
                                const borderColor = filled
                                    ? "var(--color-primary)"
                                    : "var(--ink-300)";
                                return (
                                    <input
                                        key={i}
                                        ref={(el) => {
                                            inputRefs.current[i] = el;
                                        }}
                                        inputMode="numeric"
                                        maxLength={1}
                                        autoFocus={i === 0}
                                        value={code[i] || ""}
                                        onChange={(e) =>
                                            handleChange(i, e.target.value)
                                        }
                                        onKeyDown={(e) =>
                                            handleKeyDown(i, e.key)
                                        }
                                        style={{
                                            flexGrow: 1,
                                            flexShrink: 1,
                                            flexBasis: 0,
                                            width: "100%",
                                            minWidth: 0,
                                            height: 64,
                                            textAlign: "center",
                                            fontFamily: "var(--font-sans)",
                                            fontSize: 26,
                                            fontWeight: 600,
                                            color: error
                                                ? "var(--color-primary)"
                                                : "var(--text-primary)",
                                            background: error
                                                ? "var(--color-primary-tint)"
                                                : "var(--surface-card)",
                                            border: `1.5px solid ${borderColor}`,
                                            borderRadius: "var(--radius-input)",
                                            outline: "none",
                                            transition:
                                                "border-color 120ms ease, background 120ms ease",
                                            boxSizing: "border-box",
                                        }}
                                    />
                                );
                            })}
                        </div>
                    </div>

                    {/* Error message */}
                    {error && (
                        <p
                            style={{
                                margin: "14px 0 0",
                                fontFamily: bodyFont,
                                fontSize: 14,
                                fontWeight: 500,
                                lineHeight: lh,
                                color: "var(--color-primary)",
                            }}
                        >
                            {copy.errorMsg}
                        </p>
                    )}

                    {/* Resend */}
                    {!canResend ? (
                        <p
                            style={{
                                margin: "20px 0 0",
                                fontFamily: bodyFont,
                                fontSize: 15,
                                fontWeight: 400,
                                lineHeight: lh,
                                color: "var(--text-secondary)",
                            }}
                        >
                            {copy.resendWaiting}
                        </p>
                    ) : (
                        <p
                            style={{
                                margin: "20px 0 0",
                                fontFamily: bodyFont,
                                fontSize: 15,
                                fontWeight: 400,
                                lineHeight: lh,
                                color: "var(--text-secondary)",
                            }}
                        >
                            {copy.resendPrefix}
                            <button
                                type="button"
                                onClick={handleResend}
                                style={{
                                    background: "none",
                                    border: "none",
                                    padding: 0,
                                    cursor: "pointer",
                                    fontFamily: bodyFont,
                                    fontSize: 15,
                                    fontWeight: 500,
                                    color: "var(--color-primary)",
                                }}
                            >
                                {copy.resendLink}
                            </button>
                        </p>
                    )}

                    {/* Verify button */}
                    <div style={{ marginTop: 32 }}>
                        <Button
                            fullWidth
                            height={54}
                            disabled={verifyDisabled || verifying}
                            onClick={handleVerify}
                        >
                            {verifying ? (
                                <span style={{
                                    display: 'inline-block',
                                    width: 20,
                                    height: 20,
                                    borderRadius: '50%',
                                    border: '2.5px solid rgba(255,255,255,0.35)',
                                    borderTopColor: '#fff',
                                    animation: 'bh-spin 0.8s linear infinite',
                                }} />
                            ) : copy.cta}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default OtpVerification;
