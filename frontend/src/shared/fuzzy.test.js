import { test } from 'node:test';
import assert from 'node:assert/strict';
import { score, rank } from './fuzzy.js';

const best = (q, ...labels) => rank(q, labels.map(l => ({ label: l })))[0]?.label;

test('initials beat letters that merely appear somewhere', () => {
  // The bug this file exists for: "srp" meant Send Revised Proposal.
  assert.equal(best('srp', 'Instagram reel plan', 'Send revised proposal to Zenith'),
               'Send revised proposal to Zenith');
});

test('a prefix wins over everything', () => {
  assert.equal(best('send', 'Resend invoice', 'Send the deck'), 'Send the deck');
});

test('a substring at a word start beats one mid-word', () => {
  assert.ok(score('cal', 'Mini calendar') > score('cal', 'Localised'));
});

test('non-matches are dropped, not ranked last', () => {
  assert.equal(score('zzz', 'Send proposal'), -1);
  assert.deepEqual(rank('zzz', [{ label: 'Send proposal' }]), []);
});

test('an empty query keeps everything in the original order', () => {
  const items = [{ label: 'B' }, { label: 'A' }];
  assert.deepEqual(rank('', items).map(x => x.label), ['B', 'A']);
});

test('matching ignores case', () => {
  assert.ok(score('SEND', 'send the deck') > 0);
  assert.ok(score('send', 'SEND THE DECK') > 0);
});

test('shorter is only a tie-breaker, never the main signal', () => {
  // Both match by initials; the shorter one wins only because they tie.
  assert.ok(score('sp', 'Send proposal') > score('sp', 'Send a much longer proposal'));
  // But an initials match still beats a shorter scattered one.
  assert.ok(score('srp', 'Send revised proposal') > score('srp', 'Sharp'));
});

test('limit is respected', () => {
  const many = Array.from({ length: 30 }, (_, i) => ({ label: 'task ' + i }));
  assert.equal(rank('task', many).length, 9);
});
