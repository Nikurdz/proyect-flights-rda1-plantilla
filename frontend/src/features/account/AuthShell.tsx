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
    <div className="bg-airline-sand px-4 py-12 sm:px-6 lg:px-8">
      <div className={`mx-auto w-full ${wide ? 'max-w-2xl' : 'max-w-md'}`}>
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex rounded-2xl bg-brand-black px-5 py-3 shadow-md">
            <Logo variant="icon" inverted />
          </div>
          <h1 className="text-2xl font-black text-brand-black">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p>}
        </div>
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-card sm:p-8">{children}</div>
      </div>
    </div>
  );
};
