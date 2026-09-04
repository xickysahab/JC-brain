import Clock from './Clock.jsx';
import Note from './Note.jsx';
import TaskList from './TaskList.jsx';
import Counter from './Counter.jsx';
import Placeholder from './Placeholder.jsx';

/* One registry the canvas renders from. A type the canvas does not know yet
   falls back to a placeholder rather than breaking the whole dashboard, which
   is what lets a layout saved today survive the widgets arriving next phase. */
export const WIDGETS = {
  clock:    { label: 'Date & time',  size: { w: 300, h: 120 }, Component: Clock },
  counter:  { label: 'Number card',  size: { w: 300, h: 120 }, Component: Counter },
  list:     { label: 'Task list',    size: { w: 460, h: 320 }, Component: TaskList },
  note:     { label: 'Sticky note',  size: { w: 300, h: 200 }, Component: Note },
  chart:    { label: 'Chart',        size: { w: 460, h: 320 }, Component: Placeholder, soon: true },
  progress: { label: 'Progress',     size: { w: 300, h: 160 }, Component: Placeholder, soon: true },
  calendar: { label: 'Mini calendar',size: { w: 340, h: 320 }, Component: Placeholder, soon: true }
};

export const widgetDef = type => WIDGETS[type] || { label: type, size: { w: 300, h: 200 }, Component: Placeholder, soon: true };
