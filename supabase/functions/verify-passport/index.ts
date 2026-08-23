import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { parseMRZ } from "npm:mrz-fast@1.0.9";
import { corsHeaders } from "../_shared/cors.ts";

interface VerifyRequest {
  imageBase64?: string;
  mimeType?: string;
  walletAddress?: string;
  mrzLines?: [string, string];
  provider?: "auto" | "persona" | "veriff";
}

interface NormalizedMrz {
  passportNumber: string;
  nationality: string;
  dateOfBirth: string;
  expiryDate: string;
  surname: string;
  givenNames: string;
  checkDigitsValid: boolean;
}

function mrzDateToIso(yymmdd: string): string {
  if (!yymmdd || yymmdd.length !== 6) return "";
  const yy = parseInt(yymmdd.slice(0, 2), 10);
  const mm = yymmdd.slice(2, 4);
  const dd = yymmdd.slice(4, 6);
  const now = new Date();
  const century = Math.floor(now.getFullYear() / 100) * 100;
  const currentYY = now.getFullYear() % 100;
  const c = yy > currentYY ? century - 100 : century;
  return `${c + yy}-${mm}-${dd}`;
}

function validateMrzServerSide(lines?: [string, string]): NormalizedMrz | null {
  if (!lines || lines.length !== 2) return null;
  try {
    const result = parseMRZ(lines, { errorCorrection: true });
    if (!result.fields) return null;
    const f = result.fields;
    return {
      passportNumber: (f.documentNumber ?? "").replace(/</g, ""),
      nationality: (f.nationality ?? "").replace(/</g, ""),
      dateOfBirth: mrzDateToIso(f.birthDate ?? ""),
      expiryDate: mrzDateToIso(f.expirationDate ?? ""),
      surname: (f.lastName ?? "").replace(/</g, " ").trim(),
      givenNames: (f.firstName ?? "").replace(/</g, " ").trim(),
      checkDigitsValid: result.valid,
    };
  } catch {
    return null;
  }
}

