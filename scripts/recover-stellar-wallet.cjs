/**
 * Stellar wallet recovery — reads mnemonic from env (never commit the phrase).
 *
 * Usage:
 *   MNEMONIC="word1 word2 ... word12" node scripts/recover-stellar-wallet.cjs
 */

const bip39 = require('bip39');
const { derivePath } = require('ed25519-hd-key');
const StellarSdk = require('@stellar/stellar-sdk');

const mnemonic = process.env.MNEMONIC?.trim();
if (!mnemonic) {
  console.error('Set MNEMONIC env var with your 12/24-word phrase.');
  process.exit(1);
}

try {
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const derived = derivePath("m/44'/148'/0'", seed.toString('hex'));
  const keypair = StellarSdk.Keypair.fromRawEd25519Seed(derived.key);

  console.log('\n=== Stellar Wallet Recovery ===\n');
  console.log('Public Key (Address):');
  console.log(keypair.publicKey());
  console.log('\nSecret Key (KEEP THIS SECURE!):');
  console.log(keypair.secret());
  console.log('\n================================\n');
} catch (error) {
  console.error('Error recovering wallet:', error.message);
  process.exit(1);
}
