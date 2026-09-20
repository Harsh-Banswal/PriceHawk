import axios from 'axios';

async function main() {
  const res = await axios.get('https://demo.inelabteamdev.com/assets/index-B9UiQq4X.js');
  const code = res.data;

  console.log('Code 263500 to 265500:\n', code.slice(263500, 265500));
}

main().catch(console.error);
