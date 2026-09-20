import axios from 'axios';

async function main() {
  const res = await axios.get('https://demo.inelabteamdev.com/assets/index-B9UiQq4X.js');
  const code = res.data;
  console.log('JS Bundle length:', code.length);

  // Search for "price-idle", "price-block", "Reveal price", "disabled"
  const idx = code.indexOf('price-idle');
  console.log('idx of price-idle:', idx);
  if (idx !== -1) {
    console.log('Context around price-idle:\n', code.slice(Math.max(0, idx - 400), idx + 800));
  }

  const idxReveal = code.indexOf('Reveal price');
  console.log('idx of Reveal price:', idxReveal);
  if (idxReveal !== -1) {
    console.log('Context around Reveal price:\n', code.slice(Math.max(0, idxReveal - 400), idxReveal + 600));
  }
}

main().catch(console.error);
