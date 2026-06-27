import { useState, useRef, useEffect } from "react";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { CallButton } from "../components/CallButton";
import { Card } from "../components/Card";
import { ScreenHeader } from "../components/ScreenHeader";
import { AlertDialog } from "../components/AlertDialog";
import type { Lang } from "../i18n";
import { formatNumber } from "../i18n";
import { supabase } from "../lib/supabase";
import type { BloodType } from "../blood";
import { COMPATIBLE_REQUEST_TYPES } from "../blood";
import { formatDistanceLabel, formatPhoneIntl } from "../format";
import { useZxing } from "react-zxing";

// ---- types ----

type Sheet = "resolve" | "code" | null;
type ClosedReason = "fulfilled" | "outside" | "canceled";

interface ToastMsg {
    my: string;
    en: string;
}

/** Row returned by the responders_for_request owner-scoped RPC (D-06). */
interface ResponderRow {
    donor_id: string;
    name: string;
    phone: string;
    blood_type: string;
    dist_meters: number | null;
    created_at: string;
}

/** Row returned by the callable_donors_for_request owner-scoped RPC. */
interface CallableDonorRow {
    donor_id: string;
    name: string;
    phone: string;
    blood_type: string;
    dist_meters: number | null;
}

// ---- helpers ----

function toMyanmarDigits(n: number): string {
    return String(n).replace(/[0-9]/g, (d) => "၀၁၂၃၄၅၆၇၈၉"[+d]);
}

/** Great-circle distance in metres between two lat/lng points (Haversine). */
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}

/** Map-pin glyph shown before a donor's distance. Inherits color from parent. */
function DistanceIcon() {
    return (
        <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ display: "block", flexShrink: 0 }}
        >
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z" />
            <circle cx="12" cy="10" r="3" />
        </svg>
    );
}

/** Phone-handset glyph shown before a donor's contact number. Inherits color from parent. */
function PhoneIcon() {
    return (
        <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ display: "block", flexShrink: 0 }}
        >
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />
        </svg>
    );
}

/** Bilingual write-error strings for the AlertDialog (mirrors App.tsx WRITE_ERROR_STRINGS shape). */
const WRITE_ERROR_STRINGS = {
    my: {
        genericTitle: "အမှားတစ်ခု ဖြစ်ပေါ်ခဲ့သည်",
        genericMsg: "ကြိုးစားမှု မအောင်မြင်ပါ။ ကျေးဇူးပြု၍ ထပ်ကြိုးစားပါ။",
        retry: "ထပ်ကြိုးစားရန်",
        dismiss: "ပိတ်ရန်",
    },
    en: {
        genericTitle: "Something went wrong",
        genericMsg: "The action could not be completed. Please try again.",
        retry: "Retry",
        dismiss: "Dismiss",
    },
};

// ---- props ----

export interface RequestLiveProps {
    lang: Lang;
    bloodType?: string;
    township?: string;
    alerting?: boolean;
    alertedCount?: number;
    unitsNeeded?: number;
    unitsCollected?: number;
    /** UUID of the active blood_requests row — used for RPC fetch + realtime subscription. */
    requestId?: string | null;
    /** Supabase user ID of the requester — used to gate the realtime effect (Pitfall 2). */
    currentUserId?: string | null;
    /** Request latitude — used for the truthful compatible-donors count (D-09). */
    lat?: number | null;
    /** Request longitude — used for the truthful compatible-donors count (D-09). */
    lng?: number | null;
    /** Called when the user resolves the request via outside or cancel paths (LIFE-01). App.tsx writes status + closed_at. Returns true on success; false on write error (caller does not close UI on false). */
    onResolveClosed: (reason: "outside" | "canceled") => Promise<boolean>;
    /** Called after each successful donation confirm so App.tsx can persist the count across navigation. */
    onUnitConfirmed?: (n: number) => void;
    /** Whether to show the expiring-soon extend banner (D-17). Supplied by App.tsx in 09-03. */
    showExtendBanner?: boolean;
    /** Called when the user taps "Extend +12h" (D-18). Supplied by App.tsx in 09-03. */
    onExtend?: () => void;
    /** FCM requester alert to show as an overlay modal when app opens via notification tap. */
    fcmRequesterAlert?: {
        requestId: string;
        responderName: string;
        responderPhone: string;
        responderBloodType: string;
    } | null;
    /** Clears the FCM requester alert (after dismiss). */
    onDismissFcmRequesterAlert?: () => void;

    onBack: () => void;
    onGoHome: () => void;
}

/**
 * RequestLive — live blood request session screen.
 * Shows real responders fetched via the owner-scoped responders_for_request RPC,
 * updated live through a Supabase Postgres Changes subscription (D-11/D-12).
 * Confirms donations via the confirm_donation SECURITY DEFINER RPC (D-05/D-10).
 * Port of Request Live v3.dc.html — real data wired in Phase 08-03; confirm + QR wired in Phase 09-02.
 */
