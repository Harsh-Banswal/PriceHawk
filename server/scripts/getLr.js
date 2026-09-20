import axios from 'axios';
import crypto from 'crypto';

const sha256 = (str) => crypto.createHash('sha256').update(str).digest('hex');

// From bundle:
// var lr = P(555)+P(513)+P(541)+P(507)+"y"
// Let's find lr value from running in browser or extracting from bundle
async function getLr() {
  const res = await axios.get('https://demo.inelabteamdev.com/assets/index-B9UiQq4X.js');
  const code = res.data;
  // Let's find what lr is by searching for lr=
  const idx = code.indexOf('var lr=');
  console.log('Context around var lr=:', code.slice(idx, idx + 100));
}

getLr().catch(console.error);
