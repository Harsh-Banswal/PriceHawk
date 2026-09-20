import axios from 'axios';

async function main() {
  const res = await axios.get('https://demo.inelabteamdev.com/assets/index-B9UiQq4X.js');
  const code = res.data;

  console.log('Code around 272534 (2500 chars):\n', code.slice(272500, 275000));
}

main().catch(console.error);