export function RequestLive({
    lang,
    bloodType = "B+",
    township = "ရန်ကုန် ဆေးရုံကြီး",
    alerting = false,
    alertedCount = 0,
    unitsNeeded = 2,
    unitsCollected: initCollected = 0,
    requestId,
    currentUserId,
    lat,
    lng,
    onResolveClosed,
    onUnitConfirmed,
    showExtendBanner,
    onExtend,
    fcmRequesterAlert = null,
    onDismissFcmRequesterAlert,
    onBack,
    onGoHome,
}: RequestLiveProps) {
    const [sheet, setSheet] = useState<Sheet>(null);
    const [closed, setClosed] = useState<ClosedReason | null>(null);
    const [toast, setToast] = useState<ToastMsg | null>(null);
    const [code, setCode] = useState("");
    const [collected, setCollected] = useState(initCollected);
    // Sync from parent when App.tsx hydrates the real DB value after the component has mounted
    // (e.g., navigating away and back resets initCollected to the current App.tsx state).
    useEffect(() => {
        setCollected(initCollected);
    }, [initCollected]);
    /** Write-error dialog state — shown on confirm_donation transport failures. */
    const [writeError, setWriteError] = useState<{
        title: string;
        message: string;
    } | null>(null);
    /** Camera permission pre-warning AlertDialog — shown before opening the code/QR sheet. */
    const [cameraWarningOpen, setCameraWarningOpen] = useState(false);
    /** Real responders from the owner-scoped RPC, updated on each realtime INSERT. */
    const [responders, setResponders] = useState<ResponderRow[]>([]);
    /** Emergency-callable donors fetched once on mount via the callable_donors_for_request RPC. */
    const [callableDonors, setCallableDonors] = useState<CallableDonorRow[]>(
        [],
    );
    /** Truthful count of compatible donors within radius who can see the request (D-09). */
    const [compatibleCount, setCompatibleCount] =
        useState<number>(alertedCount);
    /** Distance in metres from the FCM responder to this request — computed client-side. */
    const [fcmDistance, setFcmDistance] = useState<number | null>(null);
    const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const errStrings = WRITE_ERROR_STRINGS[lang];

    const showToast = (my: string, en: string) => {
        if (toastTimer.current) clearTimeout(toastTimer.current);
        setToast({ my, en });
        toastTimer.current = setTimeout(() => setToast(null), 3600);
    };

    // ---- useZxing QR scanner hook (D-08) ----
    //
    // Configured with formats: ['qr_code'] so only QR codes are decoded.
    // On a valid 5-char Base32 decode, populates the code state so the confirm button enables.
    // onError logs without crashing (camera denied / WASM failure).
    // NOTE: react-zxing loads zxing_reader.wasm from jsDelivr CDN by default.
    // For production PWA (offline use), pass a self-hosted wasmUrl — tracked as a follow-up.
    const { ref: zxingRef } = useZxing({
        formats: ["qr_code"],
        // Only run the camera while the QR sheet is open — releases camera on close and avoids
        // iOS Safari's requirement that getUserMedia is triggered close to a user gesture.
        paused: sheet !== "code",
        onDecodeResult(result) {
            const raw = result.rawValue.trim().toUpperCase();
            if (/^[A-Z2-7]{5}$/.test(raw)) {
                setCode(raw);
            }
        },
        onError(err) {
            console.warn("QR scan error:", err);
        },
    });

    // ---- Realtime subscription + initial RPC fetch (D-11/D-12) ----
    //
    // Pattern 7 from 08-RESEARCH.md:
    // - Gate on BOTH requestId AND currentUserId (Pitfall 2 cold-start)
    // - Refetch the WHOLE responder list via the RPC on each INSERT — NEVER apply the
    //   payload row directly to state (the payload lacks name/phone/distance; refetch self-heals
    //   after reconnect per D-11)
    // - Use stable channel name rr:${requestId} to prevent duplicate channels (Pitfall 5)
    // - removeChannel in cleanup to tear down the socket subscription (T-08-12)
    // - Do NOT call supabase.realtime.setAuth() — auto-wired by supabase-js on SIGNED_IN
    useEffect(() => {
        if (!requestId || !currentUserId) return; // Pitfall 2: gate on confirmed session
        let cancelled = false;

        async function refetchResponders() {
            const { data, error } = await supabase.rpc(
                "responders_for_request",
                {
                    p_request_id: requestId as string,
                },
            );
            if (error || cancelled) return;
            setResponders((data as unknown as ResponderRow[]) ?? []);
        }

        // Initial fetch — also covers "refetch on (re)subscribe" (D-11)
        void refetchResponders();

        // Subscribe to INSERT events filtered to this request only (D-12)
        const channel = supabase
            .channel(`rr:${requestId}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "request_responses",
                    filter: `request_id=eq.${requestId}`,
                },
                () => {
                    if (cancelled) return;
                    // D-11: refetch whole list — never apply payload row (lacks name/phone/distance)
                    void refetchResponders();
                    // D-13: gentle arrival cue for the waiting requester
                    showToast(
                        "သွေးလှူရှင်တစ်ဦး တုံ့ပြန်ပါပြီ",
                        "A donor responded",
                    );
                },
            )
            .subscribe();

        return () => {
            cancelled = true;
            void supabase.removeChannel(channel); // T-08-12: tear down on unmount
        };
    }, [requestId, currentUserId]);

    // ---- Emergency-callable donors fetch (fetch-once on mount) ----
    //
    // Gate on BOTH requestId AND currentUserId (Pitfall 2 cold-start).
    // Fetch-once — no realtime subscription needed for this scope (donors who opted in
    // were already callable before the request; the list is stable on the timescale of
    // a single request-live session).
    // Owner-scoped RPC: a non-owner gets zero rows, no existence disclosure (T-VXW-01).
    useEffect(() => {
        if (!requestId || !currentUserId) return; // Pitfall 2: gate on confirmed session
        let cancelled = false;

        async function fetchCallableDonors() {
            console.log(
                "[callable_donors] calling RPC with requestId:",
                requestId,
                "currentUserId:",
                currentUserId,
            );
            const { data, error } = await supabase.rpc(
                "callable_donors_for_request",
                {
                    p_request_id: requestId as string,
                },
            );
            if (error) {
                console.error(
                    "[callable_donors] RPC error:",
                    error.code,
                    error.message,
                    error.details,
                    error.hint,
                );
                return;
            }
            if (cancelled) return;
            console.log("[callable_donors] result:", data?.length, "rows");
            setCallableDonors(data ?? []);
        }

        void fetchCallableDonors();
        return () => {
            cancelled = true;
        };
    }, [requestId, currentUserId]);

    // ---- Truthful "can see your request" count (D-09) ----
    //
    // Fetch donors_within_radius and filter by directional blood compatibility
    // (which donor types can donate INTO the requested bloodType). Uses the
    // existing COMPATIBLE_REQUEST_TYPES inverse: a donor type d can serve
    // bloodType b if COMPATIBLE_REQUEST_TYPES[d].includes(b).
    useEffect(() => {
        if (lat == null || lng == null || !bloodType) return;
        let cancelled = false;

        async function fetchCompatibleCount() {
            const { data } = await supabase.rpc("donors_within_radius", {
                lat: lat as number,
                lng: lng as number,
                radius_km: 10,
            });
            if (cancelled || !data) return;
            const count = data.filter((d) =>
                COMPATIBLE_REQUEST_TYPES[d.blood_type as BloodType]?.includes(
                    bloodType as BloodType,
                ),
            ).length;
            setCompatibleCount(count);
        }

        void fetchCompatibleCount();
        return () => {
            cancelled = true;
        };
    }, [lat, lng, bloodType]);

    // ---- FCM responder distance (client-side Haversine) ----
    //
    // The FCM payload doesn't include the donor's coordinates (FCM is ~4 KB max),
    // so we fetch the donor's lat/lng from the donors table and compute distance
    // against the requester's known coordinates. Same approach as IncomingRequestAlert.
    useEffect(() => {
        if (!fcmRequesterAlert || !requestId || lat == null || lng == null) return;
        let cancelled = false;

        async function computeDistance() {
            // The donor's profile_id is the requester_alert's requestId-based lookup won't
            // have the donor's coords — use the request_responses join to find the donor_id,
            // then fetch lat/lng from donors.
            const { data: resp } = await supabase
                .from("request_responses")
                .select("donor_id")
                .eq("request_id", fcmRequesterAlert!.requestId)
                .eq("status", "responding")
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();
            if (cancelled || !resp) return;

            const { data: donor } = await supabase
                .from("donors")
                .select("lat, lng")
                .eq("profile_id", resp.donor_id)
                .maybeSingle();
            if (cancelled || !donor || donor.lat == null || donor.lng == null)
                return;

            setFcmDistance(
                haversineMeters(lat as number, lng as number, donor.lat, donor.lng),
            );
        }

        void computeDistance();
        return () => {
            cancelled = true;
        };
    }, [fcmRequesterAlert, requestId, lat, lng]);

    // ---- Real confirm_donation RPC call (D-05/D-10) ----
    //
    // Replaces the dummy local-state increment. Calls the SECURITY DEFINER RPC which:
    //   - verifies auth.uid() owns the request
    //   - looks up the donor by donor_code
    //   - checks the donor is a responding participant (anti-fraud D-04)
    //   - checks for duplicate confirm
    //   - atomically inserts donations row + increments donor + increments request
    //   - auto-fulfills if units_collected >= units_needed
    //
    // D-06 error granularity:
    //   'invalid_code'    → generic toast (covers unknown code + non-participant)
    //   'already_confirmed' → specific duplicate toast
    //   transport error  → AlertDialog write-error
    const handleConfirmInApp = async () => {
        if (!requestId || !confirmReady) return;

        const { data, error } = await supabase.rpc("confirm_donation", {
            p_request_id: requestId,
            p_donor_code: code.trim().toUpperCase(),
            p_via: "manual",
        });

        if (error || !data) {
            setWriteError({
                title: errStrings.genericTitle,
                message: errStrings.genericMsg,
            });
            return;
        }

        const result = data as {
            error?: string;
            units_collected?: number;
            fulfilled?: boolean;
        };

        if (result.error === "invalid_code") {
            // D-06: generic message for unknown code + not-a-participant (T-09-02-02: no info disclosure)
            showToast("ကုဒ် မမှန်ကန်ပါ", "Invalid or unrecognized code");
            return;
        }
        if (result.error === "already_confirmed") {
            // D-06: specific message only for the already-known-valid duplicate case
            showToast(
                "ဤသွေးလှူရှင်ကို အတည်ပြုပြီးဖြစ်သည်",
                "This donor is already confirmed",
            );
            return;
        }

        const next = result.units_collected ?? collected + 1;
        setCode("");
        setCollected(next);
        onUnitConfirmed?.(next);

        if (result.fulfilled) {
            setClosed("fulfilled");
            setSheet(null);
        } else {
            setSheet(null);
            showToast(
                toMyanmarDigits(next) +
                    " / " +
                    toMyanmarDigits(unitsNeeded) +
                    " အိတ် ရရှိပြီး — ကျန်အတွက် ဆက်ရှာနေပါမည်",
                next +
                    " / " +
                    unitsNeeded +
                    " units — still searching for the rest.",
            );
        }
    };

    const handleCodeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        setCode(
            e.target.value
                .toUpperCase()
                .replace(/[^A-Z2-7]/g, "")
                .slice(0, 5),
        );
    };

    const confirmReady = code.trim().length === 5;
    const alertingDone = !alerting;
    const showProgress = unitsNeeded > 1;

    // De-duplicate callable donors against Will-Help responders:
    // a donor who already tapped "I'll help" is in responders and must NOT appear in both sections.
    const visibleCallable = callableDonors.filter(
        (d) => !responders.find((r) => r.donor_id === d.donor_id),
    );

    // D-09: truthful transparency line — "[X] nearby compatible donors can see your request"
    // Never claims donors were "alerted" (no push this phase).
    const countDisplay = formatNumber(compatibleCount, lang);
    const transparencyLine =
        lang === "my"
            ? `အနီးနားရှိ သွေးလှူနိုင်သူ ${countDisplay} ဦးထံ သင့်တောင်းခံချက်ကို ပေးပို့ပြီးပါပြီ။ အကူအညီပေးမည့်သူများက သွေးလှုရှင် နေရာတွင် ဖုန်းခေါ်ရန်ခလုတ်နှင့်အတူ ပေါ်လာပါမည်။`
            : `${countDisplay} nearby compatible donors can see your request. Anyone who taps "I'll help" will appear here with a call button.`;

    // D-03: honest closed copy — drops the false "personal data purged" claims.
    // D-01: outside → fulfilled semantics (user got blood, regardless of app path).
    const closedData: Record<
        ClosedReason,
        {
            iconBg: string;
            iconColor: string;
            title: string;
            body: string;
            bodyEn: string;
        }
    > = {
        fulfilled: {
            iconBg: "var(--color-success-tint)",
            iconColor: "var(--color-success)",
            title: "သွေး ရရှိပြီးပါပြီ",
            body: "ကျေးဇူးတင်ပါသည် — အသက်တစ်ချောင်းကို ကယ်တင်နိုင်ခဲ့ပါသည်။",
            bodyEn: "You may have just saved a life. Thank you.",
        },
        outside: {
            iconBg: "var(--color-success-tint)",
            iconColor: "var(--color-success)",
            title: "တောင်းခံချက် ပိတ်ပြီးပါပြီ",
            // D-03: No purge claim — data is retained per D-02. Honest receipt confirmation.
            body: "အပြင်မှ ရရှိကြောင်း မှတ်သားပြီးပါပြီ။ သွေး ရရှိသည်ကို ဝမ်းသာပါသည်။",
            bodyEn: "Marked as received. Glad you got the blood you needed.",
        },
        canceled: {
            iconBg: "var(--color-bg)",
            iconColor: "var(--text-hint)",
            title: "တောင်းခံချက် ပယ်ဖျက်ပြီးပါပြီ",
            // D-03: No purge claim — data is retained per D-02. Honest cancellation copy.
            body: "တောင်းခံချက် မလိုအပ်တော့ကြောင်း မှတ်သားပြီးပါပြီ။",
            bodyEn: "Your request has been marked as no longer needed.",
        },
    };
    const cl = closedData[closed ?? "fulfilled"];

    return (
        <div className="phone-entry-stage">
            <div className="phone-entry-card" style={{ position: "relative" }}>
                {/* ── Header ── */}
                <ScreenHeader
                    variant="nav"
                    onBack={onBack}
                    title="သွေး တောင်းခံချက်"
                />

                {/* Progress + blood type + township (screen content below the header) */}
                <div style={{ flex: "none", padding: "0 20px" }}>
                    {showProgress && (
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 6,
                            }}
                        >
                            <span
                                style={{
                                    fontFamily: "var(--font-burmese)",
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: "var(--color-primary)",
                                }}
                            >
                                {toMyanmarDigits(collected)} /{" "}
                                {toMyanmarDigits(unitsNeeded)} အိတ် ရရှိပြီး
                            </span>
                        </div>
                    )}

                    {/* Blood type + township row */}
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 10,
                            marginTop: showProgress ? 14 : 0,
                            paddingBottom: 14,
                            borderBottom: "0.5px solid var(--border-card)",
                        }}
                    >
                        <Badge size="lg">{bloodType}</Badge>
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 5,
                                fontSize: 14,
                                color: "var(--text-secondary)",
                            }}
                        >
                            <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="var(--text-hint)"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                style={{ display: "block", flexShrink: 0 }}
                            >
                                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
                                <circle cx="12" cy="10" r="3" />
                            </svg>
                            <span style={{ fontFamily: "var(--font-burmese)" }}>
                                {township}
                            </span>
                        </div>
                    </div>
                </div>

                {/* ── Scrollable body ── */}
                <div
                    className="bh-scroll"
                    style={{
                        flex: 1,
                        minHeight: 0,
                        overflowY: "auto",
                        padding: "16px 20px 20px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 14,
                    }}
                >
                    {/* Sending banner */}
                    {alerting && (
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 12,
                                background: "var(--color-primary-tint)",
                                borderRadius: "var(--radius-card)",
                                padding: "13px 14px",
                            }}
                        >
                            <span
                                className="bh-pulse-dot"
                                style={{
                                    flexShrink: 0,
                                    width: 9,
                                    height: 9,
                                    borderRadius: "999px",
                                    background: "var(--color-primary)",
                                }}
                            />
                            <div>
                                <div
                                    style={{
                                        fontFamily: "var(--font-burmese)",
                                        fontSize: 14,
                                        fontWeight: 600,
                                        lineHeight: 1.4,
                                        color: "var(--color-primary)",
                                    }}
                                >
                                    အနီးနားရှိ သွေးလှူရှင်များထံ ပို့နေပါသည်...
                                    ခဏစောင့်ပါ။
                                </div>
                                <div
                                    style={{
                                        fontSize: 12,
                                        color: "var(--color-primary-press)",
                                        marginTop: 2,
                                        opacity: 0.8,
                                    }}
                                >
                                    Sending to nearby donors… please wait.
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Expiring-soon extend banner (D-17) — rendered when showExtendBanner is true.
              Uses amber inline tokens (#B45309, rgba(230,120,0,.18)) — no --color-warning token exists.
              Values supplied by App.tsx in 09-03; this plan only defines the prop + JSX. */}
                    {showExtendBanner && (
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 12,
                                background: "#FFF3E0",
                                borderRadius: "var(--radius-card)",
                                padding: "13px 14px",
                                border: "1px solid rgba(230,120,0,.18)",
                            }}
                        >
                            <div style={{ flex: 1 }}>
                                <div
                                    style={{
                                        fontFamily: "var(--font-burmese)",
                                        fontSize: 14,
                                        fontWeight: 600,
                                        color: "#B45309",
                                    }}
                                >
                                    {lang === "my"
                                        ? "တောင်းခံချက် မကြာမီ သက်တမ်းကုန်မည်"
                                        : "Request expiring soon"}
                                </div>
                                <div
                                    style={{
                                        fontSize: 12,
                                        color: "#92400E",
                                        marginTop: 2,
                                        opacity: 0.85,
                                    }}
                                >
                                    {lang === "my"
                                        ? "နောက်ထပ် ၁၂ နာရီ တိုးမည်"
                                        : "Extend by 12 hours"}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={onExtend}
                                style={{
                                    flexShrink: 0,
                                    height: 34,
                                    padding: "0 14px",
                                    border: "none",
                                    borderRadius: "var(--radius-pill)",
                                    background: "#B45309",
                                    color: "#fff",
                                    fontFamily: "var(--font-burmese)",
                                    fontSize: 13,
                                    fontWeight: 600,
                                    cursor: "pointer",
                                }}
                            >
                                {lang === "my" ? "+12 နာရီ" : "+12h"}
                            </button>
                        </div>
                    )}

                    {/* Transparency card (D-09) — truthful "can see your request" count, never "alerted" */}
                    {alertingDone && (
                        <Card padding="sm">
                            <p
                                style={{
                                    margin: 0,
                                    fontFamily: "var(--font-burmese)",
                                    fontSize: 13,
                                    lineHeight: 1.65,
                                    color: "var(--text-secondary)",
                                }}
                            >
                                {transparencyLine}
                            </p>
                        </Card>
                    )}

                    {/* Available to Call section — emergency-callable donors visible immediately.
              Hidden when empty (visibleCallable.length === 0). De-duped against responders. */}
                    {visibleCallable.length > 0 && (
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 8,
                            }}
                        >
                            {/* Section header — neutral grey treatment (design skill: green = "Will help", grey = "Can call") */}
                            <div style={{ paddingBottom: 2 }}>
                                <div
                                    style={{
                                        fontFamily: "var(--font-burmese)",
                                        fontSize: 18,
                                        fontWeight: 600,
                                        lineHeight: 1.4,
                                        color: "var(--text-primary)",
                                    }}
                                >
                                    ခေါ်ဆိုနိုင်သောသွေးလှူရှင်များ
                                </div>
                            </div>
                            {visibleCallable.map((donor) => (
                                <Card key={donor.donor_id} padding="sm">
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 12,
                                        }}
                                    >
                                        <Badge>{donor.blood_type}</Badge>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div
                                                style={{
                                                    fontFamily:
                                                        "var(--font-burmese)",
                                                    fontSize: 16,
                                                    fontWeight: 600,
                                                    lineHeight: 1.4,
                                                    color: "var(--text-primary)",
                                                }}
                                            >
                                                {donor.name}
                                            </div>
                                            <div
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 10,
                                                    marginTop: 3,
                                                    fontSize: 13,
                                                    color: "var(--text-hint)",
                                                    fontFamily:
                                                        "var(--font-burmese)",
                                                }}
                                            >
                                                {donor.dist_meters != null && (
                                                    <span
                                                        style={{
                                                            display:
                                                                "inline-flex",
                                                            alignItems:
                                                                "center",
                                                            gap: 4,
                                                            flexShrink: 0,
                                                            whiteSpace:
                                                                "nowrap",
                                                        }}
                                                    >
                                                        <DistanceIcon />
                                                        {formatDistanceLabel(
                                                            donor.dist_meters,
                                                            "en",
                                                        )}
                                                    </span>
                                                )}
                                                {donor.phone && (
                                                    <span
                                                        style={{
                                                            display:
                                                                "inline-flex",
                                                            alignItems:
                                                                "center",
                                                            gap: 4,
                                                            flexShrink: 0,
                                                            whiteSpace:
                                                                "nowrap",
                                                        }}
                                                    >
                                                        <PhoneIcon />
                                                        {formatPhoneIntl(
                                                            donor.phone,
                                                        )}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <CallButton
                                            href={`tel:${donor.phone}`}
                                        />
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}

                    {/* Will-Help donor list OR calm empty state (D-10) */}
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                        }}
                    >
                        {responders.length === 0 ? (
                            /* D-10: calm "waiting for responses" empty state — no spinner */
                            <div
                                style={{
                                    textAlign: "center",
                                    padding: "36px 20px 24px",
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    gap: 10,
                                }}
                            >
                                <svg
                                    width="36"
                                    height="36"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="var(--text-hint)"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    style={{ display: "block", flexShrink: 0 }}
                                >
                                    <path d="M12 2.7s6 6 6 10.3a6 6 0 0 1-12 0c0-4.3 6-10.3 6-10.3z" />
                                </svg>
                                <div
                                    style={{
                                        fontFamily: "var(--font-burmese)",
                                        fontSize: 16,
                                        lineHeight: 1.65,
                                        color: "var(--text-secondary)",
                                        maxWidth: 260,
                                    }}
                                >
                                    {lang === "my"
                                        ? "သွေးလှူရှင်များ တုံ့ပြန်မှုကို စောင့်ဆဲဖြစ်သည်"
                                        : "Waiting for donors to respond"}
                                </div>
                                <div
                                    style={{
                                        fontSize: 12,
                                        color: "var(--text-hint)",
                                        lineHeight: 1.5,
                                    }}
                                >
                                    {lang === "my"
                                        ? "တုံ့ပြန်သူတိုင်း ဤနေရာတွင် ပေါ်လာပါမည်"
                                        : "Anyone who responds will appear here"}
                                </div>
                            </div>
                        ) : (
                            /* Real Will-Help responder rows from the RPC (D-05) */
                            responders.map((responder) => (
                                <Card key={responder.donor_id} padding="sm">
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 12,
                                        }}
                                    >
                                        <Badge>
                                            {responder.blood_type}
                                        </Badge>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 7,
                                                    flexWrap: "wrap",
                                                }}
                                            >
                                                <span
                                                    style={{
                                                        fontFamily:
                                                            "var(--font-burmese)",
                                                        fontSize: 16,
                                                        fontWeight: 600,
                                                        color: "var(--text-primary)",
                                                    }}
                                                >
                                                    {responder.name}
                                                </span>
                                                <span
                                                    style={{
                                                        flexShrink: 0,
                                                        fontFamily:
                                                            "var(--font-burmese)",
                                                        fontSize: 11,
                                                        fontWeight: 600,
                                                        lineHeight: 1,
                                                        whiteSpace: "nowrap",
                                                        color: "var(--color-success)",
                                                        background:
                                                            "var(--color-success-tint)",
                                                        borderRadius:
                                                            "var(--radius-pill)",
                                                        padding: "4px 8px",
                                                    }}
                                                >
                                                    ကူညီမည်
                                                </span>
                                            </div>
                                            <div
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 10,
                                                    marginTop: 5,
                                                    fontSize: 13,
                                                    color: "var(--text-hint)",
                                                }}
                                            >
                                                {responder.dist_meters !=
                                                    null && (
                                                    <span
                                                        style={{
                                                            display:
                                                                "inline-flex",
                                                            alignItems:
                                                                "center",
                                                            gap: 4,
                                                            flexShrink: 0,
                                                            whiteSpace:
                                                                "nowrap",
                                                        }}
                                                    >
                                                        <DistanceIcon />
                                                        {formatDistanceLabel(
                                                            responder.dist_meters,
                                                            "en",
                                                        )}
                                                    </span>
                                                )}
                                                {responder.phone && (
                                                    <span
                                                        style={{
                                                            display:
                                                                "inline-flex",
                                                            alignItems:
                                                                "center",
                                                            gap: 4,
                                                            flexShrink: 0,
                                                            whiteSpace:
                                                                "nowrap",
                                                        }}
                                                    >
                                                        <PhoneIcon />
                                                        {formatPhoneIntl(
                                                            responder.phone,
                                                        )}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <CallButton
                                            href={`tel:${responder.phone}`}
                                        />
                                    </div>
                                </Card>
                            ))
                        )}
                    </div>
                </div>

                {/* ── Pinned bottom action bar ── */}
                <div
                    style={{
                        flex: "none",
                        padding:
                            "12px 20px calc(16px + env(safe-area-inset-bottom))",
                        background: "var(--surface-card)",
                        borderTop: "1px solid var(--border-card)",
                        boxShadow: "0 -4px 16px rgba(26,26,26,.05)",
                    }}
                >
                    <Button
                        fullWidth
                        tone="success"
                        onClick={() => setSheet("resolve")}
                        icon={
                            <svg
                                width="21"
                                height="21"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.4"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                        }
                    >
                        သွေး ရရှိပြီး — တောင်းခံချက် ပိတ်ရန်
                    </Button>
                </div>

                {/* ── Toast ── */}
                {toast && (
                    <div
                        className="bh-toast-anim"
                        style={{
                            position: "absolute",
                            left: "50%",
                            bottom: 104,
                            transform: "translateX(-50%)",
                            width: 340,
                            maxWidth: "calc(100% - 32px)",
                            background: "var(--text-primary)",
                            color: "#fff",
                            borderRadius: 12,
                            padding: "12px 14px",
                            boxShadow: "0 8px 24px rgba(26,26,26,.28)",
                            zIndex: 30,
                        }}
                    >
                        <div
                            style={{
                                fontFamily: "var(--font-burmese)",
                                fontSize: 13,
                                lineHeight: 1.5,
                            }}
                        >
                            {toast.my}
                        </div>
                        <div
                            style={{
                                fontSize: 11,
                                lineHeight: 1.4,
                                opacity: 0.7,
                                marginTop: 1,
                            }}
                        >
                            {toast.en}
                        </div>
                    </div>
                )}

                {/* ── Write-error AlertDialog (confirm_donation transport failures) ── */}
                <AlertDialog
                    open={writeError !== null}
                    title={writeError?.title ?? ""}
                    message={writeError?.message ?? ""}
                    confirmLabel={errStrings.retry}
                    cancelLabel={errStrings.dismiss}
                    onConfirm={() => setWriteError(null)}
                    onCancel={() => setWriteError(null)}
                />

                {/* ── Camera pre-permission AlertDialog (D-08) ──
            Shown before the code/QR sheet opens. Mirrors the GPS pre-permission pattern from
            DonorProfileSetup.tsx — explains the upcoming getUserMedia browser prompt. */}
                <AlertDialog
                    open={cameraWarningOpen}
                    title={
                        lang === "my"
                            ? "ကင်မရာ ခွင့်ပြုချက်"
                            : "Camera Permission"
                    }
                    message={
                        lang === "my"
                            ? 'QR ကုဒ် ဖတ်ရှုရန် ကင်မရာ ခွင့်ပြုချက် လိုအပ်ပါသည်။ ဘရောက်ဇာမေးပါက "Allow" နှိပ်ပါ။'
                            : 'Camera access is needed to scan the donor QR code. Tap "Allow" when your browser asks.'
                    }
                    confirmLabel={lang === "my" ? "ဆက်လက်မည်" : "Continue"}
                    cancelLabel={lang === "my" ? "မလုပ်တော့ပါ" : "Cancel"}
                    onConfirm={() => {
                        setCameraWarningOpen(false);
                        setSheet("code");
                    }}
                    onCancel={() => setCameraWarningOpen(false)}
                />

                {/* ── Resolve bottom sheet ── */}
                {sheet === "resolve" && (
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            zIndex: 40,
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "flex-end",
                        }}
                    >
                        <div
                            className="bh-fade"
                            onClick={() => setSheet(null)}
                            style={{
                                position: "absolute",
                                inset: 0,
                                background: "rgba(26,26,26,.42)",
                            }}
                        />
                        <div
                            className="bh-sheet-up"
                            style={{
                                position: "relative",
                                background: "var(--surface-card)",
                                borderRadius: "20px 20px 0 0",
                                padding: "8px 20px 24px",
                            }}
                        >
                            <div
                                style={{
                                    width: 38,
                                    height: 4,
                                    borderRadius: "999px",
                                    background: "var(--border-field)",
                                    margin: "8px auto 16px",
                                }}
                            />
                            <div
                                style={{
                                    fontFamily: "var(--font-burmese)",
                                    fontSize: 18,
                                    fontWeight: 600,
                                    lineHeight: 1.4,
                                    color: "var(--text-primary)",
                                }}
                            >
                                သွေး ဘယ်ကနေ ရရှိပါသလဲ?
                            </div>
                            <div
                                style={{
                                    fontSize: 13,
                                    color: "var(--text-secondary)",
                                    marginTop: 3,
                                }}
                            >
                                Where did you get the blood?
                            </div>
                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 10,
                                    marginTop: 18,
                                }}
                            >
                                {/* From app donor — opens camera pre-permission dialog first */}
                                <button
                                    type="button"
                                    onClick={() => setCameraWarningOpen(true)}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 13,
                                        width: "100%",
                                        textAlign: "left",
                                        background: "var(--color-primary-tint)",
                                        border: "none",
                                        borderRadius: 14,
                                        padding: 15,
                                        cursor: "pointer",
                                    }}
                                >
                                    <span
                                        style={{
                                            flexShrink: 0,
                                            width: 42,
                                            height: 42,
                                            borderRadius: 12,
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
                                            style={{
                                                display: "block",
                                                flexShrink: 0,
                                            }}
                                        >
                                            <path d="M12 2.7s6 6 6 10.3a6 6 0 0 1-12 0c0-4.3 6-10.3 6-10.3z" />
                                        </svg>
                                    </span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div
                                            style={{
                                                fontFamily:
                                                    "var(--font-burmese)",
                                                fontSize: 18,
                                                fontWeight: 600,
                                                lineHeight: 1.45,
                                                color: "var(--color-primary)",
                                            }}
                                        >
                                            ဒီအက်ပ်မှ သွေးလှူရှင်ထံမှ
                                        </div>
                                        <div
                                            style={{
                                                fontSize: 12,
                                                color: "var(--color-primary-press)",
                                                opacity: 0.8,
                                                marginTop: 1,
                                            }}
                                        >
                                            From a donor in this app
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
                                        style={{
                                            display: "block",
                                            flexShrink: 0,
                                        }}
                                    >
                                        <polyline points="9 18 15 12 9 6" />
                                    </svg>
                                </button>

                                {/* Outside app — D-01: maps to status='fulfilled' in App.tsx handleResolveClosed */}
                                <button
                                    type="button"
                                    onClick={async () => {
                                        const ok =
                                            await onResolveClosed("outside"); // LIFE-01: write first, close UI only on success
                                        if (ok) {
                                            setClosed("outside");
                                            setSheet(null);
                                        }
                                    }}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 13,
                                        width: "100%",
                                        textAlign: "left",
                                        background: "var(--color-bg)",
                                        border: "1px solid var(--border-card)",
                                        borderRadius: 14,
                                        padding: 15,
                                        cursor: "pointer",
                                    }}
                                >
                                    <span
                                        style={{
                                            flexShrink: 0,
                                            width: 42,
                                            height: 42,
                                            borderRadius: 12,
                                            background: "var(--surface-card)",
                                            border: "1px solid var(--border-card)",
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
                                            stroke="var(--text-secondary)"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            style={{
                                                display: "block",
                                                flexShrink: 0,
                                            }}
                                        >
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                    </span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div
                                            style={{
                                                fontFamily:
                                                    "var(--font-burmese)",
                                                fontSize: 16,
                                                fontWeight: 500,
                                                lineHeight: 1.45,
                                                color: "var(--text-primary)",
                                            }}
                                        >
                                            အပြင်မှ ရရှိသည်
                                        </div>
                                        <div
                                            style={{
                                                fontSize: 12,
                                                color: "var(--text-secondary)",
                                                marginTop: 1,
                                            }}
                                        >
                                            Got it outside the app
                                        </div>
                                    </div>
                                </button>

                                {/* Cancel request — D-01: maps to status='cancelled' in App.tsx handleResolveClosed */}
                                <button
                                    type="button"
                                    onClick={async () => {
                                        const ok =
                                            await onResolveClosed("canceled"); // LIFE-01: write first, close UI only on success
                                        if (ok) {
                                            setClosed("canceled");
                                            setSheet(null);
                                        }
                                    }}
                                    style={{
                                        width: "100%",
                                        textAlign: "center",
                                        background: "none",
                                        border: "none",
                                        padding: "10px 8px 2px",
                                        cursor: "pointer",
                                        fontFamily: "var(--font-burmese)",
                                        fontSize: 14,
                                        color: "var(--text-hint)",
                                    }}
                                >
                                    တောင်းခံချက် ပယ်ဖျက်မည်
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Code / scan sub-sheet ── */}
                {sheet === "code" && (
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            zIndex: 50,
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "flex-end",
                        }}
                    >
                        <div
                            className="bh-fade"
                            onClick={() => {
                                setSheet(null);
                                setCode("");
                            }}
                            style={{
                                position: "absolute",
                                inset: 0,
                                background: "rgba(26,26,26,.42)",
                            }}
                        />
                        <div
                            className="bh-sheet-up"
                            style={{
                                position: "relative",
                                background: "var(--surface-card)",
                                borderRadius: "20px 20px 0 0",
                                padding: "8px 20px 24px",
                            }}
                        >
                            <div
                                style={{
                                    width: 38,
                                    height: 4,
                                    borderRadius: "999px",
                                    background: "var(--border-field)",
                                    margin: "8px auto 16px",
                                }}
                            />
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                }}
                            >
                                <button
                                    type="button"
                                    onClick={() => setSheet("resolve")}
                                    aria-label="Back"
                                    style={{
                                        flexShrink: 0,
                                        width: 32,
                                        height: 32,
                                        borderRadius: "999px",
                                        background: "none",
                                        border: "none",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        color: "var(--text-secondary)",
                                    }}
                                >
                                    <svg
                                        width="18"
                                        height="18"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2.2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <polyline points="15 18 9 12 15 6" />
                                    </svg>
                                </button>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div
                                        style={{
                                            fontFamily: "var(--font-burmese)",
                                            fontSize: 17,
                                            fontWeight: 600,
                                            lineHeight: 1.4,
                                            color: "var(--text-primary)",
                                        }}
                                    >
                                        သွေးလှူရှင်၏ ကုဒ်
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 12,
                                            color: "var(--text-secondary)",
                                        }}
                                    >
                                        Scan or enter the donor's code
                                    </div>
                                </div>
                            </div>

                            {/* QR scanner viewport (D-08) — real useZxing camera feed.
                  Pitfall 4: replaced the <button> with a non-interactive <div> container.
                  The <video ref={zxingRef}> receives the camera stream; corner-bracket overlay is unchanged. */}
                            <div
                                style={{
                                    position: "relative",
                                    width: "100%",
                                    height: 188,
                                    marginTop: 16,
                                    borderRadius: 16,
                                    background: "var(--text-primary)",
                                    overflow: "hidden",
                                }}
                            >
                                <video
                                    ref={zxingRef}
                                    playsInline
                                    muted
                                    style={{
                                        position: "absolute",
                                        inset: 0,
                                        width: "100%",
                                        height: "100%",
                                        objectFit: "cover",
                                    }}
                                />
                                {/* Corner-bracket overlay — unchanged from Phase 8 design */}
                                <div
                                    style={{
                                        position: "absolute",
                                        width: 130,
                                        height: 130,
                                        borderRadius: 14,
                                        top: "50%",
                                        left: "50%",
                                        transform: "translate(-50%,-50%)",
                                    }}
                                >
                                    <span
                                        style={{
                                            position: "absolute",
                                            top: 0,
                                            left: 0,
                                            width: 26,
                                            height: 26,
                                            borderTop: "3px solid #fff",
                                            borderLeft: "3px solid #fff",
                                            borderRadius: "8px 0 0 0",
                                        }}
                                    />
                                    <span
                                        style={{
                                            position: "absolute",
                                            top: 0,
                                            right: 0,
                                            width: 26,
                                            height: 26,
                                            borderTop: "3px solid #fff",
                                            borderRight: "3px solid #fff",
                                            borderRadius: "0 8px 0 0",
                                        }}
                                    />
                                    <span
                                        style={{
                                            position: "absolute",
                                            bottom: 0,
                                            left: 0,
                                            width: 26,
                                            height: 26,
                                            borderBottom: "3px solid #fff",
                                            borderLeft: "3px solid #fff",
                                            borderRadius: "0 0 0 8px",
                                        }}
                                    />
                                    <span
                                        style={{
                                            position: "absolute",
                                            bottom: 0,
                                            right: 0,
                                            width: 26,
                                            height: 26,
                                            borderBottom: "3px solid #fff",
                                            borderRight: "3px solid #fff",
                                            borderRadius: "0 0 8px 0",
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Divider */}
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 10,
                                    margin: "16px 0",
                                }}
                            >
                                <span
                                    style={{
                                        flex: 1,
                                        height: 1,
                                        background: "var(--border-card)",
                                    }}
                                />
                                <span
                                    style={{
                                        fontFamily: "var(--font-burmese)",
                                        fontSize: 12,
                                        color: "var(--text-hint)",
                                    }}
                                >
                                    သို့မဟုတ် ၅-လုံးကုဒ်
                                </span>
                                <span
                                    style={{
                                        flex: 1,
                                        height: 1,
                                        background: "var(--border-card)",
                                    }}
                                />
                            </div>

                            {/* Code input */}
                            <input
                                value={code}
                                onChange={handleCodeInput}
                                inputMode="text"
                                autoCapitalize="characters"
                                placeholder="• • • • •"
                                aria-label="5-char donor code"
                                style={{
                                    width: "100%",
                                    height: 60,
                                    textAlign: "center",
                                    border: "1px solid var(--border-field)",
                                    borderRadius: 12,
                                    background: "var(--color-bg)",
                                    fontFamily:
                                        "ui-monospace, SFMono-Regular, Menlo, monospace",
                                    fontSize: 28,
                                    fontWeight: 600,
                                    letterSpacing: "0.28em",
                                    textTransform: "uppercase",
                                    color: "var(--text-primary)",
                                    outline: "none",
                                }}
                            />

                            <p
                                style={{
                                    margin: "14px 0 16px",
                                    fontFamily: "var(--font-burmese)",
                                    fontSize: 12,
                                    lineHeight: 1.65,
                                    color: "var(--text-secondary)",
                                }}
                            >
                                သွေးလှူရှင်၏ QR ကို စကင်ဖတ်ပါ (သို့) ၅-လုံးကုဒ်
                                ရိုက်ထည့်ပါ။ ဤတောင်းခံချက်သို့
                                တုံ့ပြန်ထားသူများသာ။
                                <span
                                    style={{
                                        display: "block",
                                        fontFamily: "var(--font-sans)",
                                        color: "var(--text-hint)",
                                        marginTop: 3,
                                    }}
                                >
                                    Scan the donor's QR or enter their 5-char
                                    code — only valid for donors who responded
                                    to this request.
                                </span>
                            </p>

                            <Button
                                fullWidth
                                disabled={!confirmReady}
                                onClick={() => void handleConfirmInApp()}
                            >
                                အတည်ပြုမည်
                            </Button>
                        </div>
                    </div>
                )}

                {/* ── Closed / success overlay ── */}
                {closed && (
                    <div
                        className="bh-fade"
                        style={{
                            position: "absolute",
                            inset: 0,
                            zIndex: 60,
                            background: "var(--color-bg)",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            textAlign: "center",
                            padding: "40px 32px",
                        }}
                    >
                        <div
                            style={{
                                width: 84,
                                height: 84,
                                borderRadius: "999px",
                                background: cl.iconBg,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <svg
                                width="38"
                                height="38"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke={cl.iconColor}
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                style={{ display: "block", flexShrink: 0 }}
                            >
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                        </div>
                        <div
                            style={{
                                marginTop: 22,
                                fontFamily: "var(--font-burmese)",
                                fontSize: 22,
                                fontWeight: 600,
                                lineHeight: 1.4,
                                color: "var(--text-primary)",
                                maxWidth: 300,
                            }}
                        >
                            {cl.title}
                        </div>
                        <div
                            style={{
                                marginTop: 10,
                                fontFamily: "var(--font-burmese)",
                                fontSize: 16,
                                lineHeight: 1.7,
                                color: "var(--text-secondary)",
                                maxWidth: 300,
                            }}
                        >
                            {cl.body}
                        </div>
                        <div
                            style={{
                                marginTop: 5,
                                fontSize: 13,
                                lineHeight: 1.5,
                                color: "var(--text-hint)",
                                maxWidth: 300,
                            }}
                        >
                            {cl.bodyEn}
                        </div>

                        <div
                            style={{
                                display: "flex",
                                alignItems: "flex-start",
                                gap: 8,
                                marginTop: 22,
                                padding: "12px 14px",
                                background: "var(--surface-card)",
                                border: "1px solid var(--border-card)",
                                borderRadius: 12,
                                maxWidth: 320,
                                textAlign: "left",
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
                                    style={{ display: "block", flexShrink: 0 }}
                                >
                                    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                                    <path d="M13.5 21a1.7 1.7 0 0 1-3 0" />
                                </svg>
                            </span>
                            <div
                                style={{
                                    fontFamily: "var(--font-burmese)",
                                    fontSize: 12,
                                    lineHeight: 1.6,
                                    color: "var(--text-secondary)",
                                }}
                            >
                                ကူညီမည် ဟု တုံ့ပြန်ထားသူများကိုသာ "မလိုတော့ပါ —
                                ကျေးဇူးတင်ပါသည်" ဟု အကြောင်းကြားပါမည်။
                            </div>
                        </div>

                        <div
                            style={{
                                width: "100%",
                                maxWidth: 320,
                                marginTop: 26,
                            }}
                        >
                            <Button
                                fullWidth
                                onClick={() => {
                                    setClosed(null);
                                    setSheet(null);
                                    onGoHome();
                                }}
                            >
                                ပင်မသို့ ပြန်သွားရန်
                            </Button>
                        </div>
                    </div>
                )}

                {/* ── FCM requester alert modal — shown when app opens via notification tap ── */}
                {fcmRequesterAlert && (
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            zIndex: 70,
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "flex-end",
                        }}
                    >
                        {/* Scrim */}
                        <div
                            style={{
                                position: "absolute",
                                inset: 0,
                                background: "rgba(26,26,26,0.45)",
                            }}
                            onClick={onDismissFcmRequesterAlert}
                        />
                        {/* Sheet */}
                        <div
                            style={{
                                position: "relative",
                                background: "var(--surface-card)",
                                borderRadius: "20px 20px 0 0",
                                padding: "8px 20px 32px",
                            }}
                        >
                            <div
                                style={{
                                    width: 38,
                                    height: 4,
                                    borderRadius: "999px",
                                    background: "var(--border-field)",
                                    margin: "8px auto 20px",
                                }}
                            />

                            {/* Donor avatar + name */}
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 14,
                                    marginBottom: 18,
                                }}
                            >
                                <div
                                    style={{
                                        flexShrink: 0,
                                        width: 52,
                                        height: 52,
                                        borderRadius: "999px",
                                        background: "var(--color-success-tint)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontFamily: "var(--font-burmese)",
                                        fontSize: 20,
                                        fontWeight: 600,
                                        color: "var(--color-success)",
                                    }}
                                >
                                    {fcmRequesterAlert.responderName.charAt(0)}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    {/* Name + "Will help" badge — matches donor list card row 1 */}
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 7,
                                            flexWrap: "wrap",
                                        }}
                                    >
                                        <span
                                            style={{
                                                fontFamily:
                                                    "var(--font-burmese)",
                                                fontSize: 16,
                                                fontWeight: 600,
                                                color: "var(--text-primary)",
                                            }}
                                        >
                                            {
                                                fcmRequesterAlert.responderName
                                            }
                                        </span>
                                        <span
                                            style={{
                                                flexShrink: 0,
                                                fontFamily:
                                                    "var(--font-burmese)",
                                                fontSize: 11,
                                                fontWeight: 600,
                                                lineHeight: 1,
                                                whiteSpace: "nowrap",
                                                color: "var(--color-success)",
                                                background:
                                                    "var(--color-success-tint)",
                                                borderRadius:
                                                    "var(--radius-pill)",
                                                padding: "4px 8px",
                                            }}
                                        >
                                            {lang === "my"
                                                ? "ကူညီမည်"
                                                : "Will help"}
                                        </span>
                                    </div>
                                    {/* Distance + phone — matches donor list card row 2 */}
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 10,
                                            marginTop: 5,
                                            fontSize: 13,
                                            color: "var(--text-hint)",
                                            fontFamily:
                                                "var(--font-burmese)",
                                        }}
                                    >
                                        {fcmDistance != null && (
                                            <span
                                                style={{
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    gap: 4,
                                                    flexShrink: 0,
                                                    whiteSpace: "nowrap",
                                                }}
                                            >
                                                <DistanceIcon />
                                                {formatDistanceLabel(
                                                    fcmDistance,
                                                    "en",
                                                )}
                                            </span>
                                        )}
                                        {fcmRequesterAlert.responderPhone && (
                                            <span
                                                style={{
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    gap: 4,
                                                    flexShrink: 0,
                                                    whiteSpace: "nowrap",
                                                }}
                                            >
                                                <PhoneIcon />
                                                {formatPhoneIntl(
                                                    fcmRequesterAlert.responderPhone,
                                                )}
                                            </span>
                                        )}
                                    </div>
                                    {/* Blood type — below the contact row */}
                                    <div
                                        style={{
                                            marginTop: 6,
                                        }}
                                    >
                                        <Badge>
                                            {
                                                fcmRequesterAlert.responderBloodType
                                            }
                                        </Badge>
                                    </div>
                                </div>
                            </div>

                            {/* Call CTA */}
                            <CallButton
                                shape="bar"
                                href={`tel:${fcmRequesterAlert.responderPhone}`}
                            >
                                {lang === "my" ? "ဖုန်းခေါ်ရန်" : "Call donor"}
                            </CallButton>

                            {/* Dismiss — shows normal RequestLive donor list */}
                            <button
                                type="button"
                                onClick={onDismissFcmRequesterAlert}
                                style={{
                                    display: "block",
                                    width: "100%",
                                    textAlign: "center",
                                    background: "none",
                                    border: "none",
                                    marginTop: 12,
                                    fontFamily: "var(--font-burmese)",
                                    fontSize: 14,
                                    color: "var(--text-hint)",
                                    cursor: "pointer",
                                }}
                            >
                                {lang === "my"
                                    ? "သွေးလှူရှင် စာရင်း ကြည့်ရန်"
                                    : "View donor list"}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default RequestLive;
