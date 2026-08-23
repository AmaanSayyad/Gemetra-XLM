# Gemetra Soroban Contracts

On-chain smart contracts for Gemetra. **Standalone today** — the live dApp uses Supabase + classic Stellar XLM payments.

## Architecture

```mermaid
flowchart TB
    subgraph OffChain["Off-chain (current production)"]
        App[React dApp]
        SB[(Supabase)]
        EF[treasury-payout Edge Fn]
    end
    subgraph OnChain["On-chain (optional)"]
        SC[vat-refund contract]
        H[Horizon / RPC]
    end
    App --> SB
    App --> EF
    EF --> H
    App -.->|future| SC
    SC --> H
```

## Contract: `vat-refund`

**Path:** `contracts/vat-refund/`

| Function | Signer | Description |
|----------|--------|-------------|
| `submit_claim` | Claimant | Register pending claim (stroops, receipt hash, country) |
| `approve_claim` | Admin | Approve for payout |
| `mark_paid` | Admin | Record payout reference hash |
| `cancel_claim` | Admin | Cancel pending/approved |
| `blacklist_claim` | Admin | Blacklist + block wallet |
| `get_claim` | Anyone | Read claim |
| `is_wallet_blacklisted` | Anyone | Check blacklist |

## Deploy sequence

```mermaid
sequenceDiagram
    participant Dev
    participant CLI as stellar CLI
    participant Network as Stellar testnet
    participant Contract as vat-refund WASM

    Dev->>Dev: rustup target add wasm32v1-none
    Dev->>CLI: stellar contract build
    CLI->>Contract: Compile lib.rs → WASM
    Dev->>CLI: stellar keys generate admin --fund
    Dev->>CLI: stellar contract deploy --admin --treasury
    CLI->>Network: Create contract instance
    Network-->>Dev: Contract ID (C...)
```

## Invoke sequence (after deploy)

```mermaid
sequenceDiagram
    participant Tourist
    participant CLI as stellar contract invoke
    participant SC as vat-refund
    participant Admin

    Tourist->>CLI: submit_claim (signed)
    CLI->>SC: store Claim pending
    SC-->>Tourist: claim_id

    Admin->>CLI: approve_claim
    CLI->>SC: status = approved

    Admin->>CLI: mark_paid + payout_ref
    CLI->>SC: status = paid
```

## Prerequisites

- Rust ≥ 1.84, `wasm32v1-none` target
- [Stellar CLI](https://developers.stellar.org/docs/tools/cli) v27+

## Build & test

```bash
cd contracts
stellar contract build
cargo test -p vat-refund
# or from repo root:
pnpm run contract:build
pnpm run contract:test
```

Wasm: `target/wasm32v1-none/release/vat_refund.wasm`

## Deploy example (testnet)

```bash
stellar keys generate admin --network testnet --fund

stellar contract deploy \
  --wasm target/wasm32v1-none/release/vat_refund.wasm \
  --source-account admin \
  --network testnet \
  -- \
  --admin admin \
  --treasury GD...YOUR_TREASURY_G_ADDRESS
```

## Future app integration

1. Set `VITE_VAT_REFUND_CONTRACT_ID=C...` in `.env`
2. After Supabase insert → call `submit_claim` from user wallet
3. Admin panel → `approve_claim` / `mark_paid` / `blacklist_claim`

See [docs/FEATURE_IDEAS.md](../docs/FEATURE_IDEAS.md).
