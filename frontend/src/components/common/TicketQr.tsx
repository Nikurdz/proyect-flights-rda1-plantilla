import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ticketVerificationUrl } from '../../lib/tickets';

interface TicketQrProps {
  /** The signed text the API gives for the passenger (`qr`). */
  code: string;
  size?: number;
  passengerName?: string;
}

/** One passenger's QR code; scanning it opens the public page that checks the ticket. SVG, so it prints sharp. */
export const TicketQr: React.FC<TicketQrProps> = ({ code, size = 96, passengerName }) => (
  <figure className="flex shrink-0 flex-col items-center gap-1">
    <div className="rounded-lg border border-slate-200 bg-white p-1.5">
      <QRCodeSVG value={ticketVerificationUrl(code)} size={size} level="M" role="img" aria-label={`Código QR del billete${passengerName ? ` de ${passengerName}` : ''}`} />
    </div>
    <figcaption className="text-[10px] font-medium text-slate-500">Escanea para verificar</figcaption>
  </figure>
);
