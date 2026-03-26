'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="h-8 w-8 rounded-lg" style={{ backgroundColor: 'var(--bg-card)' }} />;
  }

  return (
    <div
      className="flex items-center gap-1 rounded-lg p-1"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
    >
      <ThemeButton
        active={theme === 'light'}
        onClick={() => setTheme('light')}
        label="Light mode"
        icon={<Sun size={13} strokeWidth={1.75} />}
      />
      <ThemeButton
        active={theme === 'system'}
        onClick={() => setTheme('system')}
        label="System theme"
        icon={<Monitor size={13} strokeWidth={1.75} />}
      />
      <ThemeButton
        active={theme === 'dark'}
        onClick={() => setTheme('dark')}
        label="Dark mode"
        icon={<Moon size={13} strokeWidth={1.75} />}
      />
    </div>
  );
}

function ThemeButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex items-center justify-center rounded-md p-1.5 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2"
      style={{
        color: active ? 'var(--accent-primary)' : 'var(--text-muted)',
        backgroundColor: active ? 'rgba(255,214,0,0.12)' : 'transparent',
        '--tw-ring-color': 'var(--accent-primary)',
      } as React.CSSProperties}
    >
      {icon}
    </button>
  );
}
