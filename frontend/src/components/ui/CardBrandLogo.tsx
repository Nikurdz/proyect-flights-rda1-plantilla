import React from 'react';
import type { CardBrand, DetectedBrand } from '../../lib/cards';

interface CardBrandLogoProps {
  brand: DetectedBrand;
  className?: string;
}

/**
 * Simple drawn marks for the accepted brands (not the official artwork): enough to recognise the
 * brand at a glance while the number is typed. Unknown or unsupported brands show a neutral card.
 */
export const CardBrandLogo: React.FC<CardBrandLogoProps> = ({ brand, className = 'h-7 w-11' }) => {
  const common = { viewBox: '0 0 48 30', className, role: 'img' as const, focusable: false };

  switch (brand) {
    case 'VISA':
      return (
        <svg {...common} aria-label="Visa">
          <rect width="48" height="30" rx="4" fill="#1A1F71" />
          <text x="24" y="21" textAnchor="middle" fontSize="15" fontWeight="800" fontStyle="italic" fontFamily="Arial, sans-serif" fill="#FFFFFF" letterSpacing="0.5">
            VISA
          </text>
        </svg>
      );
    case 'MASTERCARD':
      return (
        <svg {...common} aria-label="Mastercard">
          <rect width="48" height="30" rx="4" fill="#1C1C1C" />
          <circle cx="19" cy="15" r="8.5" fill="#EB001B" />
          <circle cx="29" cy="15" r="8.5" fill="#F79E1B" fillOpacity="0.95" />
          <path d="M24 8.6a8.5 8.5 0 0 1 0 12.8 8.5 8.5 0 0 1 0-12.8Z" fill="#FF5F00" />
        </svg>
      );
    case 'AMEX':
      return (
        <svg {...common} aria-label="American Express">
          <rect width="48" height="30" rx="4" fill="#2E77BC" />
          <text x="24" y="19" textAnchor="middle" fontSize="10.5" fontWeight="800" fontFamily="Arial, sans-serif" fill="#FFFFFF" letterSpacing="0.6">
            AMEX
          </text>
        </svg>
      );
    case 'DINERS':
      return (
        <svg {...common} aria-label="Diners Club">
          <rect width="48" height="30" rx="4" fill="#FFFFFF" stroke="#CBD5E1" />
          <circle cx="24" cy="15" r="10" fill="#0079BE" />
          <circle cx="24" cy="15" r="7" fill="#FFFFFF" />
          <path d="M21 9.5a6 6 0 0 0 0 11V9.5Zm6 0v11a6 6 0 0 0 0-11Z" fill="#0079BE" />
        </svg>
      );
    default:
      return (
        <svg {...common} aria-label={brand === 'UNSUPPORTED' ? 'Marca no disponible' : 'Tarjeta'}>
          <rect width="48" height="30" rx="4" fill="#E2E8F0" />
          <rect y="7" width="48" height="5" fill="#94A3B8" />
          <rect x="6" y="19" width="14" height="3" rx="1.5" fill="#94A3B8" />
        </svg>
      );
  }
};

/** Row with every accepted brand; the detected one stays in colour, the rest fade. */
export const AcceptedBrands: React.FC<{ active: DetectedBrand; brands: CardBrand[] }> = ({ active, brands }) => (
  <ul className="flex items-center gap-2" aria-label="Tarjetas aceptadas">
    {brands.map((brand) => (
      <li key={brand} className={`transition-all duration-200 ${active && active !== brand ? 'opacity-30 grayscale' : 'opacity-100'}`}>
        <CardBrandLogo brand={brand} className="h-6 w-10" />
      </li>
    ))}
  </ul>
);
