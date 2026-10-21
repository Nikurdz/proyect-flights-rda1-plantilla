import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

const SITE = 'RAM Alliance';

/** Default title per route. Pages that know a more specific title set it after this runs. */
const titleFor = (pathname: string): string => {
  if (pathname === '/') return `Buscar vuelos | ${SITE}`;
  if (pathname.startsWith('/resultados')) return `Resultados de vuelos | ${SITE}`;
  if (pathname.startsWith('/checkout')) return `Finalizar compra | ${SITE}`;
  if (pathname.startsWith('/confirmacion')) return `Tu reserva | ${SITE}`;
  if (pathname.startsWith('/recuperar-orden')) return `Gestionar viaje | ${SITE}`;
  if (pathname.startsWith('/login')) return `Iniciar sesión | ${SITE}`;
  if (pathname.startsWith('/registro')) return `Crear cuenta | ${SITE}`;
  if (pathname.startsWith('/verificar-correo')) return `Verificar correo | ${SITE}`;
  if (pathname.startsWith('/verificar/')) return `Verificar billete | ${SITE}`;
  if (pathname.startsWith('/mis-ordenes')) return `Mis viajes | ${SITE}`;
  if (pathname.startsWith('/mi-cuenta')) return `Mi cuenta | ${SITE}`;
  if (pathname.startsWith('/admin')) return `Administración | ${SITE}`;
  if (pathname.startsWith('/ayuda')) return `Ayuda | ${SITE}`;
  return `${SITE} | Vuelos`;
};

/**
 * On navigation: scrolls to the top (or to the #anchor), sets a title per route and moves the focus to
 * the page heading (or to `main`) so keyboard and screen-reader users start at the new content.
 */
export const RouteEffects: React.FC = () => {
  const { pathname, hash } = useLocation();
  const firstRender = useRef(true);

  useEffect(() => {
    document.title = titleFor(pathname);
  }, [pathname]);

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
    // The first load keeps the browser's natural focus start (and the "skip to content" link).
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const main = document.getElementById('contenido');
    if (!main) return;
    const heading = main.querySelector<HTMLElement>('h1');
    const target = heading ?? main;
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }, [pathname]);

  return null;
};
