const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const QC=require('../currency.js');
global.QC=QC;
const QCSettings=require('../settings.js');
function harness({sites=[],granted=[], selection='$100'}={}) {
  const handlers={},registered=[],sent=[],opened=[],injected=[];
  const local={enabledSites:sites};
  const event=name=>({addListener(fn){handlers[name]=fn;}});
  const chrome={
    runtime:{getURL:path=>'chrome-extension://test/'+path,onMessage:event('message'),onInstalled:event('install'),onStartup:event('startup')},
    storage:{sync:{async get(){return {}}},local:{async get(){return local},async set(data){Object.assign(local,data)},async remove(){}},session:{async set(data){Object.assign(local,data)}}},
    permissions:{async contains({origins}){return origins.every(o=>granted.includes(o))},onRemoved:event('removed'),onAdded:event('added')},
    scripting:{async getRegisteredContentScripts(){return registered.slice()},async unregisterContentScripts(){registered.length=0},async registerContentScripts(scripts){registered.push(...scripts)},async executeScript(args){injected.push(args);return [{result:selection}]}},
    tabs:{async get(id){return {id,url:'https://shop.example/item'}},async query(){return [{id:1,url:'https://shop.example/item'}]},async sendMessage(id,msg){sent.push(msg);},async create(value){opened.push(value)}},
    contextMenus:{async removeAll(){},create(){},onClicked:event('context')}
  };
  const ctx={chrome,QC,QCSettings,fetch(){},importScripts(){},QCRates:{create(){return {async convert(args){return {result:args.amount,refresh:args.refresh}},async clear(){}}}},URL,console};
  vm.createContext(ctx);vm.runInContext(fs.readFileSync('background.js','utf8'),ctx);
  function message(data,sender={url:'chrome-extension://test/popup.html'}) {
    return new Promise(resolve=>handlers.message(data,sender,resolve));
  }
  return {handlers,registered,sent,opened,injected,local,message};
}
test('only explicitly enabled and granted sites get registered',async()=>{
  const h=harness({sites:['https://shop.example/*','https://ungranted.example/*','<all_urls>'],granted:['https://shop.example/*']});
  await h.message({action:'syncSites'});assert.equal(h.registered.length,1);
  assert.equal(h.registered[0].matches.join(','),'https://shop.example/*');
  assert.deepEqual(Array.from(h.local.enabledSites),['https://shop.example/*']);
});
test('turning highlighting off removes future injection and notifies open overlays',async()=>{
  const h=harness({sites:['https://shop.example/*'],granted:['https://shop.example/*']});
  await h.message({action:'syncSites'});h.local.enabledSites=[];await h.message({action:'syncSites'});
  assert.equal(h.registered.length,0);assert.ok(h.sent.some(m=>m.action==='sitesChanged'));
});
test('content scripts cannot clear cache or read arbitrary tabs',async()=>{
  const h=harness();
  for(const action of ['clearCache','selection','syncSites']) {
    assert.ok((await h.message({action,tabId:99},{url:'https://shop.example',tab:{id:1}})).error);
  }
});
test('extension page open in a tab can use manual controls',async()=>{
  const h=harness();const result=await h.message({action:'selection',tabId:1},{url:'chrome-extension://test/popup.html',tab:{id:2}});
  assert.equal(result.text,'$100');
});
test('restricted selection failure remains recoverable',async()=>{
  const h=harness();h.injected.push = ()=>{throw Error('Cannot access a chrome:// URL')};
  assert.match((await h.message({action:'selection',tabId:1})).error,/Cannot access/);
  await h.handlers.context({menuItemId:'qc_convert_selection',selectionText:'$100'}, {id:1});
  assert.equal(h.opened[0].url,'chrome-extension://test/popup.html?selection=1');
});
test('content-script conversion cannot force cache bypass',async()=>{
  const h=harness();const result=await h.message({action:'convert',amount:100,refresh:true},{url:'https://shop.example',tab:{id:1}});
  assert.equal(result.refresh,false);
});
test('worker finishes a permission grant after Dia closes the requesting popup',async()=>{
  const granted=[];const h=harness({granted});
  await h.message({action:'prepareSite',site:'https://shop.example/*',tabId:1});
  granted.push('https://shop.example/*');await h.handlers.added();
  assert.ok(h.local.enabledSites.includes('https://shop.example/*'));
  assert.equal(h.registered.length,1);assert.equal(h.injected[0].target.tabId,1);
});
test('expired or unrelated permission grants do not enable highlighting',async()=>{
  const h=harness({granted:['https://shop.example/*']});
  h.local.pendingHighlighting={site:'https://shop.example/*',tabId:1,expires:0};
  await h.handlers.added();assert.equal(h.local.enabledSites.length,0);
});
