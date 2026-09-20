import axios from 'axios';

async function main() {
  const res = await axios.get('https://demo.inelabteamdev.com/assets/index-B9UiQq4X.js');
  const code = res.data;

  const idx = code.indexOf('async function cr');
  const idx2 = code.indexOf('function cr(');
  console.log('cr indices:', idx, idx2);

  const matches = [...code.matchAll(/cr\s*=\s*/g)];
  console.log('cr= matches:', matches.length);
  for (const m of matches) {
    console.log('--- At', m.index, ':\n', code.slice(Math.max(0, m.index - 50), m.index + 400));
  }
}

main().catch(console.error);
