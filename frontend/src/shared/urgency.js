/* The urgency label a task carries decides the colour of its tag. This lived
   in three files with three identical copies; one of them was always going to
   drift the day a label is added. */

const HOT = new Set(['OVERDUE', 'DUE TODAY', 'SOS']);
const WARN = new Set(['DUE SOON', 'TOMORROW']);

/** className for a <span className={tagClass(label)}> urgency chip. */
export const tagClass = label =>
  'tag' + (HOT.has(label) ? ' hot' : WARN.has(label) ? ' warn' : '');
