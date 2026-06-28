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
import { Notifications } from "./screens/Notifications";
import { AlertDialog } from "./components/AlertDialog";
import type { Tab } from "./components/BottomNav";
import { getSession } from "./auth";
import { supabase } from "./lib/supabase";
import { registerPushToken, pushSupported } from "./lib/push";
import { onMessage } from "firebase/messaging";
import { messaging } from "./lib/firebase";
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
    | "request-live"
    | "notifications";

/** Logged-in user state, hydrated from profiles + donors on session restore. */
interface UserState {
    name: string;
    bloodType: BloodType;
    available: boolean;
    showNumber: boolean;
    emergencyCallable: boolean;
    donationCount: number;
    lastDonation: string | null;
    availableAfter: string | null;
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
    availableAfter: null,
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

/** 4-hour window before expiry at which the extend banner appears (D-17). */
const EXTEND_WARN_MS = 4 * 60 * 60 * 1000;

interface FcmDonorAlert {
    requestId: string
    bloodType: string
    urgency: string
    address: string
}

interface FcmRequesterAlert {
    requestId: string
    responderName: string
    responderPhone: string
    responderBloodType: string
}

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
    /** The tab to return to when leaving the notifications screen. */
    const [notificationsReturn, setNotificationsReturn] = useState<Screen>("home");
    const [phone, setPhone] = useState("");
    const [user, setUser] = useState<UserState>(DEFAULT_USER);
    const [requestDraft, setRequestDraft] = useState<RequestDraft | null>(null);
    /** UUID of the requester's active blood_requests row — threaded into RequestLive for the RPC + realtime subscription. */
    const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
    const [sessionLoading, setSessionLoading] = useState(true);
    const [verifying, setVerifying] = useState(false);
    const [writeError, setWriteError] = useState<{
        title: string;
        message: string;
    } | null>(null);
    /** Set of request IDs the current donor has responded to (status='responding'). */
    const [respondedIds, setRespondedIds] = useState<Set<string>>(new Set());
    /** Whether the active request has already been extended once (D-19). Hydrated from DB row — never defaulted. */
    const [activeRequestExtended, setActiveRequestExtended] = useState(false);
    /** ISO expiry timestamp of the active request — for client-side extend banner computation (D-17). */
    const [activeRequestExpiresAt, setActiveRequestExpiresAt] = useState<string | null>(null);
    /** Units already collected on the active request — kept in App so RequestLive progress survives navigation. */
    const [activeRequestUnitsCollected, setActiveRequestUnitsCollected] = useState(0);
    /** Donor alert received via FCM notification tap — shows overlay modal on Home screen. */
    const [fcmDonorAlert, setFcmDonorAlert] = useState<FcmDonorAlert | null>(null);
    /** Requester alert received via FCM notification tap — shows overlay modal on RequestLive screen. */
    const [fcmRequesterAlert, setFcmRequesterAlert] = useState<FcmRequesterAlert | null>(null);
    /** Controls the pre-permission push notification dialog. */
    const [pushDialogOpen, setPushDialogOpen] = useState(false);
    const [pendingPushProfileId, setPendingPushProfileId] = useState<string | null>(null);

