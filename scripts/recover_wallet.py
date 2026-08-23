#!/usr/bin/env python3
"""
Stellar wallet recovery from MNEMONIC env var (never commit the phrase).

Usage:
  MNEMONIC="word1 word2 ... word12" python3 scripts/recover_wallet.py
"""

import os
import sys

try:
    from stellar_sdk import Keypair
except ImportError:
    print("Install: pip install stellar-sdk bip-utils (or use recover-stellar-wallet.cjs)")
    sys.exit(1)

mnemonic = os.environ.get("MNEMONIC", "").strip()
if not mnemonic:
    print("Set MNEMONIC env var with your 12/24-word phrase.", file=sys.stderr)
    sys.exit(1)

try:
    keypair = Keypair.from_mnemonic_phrase(mnemonic)
    print("\n=== Stellar Wallet Recovery ===\n")
    print("Public Key (Address):")
    print(keypair.public_key)
    print("\nSecret Key (KEEP THIS SECURE!):")
    print(keypair.secret)
    print("\n================================\n")
except Exception as e:
    print(f"Error: {e}", file=sys.stderr)
    sys.exit(1)
