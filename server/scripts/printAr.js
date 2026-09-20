import axios from 'axios';

async function main() {
  const res = await axios.get('https://demo.inelabteamdev.com/assets/index-B9UiQq4X.js');
  const code = res.data;

  const idx = code.indexOf('class{hoverAt=0');
  console.log('Ar class (800 chars):\n', code.slice(idx, idx + 800));
}

main().catch(console.error);