    // Hydrate full user state (profile + donor + active request) from the DB for a given uid.
    // Shared by initAuth (cold page load) and handleVerified (returning-user OTP login) so both
    // entry points populate lat/lng/bloodType — without this the Home feed's null-coord guard
    // short-circuits and the requests_within_radius RPC is never called. Returns true if a
    // profile row exists, or 'congrats' when an unseen donation is found (D-12 check-on-open).
    // NOTE: the donor/request reads are RLS-scoped to auth.uid() = owner,
    // so this fully hydrates only when the current session owns the profile (same-device case).
    const hydrateUserFromDb = useCallback(
        async (uid: string): Promise<boolean | 'congrats'> => {
            // Single edge-function call — all 5 queries run server-side in parallel (~0.5ms each).
            // The function derives uid from the caller's JWT; lastSeenAt controls the donations check.
            const lastSeenAt = localStorage.getItem("bloodhelp.lastSeenDonationAt");
            const { data, error } = await supabase.functions.invoke('hydrate-user', {
                body: { lastSeenAt },
            });

            if (error) {
                console.error('[hydrate-user] edge function error:', error.message);
                return false;
            }

            const { profile, donor, activeRequest, ownResponses, unseenDonation } = data as {
                profile: { id: string; phone: string | null; name: string | null } | null;
                donor: {
                    blood_type: string; is_available: boolean; emergency_callable: boolean;
                    donation_count: number; last_donation_date: string | null;
                    available_after: string | null;
                    donor_code: string; lat: number | null; lng: number | null;
                } | null;
                activeRequest: {
                    id: string; blood_type: string; contact_phone: string; current_address: string;
                    units_needed: number; urgency: string; lat: number | null; lng: number | null;
                    units_collected: number; extended: boolean; expires_at: string;
                } | null;
                ownResponses: { request_id: string }[];
                unseenDonation: { id: string; created_at: string } | null;
            };

            if (!profile) return false;

            // Hydrate phone state — strip +95 prefix since phone state holds raw digits (WR-01)
            if (profile.phone) {
                setPhone(profile.phone.replace(/^\+95/, ""));
            }

            setUser({
                supabaseId: uid,
                name: profile.name ?? "You",
                bloodType: (donor?.blood_type as BloodType) ?? "O+",
                available: donor?.is_available ?? true,
                emergencyCallable: donor?.emergency_callable ?? false,
                showNumber: donor?.emergency_callable ?? false,
                donationCount: donor?.donation_count ?? 0,
                lastDonation: donor?.last_donation_date ?? null,
                availableAfter: donor?.available_after ?? null,
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
            setActiveRequestId(activeRequest?.id ?? null);
            setActiveRequestUnitsCollected(activeRequest?.units_collected ?? 0);
            // Must not default extended to false or the extend banner re-shows after reload (Pitfall 5).
            setActiveRequestExtended(activeRequest?.extended ?? false);
            setActiveRequestExpiresAt(activeRequest?.expires_at ?? null);

            // Restore responded card state across reload (D-04)
            setRespondedIds(new Set(ownResponses.map((r) => r.request_id)));

            // D-12: unseen donation congrats — edge function only returns this when lastSeenAt was sent
            if (unseenDonation) {
                localStorage.setItem(
                    "bloodhelp.lastSeenDonationAt",
                    unseenDonation.created_at ?? new Date().toISOString(),
                );
                return "congrats";
            }

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

                // Full hydration; navigate to home only if a profile row exists (or donor-congrats on unseen donation).
                const hydrated = await hydrateUserFromDb(uid);
                if (hydrated === "congrats") {
                    setScreen("donor-congrats");
                } else if (hydrated) {
                    // Read FCM deep-link URL params injected by the service worker notificationclick handler
                    const urlParams = new URLSearchParams(window.location.search);
                    const fcmType = urlParams.get("fcm_type");
                    if (fcmType === "donor_alert") {
                        setFcmDonorAlert({
                            requestId: urlParams.get("request_id") ?? "",
                            bloodType: urlParams.get("blood_type") ?? "",
                            urgency: urlParams.get("urgency") ?? "",
                            address: urlParams.get("address") ?? "",
                        });
                        window.history.replaceState({}, "", "/");
                    } else if (fcmType === "requester_alert") {
                        setFcmRequesterAlert({
                            requestId: urlParams.get("request_id") ?? "",
                            responderName: urlParams.get("responder_name") ?? "",
                            responderPhone: urlParams.get("responder_phone") ?? "",
                            responderBloodType: urlParams.get("responder_blood_type") ?? "",
                        });
                        window.history.replaceState({}, "", "/");
                        setScreen("request-live");
                        setSessionLoading(false);
                        return;
                    }
                    setScreen("home");
                }
            }

            setSessionLoading(false);
        }
        void initAuth();
    }, [hydrateUserFromDb]);

