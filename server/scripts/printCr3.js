import axios from 'axios';

async function main() {
  const res = await axios.get('https://demo.inelabteamdev.com/assets/index-B9UiQq4X.js');
  const code = res.data;

  console.log('Code 265400 to 267000:\n', code.slice(265400, 267000));
}

main().catch(console.error);
