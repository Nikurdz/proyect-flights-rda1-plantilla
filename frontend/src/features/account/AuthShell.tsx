import React, { useEffect } from 'react';
import { Logo } from '../../components/ui/Logo';

interface AuthShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  wide?: boolean;
}

/** Shared frame of the sign-in, registration and verification pages. */
export const AuthShell: React.FC<AuthShellProps> = ({ title, subtitle, children, wide = false }) => {
  useEffect(() => {
    document.title = `${title} | RAM Alliance`;
  }, [title]);

  return (
    <div className="bg-paper px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
      <div className={`mx-auto w-full ${wide ? 'max-w-2xl' : 'max-w-md'}`}>
        <div className="mb-6">
          <div className="mb-4 inline-flex rounded-xl bg-chrome px-4 py-2.5">
            <Logo variant="icon" inverted />
          </div>
          <h1 className="text-title font-semibold text-ink sm:text-heading">{title}</h1>
          {subtitle && <p className="mt-1.5 text-body text-muted">{subtitle}</p>}
        </div>
        <div className="rounded-xl border border-line bg-surface p-6 sm:p-8">{children}</div>
      </div>
    </div>
  );
};