    // Warm-start FCM path: service worker posts notification data directly to the running app
    // instead of calling client.navigate() (which requires a full page reload to trigger initAuth).
    // Cold-start path (app was closed) still uses URL params read inside initAuth.
    useEffect(() => {
        if (!navigator.serviceWorker) return;

        function handleSWMessage(event: MessageEvent) {
            if ((event.data as { type?: string } | null)?.type !== "fcm_notification_click") return;
            const d = (event.data as { data?: Record<string, string> }).data ?? {};

            if (d.fcm_type === "donor_alert") {
                setFcmDonorAlert({
                    requestId: d.request_id ?? "",
                    bloodType: d.blood_type ?? "",
                    urgency: d.urgency ?? "",
                    address: d.address ?? "",
                });
                setScreen("home");
            } else if (d.fcm_type === "requester_alert") {
                setFcmRequesterAlert({
                    requestId: d.request_id ?? "",
                    responderName: d.responder_name ?? "",
                    responderPhone: d.responder_phone ?? "",
                    responderBloodType: d.responder_blood_type ?? "",
                });
                setScreen("request-live");
            }
        }

        navigator.serviceWorker.addEventListener("message", handleSWMessage);
        return () => {
            navigator.serviceWorker.removeEventListener("message", handleSWMessage);
        };
    }, []);

    // Foreground FCM path: when the app tab is visible, Firebase routes the push to onMessage
    // instead of the SW's onBackgroundMessage — so no native notification appears unless we
    // handle it here. We show the in-app modal directly (better UX than a notification tap).
    useEffect(() => {
        const unsub = onMessage(messaging, (payload) => {
            const d = (payload.data ?? {}) as Record<string, string>;
            if (d.fcm_type === "donor_alert") {
                setFcmDonorAlert({
                    requestId: d.request_id ?? "",
                    bloodType: d.blood_type ?? "",
                    urgency: d.urgency ?? "",
                    address: d.address ?? "",
                });
                setScreen("home");
            } else if (d.fcm_type === "requester_alert") {
                setFcmRequesterAlert({
                    requestId: d.request_id ?? "",
                    responderName: d.responder_name ?? "",
                    responderPhone: d.responder_phone ?? "",
                    responderBloodType: d.responder_blood_type ?? "",
                });
                setScreen("request-live");
            }
        });
        return unsub;
    }, []);

    // Re-register the FCM push token whenever the service worker updates and claims the page.
    // Firebase may generate a new token when the controlling SW changes — without this, the
    // stale token stays in device_tokens and messages are silently dropped.
    useEffect(() => {
        if (!navigator.serviceWorker) return;
        function handleControllerChange() {
            if (user.supabaseId) void registerPushToken(user.supabaseId);
        }
        navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
        return () => {
            navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
        };
    }, [user.supabaseId]);

