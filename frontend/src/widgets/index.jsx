import Chart from './Chart.jsx';
import Clock from './Clock.jsx';
import Note from './Note.jsx';
import TaskList from './TaskList.jsx';
import Counter from './Counter.jsx';
import MiniCalendar from './MiniCalendar.jsx';
import Progress from './Progress.jsx';
import QuickAdd from './QuickAdd.jsx';
import Placeholder from './Placeholder.jsx';

/* One registry the canvas renders from. A type the canvas does not know yet
   falls back to a placeholder rather than breaking the whole dashboard, which
   is what lets a layout saved today survive the widgets arriving next phase. */
/* Every widget the canvas can render, plus the settings its config panel
   offers. `settings` is declarative so the panel needs no per-widget UI code -
   adding a dimension to the API and a line here is the whole change. */
export const WIDGETS = {
  clock: {
    label: 'Date & time', size: { w: 300, h: 120 }, Component: Clock
  },
  counter: {
    label: 'Number card', size: { w: 300, h: 120 }, Component: Counter,
    settings: [{ key: 'metric', label: 'Show', options: [
      ['open', 'Open'], ['overdue', 'Overdue'], ['today', 'Due today'], ['sos', 'SOS']] }]
  },
  chart: {
    label: 'Chart', size: { w: 460, h: 320 }, Component: Chart,
    defaults: { chart: 'pie', groupBy: 'status', scope: 'open', range: 'all' },
    settings: [
      { key: 'chart', label: 'Type', options: [
        ['pie', 'Pie'], ['donut', 'Donut'], ['bar', 'Bar'],
        ['hbar', 'Horizontal bar'], ['line', 'Line'], ['table', 'Table']] },
      { key: 'groupBy', label: 'Group by', from: 'groupBy' },
      { key: 'scope', label: 'Tasks', from: 'scope' },
      { key: 'range', label: 'Range', from: 'range' },
      { key: 'title', label: 'Title', type: 'text' }
    ]
  },
  list: {
    label: 'Task list', size: { w: 460, h: 320 }, Component: TaskList,
    settings: [
      { key: 'view', label: 'View', options: [
        ['open', 'Open'], ['today', 'Today'], ['overdue', 'Overdue'],
        ['week', 'This week'], ['sos', 'SOS'], ['done', 'Done']] },
      { key: 'limit', label: 'Rows', options: [['5', '5'], ['8', '8'], ['12', '12'], ['20', '20']] }
    ]
  },
  progress: {
    label: 'Progress', size: { w: 320, h: 160 }, Component: Progress,
    settings: [
      { key: 'target', label: 'Target', type: 'text' },
      { key: 'title', label: 'Label', type: 'text' }
    ]
  },
  calendar: { label: 'Mini calendar', size: { w: 340, h: 300 }, Component: MiniCalendar },
  quickadd: { label: 'Quick add', size: { w: 420, h: 110 }, Component: QuickAdd },
  note:     { label: 'Sticky note', size: { w: 300, h: 200 }, Component: Note }
};

export const widgetDef = type => WIDGETS[type] || { label: type, size: { w: 300, h: 200 }, Component: Placeholder, soon: true };
