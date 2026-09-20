import axios from 'axios';

async function main() {
  const res = await axios.get('https://demo.inelabteamdev.com/assets/index-B9UiQq4X.js');
  const code = res.data;

  // Let's extract vr and pr
  // We can evaluate vr and pr in a VM context
  const vm = await import('vm');
  const sandbox = {};
  
  // Find vr definition
  const vrStart = code.indexOf('function vr(){');
  const vrEnd = code.indexOf('var yr=', vrStart);
  const vrCode = code.slice(vrStart, vrEnd);
  
  // Find pr definition
  const prStart = code.indexOf('function pr(');
  const prEnd = code.indexOf('var mr=', prStart);
  const prCode = code.slice(prStart, prEnd);
  
  // Find P = pr self-invoking loop
  const pLoopStart = code.indexOf('var P=pr;(function');
  const pLoopEnd = code.indexOf('var lr=', pLoopStart);
  const pLoopCode = code.slice(pLoopStart, pLoopEnd);

  const script = `${vrCode}\n${prCode}\n${pLoopCode}\nglobalThis.P = P;`;
  vm.runInNewContext(script, sandbox);

  const P = sandbox.P;
  console.log('P(500):', P(500));
  console.log('P(568):', P(568));
  console.log('P(558)+P(495):', P(558)+P(495));
  console.log('P(520):', P(520));
  console.log('P(543)+d:', P(543)+'d');
  console.log('P(538)+t:', P(538)+'t');
  console.log('P(497):', P(497));
  console.log('P(509)+P(605):', P(509)+P(605));
  console.log('P(588)+P(489):', P(588)+P(489));
  console.log('P(585)+P(523)+s/+e+P(526):', P(585)+P(523)+'s/'+'123'+P(526));
  console.log('lr:', sandbox.P(555)+sandbox.P(513)+sandbox.P(541)+sandbox.P(507)+'y');
}

main().catch(console.error);
