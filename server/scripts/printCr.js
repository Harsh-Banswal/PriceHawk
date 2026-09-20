import axios from 'axios';

async function main() {
  const res = await axios.get('https://demo.inelabteamdev.com/assets/index-B9UiQq4X.js');
  const code = res.data;

  console.log('Code 270000 to 272500:\n', code.slice(270500, 272530));
}

main().catch(console.error);
