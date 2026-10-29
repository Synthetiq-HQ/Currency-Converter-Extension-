const { test } = require('node:test');
const assert = require('node:assert/strict');
global.QC = require('../currency.js');
const { create } = require('../rates.js');
const now = Date.parse('2026-10-29T18:00:00Z');
const primary = (rate=.75108) => ({ base:'USD', quote:'GBP', rate, date:'2026-10-29' });
const fallback = () => ({ result:'success', base_code:'USD', time_last_update_unix:now/1000-3600, rates:{ GBP:.752 } });
function harness(respond, initial={}) {
  let data=structuredClone(initial), calls=[];
  const storage={async get(key){return {[key]:data[key]};},async set(value){Object.assign(data,structuredClone(value));}};
  const fetch=async(url,options)=>{calls.push(url);const result=await respond(url,options);return {ok:true,json:async()=>result};};
  return { service:create({fetch,storage,now:()=>now,timeout:20}), calls, data:()=>data, storage };
}
const input={from:'USD',to:'GBP',amount:1234.56};
test('uses working primary endpoint and current payload',async()=>{
  const h=harness(()=>primary());const r=await h.service.convert(input);
  assert.equal(r.result,1234.56*.75108); assert.equal(r.provider,'frankfurter');
  assert.equal(h.calls[0],'https://api.frankfurter.dev/v2/rate/USD/GBP');
});
test('fallback is reached after primary fails',async()=>{
  const h=harness(url=>{if(url.includes('frankfurter'))throw Error();return fallback();});
  const r=await h.service.convert(input);assert.equal(r.provider,'exchangerate-api');assert.equal(h.calls.length,2);
  assert.equal(h.calls[1],'https://open.er-api.com/v6/latest/USD');
});
test('cache stores rate, not original amount',async()=>{
  const h=harness(()=>primary());await h.service.convert(input);const r=await h.service.convert({...input,amount:100});
  assert.equal(r.result,75.108);assert.equal(r.cached,true);assert.equal(h.calls.length,1);
});
test('new requests share the same in-flight rate',async()=>{
  let done;const pending=new Promise(r=>done=r);const h=harness(async()=>{await pending;return primary();});
  const requests=[h.service.convert(input),h.service.convert({...input,amount:50})];
  await new Promise(r=>setImmediate(r));done();const result=await Promise.all(requests);
  assert.equal(h.calls.length,1);assert.equal(result[1].result,50*.75108);
});
test('clear and refresh invalidate saved rates',async()=>{
  const h=harness(()=>primary());await h.service.convert(input);await h.service.convert({...input,refresh:true});
  assert.equal(h.calls.length,2);await h.service.clear();await h.service.convert(input);assert.equal(h.calls.length,3);
});
test('legacy cache cannot contaminate new provider',async()=>{
  const h=harness(()=>primary(),{quickcurrency_rates:{'USD:GBP':{rate:99,timestamp:now}}});
  assert.equal((await h.service.convert(input)).rate,.75108);
});
test('proxy cache is separate and failures do not leak into public APIs',async()=>{
  const h=harness(url=>url.includes('frankfurter')?primary():{result:.8});
  await h.service.convert(input);
  assert.equal((await h.service.convert({...input,settings:{useProxy:true,proxyURL:'http://localhost:5000/?from={FROM}&to={TO}&amount={AMOUNT}'}})).rate,.8);
  const fail=harness(()=>{throw Error();});
  await assert.rejects(fail.service.convert({...input,settings:{useProxy:true,proxyURL:'http://localhost:5000/?amount={AMOUNT}'}}),/proxy/);
  assert.equal(fail.calls.length,1);
});
test('rejects old, future, mismatched and invalid provider data',async()=>{
  for(const response of [{...primary(),date:'2020-01-01'},{...primary(),date:'2030-01-01'},primary(-1),primary('0.75'),primary(NaN),{...primary(),base:'EUR'}]) {
    const h=harness(url=>url.includes('frankfurter')?response:{result:'error'});
    await assert.rejects(h.service.convert(input),/current rate/);
  }
});
test('offline failure stays explicit instead of returning stale rates',async()=>{
  const h=harness(()=>{throw Error('offline');});await assert.rejects(h.service.convert(input),/current rate/);
});
test('hung fetches are aborted and fall back without hanging',async()=>{
  let aborted=false;
  const h=harness((url,{signal})=>url.includes('frankfurter')?new Promise((_,reject)=>signal.addEventListener('abort',()=>{aborted=true;reject(Error('timeout'));})):fallback());
  await h.service.convert(input);assert.equal(aborted,true);
});
test('zero, negative and same-currency amounts are valid',async()=>{
  const h=harness(()=>primary());assert.equal((await h.service.convert({...input,amount:0})).result,0);
  assert.equal((await h.service.convert({...input,to:'USD'})).result,1234.56);
  assert.equal(h.calls.length,0);assert.equal((await h.service.convert({...input,amount:-100})).result,-75.108);
});
test('invalid inputs never reach the network',async()=>{
  const h=harness(()=>primary());
  for(const bad of [{from:'PAY'},{to:'ABC'},{amount:Infinity},{amount:'100'},{amount:1e16}])await assert.rejects(h.service.convert({...input,...bad}));
  assert.equal(h.calls.length,0);
});
test('concurrent cache writes preserve distinct pairs across worker restart',async()=>{
  const h=harness(url=>({...primary(),quote:url.endsWith('/EUR')?'EUR':'GBP'}));
  await Promise.all([h.service.convert(input),h.service.convert({...input,to:'EUR'})]);
  const next=create({fetch:()=>{throw Error('should use cache');},storage:h.storage,now:()=>now});
  assert.equal((await next.convert(input)).cached,true);assert.equal((await next.convert({...input,to:'EUR'})).cached,true);
});
test('malformed saved cache values are ignored',async()=>{
  const h=harness(()=>primary(),{quickcurrency_rates_v2:{'public-v2|USD:GBP':{rate:'bad',date:'2026-10-29',fetchedAt:now}}});
  assert.equal((await h.service.convert(input)).rate,.75108);
});
