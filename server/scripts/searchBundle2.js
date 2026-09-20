import axios from 'axios';

async function main() {
  const res = await axios.get('https://demo.inelabteamdev.com/assets/index-B9UiQq4X.js');
  const code = res.data;

  const idx = code.indexOf('.missing=');
  const idx2 = code.indexOf('missing()');
  console.log('missing indices:', idx, idx2);

  // Search around the component that defines a
  const idxPriceIdle = code.indexOf('price-idle');
  console.log('Code before price-idle (800 chars):\n', code.slice(Math.max(0, idxPriceIdle - 1200), idxPriceIdle));
}

main().catch(console.error);
