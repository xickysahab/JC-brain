import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCsv, COLUMNS, filename } from './export.js';

test('quotes only what needs quoting, and doubles inner quotes', () => {
  const csv = toCsv([{ a: 'plain', b: 'has, comma', c: 'say "hi"', d: 'two\nlines' }],
                    ['a', 'b', 'c', 'd']);
  assert.equal(csv.split('\r\n')[1], 'plain,"has, comma","say ""hi""","two\nlines"');
});

test('a blank is empty, not the word null', () => {
  assert.equal(toCsv([{ a: null, b: undefined, c: 0, d: false }], ['a', 'b', 'c', 'd']).split('\r\n')[1],
               ',,0,false');
});

test('a formula in a title cannot run when the file is opened elsewhere', () => {
  const row = toCsv([{ title: '=HYPERLINK("http://evil","click")' }], ['title']).split('\r\n')[1];
  assert.ok(row.startsWith(`"'=HYPERLINK`), row);
  for (const lead of ['+1', '-1+1', '@SUM(A1)']) {
    assert.ok(toCsv([{ title: lead }], ['title']).split('\r\n')[1].startsWith("'"), lead);
  }
});

test('a timestamp is a plain ISO date, not a quoted JSON string', () => {
  // pg returns Date objects; through JSON.stringify they arrive pre-quoted and
  // come out of the escaper wearing three quotes.
  const csv = toCsv([{ deadline: new Date('2026-09-16T09:00:00Z') }], ['deadline']);
  assert.equal(csv.split('\r\n')[1], '2026-09-16T09:00:00.000Z');
});

test('a checklist survives as JSON in its cell', () => {
  const csv = toCsv([{ subtasks: [{ title: 'Step one', done: true }] }], ['subtasks']);
  assert.equal(csv.split('\r\n')[1], '"[{""title"":""Step one"",""done"":true}]"');
});

test('the columns cover the whole form, and the bucket exports by name', () => {
  assert.ok(COLUMNS.includes('title') && COLUMNS.includes('bucket') && COLUMNS.includes('repeat'));
  assert.ok(!COLUMNS.includes('bucket_id'), 'an id is not something a person can read');
  assert.equal(filename('csv', new Date('2026-09-16T10:00:00Z')), 'jc-tasks-2026-09-16.csv');
});
