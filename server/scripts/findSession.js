import axios from 'axios';

async function main() {
  const res = await axios.get('https://demo.inelabteamdev.com/assets/index-B9UiQq4X.js');
  const code = res.data;

  // Let's search for "session"
  const matches = [...code.matchAll(/session/gi)];
  console.log('session count:', matches.length);
  for (const m of matches) {
    console.log('--- At', m.index, ':\n', code.slice(Math.max(0, m.index - 150), m.index + 200));
  }
}

main().catch(console.error);
