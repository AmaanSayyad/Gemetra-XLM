#!/usr/bin/env bash
# Deploy claim-audit + vat-refund, then wire inter-contract audit hook.
# Usage: ./contracts/scripts/deploy.sh testnet|mainnet
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
NETWORK="${1:-}"
if [[ "$NETWORK" != "testnet" && "$NETWORK" != "mainnet" ]]; then
  echo "Usage: $0 testnet|mainnet" >&2
  exit 1
fi

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

unset STELLAR_NETWORK STELLAR_RPC_URL STELLAR_NETWORK_PASSPHRASE || true

: "${TREASURY_SECRET_KEY:?Set TREASURY_SECRET_KEY in .env}"
: "${TREASURY_PUBLIC_KEY:?Set TREASURY_PUBLIC_KEY in .env}"

echo "Building wasm…"
(cd "$ROOT/contracts" && stellar contract build)

AUDIT_WASM="$ROOT/contracts/target/wasm32v1-none/release/claim_audit.wasm"
VAT_WASM="$ROOT/contracts/target/wasm32v1-none/release/vat_refund.wasm"

if [[ "$NETWORK" == "testnet" ]]; then
  RPC_URL="${STELLAR_TESTNET_RPC_URL:-https://soroban-testnet.stellar.org}"
  PASSPHRASE="Test SDF Network ; September 2015"
  AUDIT_ALIAS="claim-audit-testnet"
  VAT_ALIAS="vat-refund-testnet"
else
  RPC_URL="${STELLAR_MAINNET_RPC_URL:-https://mainnet.sorobanrpc.com}"
  PASSPHRASE="Public Global Stellar Network ; September 2015"
  AUDIT_ALIAS="claim-audit-mainnet"
  VAT_ALIAS="vat-refund-mainnet"
fi

ADDR="$TREASURY_PUBLIC_KEY"
echo "Deploying claim-audit to $NETWORK as $ADDR"
AUDIT_ID="$(stellar contract deploy \
  --wasm "$AUDIT_WASM" \
  --source-account "$TREASURY_SECRET_KEY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$PASSPHRASE" \
  --alias "$AUDIT_ALIAS" \
  -- \
  --admin "$ADDR")"
echo "claim-audit: $AUDIT_ID"

echo "Deploying vat-refund to $NETWORK as $ADDR"
VAT_ID="$(stellar contract deploy \
  --wasm "$VAT_WASM" \
  --source-account "$TREASURY_SECRET_KEY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$PASSPHRASE" \
  --alias "$VAT_ALIAS" \
  -- \
  --admin "$ADDR" \
  --treasury "$ADDR" \
  --government "$ADDR")"
echo "vat-refund: $VAT_ID"

echo "Wiring vat-refund.set_audit_contract -> $AUDIT_ID"
stellar contract invoke \
  --id "$VAT_ID" \
  --source-account "$TREASURY_SECRET_KEY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$PASSPHRASE" \
  -- \
  set_audit_contract \
  --admin "$ADDR" \
  --audit "$AUDIT_ID"

echo "Done. vat-refund=$VAT_ID claim-audit=$AUDIT_ID"
