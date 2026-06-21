import { useState, useEffect } from "react";
import { PhoneEntry } from "./screens/PhoneEntry";
import { OtpVerification } from "./screens/OtpVerification";
import { IntentChoice } from "./screens/IntentChoice";
import type { Intent } from "./screens/IntentChoice";
import { CreateRequest } from "./screens/CreateRequest";
import type { RequestDraft } from "./screens/CreateRequest";
import { DonorProfileSetup } from "./screens/DonorProfileSetup";
import type { DonorProfile } from "./screens/DonorProfileSetup";
import { Profile } from "./screens/Profile";
import { Leaderboard } from "./screens/Leaderboard";
import { DonorCongrats } from "./screens/DonorCongrats";
import { DonorThankYou } from "./screens/DonorThankYou";
import { Home } from "./screens/Home";
import { RequestLive } from "./screens/RequestLive";
import { AlertDialog } from "./components/AlertDialog";
import type { Tab } from "./components/BottomNav";
import { getSession } from "./auth";
import { supabase } from "./lib/supabase";
import type { BloodType } from "./blood";
import type { Lang } from "./i18n";

type Screen =
    | "phone"
    | "otp"
    | "intent"
    | "home"
    | "profile"
    | "leaderboard"
    | "create-request"
    | "donor-setup"
    | "donor-congrats"
    | "donor-thankyou"
    | "request-live";

/** Logged-in user state, hydrated from profiles + donors on session restore. */
interface UserState {
    name: string;
    bloodType: BloodType;
    available: boolean;
    showNumber: boolean;
    emergencyCallable: boolean;
    donationCount: number;
    lastDonation: string | null;
    donorSetupComplete: boolean;
    donorCode: string;
    supabaseId: string | null;
    /** Donor's last-known coarsened latitude (null until GPS granted on donor setup). */
    lat: number | null;
    /** Donor's last-known coarsened longitude (null until GPS granted on donor setup). */
    lng: number | null;
}

const DEFAULT_USER: UserState = {
    name: "You",
    bloodType: "O+",
    available: true,
    showNumber: false,
    emergencyCallable: false,
    donationCount: 0,
    lastDonation: null,
    donorSetupComplete: false,
    donorCode: "K7M2Q",
    supabaseId: null,
    lat: null,
    lng: null,
};

/** Format a national number for display under the +95 country code. */
function formatPhone(digits: string): string {
    return digits ? `+95 ${digits}` : "+95";
}

/**
 * Normalize a phone number to E.164 format for DB writes.
 * Strips non-digits and prepends the Myanmar +95 country code.
 */
function normalizePhone(digits: string): string {
    const clean = digits.replace(/\D/g, "");
    return `+95${clean}`;
}

