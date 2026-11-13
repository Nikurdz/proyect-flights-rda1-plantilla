import React from 'react';
import { clsx } from 'clsx';
import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';
import { useTheme, type ThemeMode } from '../../lib/theme';

const OPTIONS: { mode: ThemeMode; label: string; Icon: LucideIcon }[] = [
  { mode: 'light', label: 'Claro', Icon: Sun },
  { mode: 'dark', label: 'Oscuro', Icon: Moon },
  { mode: 'system', label: 'Según el sistema', Icon: Monitor },
];

/** Three-option theme control. The pressed button is the current choice (also announced to screen readers). */
export const ThemeToggle: React.FC<{ className?: string }> = ({ className }) => {
  const { mode, setMode } = useTheme();
  return (
    <div role="group" aria-label="Tema de la página" className={clsx('inline-flex rounded-lg border border-line bg-surface p-0.5', className)}>
      {OPTIONS.map(({ mode: option, label, Icon }) => {
        const active = mode === option;
        return (
          <button
            key={option}
            type="button"
            aria-label={label}
            aria-pressed={active}
            title={label}
            onClick={() => setMode(option)}
            className={clsx(
              'inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors',
              active ? 'bg-ink text-on-ink' : 'text-muted hover:bg-ink/5 hover:text-ink'
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
};
