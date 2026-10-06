import React from 'react';
import { Link } from 'react-router-dom';
import { LegalLayout } from './LegalLayout';

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: '¿Necesito una cuenta para comprar?',
    a: (
      <>
        No. Puedes comprar como invitado y recuperar tu viaje después con el número de orden o el código de reserva y un apellido. Con una cuenta gratuita, además, ves todos tus viajes en un solo lugar. <Link to="/registro">Crear cuenta</Link>.
      </>
    ),
  },
  {
    q: '¿Cuánto tiempo tengo para completar la compra?',
    a: 'Al armar tu reserva retenemos los asientos 15 minutos. Verás una cuenta regresiva; si termina, haz una nueva búsqueda.',
  },
  {
    q: '¿Por qué cambió el precio?',
    a: 'Antes de cobrar verificamos de nuevo precio y disponibilidad. Si cambió, te mostramos el valor anterior y el nuevo, y solo se cobra si lo aceptas.',
  },
  {
    q: 'Mi pago fue rechazado, ¿pierdo la reserva?',
    a: 'No. La reserva sigue vigente el tiempo restante y puedes probar con otro medio de pago. Intentarlo de nuevo no genera cobros duplicados.',
  },
  {
    q: '¿Cómo recupero mi viaje si compré sin cuenta?',
    a: (
      <>
        En <Link to="/recuperar-orden">Gestionar viaje</Link> ingresa el número de orden (ORD-…) o el código de reserva de 6 caracteres y el apellido de uno de los pasajeros.
      </>
    ),
  },
  {
    q: '¿No encuentro vuelos para mi ruta o fecha?',
    a: 'Solo vendemos vuelos directos, en clase económica y con salida desde mañana en adelante. Prueba otro día cercano o cambia el origen o el destino.',
  },
  {
    q: '¿Puedo cambiar o cancelar mi vuelo?',
    a: (
      <>
        Depende de la tarifa: FULL permite cambios y reembolso; BASIC y LIGHT no. En esta versión aún no se gestiona en línea. Consulta <Link to="/transparencia#cambios">Transparencia</Link>.
      </>
    ),
  },
  {
    q: '¿Mi tarjeta se cobra de verdad?',
    a: 'No. Los pagos son simulados en este prototipo. No ingreses datos reales de tu tarjeta.',
  },
  {
    q: '¿En qué moneda se paga?',
    a: 'Todos los precios están en dólares estadounidenses (USD).',
  },
];

export const HelpPage: React.FC = () => (
  <LegalLayout title="Ayuda" intro="Respuestas a las dudas más comunes sobre buscar, comprar y gestionar tus vuelos.">
    <h2>Preguntas frecuentes</h2>
    <div className="not-prose space-y-3">
      {FAQ.map((item) => (
        <details key={item.q} className="group rounded-xl border border-slate-200 bg-white px-4 py-3 open:bg-slate-50">
          <summary className="cursor-pointer list-none text-sm font-bold text-brand-black marker:hidden">
            <span className="mr-2 text-brand-gold-dark group-open:hidden">+</span>
            <span className="mr-2 hidden text-brand-gold-dark group-open:inline">−</span>
            {item.q}
          </summary>
          <p className="mt-2 pl-5 text-sm leading-relaxed text-slate-700">{item.a}</p>
        </details>
      ))}
    </div>

    <h2 id="contacto">Contacto</h2>
    <p>
      Este sitio es un proyecto académico y no cuenta con un centro de atención real. Para consultas del proyecto, escribe a{' '}
      <a href="mailto:ayuda@ramalliance.example">ayuda@ramalliance.example</a> (dirección de ejemplo). Indica siempre el número de orden o el código de reserva.
    </p>

    <h2>Documentos</h2>
    <ul>
      <li><Link to="/transparencia">Transparencia de precios y tarifas</Link></li>
      <li><Link to="/condiciones-transporte">Condiciones de transporte</Link></li>
      <li><Link to="/terminos">Términos de uso</Link></li>
      <li><Link to="/privacidad">Política de privacidad</Link></li>
    </ul>
  </LegalLayout>
);
