import axios from 'axios';

async function main() {
  const res = await axios.get('https://demo.inelabteamdev.com/assets/index-B9UiQq4X.js');
  const code = res.data;

  const idx = code.indexOf('function ar(');
  const idx2 = code.indexOf('function or(');
  const idx3 = code.indexOf('function sr(');
  console.log('Indices of ar, or, sr:', idx, idx2, idx3);

  console.log('ar code:\n', code.slice(idx - 50, idx + 400));
  console.log('or code:\n', code.slice(idx2 - 50, idx2 + 400));
  console.log('sr code:\n', code.slice(idx3 - 50, idx3 + 400));
}

main().catch(console.error);
