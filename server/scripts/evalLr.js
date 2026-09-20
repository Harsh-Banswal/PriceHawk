import axios from 'axios';
import vm from 'vm';

async function main() {
  const res = await axios.get('https://demo.inelabteamdev.com/assets/index-B9UiQq4X.js');
  const code = res.data;

  // Let's find the slice containing vr, pr, and lr
  const idxVr = code.indexOf('function vr(){');
  const idxEnd = code.indexOf('var ur=new Uint32Array');
  console.log('Indices:', idxVr, idxEnd);

  const snippet = code.slice(idxVr, idxEnd + 50);

  const context = { window: {}, console };
  vm.createContext(context);
  vm.runInContext(snippet + '; context_lr = lr;', context);
  console.log('Value of lr:', context.context_lr);
}

main().catch(console.error);
