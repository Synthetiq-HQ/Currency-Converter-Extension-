const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const QC=require('../currency.js');global.QC=QC;
const QCSettings=require('../settings.js');
const tick=()=>new Promise(r=>setImmediate(r));
function harness(enabled=true) {
  class Element {
    constructor(){this.children=[];this.style={setProperty(){}};this.isConnected=true;this.events={};this.className='';this.textContent='';}
    append(...items){this.children.push(...items);}
    setAttribute(){}
    matches(){return false;}
    addEventListener(name,fn){this.events[name]=fn;}
    attachShadow(){this.shadow=new Element();return this.shadow;}
    remove(){this.isConnected=false;}
    getBoundingClientRect(){return {left:100,top:100,bottom:120,width:150,height:60}}
  }
  const events={},messages=[],timers=new Map(),roots=[],conversions=[];
  let selected='$100',nextTimer=0;
  const document={activeElement:new Element(),hidden:false,createElement:()=>new Element(),
    documentElement:{append(host){roots.push(host)}},addEventListener(name,fn,opts){
      (events[name]??=new Set()).add(fn);opts?.signal?.addEventListener('abort',()=>events[name].delete(fn));
    }};
  const chrome={storage:{sync:{async get(){return {targetCurrency:'GBP'}}},onChanged:{addListener(){}}},
    runtime:{async sendMessage(message){if(message.action==='siteState')return {enabled};
      return new Promise(resolve=>conversions.push({message,resolve}));},onMessage:{addListener(fn){messages.push(fn)}}}};
  const ctx={document,chrome,QC,QCSettings,AbortController,URL,innerWidth:800,innerHeight:600,
    window:{getSelection:()=>({toString:()=>selected,rangeCount:1,getRangeAt:()=>({getBoundingClientRect:()=>({left:50,top:90,bottom:110,width:90})})}),addEventListener(){}},
    setTimeout(fn){timers.set(++nextTimer,fn);return nextTimer;},clearTimeout(id){timers.delete(id)},navigator:{clipboard:{async writeText(){}}}};
  vm.createContext(ctx);vm.runInContext(fs.readFileSync('content.js','utf8'),ctx);
  return {roots,events,conversions,messages,document,setText(text){selected=text},setEnabled(value){enabled=value},
    async event(name){for(const fn of events[name]||[])fn({});for(const [key,fn]of [...timers]){timers.delete(key);fn();}await tick()},
    refresh(){messages[0]({action:'sitesChanged'},null,()=>{});return tick()}};
}
test('manual mode never adds automatic selection listeners or polling',async()=>{
  const h=harness(false);await tick();assert.equal(h.events.selectionchange,undefined);assert.equal(h.conversions.length,0);
});
test('new selection cancels late results from old request',async()=>{
  const h=harness();await tick();await h.event('selectionchange');
  assert.equal(h.conversions.length,1);const first=h.roots.at(-1);
  h.setText('$200');await h.event('selectionchange');assert.equal(first.isConnected,false);
  h.conversions[1].resolve({result:150});await tick();const current=h.roots.at(-1);
  assert.equal(current.shadow.children[1].children[1].textContent,'≈ £150.00');
  h.conversions[0].resolve({result:75});await tick();
  assert.equal(current.shadow.children[1].children[1].textContent,'≈ £150.00');
});
test('editing fields do not trigger conversions',async()=>{
  const h=harness();await tick();h.document.activeElement.matches=()=>true;
  await h.event('selectionchange');assert.equal(h.conversions.length,0);
});
test('disabling a site aborts listeners and removes its overlay',async()=>{
  const h=harness();await tick();await h.event('selectionchange');const overlay=h.roots.at(-1);
  h.setEnabled(false);await h.refresh();assert.equal(overlay.isConnected,false);assert.equal(h.events.selectionchange.size,0);
  h.conversions[0].resolve({result:75});await tick();assert.equal(overlay.isConnected,false);
});
