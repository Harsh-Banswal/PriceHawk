import axios from 'axios';

async function main() {
  const res = await axios.get('https://demo.inelabteamdev.com/assets/index-B9UiQq4X.js');
  const code = res.data;

  // Let's find where Dr is defined
  const idx = code.indexOf('async function Dr');
  const idx2 = code.indexOf('Dr=async');
  const idx3 = code.indexOf('function Dr(');
  console.log('Dr indices:', idx, idx2, idx3);

  // If not found, search for "Dr("
  const matches = [...code.matchAll(/Dr\s*=\s*/g)];
  console.log('Dr= matches:', matches.length);
  for (const m of matches) {
    console.log('--- At', m.index, ':\n', code.slice(Math.max(0, m.index - 50), m.index + 500));
  }
}

main().catch(console.error);
