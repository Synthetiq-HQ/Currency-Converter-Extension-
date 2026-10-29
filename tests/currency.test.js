const { test } = require('node:test');
const assert = require('node:assert/strict');
const QC = require('../currency.js');
const samples = [
  ['$1,234.56', 'USD', 1234.56], ['USD 999', 'USD', 999], ['usd100', 'USD', 100],
  ['100 USD', 'USD', 100], ['The laptop costs $1,234.56 on Amazon.', 'USD', 1234.56],
  ['€1.234,56', 'EUR', 1234.56], ['1 234,56 EUR', 'EUR', 1234.56],
  ['EUR 1.234.567,89', 'EUR', 1234567.89], ['CHF 1’234.50', 'CHF', 1234.50],
  ['₹ 50 00 000', 'INR', 5000000], ['CNY 529,000', 'CNY', 529000],
  ['100 yen', 'JPY', 100], ['500 RMB', 'CNY', 500], ['185 yuan', 'CNY', 185],
  ['CN ¥ 35.00', 'CNY', 35], ['CN¥358', 'CNY', 358], ['Total Amount:CN ¥ 80.00', 'CNY', 80],
  ['HK$ 250', 'HKD', 250], ['AUD $250', 'AUD', 250], ['CA $15', 'CAD', 15],
  ['NZ$200', 'NZD', 200], ['SG $100', 'SGD', 100], ['US $50', 'USD', 50],
  ['$1.2M', 'USD', 1200000], ['€500K', 'EUR', 500000], ['USD 1.234M', 'USD', 1234000],
  ['-$100', 'USD', -100], ['USD -100.50', 'USD', -100.5], ['($100)', 'USD', -100],
  ['$0', 'USD', 0], ['$0.99', 'USD', .99], ['SAR 100', 'SAR', 100],
  ['ر.س ١٬٢٣٤٫٥٦', 'SAR', 1234.56], ['١٢٣ ريال', 'SAR', 123],
  ['AED ۱٬۲۳۴٫۵۶', 'AED', 1234.56], ['￥ 500', 'JPY', 500], ['100 元', 'CNY', 100]
];
for (const [text,currency,amount] of samples) test(`recognises ${text}`, () => {
  assert.deepEqual(QC.parseCurrency(text), { currency, amount });
});
for (const text of ['Pay 100', 'ABC 100', 'hello', '100', 'USD NaN', '$1,2,3', '$1.2.3', '$Infinity', '$1,234 and €50', 'USD 100 EUR 200', '$1'.repeat(300)]) {
  test(`rejects ${text.slice(0,35)}`, () => assert.equal(QC.parseCurrency(text), null));
}
for (const [text, amount] of [['1,234.56',1234.56],['1.234,56',1234.56],['1,234',1234],['1.234',1234],['0.123',.123],['-12.50',-12.5],['0',0]]) {
  test(`manual ${text}`, () => assert.equal(QC.parseAmount(text), amount));
}
for (const text of ['12 34', '1,2,3', '1e10', '1.234,5.6', 'Infinity', '', '1000000000000001']) {
  test(`rejects malformed manual ${text}`, () => assert.equal(QC.parseAmount(text), null));
}
test('honours ambiguous symbol preferences', () => {
  assert.deepEqual(QC.parseCurrency('$123', { ambiguousDollarDefault: 'CAD' }), { currency:'CAD', amount:123 });
  assert.deepEqual(QC.parseCurrency('¥500', { ambiguousYenDefault:'CNY' }), { currency:'CNY', amount:500 });
  assert.deepEqual(QC.parseCurrency('JP ¥ 500', { ambiguousYenDefault:'CNY' }), { currency:'JPY', amount:500 });
});
test('explicit decimal preference resolves three digits', () => {
  assert.equal(QC.parseAmount('1.234','dot'),1.234);
  assert.equal(QC.parseAmount('1,234','comma'),1.234);
});
test('currency format preserves code for ambiguous symbols', () => {
  assert.match(QC.format(100, 'SAR'), /SAR|ر\.س/);
  assert.match(QC.format(-1234.5,'GBP'), /1,234\.50|1.234,50/);
});
