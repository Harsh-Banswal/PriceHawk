import axios from 'axios';

async function main() {
  const res = await axios.get('https://demo.inelabteamdev.com/assets/index-B9UiQq4X.js');
  const code = res.data;

  const idx = code.indexOf('/api/challenge');
  console.log('idx of /api/challenge:', idx);
  if (idx !== -1) {
    console.log('Code around /api/challenge:\n', code.slice(Math.max(0, idx - 500), idx + 1500));
  }

  const idxSession = code.indexOf('/api/session');
  console.log('idx of /api/session:', idxSession);
  if (idxSession !== -1) {
    console.log('Code around /api/session:\n', code.slice(Math.max(0, idxSession - 500), idxSession + 1500));
  }
}

main().catch(console.error);
