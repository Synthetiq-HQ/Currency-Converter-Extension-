const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const QC=require('../currency.js');global.QC=QC;
const QCSettings=require('../settings.js');
const tick=()=>new Promise(r=>setImmediate(r));
function harness({prefs={},selection='',restricted=false}={}) {
  class Element {
    constructor(){this.value='';this.children=[];this.events={};this.classList={toggle(){}};this.disabled=false;this.textContent='';}
    append(...elements){this.children.push(...elements)}
    replaceChildren(){this.children=[]}
    setAttribute(){}
    addEventListener(name,fn){this.events[name]=fn}
    focus(){}
  }
  const ids=['from','to','amount','status','result','original','copy','copy-number','refresh','attribution','favorites','converter','settings','swap','site-label','toggle-site'];
  const elements=Object.fromEntries(ids.map(id=>[id,new Element()]));
  const requests=[],timers=new Map(),copied=[];let timerId=0;
  const chrome={
    storage:{sync:{async get(){return prefs},async set(v){Object.assign(prefs,v)}},local:{async get(){return {enabledSites:[]}}}},
    runtime:{async sendMessage(message){if(message.action==='selection')return {text:selection};return new Promise(resolve=>requests.push({message,resolve}));},openOptionsPage(){}},
    permissions:{async contains(){return false}},tabs:{async query(){return [{id:1,url:restricted?'chrome://settings':'https://shop.example/'}]}}
  };
  const ctx={QC,QCSettings,chrome,Intl,URL,URLSearchParams,location:{search:''},navigator:{clipboard:{async writeText(value){copied.push(value)}}},
    document:{getElementById:id=>elements[id],createElement:()=>new Element()},
    setTimeout(fn){timers.set(++timerId,fn);return timerId},clearTimeout(id){timers.delete(id)}};
  vm.createContext(ctx);vm.runInContext(fs.readFileSync('popup.js','utf8'),ctx);
  return {elements,requests,prefs,copied,async event(id,name){await elements[id].events[name]({preventDefault(){}});await tick()},
    async type(text){elements.amount.value=text;elements.amount.events.input();for(const[key,fn]of [...timers]){timers.delete(key);fn()}await tick()},
    async flush(){for(const[key,fn]of [...timers]){timers.delete(key);fn()}await tick()}};
}
test('manual converter is available without permission on restricted pages',async()=>{
  const h=harness({restricted:true});await tick();assert.equal(h.elements['toggle-site'].disabled,true);
  await h.type('100');assert.equal(h.requests[0].message.from,'USD');h.requests[0].resolve({result:75});await tick();
  assert.equal(h.elements.result.textContent,'£75.00');
});
test('selected European price pre-fills the popup correctly',async()=>{
  const h=harness({selection:'€1.234,56'});await tick();
  assert.equal(h.requests[0].message.amount,1234.56);assert.equal(h.requests[0].message.from,'EUR');
  h.requests[0].resolve({result:1000});await tick();assert.equal(h.elements.result.textContent,'£1,000.00');
});
test('editing input cancels an old popup result',async()=>{
  const h=harness();await tick();await h.type('100');await h.type('200');
  h.requests[1].resolve({result:150});await tick();h.requests[0].resolve({result:75});await tick();
  assert.equal(h.elements.result.textContent,'£150.00');
});
test('invalid input cannot leave an old amount copyable',async()=>{
  const h=harness();await tick();await h.type('100');h.requests[0].resolve({result:75});await tick();
  await h.type('Pay 100');assert.equal(h.elements.copy.disabled,true);assert.equal(h.elements.result.textContent,'—');assert.equal(h.requests.length,1);
});
test('swap reverses currencies and uses the converted amount',async()=>{
  const h=harness();await tick();await h.type('$100');h.requests[0].resolve({result:75});await tick();
  await h.event('swap','click');await h.flush();const next=h.requests[1].message;
  assert.equal(next.from,'GBP');assert.equal(next.to,'USD');assert.equal(next.amount,75);
});
test('plain number copy omits the currency',async()=>{
  const h=harness();await tick();await h.type('100');h.requests[0].resolve({result:75});await tick();
  await h.event('copy-number','click');assert.deepEqual(h.copied,['75.00']);
});
test('saved comma-decimal format works after swapping',async()=>{
  const h=harness({prefs:{numberFormat:'comma'}});await tick();await h.type('100,00');h.requests[0].resolve({result:75.12});await tick();
  await h.event('swap','click');await h.flush();assert.equal(h.requests[1].message.amount,75.12);
});
