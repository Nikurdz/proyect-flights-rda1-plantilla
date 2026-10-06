import React from 'react';
import { Link } from 'react-router-dom';
import { LegalLayout, PrototypeNotice } from './LegalLayout';

export const PrivacyPage: React.FC = () => (
  <LegalLayout title="Política de privacidad" intro="Qué datos personales tratamos, para qué, cómo los protegemos y qué derechos tienes sobre ellos.">
    <PrototypeNotice />

    <h2>1. Datos que recopilamos</h2>
    <table>
      <thead><tr><th>Cuándo</th><th>Datos</th></tr></thead>
      <tbody>
        <tr><td>Al crear una cuenta</td><td>Correo, contraseña (guardada solo como huella cifrada irreversible), nombres, apellidos, fecha de nacimiento, teléfono opcional y la versión de los términos aceptada.</td></tr>
        <tr><td>Al comprar</td><td>Por pasajero: nombres, apellidos, fecha de nacimiento, género, nacionalidad y documento de viaje. Contacto del comprador (correo y teléfono) y datos de facturación.</td></tr>
        <tr><td>Al pagar</td><td>Solo la marca de la tarjeta y sus últimos cuatro dígitos. <strong>Nunca guardamos el número completo ni el código de seguridad.</strong></td></tr>
        <tr><td>Al usar el sitio</td><td>Un identificador técnico de cada solicitud para diagnosticar errores, y los datos mínimos de la sesión.</td></tr>
      </tbody>
    </table>

    <h2>2. Para qué los usamos</h2>
    <ul>
      <li>Emitir y gestionar tus reservas, billetes y órdenes.</li>
      <li>Enviarte mensajes de servicio: confirmación de compra, avisos de seguridad de la cuenta y verificación de correo.</li>
      <li>Prevenir fraude y abusos (por ejemplo, limitar intentos repetidos).</li>
      <li>Cumplir obligaciones legales y atender tus solicitudes.</li>
    </ul>
    <p>No vendemos tus datos. El consentimiento para comunicaciones comerciales es opcional, está desactivado de forma predeterminada y puedes cambiarlo cuando quieras en <Link to="/mi-cuenta">Mi cuenta</Link>.</p>

    <h2>3. Cómo los protegemos</h2>
    <ul>
      <li>Los datos de pasajeros, contacto y facturación se guardan <strong>cifrados</strong> en la base de datos.</li>
      <li>Las contraseñas se almacenan con un algoritmo de derivación de claves; no se pueden leer.</li>
      <li>Cada persona solo puede ver sus propias órdenes. Un invitado recupera su viaje con el número de orden o el código de reserva <em>y</em> un apellido de los pasajeros; esa vista no muestra el contacto del comprador.</li>
      <li>El personal administrativo autorizado puede consultar órdenes para soporte, mediante una cuenta con permisos especiales.</li>
      <li>La comunicación con el servidor viaja cifrada (HTTPS).</li>
    </ul>

    <h2>4. Con quién se comparten</h2>
    <p>Los datos necesarios para el viaje se comparten con la aerolínea que opera el vuelo y con el proveedor de pagos. En este prototipo el proveedor de pagos y el envío de correos son simulados, por lo que ningún dato sale a terceros reales.</p>

    <h2>5. Cuánto tiempo los conservamos</h2>
    <p>Conservamos las órdenes mientras sean necesarias para el servicio y las obligaciones legales. Las reservas no pagadas se liberan al vencer su tiempo de retención.</p>

    <h2>6. Tus derechos</h2>
    <p>Puedes pedir acceso, rectificación, eliminación o limitación del uso de tus datos, y retirar tu consentimiento de marketing. Solicítalo desde <Link to="/ayuda#contacto">Ayuda</Link> indicando el correo de tu cuenta.</p>

    <h2>7. Cookies y almacenamiento local</h2>
    <p>Usamos únicamente almacenamiento de sesión del navegador para mantener tu sesión y tu última orden mientras la pestaña está abierta. No usamos cookies publicitarias ni de seguimiento.</p>

    <h2>8. Cambios</h2>
    <p>Si actualizamos esta política, cambiaremos la versión y la fecha de esta página.</p>
  </LegalLayout>
);