function App() {
    const [lang, setLang] = useState<Lang>("my");
    const [screen, setScreen] = useState<Screen>("phone");
    const [phone, setPhone] = useState("");
    const [user, setUser] = useState<UserState>(DEFAULT_USER);
    const [requestDraft, setRequestDraft] = useState<RequestDraft | null>(null);
    const [sessionLoading, setSessionLoading] = useState(true);
    const [writeError, setWriteError] = useState<{
        title: string;
        message: string;
    } | null>(null);

    const writeErrorStrings = {
        my: {
            duplicateTitle: "တောင်းခံချက် ရှိပြီးသား",
            duplicateMsg:
                "သင့်တွင် တက်ကြွသော တောင်းခံချက် တစ်ခု ရှိပြီးဖြစ်သည်။ ၄င်းကို ပိတ်ပြီးမှ အသစ်တင်နိုင်ပါသည်။",
            genericTitle: "အမှားတစ်ခု ဖြစ်ပေါ်ခဲ့သည်",
            genericMsg: "ကြိုးစားမှု မအောင်မြင်ပါ။ ကျေးဇူးပြု၍ ထပ်ကြိုးစားပါ။",
            retry: "ထပ်ကြိုးစားရန်",
            dismiss: "ပိတ်ရန်",
        },
        en: {
            duplicateTitle: "Request already open",
            duplicateMsg:
                "You already have an active blood request. Close it before posting a new one.",
            genericTitle: "Something went wrong",
            genericMsg: "The action could not be completed. Please try again.",
            retry: "Retry",
            dismiss: "Dismiss",
        },
    };

    useEffect(() => {
        async function initAuth() {
            // Check for existing session FIRST — only sign in anonymously when there is none (D-03)
            const {
                data: { session },
            } = await supabase.auth.getSession();
            if (!session) {
                const { error } = await supabase.auth.signInAnonymously();
                if (error) {
                    console.error("Anonymous sign-in failed:", error.message);
                    setSessionLoading(false);
                    return;
                }
            }

            // Get the confirmed session (existing or just created)
            const result = await getSession();
            if (result.ok) {
                const { session: confirmedSession } = result;
                const uid = confirmedSession.user.id;

                // Always store the auth UID so handleSaveDonor / handlePosted can write even before
                // the profiles row exists (new users hit this path with no profile yet)
                setUser((u) => ({ ...u, supabaseId: uid }));

                // Load full profiles row (D-13)
                const { data: profile, error: profileErr } = await supabase
                    .from("profiles")
                    .select("*")
                    .eq("id", uid)
                    .maybeSingle();
                if (profileErr)
                    console.error("profile load error:", profileErr.message);

                if (profile) {
                    // Hydrate phone state — strip +95 prefix since phone state holds raw digits (WR-01)
                    if (profile.phone) {
                        setPhone(profile.phone.replace(/^\+95/, ""));
                    }

                    // Load donors row — may be null for pure requesters (D-13)
                    const { data: donor, error: donorErr } = await supabase
                        .from("donors")
                        .select("*")
                        .eq("profile_id", uid)
                        .maybeSingle();
                    if (donorErr)
                        console.error("donor load error:", donorErr.message);

                    // Load own active blood request — drives hasOpenRequest (D-14)
                    const { data: activeRequest, error: requestErr } =
                        await supabase
                            .from("blood_requests")
                            .select("*")
                            .eq("requester_id", uid)
                            .eq("status", "active")
                            .maybeSingle();
                    if (requestErr)
                        console.error(
                            "active request load error:",
                            requestErr.message,
                        );

                    setUser({
                        supabaseId: uid,
                        name: profile.name ?? "You",
                        bloodType: (donor?.blood_type as BloodType) ?? "O+",
                        available: donor?.is_available ?? true,
                        emergencyCallable: donor?.emergency_callable ?? false,
                        showNumber: donor?.emergency_callable ?? false,
                        donationCount: donor?.donation_count ?? 0,
                        lastDonation: donor?.last_donation_date ?? null,
                        donorSetupComplete: donor !== null,
                        donorCode: donor?.donor_code ?? "",
                        lat: donor?.lat ?? null,
                        lng: donor?.lng ?? null,
                    });

                    // Map active request to RequestDraft to drive hasOpenRequest (D-14, D-16)
                    setRequestDraft(
                        activeRequest
                            ? {
                                  bloodType:
                                      activeRequest.blood_type as BloodType,
                                  phone: activeRequest.contact_phone,
                                  address: activeRequest.current_address,
                                  units: activeRequest.units_needed,
                                  urgency: activeRequest.urgency as
                                      | "urgent"
                                      | "today",
                                  lat: activeRequest.lat ?? 0,
                                  lng: activeRequest.lng ?? 0,
                              }
                            : null,
                    );

                    setScreen("home");
                }
            }

            setSessionLoading(false);
        }
        void initAuth();
    }, []);

    if (sessionLoading) return null;

    const handleVerified = async () => {
        // Normalize to E.164 before querying — DB stores '+959XXXXXXXXX', not raw digits (CR-01)
        const e164 = normalizePhone(phone);

        // Look up the phone via a SECURITY DEFINER RPC. A plain SELECT is filtered by the
        // own_profile_select RLS policy (auth.uid() = id), which hides the row when logging in
        // from a different device with a different anonymous UID. The RPC bypasses that so the
        // same number is recognized as a returning user on every device.
        const { data: existingId } = await supabase.rpc("profile_id_by_phone", {
            p_phone: e164,
        });

        if (existingId) {
            // Returning user — sync supabaseId to the profile's owner UID so RLS passes on writes
            setUser((u) => ({ ...u, supabaseId: existingId }));
            setScreen("home");
        } else {
            // New user — create a minimal profile row immediately so blood_requests FK is satisfied
            // and handleSaveDonor / handlePosted can write in this session
            const uid = user.supabaseId;
            if (uid) {
                const { error } = await supabase.from("profiles").upsert(
                    {
                        id: uid,
                        phone: e164,
                        updated_at: new Date().toISOString(),
                    },
                    { onConflict: "id" },
                );
                if (error)
                    console.error(
                        "profile create on verify failed:",
                        error.message,
                    );
            }
            setScreen("intent");
        }
    };

    const handleChooseIntent = (intent: Intent) => {
        setScreen(intent === "need" ? "create-request" : "donor-setup");
    };

    const handlePosted = async (draft: RequestDraft) => {
        const uid = user.supabaseId;
        if (!uid) return; // should never happen post-auth

        const expiresAt = new Date(
            Date.now() + 24 * 60 * 60 * 1000,
        ).toISOString();
        const errStrings = writeErrorStrings[lang];

        // Bare .insert() without chaining .select() or .single() (Pitfall 1)
        const { error } = await supabase.from("blood_requests").insert({
            requester_id: uid,
            blood_type: draft.bloodType,
            current_address: draft.address,
            lat: draft.lat,
            lng: draft.lng,
            contact_phone: normalizePhone(draft.phone),
            units_needed: draft.units,
            urgency: draft.urgency,
            status: "active",
            expires_at: expiresAt,
        });

        if (error) {
            if (error.code === "23505") {
                // one_open_request_per_user unique-index violation backstop (D-17)
                setWriteError({
                    title: errStrings.duplicateTitle,
                    message: errStrings.duplicateMsg,
                });
            } else {
                // Generic write failure (D-18)
                setWriteError({
                    title: errStrings.genericTitle,
                    message: errStrings.genericMsg,
                });
            }
            return;
        }

        setRequestDraft(draft);
        setScreen("request-live");
    };

    const handleSaveDonor = async (profile: DonorProfile) => {
        const uid = user.supabaseId;
        if (!uid) return; // should never happen post-auth

        const errStrings = writeErrorStrings[lang];

        // Step 1: upsert profiles (identity row) keyed by id (D-15)
        const { error: profileErr } = await supabase.from("profiles").upsert(
            {
                id: uid,
                name: profile.name,
                phone: normalizePhone(profile.phone),
                language: lang,
                updated_at: new Date().toISOString(),
            },
            { onConflict: "id" },
        );

        if (profileErr) {
            console.error("profile upsert error:", profileErr.message);
            setWriteError({
                title: errStrings.genericTitle,
                message: errStrings.genericMsg,
            });
            return;
        }

        // Step 2: upsert donors row keyed by profile_id (D-15)
        // NEVER include donor_code — trigger assigns it on INSERT (Pitfall 3)
        const { error: donorErr } = await supabase.from("donors").upsert(
            {
                profile_id: uid,
                blood_type: profile.bloodType,
                emergency_callable: profile.showNumber,
                is_available: profile.available,
                lat: profile.lat,
                lng: profile.lng,
                location_updated_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            },
            { onConflict: "profile_id" },
        );

        if (donorErr) {
            console.error("donor upsert error:", donorErr.message);
            setWriteError({
                title: errStrings.genericTitle,
                message: errStrings.genericMsg,
            });
            return;
        }

        // Update local state with hydrated values + navigate
        setUser((u) => ({
            ...u,
            name: profile.name,
            bloodType: profile.bloodType,
            available: profile.available,
            emergencyCallable: profile.showNumber,
            showNumber: profile.showNumber,
            donorSetupComplete: true,
            lat: profile.lat,
            lng: profile.lng,
        }));
        setScreen("donor-thankyou");
    };

    const handleNavigate = (tab: Tab) => {
        if (tab === "home") setScreen("home");
        else if (tab === "profile") setScreen("profile");
        else if (tab === "leaderboard") setScreen("leaderboard");
    };

    const handleAvailableChange = async (v: boolean) => {
        setUser((u) => ({ ...u, available: v }));
        if (!user.supabaseId) return;
        const { error } = await supabase
            .from("donors")
            .update({ is_available: v, updated_at: new Date().toISOString() })
            .eq("profile_id", user.supabaseId);
        if (error) console.error("availability update failed:", error.message);
    };

    const handleEmergencyChange = async (v: boolean) => {
        setUser((u) => ({ ...u, emergencyCallable: v, showNumber: v }));
        if (!user.supabaseId) return;
        const { error } = await supabase
            .from("donors")
            .update({
                emergency_callable: v,
                updated_at: new Date().toISOString(),
            })
            .eq("profile_id", user.supabaseId);
        if (error)
            console.error("emergency callable update failed:", error.message);
    };

    const handleLogout = () => {
        // signOut errors are intentionally ignored — the local session is cleared regardless of
        // server response, so the user is effectively logged out from the app's perspective
        void supabase.auth.signOut();
        setUser(DEFAULT_USER);
        setPhone("");
        setScreen("phone");
    };

    if (screen === "otp") {
        return (
            <OtpVerification
                phoneDisplay={formatPhone(phone)}
                lang={lang}
                onLangChange={setLang}
                onBack={() => setScreen("phone")}
                onVerified={handleVerified}
            />
        );
    }

    if (screen === "intent") {
        return (
            <IntentChoice
                lang={lang}
                onLangChange={setLang}
                onChoose={handleChooseIntent}
            />
        );
    }

    if (screen === "create-request") {
        return (
            <CreateRequest
                lang={lang}
                onLangChange={setLang}
                onBack={() => setScreen("profile")}
                defaultPhone={phone}
                onPosted={handlePosted}
            />
        );
    }

    if (screen === "donor-setup") {
        return (
            <DonorProfileSetup
                lang={lang}
                onLangChange={setLang}
                onBack={() => setScreen("profile")}
                defaultPhone={phone}
                onSave={handleSaveDonor}
            />
        );
    }

    if (screen === "donor-thankyou") {
        return (
            <DonorThankYou
                lang={lang}
                bloodType={user.bloodType}
                onContinue={() => setScreen("profile")}
            />
        );
    }

    if (screen === "donor-congrats") {
        return (
            <DonorCongrats
                lang={lang}
                donationCount={user.donationCount}
                onDone={() => setScreen("profile")}
                onLeaderboard={() => setScreen("leaderboard")}
            />
        );
    }

    if (screen === "request-live") {
        return (
            <RequestLive
                lang={lang}
                bloodType={requestDraft?.bloodType}
                unitsNeeded={requestDraft?.units}
                onBack={() => setScreen("home")}
                onGoHome={() => {
                    setRequestDraft(null);
                    setScreen("home");
                }}
            />
        );
    }

    if (screen === "home") {
        return (
            <>
                <Home
                    lang={lang}
                    donorReady={user.donorSetupComplete}
                    available={user.available}
                    onAvailableChange={handleAvailableChange}
                    hasOpenRequest={requestDraft !== null}
                    onRequestBlood={() => setScreen("create-request")}
                    onViewRequest={() => setScreen("request-live")}
                    onFinishSetup={() => setScreen("donor-setup")}
                    onNavigate={handleNavigate}
                    donorLat={user.lat}
                    donorLng={user.lng}
                    currentUserId={user.supabaseId}
                    donorBloodType={user.bloodType}
                />
                {/* Write-error dialog for handlePosted and handleSaveDonor failures */}
                <AlertDialog
                    open={writeError !== null}
                    title={writeError?.title ?? ""}
                    message={writeError?.message ?? ""}
                    confirmLabel={writeErrorStrings[lang].retry}
                    cancelLabel={writeErrorStrings[lang].dismiss}
                    onConfirm={() => setWriteError(null)}
                    onCancel={() => setWriteError(null)}
                />
            </>
        );
    }

    if (screen === "profile") {
        return (
            <>
                <Profile
                    lang={lang}
                    onLangChange={setLang}
                    name={user.name}
                    bloodType={user.bloodType}
                    donationCount={user.donationCount}
                    lastDonation={user.lastDonation}
                    isDonor={user.donorSetupComplete}
                    donorCode={user.donorCode}
                    showCooldown={user.donationCount > 0}
                    available={user.available}
                    onAvailableChange={handleAvailableChange}
                    emergencyCallable={user.emergencyCallable}
                    onEmergencyChange={handleEmergencyChange}
                    onEditProfile={() => setScreen("donor-setup")}
                    onRegisterDonor={() => setScreen("donor-setup")}
                    onLogout={handleLogout}
                    onNavigate={handleNavigate}
                />
                {/* Write-error dialog also accessible from profile screen */}
                <AlertDialog
                    open={writeError !== null}
                    title={writeError?.title ?? ""}
                    message={writeError?.message ?? ""}
                    confirmLabel={writeErrorStrings[lang].retry}
                    cancelLabel={writeErrorStrings[lang].dismiss}
                    onConfirm={() => setWriteError(null)}
                    onCancel={() => setWriteError(null)}
                />
            </>
        );
    }

    if (screen === "leaderboard") {
        return (
            <Leaderboard
                lang={lang}
                onNavigate={handleNavigate}
                userName={user.name}
                userBloodType={user.bloodType}
            />
        );
    }

    return (
        <PhoneEntry
            lang={lang}
            onLangChange={setLang}
            onSend={(digits) => {
                setPhone(digits);
                setScreen("otp");
            }}
        />
    );
}

export default App;
