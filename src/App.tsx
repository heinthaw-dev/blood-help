import { useState, useEffect, useCallback } from "react";
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

/** Format raw digit string for display in the OTP header under the +95 country code. */
function formatDialDisplay(digits: string): string {
    return digits ? `+95 ${digits}` : "+95";
}

/** Bilingual strings for write-error dialogs (duplicate request, generic failure). */
const WRITE_ERROR_STRINGS = {
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

/**
 * Normalize a phone number to E.164 format for DB writes.
 * Strips non-digits and prepends the Myanmar +95 country code.
 */
function normalizePhone(digits: string): string {
    const clean = digits.replace(/\D/g, "");
    return `+95${clean}`;
}

/**
 * Deterministic synthetic email for a phone number. The same phone always maps
 * to the same Supabase account → the same auth.uid() on every device/session,
 * which is what makes RLS (auth.uid() = owner) work for returning users.
 */
function phoneToEmail(e164: string): string {
    return `${e164.replace(/\D/g, "")}@bloodhelp.local`;
}

/**
 * Deterministic password derived from the phone via SHA-256 (Web Crypto, needs
 * a secure context — provided by the HTTPS dev server). Reproducible client-side
 * so the same phone re-derives the same credentials on any device. NOTE: this is
 * prototype-grade identity (anyone knowing the scheme + phone could log in) and
 * will be replaced by real server-verified OTP in a later auth-hardening phase.
 */
async function derivePassword(e164: string): Promise<string> {
    const data = new TextEncoder().encode(`bloodhelp-auth-v1:${e164}`);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

function App() {
    const [lang, setLang] = useState<Lang>("my");
    const [screen, setScreen] = useState<Screen>("phone");
    const [phone, setPhone] = useState("");
    const [user, setUser] = useState<UserState>(DEFAULT_USER);
    const [requestDraft, setRequestDraft] = useState<RequestDraft | null>(null);
    /** UUID of the requester's active blood_requests row — threaded into RequestLive for the RPC + realtime subscription. */
    const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
    const [sessionLoading, setSessionLoading] = useState(true);
    const [writeError, setWriteError] = useState<{
        title: string;
        message: string;
    } | null>(null);
    /** Set of request IDs the current donor has responded to (status='responding'). */
    const [respondedIds, setRespondedIds] = useState<Set<string>>(new Set());

    // Hydrate full user state (profile + donor + active request) from the DB for a given uid.
    // Shared by initAuth (cold page load) and handleVerified (returning-user OTP login) so both
    // entry points populate lat/lng/bloodType — without this the Home feed's null-coord guard
    // short-circuits and the requests_within_radius RPC is never called. Returns true if a
    // profile row exists. NOTE: the donor/request reads are RLS-scoped to auth.uid() = owner,
    // so this fully hydrates only when the current session owns the profile (same-device case).
    const hydrateUserFromDb = useCallback(
        async (uid: string): Promise<boolean> => {
            const { data: profile, error: profileErr } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", uid)
                .maybeSingle();
            if (profileErr)
                console.error("profile load error:", profileErr.message);
            if (!profile) return false;

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
            if (donorErr) console.error("donor load error:", donorErr.message);

            // Load own active blood request — drives hasOpenRequest (D-14)
            const { data: activeRequest, error: requestErr } = await supabase
                .from("blood_requests")
                .select("*")
                .eq("requester_id", uid)
                .eq("status", "active")
                .maybeSingle();
            if (requestErr)
                console.error("active request load error:", requestErr.message);

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
                          bloodType: activeRequest.blood_type as BloodType,
                          phone: activeRequest.contact_phone,
                          address: activeRequest.current_address,
                          units: activeRequest.units_needed,
                          urgency: activeRequest.urgency as "urgent" | "today",
                          lat: activeRequest.lat ?? 0,
                          lng: activeRequest.lng ?? 0,
                      }
                    : null,
            );
            // Thread the active request UUID (activeRequestId) into RequestLive for the RPC + realtime subscription (D-14).
            setActiveRequestId(activeRequest?.id ?? null);

            // Restore responded state across reload (D-04): fetch own request_responses rows
            // so cards that the donor has already responded to start in the responded state.
            const { data: ownResponses } = await supabase
                .from("request_responses")
                .select("request_id")
                .eq("donor_id", uid)
                .eq("status", "responding");
            setRespondedIds(
                new Set((ownResponses ?? []).map((r) => r.request_id)),
            );

            return true;
        },
        [],
    );

    useEffect(() => {
        async function initAuth() {
            // Restore a persisted phone-keyed session if one exists (no anonymous sign-in —
            // a session is only created after the user logs in via handleVerified).
            const result = await getSession();
            if (result.ok) {
                const uid = result.session.user.id;

                // Store the auth UID so handleSaveDonor / handlePosted can write
                setUser((u) => ({ ...u, supabaseId: uid }));

                // Full hydration; navigate to home only if a profile row exists
                const hydrated = await hydrateUserFromDb(uid);
                if (hydrated) setScreen("home");
            }

            setSessionLoading(false);
        }
        void initAuth();
    }, [hydrateUserFromDb]);

    if (sessionLoading) return null;

    const handleVerified = async () => {
        const e164 = normalizePhone(phone);
        const email = phoneToEmail(e164);
        const password = await derivePassword(e164);
        const errStrings = WRITE_ERROR_STRINGS[lang];

        // Establish a STABLE phone-keyed session: sign in if the account exists, else sign up.
        // Either way the same phone yields the same auth.uid() on every device, so RLS
        // (auth.uid() = owner) lets the user read/write their own rows anywhere.
        let uid: string | null = null;
        const signIn = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        if (signIn.data.user) {
            uid = signIn.data.user.id;
        } else {
            const signUp = await supabase.auth.signUp({ email, password });
            if (signUp.error || !signUp.data.user) {
                console.error(
                    "phone auth failed:",
                    signUp.error?.message ?? signIn.error?.message,
                );
                setWriteError({
                    title: errStrings.genericTitle,
                    message: errStrings.genericMsg,
                });
                return;
            }
            uid = signUp.data.user.id;
        }

        setUser((u) => ({ ...u, supabaseId: uid }));

        // Returning user has a profile row → hydrate + home. New user → create the minimal
        // profile row (satisfies blood_requests FK + lets writes through) → intent choice.
        const hydrated = await hydrateUserFromDb(uid);
        if (hydrated) {
            setScreen("home");
        } else {
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
        const errStrings = WRITE_ERROR_STRINGS[lang];

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

        // Read-back the new request id and set activeRequestId (separate from the bare insert —
        // convention is bare .insert() without chaining .select(); the id is recovered via an
        // owner-scoped read after the write).
        const { data: newRow } = await supabase
            .from("blood_requests")
            .select("id")
            .eq("requester_id", uid)
            .eq("status", "active")
            .maybeSingle();
        setActiveRequestId(newRow?.id ?? null);

        setScreen("request-live");
    };

    /**
     * Donor taps "I'll help" on a feed card. Optimistically marks the request as
     * responded (D-03), then inserts a request_responses row. On error:
     * - 23505 (duplicate) → silent no-op; keep the responded state (D-04 backstop).
     * - Any other error → roll back the optimistic flip and surface the AlertDialog (D-18).
     */
    const handleRespond = async (reqId: string) => {
        const uid = user.supabaseId;
        if (!uid) return;

        // Optimistic flip (D-03)
        setRespondedIds((s) => new Set(s).add(reqId));

        const errStrings = WRITE_ERROR_STRINGS[lang];
        const { error } = await supabase.from("request_responses").insert({
            request_id: reqId,
            donor_id: uid,
            // status omits → defaults to 'responding'
        });

        if (error) {
            if (error.code === "23505") {
                // Already responded — duplicate is the expected no-op (D-04 backstop).
                // Keep the optimistic responded state; do NOT roll back; do NOT show AlertDialog.
            } else {
                // Real failure (network/RLS) → roll back + generic error dialog (D-03/D-18)
                setRespondedIds((s) => {
                    const next = new Set(s);
                    next.delete(reqId);
                    return next;
                });
                setWriteError({
                    title: errStrings.genericTitle,
                    message: errStrings.genericMsg,
                });
            }
        }
    };

    const handleSaveDonor = async (profile: DonorProfile) => {
        const uid = user.supabaseId;
        if (!uid) return; // should never happen post-auth

        const errStrings = WRITE_ERROR_STRINGS[lang];

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
        setRequestDraft(null);
        setActiveRequestId(null); // clear activeRequestId on logout
        setRespondedIds(new Set()); // clear responded card state so the next user on a shared device does not inherit it (privacy)
        setScreen("phone");
    };

    if (screen === "otp") {
        return (
            <OtpVerification
                phoneDisplay={formatDialDisplay(phone)}
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
                requestId={activeRequestId}
                currentUserId={user.supabaseId}
                lat={requestDraft?.lat}
                lng={requestDraft?.lng}
                onBack={() => setScreen("home")}
                onGoHome={() => {
                    setRequestDraft(null);
                    setActiveRequestId(null);
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
                    respondedIds={respondedIds}
                    onRespond={handleRespond}
                />
                {/* Write-error dialog for handlePosted and handleSaveDonor failures */}
                <AlertDialog
                    open={writeError !== null}
                    title={writeError?.title ?? ""}
                    message={writeError?.message ?? ""}
                    confirmLabel={WRITE_ERROR_STRINGS[lang].retry}
                    cancelLabel={WRITE_ERROR_STRINGS[lang].dismiss}
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
                    confirmLabel={WRITE_ERROR_STRINGS[lang].retry}
                    cancelLabel={WRITE_ERROR_STRINGS[lang].dismiss}
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
