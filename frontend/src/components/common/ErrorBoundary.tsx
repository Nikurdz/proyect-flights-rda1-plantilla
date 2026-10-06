import React from 'react';
import { Link } from 'react-router-dom';

interface State {
  failed: boolean;
}

/** Last resort: a rendering bug shows a calm page instead of a blank screen. */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    if (import.meta.env.DEV) console.error(error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-2xl font-black text-brand-black">Algo salió mal</h1>
        <p className="mt-3 text-sm text-slate-600">Tuvimos un problema al mostrar esta página. Puedes volver al inicio e intentar de nuevo.</p>
        <Link to="/" onClick={() => this.setState({ failed: false })} className="mt-6 inline-block rounded-lg bg-brand-black px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-navy">
          Volver al inicio
        </Link>
      </div>
    );
  }
}
