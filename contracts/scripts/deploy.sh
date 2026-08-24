#!/usr/bin/env bash
# Deploy vat-refund to Stellar testnet or mainnet.
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

# .env may set STELLAR_NETWORK=mainnet; flags below must win.
unset STELLAR_NETWORK STELLAR_RPC_URL STELLAR_NETWORK_PASSPHRASE || true

: "${TREASURY_SECRET_KEY:?Set TREASURY_SECRET_KEY in .env}"
: "${TREASURY_PUBLIC_KEY:?Set TREASURY_PUBLIC_KEY in .env}"

WASM="$ROOT/contracts/target/wasm32v1-none/release/vat_refund.wasm"
if [[ ! -f "$WASM" ]]; then
  echo "Building wasm…"
  (cd "$ROOT/contracts" && stellar contract build)
fi

if [[ "$NETWORK" == "testnet" ]]; then
  RPC_URL="${STELLAR_TESTNET_RPC_URL:-https://soroban-testnet.stellar.org}"
  PASSPHRASE="Test SDF Network ; September 2015"
  ALIAS="vat-refund-testnet"
else
  RPC_URL="${STELLAR_MAINNET_RPC_URL:-https://mainnet.sorobanrpc.com}"
  PASSPHRASE="Public Global Stellar Network ; September 2015"
  ALIAS="vat-refund-mainnet"
fi

ADDR="$TREASURY_PUBLIC_KEY"
echo "Deploying vat-refund to $NETWORK as $ADDR"

stellar contract deploy \
  --wasm "$WASM" \
  --source-account "$TREASURY_SECRET_KEY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$PASSPHRASE" \
  --alias "$ALIAS" \
  -- \
  --admin "$ADDR" \
  --treasury "$ADDR" \
  --government "$ADDR"
