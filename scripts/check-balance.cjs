/**
 * Check Stellar Account Balance
 */

const https = require('https');

const publicKey = 'GA2KFW4G6DJZNFIPBMQYJOQSJWO4UCQ2QJNARC7OG3U7LFOBVTX5NUJJ';
const horizonUrl = `https://horizon-testnet.stellar.org/accounts/${publicKey}`;

console.log('\n💰 Checking account balance...\n');
console.log(`Public Key: ${publicKey}\n`);

https.get(horizonUrl, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    if (res.statusCode === 200) {
      const account = JSON.parse(data);
      
      console.log('✅ Account Details:\n');
      console.log(`Account ID: ${account.id}`);
      console.log(`Sequence: ${account.sequence}`);
      console.log(`\n💎 Balances:`);
      
      account.balances.forEach((balance) => {
        if (balance.asset_type === 'native') {
          console.log(`  - XLM: ${parseFloat(balance.balance).toFixed(7)} XLM`);
        } else {
          console.log(`  - ${balance.asset_code}: ${balance.balance}`);
        }
      });
      
      console.log(`\n📊 Subentries: ${account.subentry_count}`);
      console.log(`📝 Signers: ${account.signers.length}`);
      
      console.log(`\n🔗 View on Stellar Expert:`);
      console.log(`https://stellar.expert/explorer/testnet/account/${publicKey}\n`);
    } else {
      console.error('❌ Error fetching account');
      console.error(`Status: ${res.statusCode}`);
      console.error(`Response: ${data}`);
    }
  });
}).on('error', (err) => {
  console.error('❌ Network error:', err.message);
});
