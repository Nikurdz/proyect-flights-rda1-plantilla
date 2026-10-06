import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** Scrolls to the top on navigation (or to the #anchor of the link) and resets the page title. */
export const RouteEffects: React.FC = () => {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const target = document.getElementById(hash.slice(1));
      if (target) {
        target.scrollIntoView();
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);

  useEffect(() => {
    // Pages that know their own title set it after this runs; the rest get the site title.
    document.title = 'RAM Alliance | Vuelos';
  }, [pathname]);

  return null;
};
