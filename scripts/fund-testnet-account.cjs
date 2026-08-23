/**
 * Fund Testnet Account with Friendbot
 * Activates a Stellar testnet account with 10,000 XLM
 */

const https = require('https');

const publicKey = 'GA2KFW4G6DJZNFIPBMQYJOQSJWO4UCQ2QJNARC7OG3U7LFOBVTX5NUJJ';
const friendbotUrl = `https://friendbot.stellar.org?addr=${publicKey}`;

console.log('\n🚀 Funding testnet account...\n');
console.log(`Public Key: ${publicKey}`);
console.log(`Friendbot URL: ${friendbotUrl}\n`);

https.get(friendbotUrl, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('✅ SUCCESS! Account funded with 10,000 XLM\n');
      console.log('Account Details:');
      const response = JSON.parse(data);
      console.log(`- Balance: 10,000 XLM`);
      console.log(`- Sequence: ${response.sequence || 'N/A'}`);
      console.log(`\n🎉 Your testnet account is now active!`);
      console.log(`\nView on Stellar Expert:`);
      console.log(`https://stellar.expert/explorer/testnet/account/${publicKey}\n`);
    } else {
      console.error('❌ Error funding account');
      console.error(`Status: ${res.statusCode}`);
      console.error(`Response: ${data}`);
    }
  });
}).on('error', (err) => {
  console.error('❌ Network error:', err.message);
});
