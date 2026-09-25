import type { CSSProperties } from "react";
import { useState } from "react";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { BloodTypeSelector } from "../components/BloodTypeSelector";
import { DateOfBirthPicker } from "../components/DateOfBirthPicker";
import { Switch } from "../components/Switch";
import { ScreenHeader } from "../components/ScreenHeader";
import { LanguageToggle } from "../components/LanguageToggle";
import { AlertDialog } from "../components/AlertDialog";
import { getCurrentPosition, coarsenCoordinates } from "../geolocation";
import { calculateAge, MIN_DONOR_AGE } from "../age";
import type { BloodType } from "../blood";
import type { Lang } from "../i18n";

/** The donor profile the user sets up. */
export interface DonorProfile {
    name: string;
    /** ISO `YYYY-MM-DD`. The form only submits a date that clears MIN_DONOR_AGE. */
    dateOfBirth: string;
    bloodType: BloodType;
    phone: string;
    showNumber: boolean;
    available: boolean;
    /** Coarsened GPS latitude captured on Save (after AlertDialog pre-permission flow). */
    lat: number;
    /** Coarsened GPS longitude captured on Save (after AlertDialog pre-permission flow). */
    lng: number;
}

interface DonorProfileSetupProps {
    lang: Lang;
    onLangChange: (lang: Lang) => void;
    onBack: () => void;
    /** Default contact number to prefill (the user's login phone). */
    defaultPhone?: string;
    /**
     * Persists the profile. Must resolve false when the write failed, so the form
     * can re-enable itself; on true the caller navigates away and this screen
     * unmounts with its saving overlay still up.
     */
    onSave: (profile: DonorProfile) => Promise<boolean>;
}

/**
 * 'requesting' = waiting on the browser geolocation prompt.
 * 'saving'     = coordinates in hand, the DB write is in flight.
 * Both keep the overlay up and the CTA disabled — collapsing them into one phase
 * is what let the user re-tap Save mid-write and fire a second save.
 */
type GeoPhase = "idle" | "prealert" | "requesting" | "saving" | "denied";

