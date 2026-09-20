import axios from 'axios';

async function testSession() {
  const chalRes = await axios.get('https://demo.inelabteamdev.com/api/challenge');
  const chal = chalRes.data;
  console.log('Got challenge:', { salt: chal.salt, difficulty: chal.difficulty, ts: chal.ts });
}

testSession().catch(console.error);
