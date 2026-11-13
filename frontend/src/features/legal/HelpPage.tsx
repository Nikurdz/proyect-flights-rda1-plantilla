import React from 'react';
import { Link } from 'react-router-dom';
import { LegalLayout } from './LegalLayout';

interface Faq {
  q: string;
  a: React.ReactNode;
}

interface Topic {
  id: string;
  title: string;
  faqs: Faq[];
}

const link = 'font-medium text-gold-text underline underline-offset-2 hover:text-ink';

const TOPICS: Topic[] = [
  {
    id: 'buscar',
    title: 'Buscar un vuelo',
    faqs: [
      {
        q: '¿No encuentro vuelos para mi ruta o fecha?',
        a: 'Vendemos vuelos directos en clase económica, con salida desde mañana en adelante. Prueba otro día cercano (en los resultados ves los precios de los días vecinos) o cambia la ciudad de salida o de llegada.',
      },
      {
        q: '¿Cuántos pasajeros puedo reservar?',
        a: 'Hasta 9 por reserva. Los bebés (menores de 2 años) viajan en brazos de un adulto, así que no puede haber más bebés que adultos. Los jóvenes de 12 a 17 años pagan tarifa de adulto y viajan con asiento propio.',
      },
      {
        q: '¿Qué diferencia hay entre las tarifas Basic, Light y Full?',
        a: (
          <>
            Cambian el equipaje incluido, los cambios de fecha y el reembolso. Al elegir un vuelo ves las tres lado a lado, con el total de tu grupo. Más detalle en <Link to="/transparencia" className={link}>Transparencia</Link>.
          </>
        ),
      },
      {
        q: '¿En qué moneda se paga?',
        a: 'Todos los precios están en dólares estadounidenses (USD) e incluyen impuestos.',
      },
    ],
  },
  {
    id: 'pagar',
    title: 'Reservar y pagar',
    faqs: [
      {
        q: '¿Necesito una cuenta para comprar?',
        a: (
          <>
            No. Puedes comprar como invitado y recuperar tu viaje después con el código de reserva y un apellido. Con una cuenta gratuita ves todos tus viajes en un solo lugar. <Link to="/registro" className={link}>Crear cuenta</Link>.
          </>
        ),
      },
      {
        q: '¿Cuánto tiempo tengo para completar la compra?',
        a: 'Al armar tu reserva apartamos los asientos 15 minutos. Verás una cuenta regresiva en el resumen; si termina, vuelve a buscar el vuelo.',
      },
      {
        q: '¿Por qué cambió el precio?',
        a: 'Antes de cobrar verificamos de nuevo el precio y la disponibilidad. Si cambió, te mostramos el valor anterior y el nuevo, y solo se cobra si lo aceptas.',
      },
      {
        q: 'Mi pago fue rechazado, ¿pierdo la reserva?',
        a: 'No. La reserva sigue vigente mientras te quede tiempo y puedes probar con otro medio de pago. Intentarlo de nuevo no genera cobros duplicados.',
      },
      {
        q: '¿Mi tarjeta se cobra de verdad?',
        a: 'No. Los pagos son de prueba y no se cobra nada. No escribas datos reales de tu tarjeta.',
      },
    ],
  },
  {
    id: 'cambiar',
    title: 'Cambiar o cancelar',
    faqs: [
      {
        q: '¿Puedo cambiar o cancelar mi vuelo?',
        a: (
          <>
            Depende de la tarifa: Full permite cambios y reembolso; Basic y Light no. Por ahora estos trámites no se hacen desde la web. Mira las reglas completas en <Link to="/transparencia#cambios" className={link}>Transparencia</Link> y en las{' '}
            <Link to="/condiciones-transporte" className={link}>Condiciones de transporte</Link>.
          </>
        ),
      },
      {
        q: '¿Cuándo recibo un reembolso?',
        a: 'Si tu tarifa lo permite, el reembolso se hace al mismo medio de pago. Mientras se procesa, tu orden aparece como «Reembolso en curso» en Mis viajes.',
      },
    ],
  },
  {
    id: 'recuperar',
    title: 'Recuperar una reserva',
    faqs: [
      {
        q: '¿Cómo recupero mi viaje si compré sin cuenta?',
        a: (
          <>
            En <Link to="/recuperar-orden" className={link}>Gestionar viaje</Link> escribe el número de orden (empieza con ORD-) o el código de reserva de 6 caracteres, y el apellido de uno de los pasajeros.
          </>
        ),
      },
      {
        q: '¿Dónde veo mi código de reserva?',
        a: 'En la pantalla de confirmación y en el mensaje de confirmación que te enviamos. Si tienes cuenta, también en Mis viajes.',
      },
      {
        q: 'Compré como invitado y ahora tengo cuenta, ¿cómo uso mi viaje?',
        a: 'Entra a Mis viajes y usa «Agrega tu viaje» con el código de reserva y un apellido. El viaje pasa a tu cuenta.',
      },
    ],
  },
  {
    id: 'verificar',
    title: 'Verificar un billete',
    faqs: [
      {
        q: '¿Para qué sirve el código QR del billete?',
        a: 'Al escanearlo se abre una página que confirma si el billete es auténtico y está emitido. No muestra nombres ni datos de contacto.',
      },
      {
        q: 'Dice que no pudo validar el billete, ¿qué hago?',
        a: (
          <>
            El código puede estar alterado o el billete ya no estar emitido (por ejemplo, si se canceló). Recupera tu viaje en <Link to="/recuperar-orden" className={link}>Gestionar viaje</Link> para ver su estado.
          </>
        ),
      },
    ],
  },
  {
    id: 'cuenta',
    title: 'Mi cuenta',
    faqs: [
      {
        q: '¿Por qué me piden la fecha de nacimiento al crear la cuenta?',
        a: 'Para confirmar que eres mayor de 18 años, que es requisito de los términos de uso. Para comprar, cada pasajero también indica su fecha de nacimiento, porque define su tipo de tarifa.',
      },
      {
        q: 'No he verificado mi correo, ¿qué hago?',
        a: 'Abre el mensaje que te enviamos al crear la cuenta y entra al enlace. Verificar el correo no es necesario para comprar. Si el enlace venció, escríbenos desde Contacto y pide uno nuevo.',
      },
      {
        q: '¿Cómo corrijo mis datos o elimino mi cuenta?',
        a: 'Escríbenos desde Contacto indicando qué quieres cambiar.',
      },
    ],
  },
];