export function DonorProfileSetup({
    lang,
    onLangChange,
    onBack,
    defaultPhone = "",
    onSave,
}: DonorProfileSetupProps) {
    const [name, setName] = useState("");
    const [dateOfBirth, setDateOfBirth] = useState<string | null>(null);
    const [bloodType, setBloodType] = useState<BloodType | null>(null);
    const [phone, setPhone] = useState(defaultPhone);
    const [showNumber, setShowNumber] = useState(false);
    const [available, setAvailable] = useState(true);
    const [geoPhase, setGeoPhase] = useState<GeoPhase>("idle");

    /** Blocking phases: overlay is up and the CTA is disabled. */
    const busy = geoPhase === "requesting" || geoPhase === "saving";

    const isMy = lang === "my";
    const bodyFont = isMy ? "var(--font-burmese)" : "var(--font-sans)";
    const lh = isMy ? 1.75 : 1.5;
    // Age is only known once all three parts of the date are chosen.
    const age = dateOfBirth ? calculateAge(dateOfBirth) : null;
    const tooYoung = age !== null && age < MIN_DONOR_AGE;
    const saveDisabled =
        !name.trim() ||
        !dateOfBirth ||
        tooYoung ||
        !bloodType ||
        phone.replace(/\D/g, "").length === 0;

    const strings = {
        my: {
            navTitle: "အချက်အလက် ဖြည့်ရန်",
            subtitle:
                "အနီးနားတွင် သင့်သွေးအုပ်စုနှင့် တူညီသောသူများ အကူအညီ လိုအပ်လာသည့်အခါ သင့်အား အကြောင်းကြားနိုင်ရန်အတွက် ဖြစ်ပါသည်။",
            nameLabel: "သင့်အမည်",
            namePlaceholder: "ဥပမာ — မောင်မောင်",
            nameHint: "နာမည်အရင်းကို ရိုက်ထည့်ပေးစေလိုပါသည်။",
            dobLabel: "မွေးသက္ကရာဇ်",
            dobHint: "အသက် ၁၈ နှစ်ပြည့်ပြီးသူများသာ သွေးလှူနိုင်ပါသည်။",
            dobTooYoung:
                "အသက် ၁၈ နှစ် မပြည့်သေးပါ။ ပြည့်ပြီးမှ သွေးလှူရှင်အဖြစ် စာရင်းသွင်းနိုင်ပါသည်။",
            bloodTypeLabel: "သင့်သွေးအုပ်စု",
            phoneLabel: "ဆက်သွယ်ရန် ဖုန်းနံပါတ်",
            phoneHint:
                "အကူအညီလိုအပ်သူများသာ အကြောင်းကြားရန်အတွက် အသုံးပြုပါမည်။",
            showNumberLabel:
                "သင့်နံပါတ်ကို အကူအညီ တောင်းခံသူများအား တိုက်ရိုက်ခေါ်ဆိုခွင့်ပြုမည်",
            showNumberHint:
                "ဖွင့်ထားပါက — သွေးလိုအပ်သူများ သင့်ထံ တိုက်ရိုက် ဖုန်းဆက်နိုင်သည်။ ပိတ်ထားပါက — သင့်ထံ ခွင့်ပြုချက် အရင်တောင်းခံပြီးမှသာ ဖုန်းနံပတ်ကို ဖော်ပြပေးပါမည်။",
            availableLabel: "သွေးလှူရန် အသင့်ရှိသည်",
            availableHint:
                "လက်တလော သွေးမလှူနိုင်သည့်အခါ ဤခလုတ်ကို ပိတ်ထားနိုင်သည်။",
            cta: "သိမ်းဆည်း၍ ဆက်လုပ်ရန်",
            geoTitle: "တည်နေရာ ခွင့်ပြုချက် လိုအပ်ပါသည်",
            geoMsg: 'အနီးနားရှိ သွေးတောင်းခံမှုများ ပြသရန် သင့်တည်နေရာ လိုအပ်ပါသည်။ နောက်တွင် ဘရောက်ဇာက မေးပါက "Allow / ခွင့်ပြုသည်" ကို နှိပ်ပါ။',
            geoConfirm: "ဆက်လုပ်ရန်",
            geoCancel: "မလုပ်တော့ပါ",
            geoLoading: "သင့်တည်နေရာကို ရှာဖွေနေသည်...",
            saveLoading: "သင့်အချက်အလက်များကို သိမ်းဆည်းနေသည်...",
            deniedTitle: "တည်နေရာ ပိတ်ထားသည်",
            deniedMsg:
                "တည်နေရာ ခွင့်ပြုချက် မရှိဘဲ သင့်အချက်အလက်များကို သိမ်းဆည်း၍ မရပါ။ ဘရောက်ဇာ ဆက်တင်တွင် တည်နေရာကို ဖွင့်ပြီး ထပ်ကြိုးစားပါ။",
            deniedConfirm: "ရပါပြီ",
        },
        en: {
            navTitle: "Donor Profile",
            subtitle:
                "So we can alert you when someone nearby needs your blood type.",
            nameLabel: "Your name",
            namePlaceholder: "e.g. Aung Ko",
            nameHint: "This is what people you help will see.",
            dobLabel: "Date of birth",
            dobHint: "You need to be 18 or older to donate blood.",
            dobTooYoung:
                "You need to be at least 18 to register as a donor.",
            bloodTypeLabel: "Your blood type",
            phoneLabel: "Contact number",
            phoneHint: "Used to sign you in and send you alerts.",
            showNumberLabel: "Show my number to requesters",
            showNumberHint:
                "On — people who need blood can call you directly. Off — you get notified and choose whether to call.",
            availableLabel: "Available to donate",
            availableHint: "Turn this off when you can't donate.",
            cta: "Save & continue",
            geoTitle: "We need your location",
            geoMsg: 'To show you nearby blood requests, we need your location. When the browser asks next, tap "Allow".',
            geoConfirm: "Continue",
            geoCancel: "Not now",
            geoLoading: "Getting your location…",
            saveLoading: "Saving your profile…",
            deniedTitle: "Location is off",
            deniedMsg:
                "We can't save the profile without location permission. Enable location in your browser settings and try again.",
            deniedConfirm: "OK",
        },
    };
    const copy = strings[lang];

    /** Open the pre-permission AlertDialog. Actual GPS request happens after user confirms. */
    const handleSave = () => {
        if (saveDisabled) return;
        setGeoPhase("prealert");
    };

    /** Called when user confirms in the pre-permission dialog. Requests GPS then saves. */
    const requestLocationAndSave = async () => {
        setGeoPhase("requesting");
        const res = await getCurrentPosition();
        if (!res.ok || !bloodType || !dateOfBirth) {
            // GPS denied or unavailable — show denied dialog, do NOT call onSave (D-12)
            setGeoPhase("denied");
            return;
        }

        // Stay in a blocking phase for the whole write. Awaiting onSave is what
        // keeps the overlay up; returning to 'idle' before it resolved is what
        // made a successful save look like nothing had happened.
        setGeoPhase("saving");
        const { lat, lng } = coarsenCoordinates(res.lat, res.lng);

        // `Promise<boolean>` does not forbid rejection, and a rejection here would
        // strand the overlay on "saving" forever — no dialog, no enabled CTA, no way
        // out but a reload. Today handleSaveDonor catches everything, so this is a
        // guard against a future onSave, not live behaviour.
        let saved: boolean;
        try {
            saved = await onSave({
                name: name.trim(),
                dateOfBirth,
                bloodType,
                phone,
                showNumber,
                available,
                lat,
                lng,
            });
        } catch {
            saved = false;
        }

        // On success the caller navigates away and this screen unmounts, so the
        // overlay never flickers off. Only a failure hands control back.
        if (!saved) setGeoPhase("idle");
    };

    const fieldLabelStyle: CSSProperties = {
        margin: 0,
        fontFamily: bodyFont,
        fontSize: 16,
        fontWeight: 500,
        lineHeight: lh,
        color: "var(--text-primary)",
    };
    const toggleLabelStyle: CSSProperties = { ...fieldLabelStyle, flex: 1 };
    const hintStyle: CSSProperties = {
        margin: "6px 0 0",
        fontFamily: bodyFont,
        fontSize: 13,
        fontWeight: 400,
        lineHeight: lh,
        color: "var(--text-hint)",
    };
    /** Same hint slot, turned red when the donor is under the age minimum. */
    const errorHintStyle: CSSProperties = {
        ...hintStyle,
        color: "var(--color-primary)",
        fontWeight: 500,
    };

    return (
        <div className="phone-entry-stage">
            <div className="phone-entry-card" style={{ height: "100dvh" }}>
                {/* Nav bar */}
                <ScreenHeader
                    variant="nav"
                    onBack={onBack}
                    title={copy.navTitle}
                    right={
                        <LanguageToggle lang={lang} onChange={onLangChange} />
                    }
                    divider
                />

                {/* Scrollable form */}
                <div
                    style={{
                        flex: 1,
                        overflowY: "auto",
                        scrollbarWidth: "none",
                        padding: "20px 12px 0",
                    }}
                >
                    <p
                        style={{
                            margin: 0,
                            fontFamily: bodyFont,
                            fontSize: 16,
                            fontWeight: 400,
                            lineHeight: lh,
                            color: "var(--text-secondary)",
                        }}
                    >
                        {copy.subtitle}
                    </p>

                    {/* Name */}
                    <div style={{ marginTop: 24 }}>
                        <p style={fieldLabelStyle}>{copy.nameLabel}</p>
                        <div style={{ marginTop: 10 }}>
                            <Input
                                placeholder={copy.namePlaceholder}
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                style={{ width: "100%" }}
                            />
                        </div>
                        <p style={hintStyle}>{copy.nameHint}</p>
                    </div>

                    {/* Date of birth */}
                    <div style={{ marginTop: 24 }}>
                        <p style={fieldLabelStyle}>{copy.dobLabel}</p>
                        <div style={{ marginTop: 10 }}>
                            <DateOfBirthPicker
                                value={dateOfBirth}
                                onChange={setDateOfBirth}
                                lang={lang}
                            />
                        </div>
                        <p
                            style={tooYoung ? errorHintStyle : hintStyle}
                            role={tooYoung ? "alert" : undefined}
                        >
                            {tooYoung ? copy.dobTooYoung : copy.dobHint}
                        </p>
                    </div>

                    {/* Blood type */}
                    <div style={{ marginTop: 24 }}>
                        <p style={fieldLabelStyle}>{copy.bloodTypeLabel}</p>
                        <div style={{ marginTop: 10 }}>
                            <BloodTypeSelector
                                value={bloodType}
                                onChange={setBloodType}
                            />
                        </div>
                    </div>

                    {/* Contact number */}
                    <div style={{ marginTop: 24 }}>
                        <p style={fieldLabelStyle}>{copy.phoneLabel}</p>
                        <div style={{ marginTop: 10 }}>
                            <Input
                                prefix="+95"
                                type="tel"
                                inputMode="numeric"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                            />
                        </div>
                        <p style={hintStyle}>{copy.phoneHint}</p>
                    </div>

                    {/* Divider */}
                    <div
                        style={{
                            marginTop: 28,
                            height: 1,
                            background: "var(--border-card)",
                        }}
                    />

                    {/* Show number toggle */}
                    <div style={{ marginTop: 20 }}>
                        <div
                            style={{
                                display: "flex",
                                alignItems: "flex-start",
                                justifyContent: "space-between",
                                gap: 16,
                            }}
                        >
                            <p style={toggleLabelStyle}>
                                {copy.showNumberLabel}
                            </p>
                            <div style={{ flex: "none", marginTop: 2 }}>
                                <Switch
                                    checked={showNumber}
                                    onChange={setShowNumber}
                                    ariaLabel={copy.showNumberLabel}
                                />
                            </div>
                        </div>
                        <p style={hintStyle}>{copy.showNumberHint}</p>
                    </div>

                    {/* Available toggle */}
                    <div style={{ marginTop: 20 }}>
                        <div
                            style={{
                                display: "flex",
                                alignItems: "flex-start",
                                justifyContent: "space-between",
                                gap: 16,
                            }}
                        >
                            <p style={toggleLabelStyle}>
                                {copy.availableLabel}
                            </p>
                            <div style={{ flex: "none", marginTop: 2 }}>
                                <Switch
                                    checked={available}
                                    onChange={setAvailable}
                                    ariaLabel={copy.availableLabel}
                                />
                            </div>
                        </div>
                        <p style={hintStyle}>{copy.availableHint}</p>
                    </div>

                    <div style={{ height: 24 }} />
                </div>

                {/* Sticky footer */}
                <div
                    style={{
                        flex: "none",
                        padding: "12px 12px 28px",
                        background: "var(--color-bg)",
                        boxShadow: "0 -1px 0 var(--border-card)",
                    }}
                >
                    <Button
                        fullWidth
                        height={54}
                        disabled={saveDisabled || busy}
                        onClick={handleSave}
                    >
                        {copy.cta}
                    </Button>
                </div>

                {/* Loading overlay for the whole blocking stretch — GPS lookup then DB
            write. It has no button and covers the CTA, so neither phase can be
            double-tapped (preserves CR-03 intent) */}
                {busy && (
                    <div
                        role="status"
                        aria-live="polite"
                        style={{
                            position: "absolute",
                            inset: 0,
                            zIndex: 50,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 16,
                            padding: 24,
                            background: "rgba(26, 26, 26, 0.45)",
                        }}
                    >
                        <div className="bh-spinner" />
                        <p
                            style={{
                                margin: 0,
                                fontFamily: bodyFont,
                                fontSize: 16,
                                fontWeight: 500,
                                color: "#fff",
                                textAlign: "center",
                            }}
                        >
                            {geoPhase === "saving"
                                ? copy.saveLoading
                                : copy.geoLoading}
                        </p>
                    </div>
                )}

                {/* Pre-permission warning before the native location prompt */}
                {/* open only for 'prealert' — closes immediately when GPS request starts (CR-03) */}
                <AlertDialog
                    open={geoPhase === "prealert"}
                    bodyFont={bodyFont}
                    title={copy.geoTitle}
                    message={copy.geoMsg}
                    confirmLabel={copy.geoConfirm}
                    cancelLabel={copy.geoCancel}
                    onConfirm={requestLocationAndSave}
                    onCancel={() => setGeoPhase("idle")}
                />

                {/* Permission denied / unavailable */}
                <AlertDialog
                    open={geoPhase === "denied"}
                    bodyFont={bodyFont}
                    title={copy.deniedTitle}
                    message={copy.deniedMsg}
                    confirmLabel={copy.deniedConfirm}
                    onConfirm={() => setGeoPhase("idle")}
                    onCancel={() => setGeoPhase("idle")}
                />
            </div>
        </div>
    );
}

export default DonorProfileSetup;
