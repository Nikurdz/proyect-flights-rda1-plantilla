import React from 'react';
import { Link } from 'react-router-dom';
import { LegalLayout, PrototypeNotice } from './LegalLayout';

export const TermsPage: React.FC = () => (
  <LegalLayout title="Términos de uso" intro="Reglas para usar este sitio, crear una cuenta y comprar vuelos a través de RAM Alliance.">
    <PrototypeNotice />

    <h2>1. Quiénes somos y qué ofrecemos</h2>
    <p>RAM Alliance es una plataforma de venta de vuelos directos. Permite buscar itinerarios, comparar familias tarifarias, reservar asientos temporalmente, pagar y gestionar el viaje comprado. El sitio opera únicamente en dólares estadounidenses (USD).</p>

    <h2>2. Aceptación</h2>
    <p>Al usar el sitio, crear una cuenta o comprar, aceptas estos términos, la <Link to="/privacidad">Política de privacidad</Link> y las <Link to="/condiciones-transporte">Condiciones de transporte</Link>. Si no estás de acuerdo, no uses el servicio.</p>

    <h2>3. Cuenta de usuario</h2>
    <ul>
      <li>Puedes comprar como invitado o con una cuenta gratuita.</li>
      <li>Debes ser mayor de edad y dar datos verdaderos. La contraseña tiene al menos 10 caracteres, con una letra y un número.</li>
      <li>Eres responsable de mantener tu contraseña en secreto y de la actividad de tu cuenta.</li>
      <li>Tras varios intentos fallidos de inicio de sesión, la cuenta se bloquea unos minutos por seguridad.</li>
      <li>La verificación de correo confirma que la dirección es tuya; en esta versión no condiciona el uso de la cuenta.</li>
    </ul>

    <h2>4. Reservas y compra</h2>
    <ul>
      <li>Una reserva retiene los asientos 15 minutos. Pasado ese tiempo se libera sin costo.</li>
      <li>El precio puede cambiar hasta el momento del pago; te lo mostramos y debes aceptarlo antes de continuar.</li>
      <li>Los datos de cada pasajero (nombre, documento, fecha de nacimiento) deben coincidir con su documento de viaje. Un error puede impedir el viaje.</li>
      <li>La compra se confirma cuando recibes el número de orden, el código de reserva (PNR) y los billetes electrónicos.</li>
      <li>Las reglas por familia tarifaria (equipaje, cambios, reembolsos) están en <Link to="/transparencia#familias">Transparencia</Link>.</li>
    </ul>

    <h2>5. Pagos simulados</h2>
    <p>Mientras el proyecto sea un prototipo, los pagos se simulan. No ingreses datos reales de tarjetas. Ninguna compra realizada aquí genera un derecho de transporte real ni un cobro.</p>

    <h2>6. Uso aceptable</h2>
    <ul>
      <li>No intentes acceder a información de otras personas ni sobrecargar el servicio.</li>
      <li>No uses el sitio para fines ilícitos ni para reservar asientos sin intención de viajar.</li>
      <li>Podemos limitar o bloquear el acceso ante un uso indebido.</li>
    </ul>

    <h2>7. Responsabilidad</h2>
    <p>Hacemos lo posible por mantener el servicio disponible y la información exacta, pero no garantizamos que esté libre de interrupciones o errores. Los horarios mostrados son referenciales y pueden variar.</p>

    <h2>8. Cambios a estos términos</h2>
    <p>Podemos actualizar estos términos. Cada versión tiene un identificador y, al comprar, se registra la versión que aceptaste.</p>

    <h2>9. Contacto</h2>
    <p>Para dudas sobre estos términos, escribe a través de la sección <Link to="/ayuda#contacto">Ayuda</Link>.</p>
  </LegalLayout>
);
