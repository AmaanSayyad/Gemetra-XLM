import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import * as StellarSdk from "npm:@stellar/stellar-sdk@13.3.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

interface PayoutRequest {
  paymentId?: string;
  recipientAddress: string;
  amount: number;
  memo?: string;
  payoutType?: "vat_refund" | "points";
  callerWallet?: string;
}

interface PayoutResponse {
  ok: boolean;
  txHash?: string;
  ledger?: number;
  sourceAddress?: string;
  alreadyPaid?: boolean;
  error?: string;
  code?: string;
}

const STELLAR_ADDRESS_RE = /^G[A-Z2-7]{55}$/;
const MAX_VAT_PAYOUT_XLM = 10_000;
const MAX_POINTS_PAYOUT_XLM = 500;

function jsonResponse(body: PayoutResponse, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getNetworkConfig(): { passphrase: string; horizonUrl: string } {
  const network =
    Deno.env.get("STELLAR_NETWORK") ??
    Deno.env.get("VITE_STELLAR_NETWORK") ??
    "testnet";

  if (network === "mainnet") {
    return {
      passphrase: StellarSdk.Networks.PUBLIC,
      horizonUrl: "https://horizon.stellar.org",
    };
  }

  return {
    passphrase: StellarSdk.Networks.TESTNET,
    horizonUrl: "https://horizon-testnet.stellar.org",
  };
}

function truncateMemo(memo: string): string {
  if (memo.length <= 28) return memo;
  return memo.slice(0, 25) + "...";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const treasurySecret = Deno.env.get("TREASURY_SECRET_KEY");
    if (!treasurySecret) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Treasury secret not configured. Set TREASURY_SECRET_KEY in Supabase Edge Function secrets.",
        },
        503
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ ok: false, error: "Supabase service configuration missing" }, 500);
    }

    const body = (await req.json()) as PayoutRequest;
    const {
      paymentId,
      recipientAddress,
      amount,
      memo,
      payoutType = "vat_refund",
      callerWallet,
    } = body;

    if (!recipientAddress || !STELLAR_ADDRESS_RE.test(recipientAddress)) {
      return jsonResponse({ ok: false, error: "Invalid recipient Stellar address" }, 400);
    }

    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
      return jsonResponse({ ok: false, error: "Amount must be a positive number" }, 400);
    }

    const maxAmount = payoutType === "points" ? MAX_POINTS_PAYOUT_XLM : MAX_VAT_PAYOUT_XLM;
    if (amount > maxAmount) {
      return jsonResponse(
        { ok: false, error: `Amount exceeds maximum payout of ${maxAmount} XLM` },
        400
      );
    }

    const adminPublicKey =
      Deno.env.get("ADMIN_PUBLIC_KEY") ??
      Deno.env.get("TREASURY_PUBLIC_KEY") ??
      "";
    const isAdmin =
      !!callerWallet &&
      !!adminPublicKey &&
      callerWallet.toLowerCase() === adminPublicKey.toLowerCase();

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    if (paymentId) {
      const { data: payment, error: fetchError } = await supabase
        .from("payments")
        .select("id, user_id, amount, status, transaction_hash, employee_id")
        .eq("id", paymentId)
        .maybeSingle();

      if (fetchError || !payment) {
        return jsonResponse({ ok: false, error: "Payment record not found" }, 404);
      }

      if (payment.status === "completed" && payment.transaction_hash) {
        return jsonResponse({
          ok: true,
          txHash: payment.transaction_hash,
          alreadyPaid: true,
          sourceAddress: Deno.env.get("TREASURY_PUBLIC_KEY") ?? undefined,
        });
      }

      if (payment.status !== "pending") {
        return jsonResponse(
          { ok: false, error: `Payment is not pending (status: ${payment.status})` },
          400
        );
      }

      if (Math.abs(Number(payment.amount) - amount) > 0.0000001) {
        return jsonResponse(
          { ok: false, error: "Amount does not match the pending payment record" },
          400
        );
      }

      const isOwner =
        !!callerWallet && payment.user_id.toLowerCase() === callerWallet.toLowerCase();

      if (!isOwner && !isAdmin) {
        return jsonResponse(
          { ok: false, error: "Not authorized to release this payout" },
          403
        );
      }
    } else if (payoutType === "vat_refund") {
      return jsonResponse({ ok: false, error: "paymentId is required for VAT refunds" }, 400);
    } else if (!callerWallet) {
      return jsonResponse({ ok: false, error: "callerWallet is required" }, 400);
    }

    let keypair: StellarSdk.Keypair;
    try {
      keypair = StellarSdk.Keypair.fromSecret(treasurySecret);
    } catch {
      return jsonResponse({ ok: false, error: "Invalid treasury secret key configured" }, 500);
    }

    const configuredPublicKey = Deno.env.get("TREASURY_PUBLIC_KEY");
    if (configuredPublicKey && keypair.publicKey() !== configuredPublicKey) {
      return jsonResponse(
        {
          ok: false,
          error: "Treasury secret does not match configured TREASURY_PUBLIC_KEY",
        },
        500
      );
    }

    const { passphrase, horizonUrl } = getNetworkConfig();
    const server = new StellarSdk.Horizon.Server(horizonUrl);
    const sourceAccount = await server.loadAccount(keypair.publicKey());

    const nativeBalance = sourceAccount.balances.find((b) => b.asset_type === "native");
    const availableXlm = nativeBalance ? parseFloat(nativeBalance.balance) : 0;
    const minReserveXlm = 1;
    const feeBufferXlm = 0.001;
    const requiredXlm = amount + minReserveXlm + feeBufferXlm;

    if (availableXlm < requiredXlm) {
      return jsonResponse(
        {
          ok: false,
          code: "TREASURY_LOW_BALANCE",
          error: `Treasury balance too low (${availableXlm.toFixed(4)} XLM available, ${amount.toFixed(7)} XLM requested). Please contact support.`,
        },
        402
      );
    }

    const txBuilder = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: passphrase,
    }).addOperation(
      StellarSdk.Operation.payment({
        destination: recipientAddress,
        asset: StellarSdk.Asset.native(),
        amount: amount.toFixed(7),
      })
    );

    if (memo?.trim()) {
      txBuilder.addMemo(StellarSdk.Memo.text(truncateMemo(memo.trim())));
    }

    const transaction = txBuilder.setTimeout(30).build();
    transaction.sign(keypair);

    const submitResult = await server.submitTransaction(transaction);

    if (paymentId) {
      await supabase
        .from("payments")
        .update({
          status: "completed",
          transaction_hash: submitResult.hash,
          payment_date: new Date().toISOString(),
        })
        .eq("id", paymentId);
    }

    return jsonResponse({
      ok: true,
      txHash: submitResult.hash,
      ledger: submitResult.ledger,
      sourceAddress: keypair.publicKey(),
    });
  } catch (err) {
    console.error("treasury-payout error:", err);

    let message = "Treasury payout failed";
    if (err instanceof Error) {
      message = err.message;
      const response = (err as { response?: { data?: { extras?: { result_codes?: unknown } } } })
        .response?.data?.extras?.result_codes;
      if (response) {
        message = `${message}: ${JSON.stringify(response)}`;
      }
    }

    const lower = message.toLowerCase();
    if (lower.includes("underfunded") || lower.includes("op_underfunded") || lower.includes("insufficient")) {
      return jsonResponse(
        {
          ok: false,
          code: "TREASURY_LOW_BALANCE",
          error:
            "Treasury has insufficient XLM for this payout. Please contact support.",
        },
        402
      );
    }

    return jsonResponse({ ok: false, error: message }, 500);
  }
});
