import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';
import { Dialog } from './Dialog';
import { ProblemAlert } from '../common/ProblemAlert';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  /** Qué va a pasar, en una o dos frases. */
  children: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** Acción destructiva: botón rojo y aviso visible (texto claro, con icono). */
  destructive?: boolean;
  isLoading?: boolean;
  error?: unknown;
  errorMessage?: string;
  onConfirm: () => void;
  onClose: () => void;
}

/** Confirmación accesible (usa Dialog: foco atrapado, Escape cierra). El foco inicial queda en «Cancelar». */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  children,
  confirmLabel,
  cancelLabel = 'Cancelar',
  destructive,
  isLoading,
  error,
  errorMessage,
  onConfirm,
  onClose,
}) => (
  <Dialog isOpen={isOpen} onClose={onClose} title={title} maxWidth="md">
    <div className="space-y-4">
      {destructive && (
        <p className="flex items-start gap-2 rounded-lg bg-danger-soft p-3 text-sm font-medium text-danger">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Esta acción no se puede deshacer.
        </p>
      )}
      <div className="text-body text-ink">{children}</div>
      {error != null && <ProblemAlert error={error} message={errorMessage} />}
      <div className="flex flex-wrap justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
          {cancelLabel}
        </Button>
        <Button type="button" variant={destructive ? 'danger' : 'primary'} onClick={onConfirm} isLoading={isLoading}>
          {confirmLabel}
        </Button>
      </div>
    </div>
  </Dialog>
);
