import axios from 'axios';

async function main() {
  const res = await axios.get('https://demo.inelabteamdev.com/assets/index-B9UiQq4X.js');
  const code = res.data;

  let idx = 0;
  while ((idx = code.indexOf('Reveal price', idx)) !== -1) {
    console.log('--- Match at', idx, '---');
    console.log(code.slice(Math.max(0, idx - 400), idx + 400));
    idx += 12;
  }
}

main().catch(console.error);