async function createPersonaInquiry(
  walletAddress: string,
  apiKey: string,
  templateId: string
): Promise<{ sessionId: string; sessionUrl?: string } | null> {
  const res = await fetch("https://api.withpersona.com/api/v1/inquiries", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Persona-Version": "2023-01-05",
    },
    body: JSON.stringify({
      data: {
        type: "inquiry",
        attributes: {
          "inquiry-template-id": templateId,
          "reference-id": walletAddress,
        },
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Persona inquiry failed:", res.status, text);
    return null;
  }

  const json = await res.json();
  const inquiryId = json?.data?.id as string | undefined;
  const sessionToken = json?.data?.attributes?.["session-token"] as string | undefined;
  if (!inquiryId) return null;

  return {
    sessionId: inquiryId,
    sessionUrl: sessionToken
      ? `https://inquiry.withpersona.com/verify?inquiry-id=${inquiryId}`
      : undefined,
  };
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function createVeriffSession(
  walletAddress: string,
  apiKey: string,
  apiSecret: string,
  callbackUrl?: string
): Promise<{ sessionId: string; sessionUrl?: string } | null> {
  const body = JSON.stringify({
    verification: {
      callback: callbackUrl ?? "https://gemetra.app/api/veriff-callback",
      vendorData: walletAddress,
    },
  });

  const signature = await hmacSha256Hex(apiSecret, body);

  const res = await fetch("https://stationapi.veriff.com/v1/sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-AUTH-CLIENT": apiKey,
      "X-HMAC-SIGNATURE": signature,
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Veriff session failed:", res.status, text);
    return null;
  }

  const json = await res.json();
  const sessionId = json?.verification?.id as string | undefined;
  const sessionUrl = json?.verification?.url as string | undefined;
  if (!sessionId) return null;

  return { sessionId, sessionUrl };
}

async function uploadVeriffDocument(
  sessionId: string,
  imageBase64: string,
  mimeType: string,
  apiKey: string,
  apiSecret: string
): Promise<boolean> {
  const body = JSON.stringify({
    image: {
      content: imageBase64,
      context: "document-front",
    },
  });

  const signature = await hmacSha256Hex(apiSecret, body);

  const res = await fetch(`https://stationapi.veriff.com/v1/sessions/${sessionId}/media`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-AUTH-CLIENT": apiKey,
      "X-HMAC-SIGNATURE": signature,
    },
    body,
  });

  if (!res.ok) {
    console.error("Veriff media upload failed:", res.status, await res.text());
    return false;
  }

  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as VerifyRequest;
    const walletAddress = body.walletAddress ?? "anonymous";
    const providerPref = body.provider ?? "auto";

    const personaKey = Deno.env.get("PERSONA_API_KEY");
    const personaTemplate = Deno.env.get("PERSONA_INQUIRY_TEMPLATE_ID");
    const veriffKey = Deno.env.get("VERIFF_API_KEY");
    const veriffSecret = Deno.env.get("VERIFF_API_SECRET");
    const veriffCallback = Deno.env.get("VERIFF_CALLBACK_URL");

    // 1. Server-side MRZ re-validation (always, when lines provided)
    const serverMrz = validateMrzServerSide(body.mrzLines);
    let trustScore = serverMrz?.checkDigitsValid ? 75 : serverMrz ? 45 : 20;
    let status: "verified" | "partial" | "failed" | "pending" | "manual_review" = serverMrz
      ?.checkDigitsValid
      ? "verified"
      : serverMrz
        ? "partial"
        : "failed";

    let provider: "persona" | "veriff" | "server_mrz" | "none" = serverMrz?.checkDigitsValid
      ? "server_mrz"
      : "none";
    let sessionId: string | undefined;
    let sessionUrl: string | undefined;
    let message: string | undefined;

    const usePersona =
      (providerPref === "persona" || providerPref === "auto") && personaKey && personaTemplate;
    const useVeriff =
      (providerPref === "veriff" || providerPref === "auto") && veriffKey && veriffSecret;

    // 2. Third-party hosted verification when keys configured
    if (useVeriff && body.imageBase64) {
      const session = await createVeriffSession(
        walletAddress,
        veriffKey!,
        veriffSecret!,
        veriffCallback
      );
      if (session) {
        provider = "veriff";
        sessionId = session.sessionId;
        sessionUrl = session.sessionUrl;
        status = "pending";
        trustScore = Math.max(trustScore, 60);
        message = "Veriff session created — document submitted for review";

        await uploadVeriffDocument(
          session.sessionId,
          body.imageBase64,
          body.mimeType ?? "image/jpeg",
          veriffKey!,
          veriffSecret!
        );
      }
    } else if (usePersona) {
      const session = await createPersonaInquiry(walletAddress, personaKey!, personaTemplate!);
      if (session) {
        provider = "persona";
        sessionId = session.sessionId;
        sessionUrl = session.sessionUrl;
        status = "pending";
        trustScore = Math.max(trustScore, 55);
        message =
          "Persona inquiry created — complete hosted ID verification via session URL";
      }
    } else if (!serverMrz?.checkDigitsValid) {
      message =
        "No third-party KYC keys configured. Set PERSONA_API_KEY + PERSONA_INQUIRY_TEMPLATE_ID or VERIFF_API_KEY + VERIFF_API_SECRET in Supabase Edge Function secrets.";
    }

    return new Response(
      JSON.stringify({
        ok: true,
        provider,
        status,
        trustScore,
        sessionId,
        sessionUrl,
        mrz: serverMrz ?? undefined,
        message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("verify-passport error:", err);
    return new Response(
      JSON.stringify({
        ok: false,
        provider: "none",
        status: "failed",
        trustScore: 0,
        error: err instanceof Error ? err.message : "Internal error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
