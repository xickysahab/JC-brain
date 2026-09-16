import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTask } from './parseTask.js';

const now = new Date(2026, 8, 16, 10, 0, 0);            // Wed 16 Sep 2026
const buckets = [{ id: 'b1', name: 'Sales' }, { id: 'b2', name: 'Payments' }];
const p = (s) => parseTask(s, { buckets, now });

test('a plain line is just a title', () => {
  const r = p('Send the proposal');
  assert.equal(r.title, 'Send the proposal');
  assert.deepEqual(r.chips, []);
  assert.equal(r.deadline, null);
});

test('a known #bucket is filed and removed from the title', () => {
  const r = p('Chase invoice #payments');
  assert.equal(r.bucket_id, 'b2');
  assert.equal(r.title, 'Chase invoice');
  assert.equal(r.chips[0].label, 'Payments');
});

test('an unknown #tag stays in the title instead of disappearing', () => {
  // Filing into a bucket that was never created would lose the word silently.
  const r = p('Ship it #nosuchbucket');
  assert.equal(r.bucket_id, null);
  assert.equal(r.title, 'Ship it #nosuchbucket');
});

test('!priority is read and mapped to the app vocabulary', () => {
  assert.equal(p('Fix login !sos').priority, 'SOS');
  assert.equal(p('Fix login !high').priority, 'High');
  assert.equal(p('Fix login !med').priority, 'Medium');
  assert.equal(p('Fix login !sos').title, 'Fix login');
});

test('an unknown !word is left alone', () => {
  const r = p('Deploy !now');
  assert.equal(r.priority, null);
  assert.equal(r.title, 'Deploy !now');
});

test('@owner is extracted', () => {
  const r = p('Review copy @riya');
  assert.equal(r.owner, 'riya');
  assert.equal(r.title, 'Review copy');
});

test('a date with no time sets a deadline only', () => {
  const r = p('Send report tomorrow');
  assert.equal(r.start_date, null);
  assert.equal(new Date(r.deadline).getDate(), 17);
  assert.equal(r.title, 'Send report');
});

test('a date with a time blocks an hour', () => {
  const r = p('Standup tomorrow 3pm');
  const start = new Date(r.start_date), end = new Date(r.deadline);
  assert.equal(start.getHours(), 15);
  assert.equal(end - start, 60 * 60 * 1000);
  assert.equal(r.title, 'Standup');
});

test('everything at once, in any order', () => {
  const r = p('Send proposal to Zenith tomorrow 3pm #sales !sos @riya');
  assert.equal(r.bucket_id, 'b1');
  assert.equal(r.priority, 'SOS');
  assert.equal(r.owner, 'riya');
  assert.equal(new Date(r.start_date).getHours(), 15);
  assert.equal(r.title, 'Send proposal to Zenith');
  assert.equal(r.chips.length, 4);
});

test('tokens are read before dates, so a bucket is never eaten by chrono', () => {
  const r = p('#sales call march');
  assert.equal(r.bucket_id, 'b1');
  assert.ok(r.title.includes('call'));
});

test('parsing never returns an empty title', () => {
  // "tomorrow" alone is a date and nothing else; the line still has to survive.
  assert.equal(p('tomorrow').title, 'tomorrow');
  assert.equal(p('#sales').title, '#sales');
  assert.equal(p('   ').title, '');
});

test('bucket matching ignores case', () => {
  assert.equal(p('x #SALES').bucket_id, 'b1');
  assert.equal(p('x #sales').bucket_id, 'b1');
});
