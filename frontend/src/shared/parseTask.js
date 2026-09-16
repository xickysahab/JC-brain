import * as chrono from 'chrono-node';

/* Turns one typed line into a whole task.

   "Send proposal to Zenith tomorrow 3pm #sales !sos @riya"
     -> title, deadline, start_date, bucket_id, priority, owner

   Every extraction also returns a chip, because a parser the user cannot see
   is a parser the user cannot trust: the chips are how they check the guess
   before pressing Enter, and how they notice when it guessed wrong. */

/* Repeat rules in two forms. The explicit "every ..." is tried first and can
   sit anywhere; the bare adverb only counts at the end of the line, because
   "Ship the weekly report" is a title, not a schedule. */
const REPEATS = [
  [/\bevery\s+weekdays?\b/i,                              /\bweekdays\b\s*$/i,               'Weekdays'],
  [/\bevery\s+(?:2|two)\s+weeks\b|\bevery\s+fortnight\b/i, /\bfortnightly\b\s*$/i,           'Fortnightly'],
  [/\bevery\s+day\b/i,                                    /\bdaily\b\s*$/i,                  'Daily'],
  [/\bevery\s+week\b/i,                                   /\bweekly\b\s*$/i,                 'Weekly'],
  [/\bevery\s+month\b/i,                                  /\bmonthly\b\s*$/i,                'Monthly'],
  [/\bevery\s+year\b/i,                                   /\b(?:yearly|annually)\b\s*$/i,    'Yearly']
];
/* "every monday" is a weekly rule whose day chrono can read - so only the
   word "every" comes out, and the weekday is left for the date parser. */
const EVERY_WEEKDAY = /\bevery\s+(?=mon|tues?|wed|thur?s?|fri|sat|sun)/i;

const PRIORITIES = { sos: 'SOS', urgent: 'SOS', high: 'High', med: 'Medium', medium: 'Medium', low: 'Low' };

const fmtDate = d => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const fmtTime = d => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

/** @param {string} raw  @param {{buckets?: Array, now?: Date}} opts */
export function parseTask(raw, { buckets = [], now = new Date() } = {}) {
  const original = String(raw || '').trim();
  const out = {
    title: original, deadline: null, start_date: null,
    bucket_id: null, priority: null, owner: null, repeat: null, chips: []
  };
  if (!original) return out;

  let text = original;
  const chip = (kind, label) => out.chips.push({ kind, label });

  /* Tokens we looked at and chose to keep get hidden behind a placeholder
     before chrono runs. Without this, "Deploy !now" loses the "now": the !
     token is not a priority so it stays, and then chrono reads the bare word
     as a date and strips it. Masking keeps the user's words their own. */
  const kept = [];
  const mask = t => { kept.push(t); return `\u0000${kept.length - 1}\u0000`; };
  const unmask = t => t.replace(/\u0000(\d+)\u0000/g, (_, i) => kept[Number(i)]);

  // #bucket - only names the user actually has. An unknown #tag stays in the
  // title rather than vanishing into a bucket that was never created.
  text = text.replace(/#([\p{L}\p{N}_-]+)/gu, (m, name) => {
    const b = buckets.find(x => x.name.toLowerCase() === name.toLowerCase());
    if (!b) return mask(m);
    out.bucket_id = b.id;
    chip('bucket', b.name);
    return ' ';
  });

  // !priority
  text = text.replace(/!([\p{L}]+)/gu, (m, word) => {
    const p = PRIORITIES[word.toLowerCase()];
    if (!p) return mask(m);
    out.priority = p;
    chip('priority', p);
    return ' ';
  });

  // @owner
  text = text.replace(/@([\p{L}\p{N}._-]+)/gu, (m, name) => {
    out.owner = name;
    chip('owner', '@' + name);
    return ' ';
  });

  // Repeat before chrono: chrono reads "every week" as a date and eats it.
  for (const form of [0, 1]) {
    if (out.repeat) break;
    for (const entry of REPEATS) {
      const re = entry[form];
      if (!re.test(text)) continue;
      out.repeat = entry[2];
      text = text.replace(re, ' ');
      break;
    }
  }
  if (!out.repeat && EVERY_WEEKDAY.test(text)) {
    out.repeat = 'Weekly';
    text = text.replace(EVERY_WEEKDAY, ' ');
  }
  if (out.repeat) chip('repeat', out.repeat);

  // Dates last, so the tokens above cannot be mistaken for part of a date.
  // chrono reads "on 6" as a weekday unless it is told the 6th is a date.
  const forChrono = text.replace(/\bon\s+(\d{1,2})(?:st|nd|rd|th)?\b/gi, 'on the $1 of this month');
  const [found] = chrono.parse(forChrono, now, { forwardDate: true });
  if (found) {
    const when = found.start.date();
    if (found.start.isCertain('hour')) {
      out.start_date = when.toISOString();
      out.deadline = new Date(when.getTime() + 60 * 60 * 1000).toISOString();
      chip('time', `${fmtDate(when)} ${fmtTime(when)}`);
    } else {
      out.deadline = when.toISOString();
      chip('date', fmtDate(when));
    }
    text = forChrono.replace(found.text, ' ').replace(/\bof this month\b/gi, ' ');
  }

  const title = unmask(text).replace(/\s+/g, ' ').trim();
  // Never let parsing swallow the whole line - a task with no name is worse
  // than a task that kept a stray token.
  out.title = title || original;
  return out;
}

/** True when the line carries more than just a title - the UI only shows the
    chip row when there is something to show. */
export const hasExtras = parsed => parsed.chips.length > 0;