    // D-11: App-wide donations Realtime subscription — fires DonorCongrats takeover on any screen
    // when a new donation row arrives for the current donor. Mirrors the RequestLive rr:${requestId}
    // channel pattern but scoped to the donor's uid and owned in App.tsx (global-state owner).
    useEffect(() => {
        const uid = user.supabaseId;
        if (!uid) return;

        const channel = supabase
            .channel(`donations:${uid}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "donations",
                    filter: `donor_id=eq.${uid}`,
                },
                async (payload) => {
                    // Mark this donation as seen so check-on-open (D-12) skips it on next load.
                    localStorage.setItem(
                        "bloodhelp.lastSeenDonationAt",
                        (payload.new as { created_at?: string }).created_at ?? new Date().toISOString(),
                    );
                    // Refetch donor row to get accurate donation_count, last_donation_date,
                    // and the newly-written available_after (payload doesn't carry donor fields).
                    const { data: donor } = await supabase
                        .from("donors")
                        .select("donation_count, last_donation_date, available_after")
                        .eq("profile_id", uid)
                        .maybeSingle();
                    setUser((u) => ({
                        ...u,
                        donationCount: donor?.donation_count ?? u.donationCount + 1,
                        lastDonation: donor?.last_donation_date ?? u.lastDonation,
                        availableAfter: donor?.available_after ?? u.availableAfter,
                    }));
                    // Congrats takeover — interrupts whatever screen the donor is on (D-11).
                    setScreen("donor-congrats");
                },
            )
            .subscribe();

        return () => {
            void supabase.removeChannel(channel);
        };
    }, [user.supabaseId]);

    if (sessionLoading) return null;

    const handleVerified = async () => {
        setVerifying(true);
        try {
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

        // Returning user has a profile row → hydrate + home (or congrats on unseen donation, D-12).
        // New user → create the minimal profile row → intent choice.
        const hydrated = await hydrateUserFromDb(uid);
        if (hydrated === "congrats") {
            setScreen("donor-congrats");
        } else if (hydrated) {
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
        } finally {
            setVerifying(false);
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
        setActiveRequestExpiresAt(expiresAt);
        setActiveRequestUnitsCollected(0);

        // Notify nearby compatible donors via FCM (fire-and-forget — failure does not block UX)
        if (newRow?.id) {
            const notifyPayload = {
                requestId: newRow.id,
                bloodType: draft.bloodType,
                lat: draft.lat,
                lng: draft.lng,
                urgency: draft.urgency,
                address: draft.address,
            };
            console.log('[FCM] invoking notify-donors →', notifyPayload);
            void supabase.functions.invoke("notify-donors", {
                body: notifyPayload,
            }).then(({ data, error }) => {
                if (error) console.warn('[FCM] notify-donors error:', error.message);
                else console.log('[FCM] notify-donors result:', data);
            });
        }

        // Prompt for push permission so requester gets alerted on donor responses
        maybeAskPush(uid);

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
        } else {
            // Successful new response — Edge Function handles "first-only" check before sending FCM
            console.log('[FCM] invoking notify-requester → requestId:', reqId, 'responderId:', uid);
            void supabase.functions.invoke("notify-requester", {
                body: { requestId: reqId, responderId: uid },
            }).then(({ data, error: fnErr }) => {
                if (fnErr) console.warn('[FCM] notify-requester error:', fnErr.message);
                else console.log('[FCM] notify-requester result:', data);
            });
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

        // Read back the DB-assigned donor_code — the trigger sets it on INSERT so the
        // in-memory state must come from the DB, not a local guess.
        const { data: savedDonor } = await supabase
            .from("donors")
            .select("donor_code")
            .eq("profile_id", uid)
            .maybeSingle();

        // Update local state with hydrated values + navigate
        setUser((u) => ({
            ...u,
            name: profile.name,
            bloodType: profile.bloodType,
            available: profile.available,
            emergencyCallable: profile.showNumber,
            showNumber: profile.showNumber,
            donorSetupComplete: true,
            donorCode: savedDonor?.donor_code ?? u.donorCode,
            lat: profile.lat,
            lng: profile.lng,
        }));
        // The Donor Thank You screen now owns the push opt-in (tap-to-enable),
        // so we no longer pre-prompt here — avoids double-prompting the donor.
        setScreen("donor-thankyou");
    };

    const handleNavigate = (tab: Tab) => {
        if (tab === "home") setScreen("home");
        else if (tab === "profile") setScreen("profile");
        else if (tab === "leaderboard") setScreen("leaderboard");
    };

    /** Open the notifications screen, remembering the current tab to return to. */
    const handleOpenNotifications = () => {
        setNotificationsReturn(screen);
        setScreen("notifications");
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

    /** Show push permission pre-dialog if permission not yet granted; silently re-register if already granted. */
    const maybeAskPush = (profileId: string) => {
        if (!pushSupported()) return;
        if (Notification.permission === "granted") {
            void registerPushToken(profileId);
            return;
        }
        if (Notification.permission === "default") {
            setPendingPushProfileId(profileId);
            setPushDialogOpen(true);
        }
    };

    /** Reset all active-request slices to their empty defaults. Called after any close path. */
    const clearActiveRequest = () => {
        setRequestDraft(null);
        setActiveRequestId(null);
        setActiveRequestExtended(false);
        setActiveRequestExpiresAt(null);
        setActiveRequestUnitsCollected(0);
    };

    /**
     * Writes the D-01-mapped status + closed_at for the manual close paths (LIFE-01).
     * 'outside' → status='fulfilled' (requester got blood by other means).
     * 'canceled' → status='cancelled' (request no longer needed).
     * Owner-scoped to prevent writing another user's row.
     */
    const handleResolveClosed = async (reason: "outside" | "canceled"): Promise<boolean> => {
        const uid = user.supabaseId;
        if (!uid || !activeRequestId) return false;
        const errStrings = WRITE_ERROR_STRINGS[lang];
        // D-01 status map: outside→fulfilled, canceled→cancelled
        const status = reason === "canceled" ? "cancelled" : "fulfilled";

        const { error } = await supabase
            .from("blood_requests")
            .update({ status, closed_at: new Date().toISOString() })
            .eq("id", activeRequestId)
            .eq("requester_id", uid);

        if (error) {
            setWriteError({ title: errStrings.genericTitle, message: errStrings.genericMsg });
            return false;
        }

        // Clear local request state on success; navigation back to Home driven by RequestLive's onGoHome.
        clearActiveRequest();
        return true;
    };

    /**
     * Extends the active request by +12h, once only (D-18/D-19).
     * Optimistically updates extend state + expiry timestamp, then writes to DB.
     * Rolls back on error and surfaces the AlertDialog.
     */
    const handleExtend = async () => {
        const uid = user.supabaseId;
        if (!uid || !activeRequestId || !activeRequestExpiresAt) return;
        const errStrings = WRITE_ERROR_STRINGS[lang];

        const newExpiry = new Date(
            new Date(activeRequestExpiresAt).getTime() + 12 * 60 * 60 * 1000,
        ).toISOString();

        // Optimistic: hide banner immediately (D-18)
        setActiveRequestExtended(true);
        setActiveRequestExpiresAt(newExpiry);

        // Direct owner UPDATE — verified sufficient in 09-01 (no column restriction on UPDATE policy)
        const { error } = await supabase
            .from("blood_requests")
            .update({ expires_at: newExpiry, extended: true })
            .eq("id", activeRequestId)
            .eq("requester_id", uid);

        if (error) {
            // Roll back optimistic update on failure
            setActiveRequestExtended(false);
            setActiveRequestExpiresAt(activeRequestExpiresAt);
            setWriteError({ title: errStrings.genericTitle, message: errStrings.genericMsg });
        }
    };

    // D-17: client-side expiring-soon computation — show extend banner when within 4h of expiry,
    // status is active (requestDraft !== null), and the request has not yet been extended (D-19 once-only).
    const showExtendBanner = (() => {
        if (!activeRequestExpiresAt || activeRequestExtended || requestDraft === null) return false;
        const msLeft = new Date(activeRequestExpiresAt).getTime() - Date.now();
        return msLeft > 0 && msLeft < EXTEND_WARN_MS;
    })();

    const handleLogout = () => {
        // signOut errors are intentionally ignored — the local session is cleared regardless of
        // server response, so the user is effectively logged out from the app's perspective
        void supabase.auth.signOut();
        setUser(DEFAULT_USER);
        setPhone("");
        clearActiveRequest();
        setRespondedIds(new Set()); // clear responded card state so the next user on a shared device does not inherit it (privacy)
        // D-12/T-09-03-04: clear the unseen-donation marker so a shared device does not leak one user's congrats to the next.
        localStorage.removeItem("bloodhelp.lastSeenDonationAt");
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
                verifying={verifying}
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
                onBack={() => setScreen("intent")}
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
                onBack={() => setScreen("intent")}
                defaultPhone={phone}
                onSave={handleSaveDonor}
            />
        );
    }

    if (screen === "donor-thankyou") {
        return (
            <DonorThankYou
                lang={lang}
                onLangChange={setLang}
                bloodType={user.bloodType}
                supabaseId={user.supabaseId}
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
            <>
                <RequestLive
                    lang={lang}
                    bloodType={requestDraft?.bloodType}
                    unitsNeeded={requestDraft?.units}
                    unitsCollected={activeRequestUnitsCollected}
                    requestId={activeRequestId}
                    currentUserId={user.supabaseId}
                    lat={requestDraft?.lat}
                    lng={requestDraft?.lng}
                    onResolveClosed={handleResolveClosed}
                    onUnitConfirmed={(n) => setActiveRequestUnitsCollected(n)}
                    showExtendBanner={showExtendBanner}
                    onExtend={handleExtend}
                    onBack={() => setScreen("home")}
                    onGoHome={() => {
                        clearActiveRequest();
                        setScreen("home");
                    }}
                    fcmRequesterAlert={fcmRequesterAlert}
                    onDismissFcmRequesterAlert={() => setFcmRequesterAlert(null)}
                />
                {/* Push notification pre-permission dialog */}
                <AlertDialog
                    open={pushDialogOpen}
                    title={lang === "my" ? "သတိပေးချက် ခွင့်ပြုမည်လား?" : "Enable notifications?"}
                    message={lang === "my"
                        ? "သွေးလှူရှင်များ တုံ့ပြန်မှုများကို ချက်ချင်း သိနိုင်ရန် push notification ခွင့်ပြုပါ။"
                        : "Allow push notifications to get instant alerts when donors respond."}
                    confirmLabel={lang === "my" ? "ခွင့်ပြုမည်" : "Allow"}
                    cancelLabel={lang === "my" ? "နောက်မှ" : "Not now"}
                    onConfirm={() => {
                        setPushDialogOpen(false);
                        if (pendingPushProfileId) void registerPushToken(pendingPushProfileId);
                    }}
                    onCancel={() => setPushDialogOpen(false)}
                />
            </>
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
                    onOpenNotifications={handleOpenNotifications}
                    donorLat={user.lat}
                    donorLng={user.lng}
                    currentUserId={user.supabaseId}
                    donorBloodType={user.bloodType}
                    respondedIds={respondedIds}
                    onRespond={handleRespond}
                    showExtendBanner={showExtendBanner}
                    onExtend={handleExtend}
                    fcmDonorAlert={fcmDonorAlert}
                    onDismissFcmDonorAlert={() => setFcmDonorAlert(null)}
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
                {/* Push notification pre-permission dialog */}
                <AlertDialog
                    open={pushDialogOpen}
                    title={lang === "my" ? "သတိပေးချက် ခွင့်ပြုမည်လား?" : "Enable notifications?"}
                    message={lang === "my"
                        ? "သွေးလှူရှင်များ တုံ့ပြန်မှုများနှင့် အနီးနားရှိ တောင်းခံချက်များကို ချက်ချင်း သိနိုင်ရန် push notification ခွင့်ပြုပါ။"
                        : "Allow push notifications to get instant alerts when donors respond or blood is needed nearby."}
                    confirmLabel={lang === "my" ? "ခွင့်ပြုမည်" : "Allow"}
                    cancelLabel={lang === "my" ? "နောက်မှ" : "Not now"}
                    onConfirm={() => {
                        setPushDialogOpen(false);
                        if (pendingPushProfileId) void registerPushToken(pendingPushProfileId);
                    }}
                    onCancel={() => setPushDialogOpen(false)}
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
                    availableAfter={user.availableAfter}
                    isDonor={user.donorSetupComplete}
                    donorCode={user.donorCode}
                    showCooldown={user.availableAfter !== null}
                    available={user.available}
                    onAvailableChange={handleAvailableChange}
                    emergencyCallable={user.emergencyCallable}
                    onEmergencyChange={handleEmergencyChange}
                    onEditProfile={() => setScreen("donor-setup")}
                    onRegisterDonor={() => setScreen("donor-setup")}
                    onLogout={handleLogout}
                    onNavigate={handleNavigate}
                    onOpenNotifications={handleOpenNotifications}
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
                currentUserId={user.supabaseId}
                onOpenNotifications={handleOpenNotifications}
            />
        );
    }

    if (screen === "notifications") {
        return (
            <Notifications
                lang={lang}
                onBack={() => setScreen(notificationsReturn)}
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
