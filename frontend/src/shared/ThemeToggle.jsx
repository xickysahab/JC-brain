import { motion } from 'motion/react';
import { Monitor, Sun, Moon } from 'lucide-react';
import { useTheme } from './theme.js';
import { SPRING, spring } from './motion/spring.js';

/* Three choices, not a switch.

   A two-state toggle cannot say "follow the system", which is the setting
   most people actually want and the only one that changes by itself at
   sunset. Auto is first because it is the default, and stays selectable
   after someone has chosen a side. */
const OPTIONS = [
  { id: 'auto',  label: 'Match the system', Icon: Monitor },
  { id: 'light', label: 'Light',            Icon: Sun },
  { id: 'dark',  label: 'Dark',             Icon: Moon }
];

export default function ThemeToggle() {
  const [choice, set] = useTheme();

  return (
    <div className="themeswitch" role="radiogroup" aria-label="Appearance">
      {OPTIONS.map(({ id, label, Icon }) => (
        <button
          key={id}
          role="radio"
          aria-checked={choice === id}
          aria-label={label}
          title={label}
          className={choice === id ? 'on' : ''}
          onClick={() => set(id)}
        >
          {/* One element shared across the three slots, so the selection
              slides to the choice instead of blinking out and in. */}
          {choice === id && (
            <motion.span className="themepill" layoutId="theme-pill"
                         transition={spring(SPRING.sheet)} />
          )}
          <Icon size={14} />
        </button>
      ))}
    </div>
  );
}
