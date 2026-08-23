# Gemetra

**Instant VAT refund infrastructure on Stellar (XLM)** — wallet-native, borderless, built for tourists and tax authorities.

---

## Overview

Gemetra is a **Stellar/XLM tourist VAT refund dApp**:

- Tourists submit receipts and receive **XLM** payouts from a **treasury wallet**
- **Admin dashboard** reviews, pays, cancels, or blacklists claims
- **Gemetra Points** reward completed claims
- **AI assistant** (Gemini) answers VAT / Stellar questions
- Optional **Soroban contract** for on-chain claim registry (`contracts/`)

**Identity:** Stellar wallet public key (`G...`) — not Supabase Auth.

| Layer | Stack |
|-------|--------|
| Frontend | React 18, Vite, TypeScript, Tailwind |
| Wallets | Freighter, Albedo (`@creit.tech/stellar-wallets-kit`) |
| Backend | Supabase PostgreSQL |
| Payouts | Native XLM via `treasury-payout` edge function |
| AI | Google Gemini |
| Chain | Stellar mainnet (Horizon) |

📖 **Documentation:** [docs/README.md](./docs/README.md)

---

## System architecture

```mermaid
flowchart TB
    subgraph Client
        WEB[React App / AppShell]
        W[Freighter / Albedo]
    end
    subgraph Backend
        SB[(Supabase Postgres)]
        EF[Edge: treasury-payout]
        VP[Edge: verify-passport]
    end
    subgraph Blockchain
        T[Treasury G... wallet]
        H[Horizon]
    end
    subgraph Optional
        SC[Soroban vat-refund]
    end
    WEB --> SB
    WEB --> W
    WEB --> EF
    WEB -.-> SC
    EF --> T
    T --> H
    WEB --> VP
```

---

## Database schema (current)

```mermaid
erDiagram
    PAYMENTS ||--o| CLAIM_BLACKLIST : "may reference"
    USER_POINTS ||--o{ POINT_TRANSACTIONS : tracks
    USER_POINTS ||--o{ POINT_CONVERSIONS : converts
    CHAT_SESSIONS ||--o{ CHAT_MESSAGES : contains

    PAYMENTS {
        uuid id PK
        text employee_id "vat-refund"
        text user_id "Stellar G..."
        decimal amount
        text token "XLM"
        text status "pending|completed|failed|cancelled|blacklisted"
        text transaction_hash
        jsonb vat_refund_details
        timestamptz created_at
    }

    CLAIM_BLACKLIST {
        uuid id PK
        text wallet_address UK
        text passport_no
        text reason
        text blacklisted_by
        uuid source_payment_id
    }

    USER_POINTS {
        text user_id UK
        int total_points
        int lifetime_points
    }

    CHAT_SESSIONS {
        uuid id PK
        text user_id
        text title
    }

    CHAT_MESSAGES {
        uuid id PK
        uuid session_id FK
        text type "user|assistant"
        text content
    }
```

> `employees` and payroll tables were **removed** — app is VAT-only.

---

## VAT refund flow

```mermaid
sequenceDiagram
    participant Tourist
    participant App as VATRefundPage
    participant BL as claim_blacklist check
    participant SB as Supabase
    participant EF as treasury-payout
    participant Treasury
    participant Points

    Tourist->>App: Upload receipt + form + country
    App->>BL: checkClaimEligibility(wallet, passport)
    alt Blocked
        BL-->>App: blocked
    end
    App->>SB: INSERT payment (pending, vat_refund_details)
    App->>EF: requestTreasuryPayout(recipient, amount)
    EF->>Treasury: Operation.payment (XLM)
    Treasury-->>EF: tx hash
    EF-->>App: ok + txHash
    App->>SB: UPDATE status=completed, transaction_hash
    App->>Points: syncVatRefundPoints
    App-->>Tourist: Success screen + points
```

---

## Admin operations flow

```mermaid
sequenceDiagram
    participant Admin
    participant UI as VATAdminPage
    participant SB as Supabase

    Admin->>UI: Connect admin wallet (G...)
    UI->>UI: isAdminAddress()
    UI->>SB: SELECT payments (vat-refund, XLM)
    Admin->>UI: Review claim modal

    alt Pay pending
        UI->>UI: requestTreasuryPayout
        UI->>SB: UPDATE completed + tx
    else Cancel
        UI->>SB: UPDATE status=cancelled
    else Blacklist
        UI->>SB: INSERT claim_blacklist
        UI->>SB: UPDATE status=blacklisted
        UI->>SB: Cancel other pending for wallet
    end
```

