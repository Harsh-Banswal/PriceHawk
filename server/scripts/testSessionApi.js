import axios from 'axios';

async function testSessionApi() {
  // 1. Get challenge
  const res1 = await axios.get('https://demo.inelabteamdev.com/api/challenge');
  console.log('Challenge status:', res1.status, Object.keys(res1.data));
  const chal = res1.data;

  // 2. Try posting empty or invalid to see response message
  try {
    const res2 = await axios.post('https://demo.inelabteamdev.com/api/session', {});
    console.log('Empty post response:', res2.data);
  } catch (err) {
    console.log('Empty post err:', err.response?.status, err.response?.data);
  }

  // 3. Post with just salt and csig
  try {
    const res3 = await axios.post('https://demo.inelabteamdev.com/api/session', {
      salt: chal.salt,
      ts: chal.ts,
      difficulty: chal.difficulty,
      csig: chal.csig,
    });
    console.log('Partial post response:', res3.data);
  } catch (err) {
    console.log('Partial post err:', err.response?.status, err.response?.data);
  }
}

testSessionApi().catch(console.error);
