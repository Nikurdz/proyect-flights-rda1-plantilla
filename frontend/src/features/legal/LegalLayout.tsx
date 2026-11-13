import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Printer } from 'lucide-react';

/** Version of the legal texts. It matches the version the API records when a customer accepts them. */
export const LEGAL_VERSION = '2026-10';
export const LEGAL_UPDATED = '5 de octubre de 2026';

interface LegalLayoutProps {
  title: string;
  intro?: string;
  children: React.ReactNode;
}

const RELATED = [
  { to: '/transparencia', label: 'Transparencia' },
  { to: '/condiciones-transporte', label: 'Condiciones de transporte' },
  { to: '/terminos', label: 'Términos de uso' },
  { to: '/privacidad', label: 'Privacidad' },
  { to: '/ayuda', label: 'Ayuda' },
];

export const LegalLayout: React.FC<LegalLayoutProps> = ({ title, intro, children }) => {
  useEffect(() => {
    document.title = `${title} | RAM Alliance`;
  }, [title]);

  const isActive = (label: string) => label === title || title.startsWith(label);

  return (
    <div className="bg-paper">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <nav aria-label="Información legal" className="no-print mb-6 flex flex-wrap gap-2">
          {RELATED.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              aria-current={isActive(item.label) ? 'page' : undefined}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                isActive(item.label)
                  ? 'border-ink bg-ink text-on-ink'
                  : 'border-line-strong bg-surface text-muted hover:border-gold-text hover:text-ink'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <article className="rounded-xl border border-line bg-surface p-6 sm:p-10">
          <header className="border-b border-line pb-5">
            <h1 className="text-title font-semibold text-ink sm:text-heading">{title}</h1>
            {intro && <p className="mt-2 text-small leading-relaxed text-muted">{intro}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
              <span>Versión {LEGAL_VERSION}</span>
              <span>Actualizado el {LEGAL_UPDATED}</span>
              <button type="button" onClick={() => window.print()} className="no-print inline-flex items-center gap-1 font-semibold text-gold-text hover:text-ink">
                <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                Imprimir
              </button>
            </div>
          </header>

          <div className="legal-prose">{children}</div>
        </article>
      </div>
    </div>
  );
};

/** Notice shown on every legal page: this is an academic prototype. */
export const PrototypeNotice: React.FC = () => (
  <div className="my-5 rounded-xl border border-gold-text/30 bg-gold-soft p-4 text-small leading-relaxed text-ink">
    <strong className="text-ink">Proyecto académico.</strong> RAM Alliance es un prototipo desarrollado para un curso de integración de sistemas. Los pagos son simulados, no se emiten boletos reales y ningún cobro se realiza. Los textos de esta página describen cómo funciona el sistema y no constituyen asesoría legal.
  </div>
);
