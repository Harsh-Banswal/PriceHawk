import axios from 'axios';

async function checkDate() {
  const res = await axios.get('https://demo.inelabteamdev.com/api/catalog');
  console.log('Server Date Header:', res.headers['date']);
  console.log('Local System Date:', new Date().toUTCString());

  const chal = await axios.get('https://demo.inelabteamdev.com/api/challenge');
  console.log('Challenge ts:', chal.data.ts);
  console.log('Challenge Date:', new Date(chal.data.ts).toUTCString());
}

checkDate().catch(console.error);
