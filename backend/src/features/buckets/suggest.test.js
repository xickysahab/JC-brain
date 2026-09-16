import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize, buildModel, suggest } from './suggest.js';

const history = [
  ...Array.from({ length: 9 }, (_, i) => ({ title: `Chase invoice ${i}`, bucket_id: 'pay' })),
  { title: 'Send sales deck to Zenith', bucket_id: 'sales' },
  { title: 'Sales call with Acme', bucket_id: 'sales' }
];
const model = buildModel(history);

test('filler words carry no filing signal', () => {
  assert.deepEqual(tokenize('Send the deck for Zenith'), ['deck', 'zenith']);
  assert.deepEqual(tokenize('a to of'), []);
});

test('tokens are deduplicated so repetition cannot stuff the count', () => {
  assert.deepEqual(tokenize('invoice invoice invoice'), ['invoice']);
});

test('the tenth invoice files itself', () => {
  assert.equal(suggest('Chase invoice from Acme', model).bucket_id, 'pay');
});

test('an unseen title gets no guess at all', () => {
  // A wrong guess costs more than no guess.
  assert.equal(suggest('Book flights to Goa', model), null);
});

test('one sighting is not enough to guess from', () => {
  const thin = buildModel([{ title: 'Renew domain', bucket_id: 'ops' }]);
  assert.equal(suggest('Renew domain', thin), null);
});

test('a word split evenly between buckets decides nothing', () => {
  const split = buildModel([
    ...Array.from({ length: 5 }, () => ({ title: 'Zenith review', bucket_id: 'a' })),
    ...Array.from({ length: 5 }, () => ({ title: 'Zenith review', bucket_id: 'b' }))
  ]);
  assert.equal(suggest('Zenith review', split), null);
});

test('a clear winner still wins when a rival has some claim', () => {
  const mixed = buildModel([
    ...Array.from({ length: 9 }, () => ({ title: 'Invoice chase', bucket_id: 'pay' })),
    { title: 'Invoice design', bucket_id: 'creative' }
  ]);
  assert.equal(suggest('Invoice chase', mixed).bucket_id, 'pay');
});

test('tasks with no bucket never teach it anything', () => {
  const m = buildModel([{ title: 'Invoice', bucket_id: null }, { title: 'Invoice', bucket_id: undefined }]);
  assert.deepEqual(m, {});
  assert.equal(suggest('Invoice', m), null);
});

test('matching ignores case and punctuation', () => {
  assert.equal(suggest('INVOICE, urgent!', model).bucket_id, 'pay');
});

test('an empty history and an empty title are both safe', () => {
  assert.equal(suggest('anything', {}), null);
  assert.equal(suggest('', model), null);
});
