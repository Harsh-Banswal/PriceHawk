import axios from 'axios';

async function main() {
  const res = await axios.get('https://demo.inelabteamdev.com/assets/index-B9UiQq4X.js');
  const code = res.data;

  const idx = code.indexOf('Xn=');
  const idx2 = code.indexOf('function Xn');
  console.log('Xn indices:', idx, idx2);
  const pos = idx !== -1 ? idx : idx2;
  console.log(code.slice(259500, 259800));
}

main().catch(console.error);
