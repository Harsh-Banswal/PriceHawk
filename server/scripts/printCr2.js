import axios from 'axios';

async function main() {
  const res = await axios.get('https://demo.inelabteamdev.com/assets/index-B9UiQq4X.js');
  const code = res.data;

  console.log('Code 268500 to 270500:\n', code.slice(268500, 270500));
}

main().catch(console.error);