export const HelpPage: React.FC = () => (
  <LegalLayout title="Ayuda" intro="Respuestas a las dudas más comunes, ordenadas por lo que quieres hacer.">
    <nav aria-label="Temas de ayuda" className="not-prose mb-8">
      <ul className="flex flex-wrap gap-2">
        {[...TOPICS, { id: 'contacto', title: 'Contacto', faqs: [] }].map((topic) => (
          <li key={topic.id}>
            <a
              href={`#${topic.id}`}
              className="inline-flex min-h-[44px] items-center rounded-full border border-line-strong px-4 text-small font-medium text-ink transition-colors hover:bg-ink/5 sm:min-h-[36px]"
            >
              {topic.title}
            </a>
          </li>
        ))}
      </ul>
    </nav>

    {TOPICS.map((topic) => (
      <section key={topic.id} aria-labelledby={topic.id}>
        <h2 id={topic.id} className="scroll-mt-24">
          {topic.title}
        </h2>
        <div className="not-prose space-y-3">
          {topic.faqs.map((item) => (
            <details key={item.q} className="group rounded-xl border border-line bg-surface px-4 py-1 open:bg-paper">
              <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-2 text-body font-medium text-ink marker:hidden">
                <span className="text-gold-text group-open:hidden" aria-hidden="true">
                  +
                </span>
                <span className="hidden text-gold-text group-open:inline" aria-hidden="true">
                  −
                </span>
                {item.q}
              </summary>
              <p className="pb-3 pl-5 text-body text-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    ))}

    <h2 id="contacto" className="scroll-mt-24">
      Contacto
    </h2>
    <p>
      RAM Alliance es un proyecto académico y no tiene un centro de atención real. Para consultas escribe a <a href="mailto:ayuda@ramalliance.example">ayuda@ramalliance.example</a> (dirección de ejemplo). Indica siempre el número de orden o el código de reserva.
    </p>

    <h2>Documentos</h2>
    <ul>
      <li>
        <Link to="/transparencia">Transparencia de precios y tarifas</Link>
      </li>
      <li>
        <Link to="/condiciones-transporte">Condiciones de transporte</Link>
      </li>
      <li>
        <Link to="/terminos">Términos de uso</Link>
      </li>
      <li>
        <Link to="/privacidad">Política de privacidad</Link>
      </li>
    </ul>
  </LegalLayout>
);
