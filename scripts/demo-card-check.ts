// Pure checks for the checkout form helpers. Run: pnpm run test:demo-card
import { createDemoToken, cvcLength, detectBrand, formatCardNumber, formatExpiry, luhnValid, validateCardForm } from '../src/lib/demoCard.ts';
let passed = 0, failed = 0;
const check = (n: string, ok: boolean, d?: unknown) => { ok ? (passed++, console.log(`  PASS  ${n}`)) : (failed++, console.log(`  FAIL  ${n}`, d ?? '')); };
const y = new Date().getFullYear() % 100;

check('brand detection', detectBrand('4242') === 'visa' && detectBrand('5555 5555') === 'mastercard' && detectBrand('2221000000') === 'mastercard' && detectBrand('378282') === 'amex' && detectBrand('3530') === 'jcb' && detectBrand('9') === 'card');
check('formats 4-4-4-4 and strips non-digits', formatCardNumber('4242a424242424242') === '4242 4242 4242 4242' && formatCardNumber('42424242424242429999') === '4242 4242 4242 4242');
check('formats Amex 4-6-5', formatCardNumber('378282246310005') === '3782 822463 10005');
check('formats expiry MM/YY', formatExpiry('1227') === '12/27' && formatExpiry('1') === '1' && formatExpiry('122') === '12/2');
check('Luhn accepts test cards, rejects typos', luhnValid('4242 4242 4242 4242') && luhnValid('5555555555554444') && luhnValid('378282246310005') && !luhnValid('4242 4242 4242 4241') && !luhnValid('1234'));
check('cvc length is 4 for Amex, else 3', cvcLength('amex') === 4 && cvcLength('visa') === 3);
const good = { name: 'Jane Doe', number: '4242 4242 4242 4242', expiry: `12/${y + 2}`, cvc: '123' };
check('a valid form has no errors', Object.keys(validateCardForm(good)).length === 0);
check('each field reports its own error', Object.keys(validateCardForm({ name: '', number: '4242', expiry: '13/99', cvc: '1' })).sort().join() === 'cvc,expiry,name,number');
check('a past expiry is refused', !!validateCardForm({ ...good, expiry: `01/${y - 1}` }).expiry);
check('Amex needs 4 digits', !!validateCardForm({ ...good, number: '3782 822463 10005', cvc: '123' }).cvc && !validateCardForm({ ...good, number: '3782 822463 10005', cvc: '1234' }).cvc);

const decode = (t: string) => JSON.parse(Buffer.from(t.slice(9), 'base64url').toString());
const tok = decode(createDemoToken(good));
check('the token holds brand, last4, expiry and outcome only', Object.keys(tok).sort().join() === 'brand,expMonth,expYear,last4,outcome' && tok.last4 === '4242' && tok.outcome === 'success');
check('the token never contains the card number, name or cvc', !createDemoToken(good).includes('4242424242424242') && !JSON.stringify(tok).includes('Jane') && !JSON.stringify(tok).includes('123'));
check('test numbers map to outcomes', decode(createDemoToken({ ...good, number: '4000 0000 0000 0002' })).outcome === 'declined' && decode(createDemoToken({ ...good, number: '4000 0000 0000 9995' })).outcome === 'insufficient_funds');
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
