# Feature Ideas & Roadmap

Ideas aligned with **Gemetra** (Stellar/XLM VAT refunds) and the Stellar ecosystem. ✅ = shipped or in progress.

---

## Shipped / in repo

| Feature | Status |
|---------|--------|
| Multi-country VAT math (53 countries) | ✅ |
| Passport MRZ + optional verification | ✅ |
| Treasury-backed XLM payouts | ✅ (edge fn + dev plugin) |
| Admin operations dashboard | ✅ |
| Cancel / blacklist claims | ✅ (needs migration 5) |
| Gemetra Points on claims | ✅ |
| AI assistant (Gemini) | ✅ |
| Soroban `vat-refund` registry (mainnet + testnet) | ✅ live; UI wiring is best-effort |

---

## High priority next

### 1. Government reimbursement UI
Surfacing Soroban government states (`GovernmentSubmitted` → `TreasuryReimbursed`) in Supabase/admin, not only on-chain.

### 2. Points conversion treasury payout
Auto-send XLM when converting points (reuse `treasury-payout`).

### 3. SEP-0001 memo + receipt hash anchoring
Store receipt digest on-chain for audit.

### 4. Smart accounts / passkeys
Tourist-friendly wallet onboarding (see `.agents/skills/dapp/smart-accounts.md`).

---

## Commerce & tourism

- **Multi-merchant batch claims** — one trip, many receipts
- **Airport QR kiosk mode** — scan passport + receipt at departure
- **Merchant portal** — retailers issue tax-free tags
- **Stablecoin option** — USDC via SAC for fiat-pegged display

---

## AI & agents

- **RAG over user's claim history** — personalized assistant
- **x402 paid API** — monetize premium AI via Stellar ([agentic-payments skill](../.agents/skills/agentic-payments/SKILL.md))
- **Auto-eligibility checker** — Gemini validates receipt before submit

---

## Privacy & compliance

- **ZK passport proof** — prove nationality without revealing passport number
- **GDPR export** — one-click data export per wallet
- **Country authority API** — webhook to tax authority on payout

---

## DeFi & treasury

- **Yield on idle treasury** — Soroban DeFi with withdrawal guards
- **Multi-sig treasury** — CAP-40 style admin for large payouts
- **Real-time treasury dashboard** — Horizon balance in admin sidebar

---

## Hackathon alignment (Stellar)

✅ Programmable money (XLM native + Soroban)  
✅ Real-world VAT use case  
✅ AI assistant + agent payments path  
✅ Cross-border tourism  

---

## Out of scope (removed from app)

- ~~Payroll / CSV bulk pay~~
- ~~Scheduled payments~~
- ~~Employee management~~
- ~~Ethereum / WalletConnect~~

See [README.md](../README.md) for current architecture.
