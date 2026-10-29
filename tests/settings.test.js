const { test } = require('node:test');
const assert = require('node:assert/strict');
global.QC = require('../currency.js');
const settings = require('../settings.js');
test('retains existing 1.1 settings and adds new defaults', () => {
  const saved = {targetCurrency:'CNY',precision:0,cacheTTL:60,useProxy:true,proxyURL:'http://localhost/convert',ambiguousYenDefault:'CNY'};
  const value = settings.clean(saved);
  for (const [key,expected] of Object.entries(saved)) assert.equal(value[key],expected);
  assert.equal(value.sourceCurrency,'USD'); assert.equal(value.numberFormat,'auto');
});
test('sanitises malformed preferences and bounds cache/favourites', () => {
  const value = settings.clean({targetCurrency:'PAY',sourceCurrency:'XYZ',precision:15,cacheTTL:1e9, favorites:['USD','USD','PAY'],numberFormat:'invalid'});
  assert.equal(value.targetCurrency,'GBP');assert.equal(value.sourceCurrency,'USD');assert.equal(value.precision,2);
  assert.equal(value.cacheTTL,60);assert.deepEqual(value.favorites,['USD']);assert.equal(value.numberFormat,'auto');
});
test('site patterns grant only a chosen HTTP(S) hostname',()=>{
  assert.equal(settings.sitePattern('https://shop.example/a?q=secret'),'https://shop.example/*');
  assert.equal(settings.sitePattern('http://127.0.0.1:8769/test.html'),'http://127.0.0.1/*');
  for(const value of ['chrome://extensions','file:///tmp/price.html','about:blank','bad'])assert.equal(settings.sitePattern(value),null);
});
