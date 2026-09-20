import axios from 'axios';

async function main() {
  const res = await axios.get('https://demo.inelabteamdev.com/assets/index-B9UiQq4X.js');
  const code = res.data;

  const matches = [...code.matchAll(/challenge/gi)];
  console.log('challenge occurrences:', matches.length);
  for (const m of matches.slice(0, 5)) {
    console.log('Context around challenge at', m.index, ':\n', code.slice(Math.max(0, m.index - 200), m.index + 300));
  }
}

main().catch(console.error);
