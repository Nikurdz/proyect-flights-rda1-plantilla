import React, { useState } from 'react';
import { Compass } from 'lucide-react';

/** Partner image, or a flat neutral placeholder when there is none or it fails to load. Decorative: the name is always next to it. */
export const ExperienceImage: React.FC<{ url: string | null; className?: string }> = ({ url, className = '' }) => {
  const [failed, setFailed] = useState(false);
  if (!url || failed) {
    return (
      <div className={`flex items-center justify-center bg-gold-soft text-gold-text ${className}`} aria-hidden="true">
        <Compass className="h-10 w-10" />
      </div>
    );
  }
  return <img src={url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} className={`object-cover ${className}`} />;
};
