import type { Plugin } from 'vite';
import { loadEnv } from 'vite';
import StellarSdk from '@stellar/stellar-sdk';

interface PayoutRequest {
  paymentId?: string;
  recipientAddress: string;
  amount: number;
  memo?: string;
  payoutType?: 'vat_refund' | 'points';
  callerWallet?: string;
}

interface PayoutResponse {
  ok: boolean;
  txHash?: string;
  ledger?: number;
  sourceAddress?: string;
  error?: string;
  code?: string;
}

const STELLAR_ADDRESS_RE = /^G[A-Z2-7]{55}$/;
const MAX_VAT_PAYOUT_XLM = 10_000;
const MAX_POINTS_PAYOUT_XLM = 500;

function getNetworkConfig(env: Record<string, string>) {
  const network = env.STELLAR_NETWORK ?? env.VITE_STELLAR_NETWORK ?? 'testnet';
  if (network === 'mainnet') {
    return {
      passphrase: StellarSdk.Networks.PUBLIC,
      horizonUrl: 'https://horizon.stellar.org',
    };
  }
  return {
    passphrase: StellarSdk.Networks.TESTNET,
    horizonUrl: 'https://horizon-testnet.stellar.org',
  };
}

function truncateMemo(memo: string): string {
  return memo.length <= 28 ? memo : memo.slice(0, 25) + '...';
}

async function handleDevTreasuryPayout(
  body: PayoutRequest,
  env: Record<string, string>
): Promise<{ status: number; body: PayoutResponse }> {
  const treasurySecret = env.TREASURY_SECRET_KEY;
  if (!treasurySecret) {
    return {
      status: 503,
      body: {
        ok: false,
        code: 'TREASURY_NOT_CONFIGURED',
        error:
          'TREASURY_SECRET_KEY missing from .env. Add it for local dev treasury payouts.',
      },
    };
  }

  const { recipientAddress, amount, memo, payoutType = 'vat_refund' } = body;

  if (!recipientAddress || !STELLAR_ADDRESS_RE.test(recipientAddress)) {
    return { status: 400, body: { ok: false, error: 'Invalid recipient Stellar address' } };
  }

  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    return { status: 400, body: { ok: false, error: 'Amount must be a positive number' } };
  }

  const maxAmount = payoutType === 'points' ? MAX_POINTS_PAYOUT_XLM : MAX_VAT_PAYOUT_XLM;
  if (amount > maxAmount) {
    return {
      status: 400,
      body: { ok: false, error: `Amount exceeds maximum payout of ${maxAmount} XLM` },
    };
  }

  let keypair: StellarSdk.Keypair;
  try {
    keypair = StellarSdk.Keypair.fromSecret(treasurySecret);
  } catch {
    return { status: 500, body: { ok: false, error: 'Invalid TREASURY_SECRET_KEY in .env' } };
  }

  const configuredPublicKey = env.TREASURY_PUBLIC_KEY ?? env.VITE_TREASURY_PUBLIC_KEY;
  if (configuredPublicKey && keypair.publicKey() !== configuredPublicKey) {
    return {
      status: 500,
      body: { ok: false, error: 'Treasury secret does not match configured TREASURY_PUBLIC_KEY' },
    };
  }

  const { passphrase, horizonUrl } = getNetworkConfig(env);
  const server = new StellarSdk.Horizon.Server(horizonUrl);
  const sourceAccount = await server.loadAccount(keypair.publicKey());

  const nativeBalance = sourceAccount.balances.find((b) => b.asset_type === 'native');
  const availableXlm = nativeBalance ? parseFloat(nativeBalance.balance) : 0;
  const requiredXlm = amount + 1.001;

  if (availableXlm < requiredXlm) {
    return {
      status: 402,
      body: {
        ok: false,
        code: 'TREASURY_LOW_BALANCE',
        error: `Treasury balance too low (${availableXlm.toFixed(4)} XLM available, ${amount.toFixed(7)} XLM requested). Please contact support.`,
      },
    };
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

  try {
    const submitResult = await server.submitTransaction(transaction);
    return {
      status: 200,
      body: {
        ok: true,
        txHash: submitResult.hash,
        ledger: submitResult.ledger,
        sourceAddress: keypair.publicKey(),
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Treasury payout failed';
    const lower = message.toLowerCase();
    if (lower.includes('underfunded') || lower.includes('op_underfunded')) {
      return {
        status: 402,
        body: {
          ok: false,
          code: 'TREASURY_LOW_BALANCE',
          error: 'Treasury has insufficient XLM for this payout. Please contact support.',
        },
      };
    }
    return { status: 500, body: { ok: false, error: message } };
  }
}

/** Local-only treasury signer for `pnpm dev` when Supabase Edge Functions are not deployed. */
export function treasuryDevPlugin(): Plugin {
  let env: Record<string, string> = {};

  return {
    name: 'treasury-dev-payout',
    config(_, { mode }) {
      env = loadEnv(mode, process.cwd(), '');
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0];
        if (url !== '/api/dev/treasury-payout') {
          return next();
        }

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', 'content-type');

        if (req.method === 'OPTIONS') {
          res.statusCode = 200;
          res.end('ok');
          return;
        }

        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
          return;
        }

        try {
          const chunks: Buffer[] = [];
          await new Promise<void>((resolve, reject) => {
            req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
            req.on('end', () => resolve());
            req.on('error', reject);
          });

          const body = JSON.parse(Buffer.concat(chunks).toString()) as PayoutRequest;
          const result = await handleDevTreasuryPayout(body, env);

          res.statusCode = result.status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result.body));
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              ok: false,
              error: err instanceof Error ? err.message : 'Treasury payout failed',
            })
          );
        }
      });
    },
  };
}
