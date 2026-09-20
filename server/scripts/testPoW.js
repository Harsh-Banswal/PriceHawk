import axios from 'axios';
import crypto from 'crypto';

const gr = (s) => crypto.createHash('sha256').update(s).digest('hex');

function xr(salt, difficulty) {
  const target = '0'.repeat(difficulty);
  let nonce = 0;
  while (true) {
    if (gr(salt + ':' + nonce).slice(0, difficulty) === target) {
      return nonce;
    }
    nonce++;
  }
}

// Let's get the challenge
async function testChallenge() {
  const res = await axios.get('https://demo.inelabteamdev.com/api/challenge');
  const chal = res.data;
  console.log('Challenge:', { salt: chal.salt, difficulty: chal.difficulty });

  const nonce = xr(chal.salt, chal.difficulty);
  console.log('Solved nonce:', nonce, 'Hash:', gr(chal.salt + ':' + nonce));
}

testChallenge().catch(console.error);