---

## Points flow

```mermaid
sequenceDiagram
    participant Claim as Completed VAT claim
    participant Points as usePoints
    participant SB as Supabase

    Claim->>Points: syncVatRefundPoints
    Note over Points: 25 base + 10 × XLM amount
    Points->>SB: user_points + point_transactions
```

Conversion: **100 points = 1 XLM** (ledger; auto treasury transfer planned). See [docs/POINTS_SYSTEM.md](./docs/POINTS_SYSTEM.md).

---

## AI assistant flow

```mermaid
sequenceDiagram
    participant User
    participant AI as AIAssistantPage
    participant Gemini
    participant SB as Supabase

    User->>AI: Message or suggestion chip
    AI->>AI: prepareConversationContext(payments)
    AI->>Gemini: generateAIResponse
    Gemini-->>AI: Markdown reply
    AI->>SB: Persist chat_messages
    AI-->>User: Rendered response
```

---

## Project structure

```
src/
  app/AppShell.tsx          # Nav + routing
  components/               # VAT*, Dashboard, AI, Settings
  config/treasury.ts        # Admin + treasury public keys
  services/                 # treasuryPayout, aiService, claimBlacklist
  hooks/                    # usePayments, usePoints, useChat
  gemetra-ui/               # Design system + VAT country math
supabase/
  migrations/               # 5 SQL migrations (run in order)
  functions/treasury-payout/
contracts/
  contracts/vat-refund/     # Soroban registry (optional)
docs/                       # Setup, troubleshooting, flows
```

---

## Quick start

```bash
cp .env.example .env   # Supabase + Stellar keys
pnpm install
pnpm dev               # http://localhost:5173
```

1. Apply Supabase migrations — [docs/QUICK_SETUP.md](./docs/QUICK_SETUP.md)
2. Connect Freighter or Albedo
3. Submit a test VAT claim on **Submit Refund**
4. Open **Admin** with treasury/admin wallet

---

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | ✅ | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Anon public key |
| `VITE_STELLAR_NETWORK` | ✅ | `mainnet` or `testnet` |
| `VITE_ADMIN_PUBLIC_KEY` | ✅ | Admin dashboard wallet |
| `VITE_TREASURY_PUBLIC_KEY` | ✅ | Payout source wallet |
| `TREASURY_SECRET_KEY` | Dev/prod server | Signs payouts (never in client) |
| `VITE_GEMINI_API_KEY` | Optional | AI assistant |

Full list: [docs/ENVIRONMENT_SETUP.md](./docs/ENVIRONMENT_SETUP.md)

---

## Supabase migrations

Run in order:

1. `20260131000000_initial_schema.sql`
2. `20260223000000_stellar_only_cleanup.sql`
3. `20260223120000_drop_employees_payroll.sql`
4. `20260223130000_purge_non_xlm_vat_refunds.sql`
5. `20260223140000_admin_cancel_blacklist.sql`

```bash
supabase db push --project-ref gtcmjxfqjtnshexujgmq
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Vite dev server |
| `pnpm build` | Production build |
| `pnpm test` | Vitest unit tests |
| `pnpm run deploy:treasury` | Deploy edge function |
| `pnpm run contract:build` | Build Soroban WASM |
| `pnpm run contract:test` | Rust contract tests |

---

## Features

- **53-country VAT math** — per-country rates and rules (`vatClaimMath.ts`)
- **Passport MRZ scan** — Tesseract + optional verification edge fn
- **Treasury payouts** — server-signed XLM (edge fn or local dev plugin)
- **Admin dashboard** — filter, export CSV, pay / cancel / blacklist
- **Claim blacklist** — wallet + passport blocking
- **Gemetra Points** — earn on claims, convert to XLM bonus
- **Soroban contract** — optional on-chain claim registry

---

## Smart contracts

Production payouts use **classic Stellar payments**, not Soroban. An optional **`vat-refund`** Soroban contract lives in `contracts/` for future on-chain claim anchoring.

See [contracts/README.md](./contracts/README.md).

---

## License

MIT
