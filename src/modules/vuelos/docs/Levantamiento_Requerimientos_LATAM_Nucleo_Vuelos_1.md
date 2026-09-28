**LE V A N T A M I E N T O D E R E Q U E R I M I E N T O S** 

**Núcleo de Vuelos** Sitio web LATAM Airlines 

_Documento de Especificación de Requerimientos de Software (SRS)_ 

|**Elemento**|**Detalle**|
|---|---|
|**Proyecto**|Sistema de Vuelos — Levantamiento y generación de microservicio de vuelos|
|**Dominio analizado**|latamairlines.com — flujo de búsqueda, disponibilidad, tarificación, selección,<br>pasajeros, pago y emisión|
|**Alcance del documento**|Núcleo de vuelos (booking flow). Post-venta y fidelización se documentan solo<br>como interfaces limítrofes.|
|**Tipo de documento**|Especificación formal de requerimientos (IEEE 830 / ISO-IEC-IEEE 29148<br>adaptado)|
|**Versión**|1.0|
|**Fecha**|21 de septiembre de 2026|
|**Elaborado por**|Equipo de Desarrollo — Análisis y Arquitectura|
|**Método de levantamiento**|Ingeniería inversa funcional sobre el sitio productivo + análisis documental de<br>fuentes oficiales LATAM y estándares IATA|
|**Estado**|Emitido para revisión|



SRS — Núcleo de Vuelos · Sistema de Vuelos · v1.0 

# **Control de versiones** 

|**Versión**|**Fecha**|**Autor**|**Descripción del cambio**|
|---|---|---|---|
|0.1|15/09/2026|Análisis|Borrador inicial de módulos identificados.|
|0.5|18/09/2026|Análisis|Incorporación de evidencia observada en el sitio<br>productivo.|
|1.0|21/09/2026|Análisis y Arquitectura|Versión completa: requerimientos funcionales y no<br>funcionales, reglas de negocio, casos de uso,<br>historias de usuario, modelo de datos y contratos<br>de API.|



# **Tabla de contenido** 

_Para actualizar la tabla de contenido en Word: clic derecho sobre ella y seleccionar "Actualizar campos"._ 

Página _2_ de _40_ 

SRS — Núcleo de Vuelos · Sistema de Vuelos · v1.0 

# **1. Introducción** 

## **1.1 Propósito** 

Este documento especifica, de manera formal y verificable, los requerimientos del núcleo de vuelos que el proyecto Sistema de Vuelos debe implementar como microservicio. El levantamiento toma como sistema de referencia el sitio web transaccional de LATAM Airlines, del cual se derivan las funcionalidades, reglas de negocio, validaciones y atributos de calidad observables desde la perspectiva del usuario final y del consumidor de la API. 

El documento está dirigido al equipo de desarrollo, a la arquitectura de solución, a QA y al área de producto. Su propósito operativo es doble: servir de base contractual para la construcción del microservicio y habilitar la construcción de los planes de prueba mediante criterios de aceptación explícitos. 

## **1.2 Alcance** 

El alcance cubre el recorrido completo de compra de un pasaje aéreo, desde la resolución del contexto de mercado hasta la emisión del billete electrónico. Concretamente: 

- Resolución de contexto: país, idioma, moneda y catálogo de puntos de venta. 

- Catálogo de ciudades y aeropuertos con búsqueda incremental. 

- Motor de búsqueda (booking box): tipo de viaje, origen y destino, fechas, cabina, composición de pasajeros, código promocional y modalidad de redención con millas. 

- Consulta de disponibilidad y construcción de itinerarios, incluyendo conexiones y vuelos operados por terceros. 

- Tarificación por familias tarifarias y presentación comparativa de atributos. 

- Construcción y revalidación de la oferta (carrito), con vigencia acotada. 

- Captura y validación de datos de pasajeros y de contacto. 

- Servicios adicionales asociados al vuelo (asiento, equipaje, upgrade). 

- Procesamiento de pago y emisión de la reserva (PNR) y del billete electrónico. 

Quedan fuera del alcance de la construcción, pero se documentan como interfaces limítrofes de obligada definición: check-in, gestión posterior de la reserva (cambios y devoluciones), programa de fidelización LATAM Pass, y los productos no aéreos comercializados en el portal (alojamientos, autos, traslados, actividades, eSIM y asistencia en viaje). 

## **1.3 Definiciones, acrónimos y abreviaturas** 

|**Término**|**Definición**|
|---|---|
|**PNR**|Passenger Name Record. Registro de reserva identificado por un localizador alfanumérico de<br>seis caracteres.|
|**E-ticket**|Billete electrónico. Documento fiscal y de transporte identificado por un número de trece<br>dígitos con prefijo de aerolínea.|



Página _3_ de _40_ 

SRS — Núcleo de Vuelos · Sistema de Vuelos · v1.0 

|**Término**|**Definición**|
|---|---|
|**IATA**|International Air Transport Association. Define los códigos de tres letras para aeropuertos y<br>de dos para aerolíneas.|
|**NDC**|New Distribution Capability. Estándar IATA basado en XML para la distribución de ofertas y<br>órdenes.|
|**ONE Order**|Iniciativa IATA que unifica PNR, e-ticket y EMD en un único registro de orden.|
|**PSS**|Passenger Service System. Sistema núcleo de la aerolínea: inventario, reservas y control de<br>salidas.|
|**Familia tarifaria**|Agrupación comercial de condiciones (equipaje, cambios, devoluciones, asiento,<br>acumulación) asociada a una clase de reserva.|
|**Ancillary**|Servicio complementario al transporte: asiento, equipaje adicional, upgrade, seguro.|
|**Segmento**|Tramo operado por un único número de vuelo entre dos aeropuertos.|
|**Itinerario**|Secuencia ordenada de uno o más segmentos que conecta el origen con el destino de un<br>trayecto.|
|**Oferta**|Combinación cotizada de itinerarios, familias tarifarias y pasajeros, con precio y vigencia<br>definidos.|
|**Revalidación**|Verificación de que el precio y la disponibilidad de una oferta siguen vigentes antes de<br>confirmarla.|
|**APIS**|Advance Passenger Information System. Datos del documento de viaje exigidos por<br>autoridades migratorias.|
|**EMD**|Electronic Miscellaneous Document. Documento electrónico que respalda un servicio<br>adicional.|
|**Deep link**|URL que codifica los criterios de búsqueda y permite reconstruir el estado de la consulta.|
|**TTL**|Time To Live. Tiempo de vigencia de un dato en caché o de una cotización.|



## **1.4 Referencias** 

- Sitio productivo LATAM Airlines Colombia: portal de cotización y página de selección de vuelos (recorrido ejecutado el 21/09/2026). 

- Centro de ayuda LATAM: medios de pago disponibles para compras. 

- Centro de ayuda LATAM: tarifas para vuelos internacionales y tarifas para vuelos dentro del país. 

- Centro de ayuda LATAM: cómo comprar el pasaje en línea. 

- IATA — Distribution with Offers and Orders (NDC) y ONE Order Transition Study. 

- ISO/IEC/IEEE 29148 — Requirements engineering; IEEE 830 — Recommended Practice for SRS. 

- WCAG 2.1 nivel AA; PCI DSS v4.0; Ley 1581 de 2012 (Colombia), LGPD (Brasil) y GDPR (Unión Europea). 

Página _4_ de _40_ 

SRS — Núcleo de Vuelos · Sistema de Vuelos · v1.0 

## **1.5 Metodología del levantamiento** 

El levantamiento combinó dos técnicas complementarias. La primera fue ingeniería inversa funcional: se ejecutó una transacción real de búsqueda en el portal colombiano para el par Bogotá (BOG) – Santiago de Chile (SCL), con fechas de ida el 15 de octubre de 2026 y regreso el 22 de octubre de 2026, un pasajero adulto y cabina económica. Sobre el resultado se inspeccionaron el formulario de búsqueda, el árbol de accesibilidad de la página de resultados, el comportamiento del ordenamiento y el panel comparativo de familias tarifarias. La segunda técnica fue análisis documental sobre fuentes oficiales de la aerolínea y sobre los estándares de distribución de la industria, con el fin de completar aquellas reglas que no son observables desde la interfaz. 

Cada requerimiento funcional indica su origen. Se marca como "Observado" aquel derivado directamente de la evidencia recogida en el sitio, como "Documental" el derivado de fuentes oficiales, y como "Dominio" el derivado de prácticas estándar de la industria aérea que el equipo propone incorporar y que requieren validación con el área de negocio. 

Página _5_ de _40_ 

SRS — Núcleo de Vuelos · Sistema de Vuelos · v1.0 

# **2. Descripción general del sistema** 

## **2.1 Perspectiva del producto** 

El microservicio de vuelos es la pieza transaccional central del ecosistema. No opera de forma aislada: consume el inventario y el motor tarifario del PSS de la aerolínea, delega la autorización de cobros en una pasarela de pagos, y publica eventos de dominio que otros servicios consumen para notificaciones, fidelización y analítica. Hacia afuera expone una API que sirve tanto al canal web como a las aplicaciones móviles y a los canales de agencias. 

El patrón de interacción observado en el sitio es de tipo "offer and order": el usuario construye progresivamente una oferta que se va enriqueciendo (itinerario de ida, itinerario de vuelta, familia tarifaria, pasajeros, servicios adicionales) y que solo se convierte en una orden en firme cuando el pago es autorizado. Este patrón se alinea con la dirección que marca IATA con NDC y ONE Order, y es el modelo que se recomienda adoptar para el microservicio. 

## **2.2 Actores del sistema** 

|**Actor**|**Tipo**|**Responsabilidad e interacción con el sistema**|
|---|---|---|
|**Visitante anónimo**|Humano|Consulta el catálogo, busca vuelos, compara tarifas y puede completar<br>una compra sin autenticarse. Es el actor principal del flujo de cotización.|
|**Usuario registrado**|Humano|Visitante autenticado con cuenta LATAM Pass. Obtiene autocompletado<br>de datos, acumulación de millas y acceso a la modalidad de canje.|
|**Socio LATAM Pass**|Humano|Usuario registrado con saldo de millas, habilitado para cotizar y pagar<br>bajo la modalidad "millas + dinero".|
|**Agente de ventas**|Humano|Opera el mismo núcleo a través de canales asistidos; requiere<br>trazabilidad del punto de venta y del identificador del agente.|
|**PSS / motor de**<br>**inventario**|Sistema|Provee disponibilidad de asientos por clase de reserva, malla de vuelos<br>y confirmación de la reserva.|
|**Motor tarifario**|Sistema|Calcula tarifa base, tasas, impuestos y cargos según ruta, punto de<br>venta, fecha y familia tarifaria.|
|**Pasarela de pagos**|Sistema|Tokeniza el instrumento de pago, ejecuta la autenticación 3-D Secure y<br>autoriza o rechaza la transacción.|
|**Servicio antifraude**|Sistema|Evalúa el riesgo de la transacción y devuelve una decisión de<br>aprobación, revisión o rechazo.|
|**Servicio de fidelización**|Sistema|Consulta el saldo de millas, reserva el débito durante la cotización y<br>confirma la acumulación tras la emisión.|
|**Servicio de**<br>**notificaciones**|Sistema|Envía la confirmación de compra y los documentos de viaje al contacto<br>registrado.|
|**Proveedores de**<br>**terceros**|Sistema|Suministran los productos complementarios enlazados desde el portal<br>(alojamiento, traslados, actividades, eSIM).|



Página _6_ de _40_ 

SRS — Núcleo de Vuelos · Sistema de Vuelos · v1.0 

## **2.3 Módulos funcionales identificados** 

El análisis del recorrido de compra permitió descomponer el núcleo en diez módulos funcionales. Los módulos MOD-01 a MOD-09 constituyen el alcance de construcción; MOD-10 se documenta como frontera. 

|**Código**|**Módulo**|**Responsabilidad**|
|---|---|---|
|**MOD-01**|Contexto y catálogo|Resolución de mercado, idioma y moneda; catálogo de ciudades y<br>aeropuertos.|
|**MOD-02**|Motor de búsqueda|Captura y validación de los criterios de viaje; construcción del deep<br>link.|
|**MOD-03**|Disponibilidad|Consulta de itinerarios, ordenamiento, filtrado y presentación de<br>atributos.|
|**MOD-04**|Tarificación|Familias tarifarias, desglose de precio y cotización en millas.|
|**MOD-05**|Oferta y carrito|Consolidación, revalidación y vigencia de la oferta.|
|**MOD-06**|Pasajeros|Captura, validación y normalización de datos personales y de<br>contacto.|
|**MOD-07**|Servicios adicionales|Asiento, equipaje adicional, upgrade y coberturas.|
|**MOD-08**|Pago|Medios de pago, tokenización, autenticación y autorización.|
|**MOD-09**|Emisión|Creación del PNR, emisión del e-ticket y publicación de eventos.|
|**MOD-10**|Post-venta (frontera)|Gestión de reserva, cambios, devoluciones y check-in.|



## **2.4 Supuestos y dependencias** 

- El microservicio no es la fuente de verdad del inventario: depende del PSS, cuya latencia y disponibilidad condicionan directamente los atributos de calidad comprometidos. 

- El cálculo tarifario se delega al motor tarifario; el microservicio es responsable de la presentación, el cacheo controlado y la revalidación, no del cálculo. 

- Los datos de tarjeta nunca transitan ni se persisten en el microservicio: se asume un modelo de tokenización en el lado de la pasarela. 

- El catálogo de puntos de venta, monedas y medios de pago habilitados es configurable por mercado y no se codifica en el servicio. 

- Se asume que el PSS soporta operaciones idempotentes de creación de reserva mediante una clave de idempotencia provista por el microservicio. 

## **2.5 Restricciones** 

- Regulatorias: cumplimiento de PCI DSS para el tratamiento de pagos y de la normativa de protección de datos aplicable en cada mercado de operación. 

- De interoperabilidad: los identificadores de aeropuerto, aerolínea y clase de reserva deben ceñirse a la codificación IATA. 

Página _7_ de _40_ 

SRS — Núcleo de Vuelos · Sistema de Vuelos · v1.0 

- De negocio: las condiciones de equipaje, cambios y devoluciones no son configurables por el microservicio; provienen del catálogo de familias tarifarias. 

- Operativas: la ventana de venta y las reglas de anticipación mínima dependen de la malla publicada y de las restricciones del mercado emisor. 

- De accesibilidad: el nivel de cumplimiento observado en el sitio de referencia es alto, por lo que la API debe exponer la información semántica necesaria para sostenerlo en el cliente. 

Página _8_ de _40_ 

SRS — Núcleo de Vuelos · Sistema de Vuelos · v1.0 

# **3. Requerimientos funcionales** 

Los requerimientos se numeran de forma correlativa y estable dentro de cada módulo. La prioridad se expresa según MoSCoW: Alta corresponde a "Must have" y condiciona la liberación del producto mínimo; Media corresponde a "Should have"; Baja corresponde a "Could have". 

## **3.1 MOD-01 — Contexto de mercado y catálogo** 

El sitio opera como un conjunto de portales por país bajo una misma plataforma. La ruta observada, correspondiente al portal colombiano en español, determina el idioma de la interfaz, la moneda de cotización y el conjunto de medios de pago ofrecidos. Durante la navegación se activó un diálogo de reconciliación geográfica que advertía la discrepancia entre el país del portal y el país inferido de la conexión, ofreciendo cambiar de portal o continuar en el actual. Este comportamiento es un requerimiento de primer orden porque determina toda la cotización posterior. 

|**ID**|**Requerimiento**|**Descripción y criterios de aceptación**|**Prioridad**|
|---|---|---|---|
|**RF-001**|Resolución del punto de<br>venta|El sistema debe resolver el punto de venta a partir del portal<br>solicitado, determinando país, idioma y moneda de<br>cotización. Criterio: toda respuesta de cotización incluye<br>explícitamente el punto de venta, el código de moneda ISO<br>4217 y el idioma aplicados. Origen: Observado.|Alta|
|||El sistema debe detectar la discrepancia entre el país del<br>portal solicitado y el país inferido de la conexión, y exponer||
|**RF-002**|Reconciliación geográfica|al cliente la opción de mantener el portal o migrar al del país<br>detectado. Criterio: la decisión del usuario persiste durante<br>la sesión y no se vuelve a solicitar. Origen: Observado.|Media|
|**RF-003**|Moneda de cotización|Todos los importes deben expresarse en la moneda del<br>punto de venta, con el formato de miles y decimales<br>correspondiente a la localización. Criterio: para el portal<br>colombiano los precios se expresan en COP con separador<br>de miles de punto y sin decimales. Origen: Observado.|Alta|
|**RF-004**|Catálogo de ciudades y<br>aeropuertos|El sistema debe exponer un catálogo consultable de<br>ciudades y aeropuertos con código IATA, nombre de ciudad,<br>nombre de aeropuerto, país y zona horaria. Criterio: el<br>catálogo observado supera las mil quinientas entradas<br>seleccionables como origen. Origen: Observado.|Alta|
|**RF-005**|Búsqueda incremental de<br>localidades|La consulta del catálogo debe admitir búsqueda por prefijo<br>sobre código IATA, nombre de ciudad y nombre de<br>aeropuerto, tolerante a acentos y a mayúsculas. Criterio: la<br>respuesta se entrega en menos de trescientos milisegundos<br>y devuelve resultados ordenados por relevancia comercial.<br>Origen: Observado.|Alta|
|**RF-006**|Ciudades multiaeropuerto|El catálogo debe representar la relación entre ciudad y<br>aeropuertos, permitiendo seleccionar una ciudad como<br>criterio de búsqueda que expanda a todos sus aeropuertos.|Media|



Página _9_ de _40_ 

SRS — Núcleo de Vuelos · Sistema de Vuelos · v1.0 

|**ID**|**Requerimiento**|**Descripción y criterios de aceptación**|**Prioridad**|
|---|---|---|---|
|||Origen: Dominio.||
|**RF-007**|Exclusión de pares no<br>operados|El sistema debe impedir la selección de pares origen–<br>destino sin conectividad comercial publicada, informando la<br>restricción antes de ejecutar la búsqueda. Criterio: el<br>catálogo de destinos se recalcula tras seleccionar el origen.<br>Origen: Observado.|Media|
|**RF-008**|Vigencia del catálogo|El catálogo debe sincronizarse con la malla publicada<br>mediante un proceso programado, con marca de versión y<br>fecha de última actualización expuestas en la respuesta.<br>Origen: Dominio.|Media|



## **3.2 MOD-02 — Motor de búsqueda** 

El formulario de búsqueda del sitio expone tres tipos de viaje, campos de origen y destino con autocompletado e inversión recíproca, selector de cabina, fechas de ida y vuelta, composición de pasajeros, código promocional y una casilla para cotizar con millas más dinero. Los criterios se serializan íntegramente en la URL, lo que permite reconstruir cualquier búsqueda a partir de un enlace. 

|**ID**|**Requerimiento**|**Descripción y criterios de aceptación**|**Prioridad**|
|---|---|---|---|
|**RF-010**|Tipos de viaje|El sistema debe soportar los tipos de viaje "ida y vuelta",<br>"solo ida" y "multidestino". Criterio: el tipo determina la<br>cantidad de trayectos solicitados y la estructura de la<br>respuesta de disponibilidad. Origen: Observado.|Alta|
|**RF-011**|Origen y destino|El sistema debe recibir origen y destino como códigos IATA<br>válidos y distintos entre sí, y ofrecer la inversión recíproca<br>de ambos valores en una sola acción. Criterio: origen igual a<br>destino es rechazado con mensaje explícito. Origen:<br>Observado.|Alta|
|**RF-012**|Selección de cabina|El sistema debe permitir acotar la búsqueda por cabina<br>entre económica, premium economy y premium business.<br>Criterio: la disponibilidad devuelta se restringe a la cabina<br>solicitada y a las superiores cuando la inferior no tiene<br>inventario. Origen: Observado.|Alta|
|**RF-013**|Fechas de viaje|El sistema debe validar que la fecha de ida no sea anterior a<br>la fecha actual en el huso del aeropuerto de origen, que la<br>fecha de vuelta no sea anterior a la de ida, y que ambas se<br>encuentren dentro de la ventana de venta publicada.<br>Criterio: cada violación produce un código de error<br>diferenciado. Origen: Observado y Dominio.|Alta|
|**RF-014**|Composición de pasajeros|El sistema debe recibir la cantidad de adultos, niños e<br>infantes, aplicando los límites máximos por reserva y la<br>relación entre infantes y adultos acompañantes. Criterio: la<br>cantidad de infantes en brazos no puede superar la cantidad|Alta|



Página _10_ de _40_ 

SRS — Núcleo de Vuelos · Sistema de Vuelos · v1.0 

|**ID**|**Requerimiento**|**Descripción y criterios de aceptación**|**Prioridad**|
|---|---|---|---|
|||de adultos. Origen: Observado y Dominio.||
|**RF-015**|Código promocional|El sistema debe admitir un código promocional opcional,<br>validarlo contra el catálogo de campañas vigentes para el<br>punto de venta y aplicarlo a la cotización. Criterio: un código<br>inválido o expirado no bloquea la búsqueda; se informa y se<br>cotiza sin descuento. Origen: Observado.|Media|
|**RF-016**|Modalidad de redención|El sistema debe permitir activar la cotización bajo la<br>modalidad "millas más dinero", devolviendo en ese caso el<br>precio expresado en millas y en el remanente monetario.<br>Criterio: la modalidad exige sesión autenticada con saldo<br>consultable. Origen: Observado.|Alta|
|||El sistema debe serializar la totalidad de los criterios de<br>búsqueda en parámetros de consulta, de modo que un<br>enlace reconstruya íntegramente el estado de la consulta.||
|**RF-017**|Enlaces profundos|Criterio: los parámetros observados incluyen origen,<br>destino, fecha de ida, fecha de vuelta, adultos, niños,<br>infantes, tipo de viaje, cabina, indicador de redención y<br>criterio de ordenamiento. Origen: Observado.|Alta|
|||Desde la página de resultados el sistema debe permitir||
|**RF-018**|Modificación de la<br>búsqueda en contexto|reabrir el formulario con los criterios vigentes precargados y<br>relanzar la búsqueda sin perder el contexto de sesión.<br>Origen: Observado.|Alta|
|||Toda violación de las reglas de entrada debe producir un||
|**RF-019**|Validación y mensajería de<br>errores|error estructurado con código, campo afectado y mensaje<br>localizado, sin exponer detalles internos de implementación.<br>Origen: Dominio.|Alta|



## **3.3 MOD-03 — Disponibilidad y presentación de itinerarios** 

La página de resultados presenta los itinerarios de un trayecto a la vez, comenzando por la ida, y advierte que el criterio de ordenamiento elegido se aplicará también al trayecto de vuelta. Cada tarjeta de vuelo expone hora de salida y llegada, indicador de cruce de día, duración total, número de escalas, precio por persona desde y la aerolínea operadora, que no siempre coincide con la comercializadora. Se observaron itinerarios operados por LATAM Airlines Colombia, Perú, Brasil y Group, así como un itinerario directo operado por Wamos Air, lo que confirma la necesidad de modelar explícitamente el operador por segmento. 

|**ID**|**Requerimiento**|**Descripción y criterios de aceptación**|**Prioridad**|
|---|---|---|---|
|**RF-020**|Consulta de disponibilidad<br>por trayecto|El sistema debe devolver el conjunto de itinerarios<br>disponibles para cada trayecto solicitado, resolviendo<br>conexiones de uno o más segmentos. Criterio: se<br>observaron itinerarios directos, con una escala y con dos<br>escalas para el mismo par de ciudades. Origen: Observado.|Alta|
|**RF-021**|Selección secuencial por|En viajes de ida y vuelta o multidestino, el sistema debe|Alta|



Página _11_ de _40_ 

SRS — Núcleo de Vuelos · Sistema de Vuelos · v1.0 

|**ID**|**Requerimiento**<br>trayecto|**Descripción y criterios de aceptación**<br>conducir la selección trayecto por trayecto, conservando lo<br>ya elegido. Criterio: la interfaz indica explícitamente el<br>trayecto en curso. Origen: Observado.|**Prioridad**|
|---|---|---|---|
|**RF-022**|Atributos del itinerario|Cada itinerario debe exponer hora de salida, hora de<br>llegada, indicador de cruce de día, duración total, cantidad<br>de escalas, aeropuertos de origen y destino con su<br>denominación completa, y el precio mínimo por persona.<br>Origen: Observado.|Alta|
|||El sistema debe identificar la aerolínea operadora de cada<br>segmento y advertirla cuando difiera de la comercializadora.||
|**RF-023**|Aerolínea operadora por<br>segmento|i  i<br>Criterio: se observaron operadores LATAM Airlines<br>Colombia, LATAM Airlines Perú, LATAM Airlines Brasil,<br>LATAM Airlines Group y Wamos Air en un mismo conjunto<br>de resultados. Origen: Observado.|Alta|
|**RF-024**|Información de aeronave y<br>servicios a bordo|Al desplegar el detalle de un itinerario, el sistema debe<br>exponer el modelo de aeronave y los servicios incluidos a<br>bordo, con sus notas aclaratorias. Criterio: se observó<br>"Airbus A330" con servicio de alimentación,<br>entretenimiento a bordo, bebidas y tomacorriente. Origen:<br>Observado.|Media|
|**RF-025**|Distintivos comerciales|El sistema debe calcular y exponer los distintivos<br>"recomendado", "más económico" y "más rápido" sobre el<br>conjunto de resultados de cada trayecto. Criterio: un mismo<br>itinerario puede acumular más de un distintivo. Origen:<br>Observado.|Media|
|**RF-026**|Indicador de escasez de<br>inventario|El sistema debe señalar los itinerarios cuyo inventario en la<br>clase cotizada esté por debajo del umbral definido,<br>mediante la leyenda de últimos asientos disponibles a ese<br>precio. Origen: Observado.|Media|
|**RF-027**|Ordenamiento de<br>resultados|El sistema debe soportar el ordenamiento por<br>recomendación, precio ascendente, duración ascendente,<br>hora de salida más temprana, hora de salida más tardía,<br>hora de llegada más temprana y hora de llegada más tardía.<br>Criterio: el orden seleccionado se aplica a todos los<br>trayectos del viaje y se refleja en el enlace profundo. Origen:<br>Observado.|Alta|
|**RF-028**|Filtros de resultados|El sistema debe permitir filtrar por cantidad de escalas,<br>franja horaria de salida y llegada, aerolínea operadora y<br>duración máxima, aplicando los filtros sin relanzar la<br>consulta al inventario cuando el conjunto ya esté en<br>memoria. Origen: Dominio.|Media|
|**RF-029**|Calendario de precios|El sistema debe ofrecer el precio mínimo para fechas<br>próximas a las solicitadas, de modo que el usuario pueda|Media|



Página _12_ de _40_ 

SRS — Núcleo de Vuelos · Sistema de Vuelos · v1.0 

|**ID**|**Requerimiento**|**Descripción y criterios de aceptación**|**Prioridad**|
|---|---|---|---|
|**RF-030**|Carga progresiva|desplazar su viaje. Criterio: el desplazamiento de fecha<br>relanza la cotización conservando el resto de criterios.<br>Origen: Dominio.<br>Cuando el conjunto de resultados supere el umbral de<br>presentación, el sistema debe entregarlo de forma paginada<br>o progresiva, conservando el orden global. Criterio: se<br>observaron más de cuarenta itinerarios para un único<br>trayecto. Origen: Observado.|Media|
|**RF-031**|Ausencia de disponibilidad|Cuando no existan itinerarios para los criterios dados, el<br>sistema debe responder con un resultado vacío diferenciado<br>del error, acompañado de sugerencias de fechas o<br>aeropuertos alternativos. Origen: Dominio.|Alta|



## **3.4 MOD-04 — Tarificación y familias tarifarias** 

Al expandir un itinerario, el sitio presenta un panel comparativo de familias tarifarias. En el caso observado se ofrecieron cinco tarifas para un mismo vuelo: Basic, Light y Full en cabina económica, y Premium Business Standard y Premium Business Full en cabina superior. Cada familia se describe mediante un conjunto homogéneo de atributos —franquicia de equipaje de mano y de bodega, condiciones de cambio, condiciones de devolución, selección de asiento, elegibilidad para upgrade y acumulación de millas— y un precio por pasajero que se declara con tasas e impuestos incluidos. 

La siguiente tabla consolida las condiciones observadas en el sitio y las contrastadas con el centro de ayuda oficial. Constituye la base del catálogo de familias que debe administrar el microservicio. 

|**Familia**|**Cabina**|**Equipaje de**<br>**mano**|**Equipaje de**<br>**bodega**|**Cambios**|**Devolución**|
|---|---|---|---|---|---|
|Basic|Económica|Solo bolso o<br>mochila|No incluido|Con cargo más<br>diferencia de<br>precio|Solo tasa de<br>embarque|
|Light|Económica|Bolso más<br>maleta de 12 kg|No incluido|Con cargo más<br>diferencia de<br>precio|Solo tasa de<br>embarque|
|Full|Económica|Bolso más<br>maleta de 12 kg|Una pieza de 23 kg|Sin cargo más<br>diferencia de<br>precio|Antes de la salida<br>del primer vuelo|
|Premium<br>Economy<br>Standard|Premium<br>economy|Bolso más<br>maleta de 16 kg|Una pieza de 23 kg|Con diferencia de<br>tarifa|Según condición<br>de la familia|
|Premium<br>Economy Full|Premium<br>economy|Bolso más<br>maleta de 16 kg|Una pieza de 23 kg|Permitidos|Devolución total|
|Premium|Premium|Bolso más|Una pieza de 23 kg|Con cargo más|Sin devolución de|



Página _13_ de _40_ 

SRS — Núcleo de Vuelos · Sistema de Vuelos · v1.0 

|**Familia**|**Cabina**|**Equipaje de**<br>**mano**|**Equipaje de**<br>**bodega**|**Cambios**|**Devolución**|
|---|---|---|---|---|---|
|Business<br>Standard|business|maleta de 16 kg||diferencia de<br>precio|pasaje|
|Premium<br>Business Full|Premium<br>business|Bolso más<br>maleta de 16 kg|Dos piezas de 23<br>kg|Sin cargo más<br>diferencia de<br>precio|Antes de la salida<br>del primer vuelo|



|**ID**|**Requerimiento**|**Descripción y criterios de aceptación**|**Prioridad**|
|---|---|---|---|
|**RF-040**|Catálogo de familias<br>tarifarias|El sistema debe administrar el catálogo de familias tarifarias<br>con sus atributos y su vigencia por mercado, ruta y cabina.<br>Criterio: el catálogo distingue familias domésticas e<br>internacionales, que no comparten la misma nomenclatura.<br>Origen: Documental.|Alta|
|**RF-041**|Presentación comparativa|Para cada itinerario el sistema debe devolver el conjunto de<br>familias disponibles con sus atributos normalizados, de<br>modo que el cliente pueda presentarlas en comparación<br>directa. Criterio: se observaron cinco familias para un mismo<br>vuelo. Origen: Observado.|Alta|
|**RF-042**|Atributos normalizados de<br>familia|Cada familia debe exponer, como campos estructurados y<br>no como texto libre, la franquicia de equipaje de mano, la<br>de bodega, la política de cambio, la de devolución, la<br>inclusión de selección de asiento, la elegibilidad para<br>upgrade y el factor de acumulación de millas. Origen:<br>Observado.|Alta|
|**RF-043**|Detalle extendido de<br>condiciones|El sistema debe exponer, bajo demanda, el detalle completo<br>de las condiciones de la familia, incluyendo notas al pie y<br>restricciones específicas de la ruta. Origen: Observado.|Media|
|**RF-044**|Precio por pasajero con<br>impuestos|El precio de cada familia debe expresarse por pasajero e<br>incluir tasas e impuestos, declarándolo explícitamente.<br>Criterio: el importe mostrado es el que se traslada al total<br>sin recargos posteriores por este concepto. Origen:<br>Observado.|Alta|
|**RF-045**|Desglose del precio|El sistema debe exponer el desglose del importe en tarifa<br>base, tasas aeroportuarias, impuestos y cargos de la<br>aerolínea, por pasajero y por tipo de pasajero. Origen:<br>Dominio.|Alta|
|**RF-046**|Cotización en millas más<br>dinero|Bajo la modalidad de redención, el sistema debe devolver el<br>precio en millas y el remanente monetario, junto con la<br>tabla de combinaciones disponibles. Criterio: requiere saldo<br>suficiente verificado contra el servicio de fidelización.<br>Origen: Observado.|Alta|



Página _14_ de _40_ 

SRS — Núcleo de Vuelos · Sistema de Vuelos · v1.0 

|**ID**|**Requerimiento**|**Descripción y criterios de aceptación**|**Prioridad**|
|---|---|---|---|
|**RF-047**|Combinación de familias<br>entre trayectos|El sistema debe permitir seleccionar familias distintas en ida<br>y vuelta, recalculando el total y validando la combinabilidad<br>de las reglas tarifarias. Criterio: si la combinación no es<br>permitida, se informa antes de avanzar. Origen: Observado<br>y Dominio.|Alta|
|**RF-048**|Vigencia de la cotización|Toda cotización debe llevar asociada una marca temporal de<br>emisión y un tiempo de vigencia, transcurrido el cual debe<br>revalidarse antes de cualquier confirmación. Origen:<br>Dominio.|Alta|
|**RF-049**|Precio mínimo por<br>itinerario|El sistema debe calcular y exponer el precio mínimo del<br>itinerario como el menor precio entre sus familias<br>disponibles, etiquetado como precio desde. Origen:<br>Observado.|Alta|



## **3.5 MOD-05 — Oferta y carrito** 

|**ID**|**Requerimiento**|**Descripción y criterios de aceptación**|**Prioridad**|
|---|---|---|---|
|**RF-050**|Construcción de la oferta|El sistema debe consolidar en una única oferta los<br>itinerarios elegidos por trayecto, las familias tarifarias<br>seleccionadas y la composición de pasajeros, asignándole un<br>identificador único y opaco. Origen: Dominio.|Alta|
|**RF-051**|Revalidación antes de<br>confirmar|Antes de avanzar a pago, el sistema debe revalidar precio y<br>disponibilidad contra el inventario. Criterio: ante una<br>variación de precio se detiene el flujo y se solicita la<br>aceptación explícita del nuevo importe. Origen: Dominio.|Alta|
|**RF-052**|Resumen persistente de<br>compra|El sistema debe exponer en todo momento un resumen con<br>trayectos, pasajeros, familias, servicios adicionales y total<br>acumulado, actualizado ante cualquier cambio. Origen:<br>Observado.|Alta|
|**RF-053**|Expiración de la sesión de<br>compra|La oferta debe expirar transcurrido el tiempo configurado<br>sin actividad, liberando cualquier inventario retenido e<br>informando al usuario antes del vencimiento. Origen:<br>Dominio.|Alta|
|||El sistema debe permitir recuperar una oferta vigente por su||
|**RF-054**|Recuperación de la oferta|identificador, reconstruyendo el estado del flujo sin repetir<br>la búsqueda. Origen: Dominio.|Media|



## **3.6 MOD-06 — Datos de pasajeros y contacto** 

|**ID**|**Requerimiento**|**Descripción y criterios de aceptación**|**Prioridad**|
|---|---|---|---|
|**RF-060**|Datos identificatorios del<br>pasajero|El sistema debe capturar por cada pasajero nombres,<br>apellidos, fecha de nacimiento, género, nacionalidad, tipo y|Alta|



Página _15_ de _40_ 

SRS — Núcleo de Vuelos · Sistema de Vuelos · v1.0 

|**ID**|**Requerimiento**|**Descripción y criterios de aceptación**<br>número de documento de viaje, y fecha de vencimiento del<br>documento cuando la ruta lo exija. Origen: Dominio.|**Prioridad**|
|---|---|---|---|
|**RF-061**|Normalización de nombres|Los nombres y apellidos deben normalizarse al juego de<br>caracteres admitido por el billete electrónico, eliminando<br>diacríticos y validando que coincidan con el documento de<br>viaje. Criterio: el sistema advierte que el nombre debe<br>corresponder exactamente al del documento. Origen:<br>Dominio.|Alta|
|**RF-062**|Coherencia entre edad y<br>tipo de pasajero|El sistema debe validar la fecha de nacimiento contra el tipo<br>de pasajero declarado, tomando como referencia la fecha<br>del primer vuelo del itinerario. Criterio: un menor que<br>cumple la edad de adulto antes del viaje debe recotizarse<br>como adulto. Origen: Dominio.|Alta|
|**RF-063**|Datos de contacto|El sistema debe capturar un correo electrónico y un teléfono<br>de contacto con código de país, validados sintácticamente, a<br>los que se enviarán la confirmación y las notificaciones<br>operativas. Origen: Dominio.|Alta|
|**RF-064**|Asociación al programa de<br>fidelización|El sistema debe permitir asociar un número de socio por<br>pasajero para la acumulación de millas y puntos calificables,<br>validándolo contra el servicio de fidelización. Criterio: la<br>familia Basic acumula un factor reducido respecto de las<br>demás. Origen: Observado.|Alta|
|**RF-065**|Requisitos migratorios y<br>APIS|El sistema debe determinar, según nacionalidad, documento<br>y ruta, los datos migratorios exigibles, y solicitarlos antes de<br>la emisión cuando corresponda. Origen: Dominio.|Media|
|**RF-066**|Asistencias y condiciones<br>especiales|El sistema debe permitir declarar requerimientos de<br>asistencia especial, entre ellos movilidad reducida, menor<br>no acompañado y transporte de mascota en cabina,<br>verificando su disponibilidad en el itinerario elegido. Origen:<br>Dominio.|Media|
|**RF-067**|Autocompletado para<br>usuario autenticado|Para un usuario autenticado, el sistema debe precargar los<br>datos del titular y los de pasajeros frecuentes previamente<br>registrados, permitiendo su edición. Origen: Observado.|Media|
|**RF-068**|Prevención de duplicados|El sistema debe detectar pasajeros repetidos dentro de la<br>misma reserva por coincidencia de nombre, apellido y fecha<br>de nacimiento, e impedir la continuación. Origen: Dominio.|Media|



## **3.7 MOD-07 — Servicios adicionales** 

|**ID**|**Requerimiento**|**Descripción y criterios de aceptación**|**Prioridad**|
|---|---|---|---|
|**RF-070**|Selección de asiento|El sistema debe exponer el mapa de asientos por segmento<br>con su categoría, disponibilidad y precio, y permitir la|Alta|



Página _16_ de _40_ 

SRS — Núcleo de Vuelos · Sistema de Vuelos · v1.0 

|**ID**|**Requerimiento**|**Descripción y criterios de aceptación**|**Prioridad**|
|---|---|---|---|
|||asignación por pasajero. Criterio: la familia Full incluye la<br>selección de asiento estándar sin costo; las familias Basic y<br>Light la cobran. Origen: Observado y Documental.||
|**RF-071**|Equipaje adicional|El sistema debe permitir adquirir piezas de equipaje de<br>bodega adicionales a la franquicia de la familia, con precio<br>diferenciado por tramo y por anticipación de compra.<br>Origen: Documental.|Alta|
|**RF-072**|Postulación a upgrade de<br>cabina|El sistema debe permitir postular al ascenso de cabina en las<br>familias elegibles. Criterio: las familias Light y Full habilitan<br>la postulación con tramos; Basic no la habilita. Origen:<br>Observado.|Media|
|**RF-073**|Coberturas y asistencia en<br>viaje|El sistema debe ofrecer coberturas de asistencia asociadas<br>al itinerario, con su alcance, vigencia y precio. Origen:<br>Observado.|Baja|
|**RF-074**|Productos<br>complementarios de<br>terceros|El sistema debe exponer los productos complementarios<br>ofrecidos por proveedores externos, identificando<br>claramente al proveedor y trasladando el contexto del viaje.<br>Criterio: se observaron alojamiento, autos, traslados,<br>actividades y eSIM enlazados desde el portal con<br>parámetros de campaña. Origen: Observado.|Baja|
|||Toda incorporación o retiro de un servicio adicional debe||
|**RF-075**|Recálculo del total|recalcular el total de la oferta de forma inmediata y trazable<br>por concepto. Origen: Dominio.|Alta|



## **3.8 MOD-08 — Pago** 

Los medios de pago habilitados dependen del mercado. Según la documentación oficial de la aerolínea, las tarjetas Visa, Mastercard y American Express están disponibles en todos los países, Diners Club se acepta en Brasil, Chile, Colombia, Ecuador y Argentina, y Hipercard y Elo únicamente en Brasil. A ello se suman los medios locales canalizados mediante plataforma de pago: débito en Chile, transferencia en Ecuador, débito bancario PSE en Colombia, banca por internet en Perú y PIX en Brasil. La billetera propia de la aerolínea funciona como medio autónomo y también como complemento de una tarjeta de crédito. 

|**ID**|**Requerimiento**|**Descripción y criterios de aceptación**|**Prioridad**|
|---|---|---|---|
|**RF-080**|Catálogo de medios de<br>pago por mercado|El sistema debe resolver dinámicamente los medios de pago<br>habilitados según el punto de venta, la moneda y el tipo de<br>producto. Origen: Documental.|Alta|
|||El sistema debe soportar el pago con las marcas habilitadas<br>por mercado, delegando la captura y la tokenización del||
|**RF-081**|Pago con tarjeta|instrumento en la pasarela. Criterio: el microservicio nunca<br>recibe ni persiste el número completo de tarjeta. Origen:<br>Documental y Dominio.|Alta|



Página _17_ de _40_ 

SRS — Núcleo de Vuelos · Sistema de Vuelos · v1.0 

|**ID**|**Requerimiento**|**Descripción y criterios de aceptación**|**Prioridad**|
|---|---|---|---|
|**RF-082**|Medios de pago locales|El sistema debe soportar los medios locales por mercado,<br>incluyendo débito bancario PSE en Colombia, transferencia<br>en Ecuador, débito en Chile, banca por internet en Perú y<br>PIX en Brasil, gestionando el retorno asincrónico de la<br>confirmación. Origen: Documental.|Alta|
|||El sistema debe admitir el pago con saldo de billetera, de||
|**RF-083**|Billetera de la aerolínea|forma autónoma o combinada con una tarjeta de crédito.<br>Criterio: para servicios adicionales la combinación con<br>tarjeta no admite cuotas. Origen: Documental.|Alta|
|||El sistema debe ejecutar el débito de millas contra el<br>i||
|**RF-084**|Pago con millas más dinero|servicio de fidelización y el cobro del remanente monetario<br>como una única transacción lógica, con compensación ante<br>fallo parcial. Origen: Observado y Dominio.|Alta|
|||El sistema debe someter las transacciones con tarjeta a<br>i||
|**RF-085**|Autenticación reforzada|autenticación 3-D Secure cuando el emisor o la regulación<br>del mercado lo exijan, manejando el desafío y su resultado.<br>Origen: Dominio.|Alta|
|**RF-086**|Evaluación antifraude|Previo a la autorización, el sistema debe someter la<br>transacción al servicio antifraude y actuar según su<br>veredicto de aprobación, revisión manual o rechazo. Origen:<br>Dominio.|Alta|
|**RF-087**|Idempotencia del cobro|Toda solicitud de pago debe acompañarse de una clave de<br>idempotencia que garantice que un reintento no genere un<br>segundo cargo. Origen: Dominio.|Alta|
|||Ante un rechazo, el sistema debe conservar la oferta||
|**RF-088**|Gestión de rechazos|vigente, informar la causa en términos comprensibles y<br>permitir reintentar con otro medio de pago dentro del<br>tiempo de vigencia restante. Origen: Dominio.|Alta|
|||Cuando el mercado y el emisor lo permitan, el sistema debe||
|**RF-089**|Cuotas|exponer los planes de cuotas disponibles para el pasaje.<br>Criterio: los servicios adicionales se cobran sin cuotas.<br>Origen: Documental.|Media|



## **3.9 MOD-09 — Reserva y emisión** 

|**ID**|**Requerimiento**|**Descripción y criterios de aceptación**|**Prioridad**|
|---|---|---|---|
|**RF-090**|Creación de la reserva|Autorizado el pago, el sistema debe crear la reserva en el<br>PSS y obtener el localizador alfanumérico de seis caracteres.<br>Criterio: la operación es idempotente respecto de la clave<br>de la oferta. Origen: Dominio.|Alta|
|**RF-091**|Emisión del billete<br>electrónico|El sistema debe emitir un billete electrónico por pasajero,<br>con su número de trece dígitos, y los documentos|Alta|



Página _18_ de _40_ 

SRS — Núcleo de Vuelos · Sistema de Vuelos · v1.0 

|**ID**|**Requerimiento**|**Descripción y criterios de aceptación**|**Prioridad**|
|---|---|---|---|
|||electrónicos que respalden los servicios adicionales<br>adquiridos. Origen: Dominio.||
|**RF-092**|Confirmación al usuario|El sistema debe presentar la confirmación en pantalla con<br>localizador, itinerario completo, pasajeros, servicios y total<br>pagado, y enviarla al correo de contacto. Origen:<br>Documental.|Alta|
|||El sistema debe generar el comprobante de venta conforme||
|**RF-093**|Comprobante de venta|a la normativa fiscal del mercado emisor y ponerlo a<br>disposición del comprador. Origen: Documental.|Alta|
|**RF-094**|Compensación ante fallo<br>de emisión|Si el pago fue autorizado y la emisión falla, el sistema debe<br>ejecutar la compensación —reversa o reembolso— y<br>notificar al usuario, dejando registro auditable de la<br>transacción fallida. Origen: Dominio.|Alta|
|||El sistema debe publicar los eventos de oferta creada, pago||
|**RF-095**|Publicación de eventos de<br>dominio|autorizado, reserva confirmada y billete emitido, para<br>consumo de notificaciones, fidelización y analítica. Origen:<br>Dominio.|Alta|
|**RF-096**|Consulta de la reserva<br>emitida|El sistema debe permitir recuperar una reserva por<br>localizador y apellido del titular, devolviendo su estado<br>vigente. Origen: Dominio.|Alta|



## **3.10 MOD-10 — Post-venta (frontera del alcance)** 

Los siguientes requerimientos no forman parte de la construcción comprometida, pero deben quedar previstos en el diseño de la API y del modelo de datos para evitar retrabajo. Se listan con prioridad "Frontera". 

|**ID**|**Requerimiento**|**Descripción y criterios de aceptación**|**Prioridad**|
|---|---|---|---|
|**RF-100**|Gestión de la reserva|Consulta y administración de la reserva por el titular,<br>incluyendo la actualización de datos de contacto y la<br>incorporación posterior de servicios adicionales. Origen:<br>Observado.|Frontera|
|||Modificación de fecha o vuelo aplicando las condiciones de||
|**RF-101**|Cambios de itinerario|la familia tarifaria y cobrando cargo y diferencia cuando<br>corresponda. Origen: Documental.|Frontera|
|**RF-102**|Devoluciones|Solicitud y procesamiento de devoluciones según la<br>condición de la familia, distinguiendo devolución total,<br>devolución antes de la salida del primer vuelo y devolución<br>limitada a la tasa de embarque. Origen: Documental.|Frontera|
|**RF-103**|Check-in|Apertura del check-in en la ventana definida, asignación o<br>confirmación de asiento y emisión del pase de abordar.<br>Origen: Observado.|Frontera|



Página _19_ de _40_ 

SRS — Núcleo de Vuelos · Sistema de Vuelos · v1.0 

Página _20_ de _40_ 

SRS — Núcleo de Vuelos · Sistema de Vuelos · v1.0 

# **4. Reglas de negocio** 

Las reglas de negocio expresan restricciones del dominio que trascienden a cualquier requerimiento particular y que deben implementarse de forma centralizada para evitar divergencias entre canales. 

|**ID**|**Regla**|**Enunciado**|
|---|---|---|
|**RN-01**|Integridad del par de ciudades|El origen y el destino de un mismo trayecto deben ser distintos y<br>pertenecer al conjunto de puntos con conectividad comercial<br>publicada.|
|**RN-02**|Cronología del viaje|La fecha de regreso no puede ser anterior a la fecha de ida, y<br>ninguna fecha puede ser anterior a la fecha actual en el huso<br>horario del aeropuerto de origen.|
|**RN-03**|Ventana de venta|Solo se pueden cotizar vuelos dentro de la ventana de venta<br>publicada para la ruta y el punto de venta.|
|**RN-04**|Acompañamiento de infantes|La cantidad de infantes sin asiento no puede superar la cantidad<br>de adultos en la reserva.|
|||El total de pasajeros por reserva no puede superar el máximo|
|**RN-05**|Tope de pasajeros por reserva|definido por la aerolínea; por encima de ese umbral la venta se<br>canaliza como grupo.|
|**RN-06**|Determinación del tipo de pasajero|El tipo de pasajero se determina por la edad cumplida a la fecha<br>del primer vuelo del itinerario, no a la fecha de compra.|
|**RN-07**|Precio con impuestos incluidos|Todo precio presentado al usuario debe incluir tasas e impuestos<br>y declararlo explícitamente.|
|**RN-08**|Vigencia de la cotización|Una cotización solo es válida dentro de su ventana de vigencia;<br>vencida esta, debe revalidarse antes de cualquier confirmación.|
|**RN-09**|Precedencia del inventario|Ante discrepancia entre el precio cacheado y el del motor<br>tarifario en la revalidación, prevalece el segundo y se requiere<br>aceptación explícita del usuario.|
|||Las condiciones de equipaje, cambio, devolución, asiento,|
|**RN-10**|Atributos de la familia tarifaria|upgrade y acumulación derivan exclusivamente de la familia<br>tarifaria seleccionada.|
|||La familia más restrictiva de cabina económica acumula millas y|
|**RN-11**|Acumulación diferenciada|puntos calificables con un factor reducido respecto de las demás<br>familias.|
|**RN-12**|Combinabilidad entre trayectos|Las familias elegidas en distintos trayectos deben ser<br>combinables según las reglas tarifarias; en caso contrario el<br>sistema debe impedir la combinación antes de avanzar.|
|**RN-13**|Coincidencia nombre-documento|El nombre registrado del pasajero debe coincidir con el del<br>documento de viaje; su corrección posterior está sujeta a las<br>políticas de la aerolínea.|
|**RN-14**|Moneda única por transacción|La moneda de cotización y la de cobro deben coincidir y|



Página _21_ de _40_ 

SRS — Núcleo de Vuelos · Sistema de Vuelos · v1.0 

|**ID**|**Regla**|**Enunciado**|
|---|---|---|
|||corresponder al punto de venta resuelto al inicio de la<br>transacción.|
|**RN-15**|Medios de pago por mercado|El conjunto de medios de pago ofrecidos se determina por el<br>punto de venta y por el tipo de producto adquirido.|
|**RN-16**|Cuotas restringidas|Los servicios adicionales no admiten pago en cuotas, aun cuando<br>el pasaje asociado sí lo permita.|
|**RN-17**|Atomicidad de la compra|El cobro y la emisión constituyen una unidad de negocio: si la<br>emisión no se completa, el cobro debe compensarse.|
|**RN-18**|No repetición del cargo|Un reintento de pago con la misma clave de idempotencia no<br>puede producir un segundo cargo.|
|**RN-19**|Operador declarado|Cuando la aerolínea operadora difiere de la comercializadora,<br>esa condición debe declararse al usuario antes de la compra.|
|**RN-20**|Redención con saldo suficiente|La cotización en millas solo se ofrece si el socio autenticado<br>dispone de saldo suficiente para la combinación seleccionada.|
|||Los datos completos del instrumento de pago no pueden|
|**RN-21**|Aislamiento de datos de pago|transitar ni almacenarse en los sistemas de la aerolínea fuera del<br>entorno certificado.|



Página _22_ de _40_ 

SRS — Núcleo de Vuelos · Sistema de Vuelos · v1.0 

# **5. Requerimientos no funcionales** 

Los atributos de calidad se expresan con métricas verificables. Las cifras propuestas constituyen una línea base derivada de la observación del sistema de referencia y de prácticas habituales del sector; deben ratificarse con el área de negocio antes de comprometerse contractualmente. 

|**ID**|**Categoría**|**Requerimiento y métrica de verificación**|
|---|---|---|
|**RNF-01**|Rendimiento|La consulta al catálogo de localidades debe responder en menos de trescientos<br>milisegundos en el percentil noventa y cinco. La consulta de disponibilidad debe<br>responder en menos de tres segundos en el percentil noventa y cinco y menos<br>de cinco segundos en el noventa y nueve.|
|**RNF-02**|Rendimiento|La revalidación de una oferta debe completarse en menos de dos segundos en el<br>percentil noventa y cinco, por tratarse de una operación bloqueante del flujo de<br>compra.|
|**RNF-03**|Disponibilidad|El servicio debe alcanzar una disponibilidad mensual del noventa y nueve coma<br>nueve por ciento para las operaciones de consulta y del noventa y nueve coma<br>noventa y cinco por ciento para las de pago y emisión.|
|**RNF-04**|Escalabilidad|La arquitectura debe escalar horizontalmente sin estado compartido en los<br>nodos, soportando un incremento de diez veces la carga base durante campañas<br>comerciales.|
|**RNF-05**|Caché|El catálogo de localidades debe cachearse con vigencia mínima de veinticuatro<br>horas. Los resultados de disponibilidad pueden cachearse por un período breve<br>y configurable, nunca superior a la vigencia de la cotización, y jamás deben<br>servirse desde caché en la revalidación.|
|**RNF-06**|Resiliencia|Toda invocación a un sistema externo debe protegerse con tiempo límite,<br>reintentos con retroceso exponencial y cortacircuitos, con degradación<br>controlada y mensaje explícito al usuario.|
|**RNF-07**|Consistencia|El flujo de pago y emisión debe implementarse como una transacción distribuida<br>con compensación explícita; no se admite consistencia eventual sin<br>compensación en este tramo.|
|**RNF-08**|Seguridad|El tratamiento de pagos debe cumplir PCI DSS. El servicio no almacena ni<br>registra en bitácora el número completo de tarjeta, el código de seguridad ni la<br>fecha de vencimiento.|
|**RNF-09**|Seguridad|Toda comunicación debe cifrarse en tránsito con TLS 1.2 o superior, y los datos<br>personales deben cifrarse en reposo.|
|**RNF-10**|Seguridad|La API debe autenticarse mediante credenciales de cliente y autorizarse por<br>ámbitos, con limitación de tasa por consumidor y protección frente a las diez<br>vulnerabilidades más críticas identificadas por OWASP.|
|**RNF-11**|Privacidad|El tratamiento de datos personales debe cumplir la normativa del mercado de<br>operación —Ley 1581 de 2012 en Colombia, LGPD en Brasil y GDPR cuando<br>aplique—, con consentimiento registrado, minimización y política de retención<br>definida.|



Página _23_ de _40_ 

SRS — Núcleo de Vuelos · Sistema de Vuelos · v1.0 

|**ID**|**Categoría**|**Requerimiento y métrica de verificación**|
|---|---|---|
|**RNF-12**|Accesibilidad|Las respuestas de la API deben incluir la información semántica —denominación<br>completa de aeropuertos, descripción de itinerarios y etiquetas de distintivos—<br>que permita al cliente cumplir WCAG 2.1 nivel AA. El sistema de referencia<br>expone descripciones textuales completas por cada itinerario, lo que fija el<br>estándar a igualar.|
|**RNF-13**|Internacionalización|El servicio debe soportar múltiples idiomas y monedas sin despliegue adicional,<br>resolviendo los textos desde un catálogo de localización externo al código.|
|**RNF-14**|Zonas horarias|Todo instante debe persistirse en tiempo universal coordinado y presentarse en<br>la hora local del aeropuerto correspondiente, con indicación explícita del cruce<br>de día.|
|**RNF-15**|Observabilidad|Cada transacción debe propagar un identificador de correlación a través de<br>todos los servicios involucrados, con trazas distribuidas, métricas de negocio y<br>bitácoras estructuradas sin datos sensibles.|
|**RNF-16**|Auditoría|Toda operación que modifique el estado de una oferta, un pago o una reserva<br>debe registrarse de forma inmutable con actor, instante, valores previos y<br>posteriores.|
|**RNF-17**|Compatibilidad|La API debe versionarse en la ruta y mantener retrocompatibilidad dentro de<br>una misma versión mayor, con política de obsolescencia anunciada.|
|**RNF-18**|Mantenibilidad|El código debe alcanzar una cobertura de pruebas unitarias no inferior al<br>ochenta por ciento en la capa de dominio, con pruebas de contrato para cada<br>integración externa.|
|**RNF-19**|Portabilidad|El servicio debe empaquetarse en contenedores y desplegarse mediante una<br>canalización automatizada con capacidad de reversión.|
|**RNF-20**|Usabilidad|El flujo de compra completo debe poder ejecutarse en un máximo de cinco<br>pasos visibles, y el estado del avance debe ser explícito en cada uno.|
|**RNF-21**|Capacidad|El servicio debe sostener un mínimo de quinientas consultas de disponibilidad<br>por segundo y cincuenta emisiones por minuto en condiciones nominales.|



Página _24_ de _40_ 

SRS — Núcleo de Vuelos · Sistema de Vuelos · v1.0 

# **6. Casos de uso** 

Se documentan los casos de uso que gobiernan el camino crítico de la compra. Cada uno identifica su actor principal, precondiciones, flujo básico, flujos alternos y excepciones. 

## **6.1 CU-01 — Buscar vuelos disponibles** 

|**Campo**|**Detalle**|
|---|---|
|**Actor principal**|Visitante anónimo|
|**Actores secundarios**|PSS / motor de inventario, motor tarifario|
|**Precondiciones**|El punto de venta está resuelto y el catálogo de localidades está disponible.|
|**Postcondiciones**|El usuario dispone de un conjunto ordenado de itinerarios con su precio mínimo, y la<br>búsqueda queda codificada en un enlace reconstruible.|
|**Requerimientos**|RF-010 a RF-019, RF-020 a RF-031|



### **Flujo básico** 

1. El usuario selecciona el tipo de viaje entre ida y vuelta, solo ida y multidestino. 

2. El usuario introduce el origen y el sistema sugiere localidades coincidentes por prefijo. 

3. El usuario introduce el destino y el sistema restringe las sugerencias a los puntos con conectividad desde el origen. 

4. El usuario selecciona la cabina, las fechas y la composición de pasajeros. 

5. El usuario ejecuta la búsqueda y el sistema valida la totalidad de los criterios. 

6. El sistema consulta la disponibilidad, cotiza el precio mínimo de cada itinerario y devuelve el conjunto ordenado por el criterio recomendado. 

7. El sistema presenta los itinerarios con sus atributos, distintivos comerciales y aerolínea operadora, y codifica los criterios en la URL. 

### **Flujos alternos** 

- 2a. El usuario invierte origen y destino mediante la acción recíproca; el sistema recalcula las sugerencias de destino. 

- 4a. El usuario introduce un código promocional; el sistema lo valida y, si es aplicable, lo incorpora a la cotización. 

- 4b. El usuario activa la modalidad de millas más dinero; el sistema exige sesión autenticada y verifica el saldo disponible. 

- 7a. El usuario cambia el criterio de ordenamiento; el sistema reordena el conjunto sin volver a consultar el inventario y actualiza el enlace. 

- 7b. El usuario modifica la búsqueda desde el panel contextual; el sistema precarga los criterios vigentes y relanza la consulta. 

Página _25_ de _40_ 

SRS — Núcleo de Vuelos · Sistema de Vuelos · v1.0 

### **Excepciones** 

- E1. Criterios inválidos: el sistema detiene la búsqueda y señala el campo afectado con un mensaje localizado. 

- E2. Sin disponibilidad: el sistema devuelve un resultado vacío diferenciado y ofrece fechas o aeropuertos alternativos. 

- E3. Inventario no disponible: el sistema aplica la degradación controlada, informa la indisponibilidad temporal y permite reintentar. 

## **6.2 CU-02 — Seleccionar itinerario y familia tarifaria** 

|**Campo**|**Detalle**|
|---|---|
|**Actor principal**|Visitante anónimo|
|**Actores secundarios**|Motor tarifario|
|**Precondiciones**|Existe un conjunto de itinerarios vigente para al menos un trayecto.|
|**Postcondiciones**|Se constituye una oferta con identificador único, precio total y vigencia definida.|
|**Requerimientos**|RF-040 a RF-049, RF-050 a RF-054|



### **Flujo básico** 

1. El usuario expande un itinerario y el sistema presenta el panel comparativo de familias tarifarias disponibles. 

2. El sistema muestra por cada familia la franquicia de equipaje, las condiciones de cambio y devolución, la selección de asiento, la elegibilidad de upgrade, la acumulación de millas y el precio por pasajero con impuestos incluidos. 

3. El usuario selecciona una familia y el sistema registra la elección para ese trayecto. 

4. Si el viaje tiene más de un trayecto, el sistema avanza al siguiente y repite el ciclo conservando lo ya elegido. 

5. Completados todos los trayectos, el sistema consolida la oferta, calcula el total y establece su vigencia. 

### **Flujos alternos** 

- 2a. El usuario consulta el detalle extendido de condiciones de una familia antes de decidir. 

- 3a. El usuario elige familias distintas en ida y vuelta; el sistema verifica la combinabilidad y recalcula el total. 

- 5a. El usuario retrocede para cambiar un trayecto ya elegido; el sistema invalida la oferta parcial y la reconstruye. 

### **Excepciones** 

Página _26_ de _40_ 

SRS — Núcleo de Vuelos · Sistema de Vuelos · v1.0 

- E1. Familias no combinables: el sistema informa la restricción y propone las alternativas válidas. 

- E2. Inventario agotado durante la selección: el sistema informa la pérdida de disponibilidad y devuelve al usuario al conjunto de resultados actualizado. 

## **6.3 CU-03 — Registrar pasajeros** 

|**Campo**|**Detalle**|
|---|---|
|**Actor principal**|Visitante anónimo o usuario registrado|
|**Actores secundarios**|Servicio de fidelización|
|**Precondiciones**|Existe una oferta vigente y no expirada.|
|**Postcondiciones**|La oferta queda asociada al conjunto completo de pasajeros validados y a un contacto<br>de notificación.|
|**Requerimientos**|RF-060 a RF-068|



### **Flujo básico** 

1. El sistema presenta un formulario por cada pasajero según la composición declarada en la búsqueda. 

2. El usuario introduce nombres, apellidos, fecha de nacimiento, género, nacionalidad y documento de viaje. 

3. El sistema normaliza los nombres, valida la coherencia entre la edad y el tipo de pasajero, y verifica la ausencia de duplicados. 

4. El usuario introduce el correo electrónico y el teléfono de contacto. 

5. El sistema valida el conjunto y habilita el avance al pago. 

### **Flujos alternos** 

- 1a. El usuario está autenticado: el sistema precarga sus datos y los de pasajeros frecuentes registrados. 

- 2a. El usuario asocia un número de socio; el sistema lo valida contra el servicio de fidelización. 

- 2b. La ruta exige datos migratorios; el sistema solicita los campos adicionales correspondientes. 

- 4a. El usuario declara una asistencia especial; el sistema verifica su disponibilidad en el itinerario elegido. 

### **Excepciones** 

- E1. Edad incompatible con el tipo de pasajero: el sistema exige recotizar la oferta con la composición correcta. 

- E2. Oferta expirada durante la captura: el sistema revalida y, si el precio cambió, solicita aceptación expresa. 

Página _27_ de _40_ 

SRS — Núcleo de Vuelos · Sistema de Vuelos · v1.0 

## **6.4 CU-04 — Pagar y emitir** 

|**Campo**|**Detalle**|
|---|---|
|**Actor principal**|Visitante anónimo o usuario registrado|
|**Actores secundarios**|Pasarela de pagos, servicio antifraude, servicio de fidelización, PSS, notificaciones|
|**Precondiciones**|La oferta está vigente, completa y con pasajeros validados.|
|**Postcondiciones**|Existe una reserva confirmada con billete electrónico emitido por pasajero y<br>confirmación enviada al contacto.|
|**Requerimientos**|RF-080 a RF-089, RF-090 a RF-096|



### **Flujo básico** 

1. El sistema revalida el precio y la disponibilidad de la oferta contra el inventario. 

2. El sistema resuelve y presenta los medios de pago habilitados para el punto de venta y el producto. 

3. El usuario selecciona el medio de pago y completa los datos requeridos en el entorno de la pasarela. 

4. El sistema somete la transacción al servicio antifraude y, si corresponde, ejecuta la autenticación reforzada. 

5. La pasarela autoriza el cobro y devuelve el resultado con su referencia. 

6. El sistema crea la reserva en el PSS de forma idempotente y obtiene el localizador. 

7. El sistema emite el billete electrónico por pasajero y los documentos de los servicios adicionales. 

8. El sistema presenta la confirmación, genera el comprobante de venta, envía la notificación y publica los eventos de dominio. 

### **Flujos alternos** 

- 2a. El usuario paga con billetera, de forma autónoma o combinada con tarjeta de crédito sin cuotas. 

- 2b. El usuario paga con millas más dinero; el sistema debita las millas y cobra el remanente como unidad lógica. 

- 2c. El usuario elige un medio local de confirmación asincrónica; el sistema mantiene la oferta retenida hasta recibir la notificación del proveedor o hasta que expire el plazo. 

- 5a. El pago es rechazado; el sistema conserva la oferta e invita a reintentar con otro medio dentro de la vigencia restante. 

### **Excepciones** 

- E1. Variación de precio en la revalidación: el sistema detiene el flujo y exige la aceptación explícita del nuevo importe. 

- E2. Veredicto antifraude de rechazo: el sistema cancela la transacción sin revelar el motivo específico y registra el evento. 

Página _28_ de _40_ 

SRS — Núcleo de Vuelos · Sistema de Vuelos · v1.0 

- E3. Fallo de emisión con cobro autorizado: el sistema ejecuta la compensación, notifica al usuario y escala el caso a soporte con trazabilidad completa. 

- E4. Reintento por pérdida de conectividad: la clave de idempotencia impide el doble cargo y devuelve el resultado de la operación original. 

## **6.5 CU-05 — Cotizar con millas más dinero** 

|**Campo**|**Detalle**|
|---|---|
|**Actor principal**|Socio LATAM Pass|
|**Actores secundarios**|Servicio de fidelización, motor tarifario|
|**Precondiciones**|El socio está autenticado y su saldo de millas es consultable.|
|**Postcondiciones**|La oferta queda expresada en millas y remanente monetario, con las millas reservadas<br>hasta la confirmación o la expiración.|
|**Requerimientos**|RF-016, RF-046, RF-084, RN-20|



### **Flujo básico** 

1. El socio activa la modalidad de redención en el formulario de búsqueda. 

2. El sistema verifica la autenticación y consulta el saldo de millas disponible. 

3. El sistema cotiza los itinerarios y expresa cada familia en su equivalente de millas más remanente. 

4. El socio selecciona la combinación deseada dentro de la tabla de opciones ofrecidas. 

5. El sistema reserva el débito de millas por el tiempo de vigencia de la oferta. 

### **Excepciones** 

- E1. Saldo insuficiente: el sistema informa la brecha y ofrece continuar en la modalidad monetaria. 

- E2. Expiración de la oferta con millas reservadas: el sistema libera la reserva de millas de forma automática. 

Página _29_ de _40_ 

SRS — Núcleo de Vuelos · Sistema de Vuelos · v1.0 

# **7. Historias de usuario y criterios de aceptación** 

Las historias se expresan en el formato rol–necesidad–beneficio y sus criterios de aceptación se redactan en estructura dado–cuando–entonces, de modo que sean directamente automatizables por el equipo de pruebas. 

|**ID**<br>**HU-01**|**Historia**<br>Como visitante quiero buscar vuelos<br>indicando origen, destino, fechas y<br>pasajeros para conocer las opciones<br>disponibles y su precio.|**Criterios de aceptación**<br>Dado un origen y un destino válidos con fechas<br>futuras, cuando ejecuto la búsqueda, entonces<br>obtengo el conjunto de itinerarios con hora de<br>salida, hora de llegada, duración, escalas y precio<br>mínimo por persona. Dado un origen igual al<br>destino, cuando ejecuto la búsqueda, entonces<br>recibo un mensaje que señala el campo en<br>conflicto y la búsqueda no se lanza.|**RF**<br>RF-010,<br>RF-011,<br>RF-020|
|---|---|---|---|
|**HU-02**|Como visitante quiero que el buscador<br>me sugiera ciudades mientras escribo<br>para no necesitar conocer los códigos<br>de aeropuerto.|Dado que escribo al menos dos caracteres en el<br>campo de origen, cuando el sistema responde,<br>entonces recibo sugerencias con código IATA,<br>ciudad y país ordenadas por relevancia, en menos<br>de trescientos milisegundos. Dado que escribo sin<br>acentos, cuando el sistema busca, entonces las<br>coincidencias con acentos también se devuelven.|RF-004,<br>RF-005|
|**HU-03**|Como visitante quiero invertir el<br>origen y el destino con una sola acción<br>para cotizar el sentido contrario sin<br>volver a escribir.|Dado un origen y un destino cargados, cuando<br>acciono la inversión, entonces ambos valores se<br>intercambian y las sugerencias de destino se<br>recalculan.|RF-011|
|**HU-04**|Como visitante quiero comparar las<br>tarifas de un mismo vuelo para elegir<br>la que corresponde a lo que necesito<br>llevar y a la flexibilidad que quiero.|Dado un itinerario en el conjunto de resultados,<br>cuando despliego sus opciones de tarifa, entonces<br>veo todas las familias disponibles con equipaje de<br>mano, equipaje de bodega, condiciones de cambio,<br>condiciones de devolución, selección de asiento,<br>upgrade y acumulación, y el precio por pasajero<br>con impuestos incluidos.|RF-041,<br>RF-042,<br>RF-044|
|**HU-05**|Como visitante quiero ordenar los<br>resultados por precio o por duración<br>para encontrar rápidamente la opción<br>que me conviene.|Dado un conjunto de resultados, cuando<br>selecciono un criterio de ordenamiento, entonces<br>el conjunto se reordena de inmediato, el criterio<br>queda reflejado en el enlace y se aplica también al<br>trayecto de vuelta.|RF-027|
|**HU-06**|Como visitante quiero saber qué<br>aerolínea opera cada vuelo para<br>conocer el servicio que voy a recibir.|Dado un itinerario cuyo operador difiere del<br>comercializador, cuando lo visualizo, entonces la<br>aerolínea operadora se declara de forma visible<br>por segmento antes de que yo seleccione la tarifa.|RF-023,<br>RN-19|
|**HU-07**|Como visitante quiero modificar mi<br>búsqueda desde la página de<br>resultados para ajustar fechas o|Dado que estoy en la página de resultados, cuando<br>abro el panel de modificación, entonces todos los<br>criterios vigentes aparecen precargados y, al<br>actualizar, la consulta se relanza conservando la|RF-018|



Página _30_ de _40_ 

SRS — Núcleo de Vuelos · Sistema de Vuelos · v1.0 

|**ID**|**Historia**<br>pasajeros sin empezar de nuevo.|**Criterios de aceptación**<br>sesión.|**RF**|
|---|---|---|---|
|**HU-08**|Como visitante quiero compartir o<br>retomar una búsqueda mediante un<br>enlace para consultarla luego o<br>mostrarla a otra persona.|Dada una búsqueda ejecutada, cuando copio la<br>dirección resultante y la abro en otra sesión,<br>entonces se reconstruyen origen, destino, fechas,<br>pasajeros, tipo de viaje, cabina, modalidad de<br>redención y ordenamiento.|RF-017|
|||Dado que estoy autenticado con saldo suficiente,<br>cuando activo la modalidad de redención, entonces||
|**HU-09**|Como socio quiero cotizar con mis<br>millas más dinero para aprovechar el<br>saldo acumulado.|i<br>cada tarifa se expresa en millas y remanente<br>monetario. Dado que mi saldo es insuficiente,<br>cuando activo la modalidad, entonces se me<br>informa la brecha y se me ofrece continuar en la<br>modalidad monetaria.|RF-016,<br>RF-046|
|**HU-10**|Como comprador quiero registrar los<br>datos de los pasajeros tal como figuran<br>en su documento para que el billete<br>sea válido.|Dado un formulario de pasajero, cuando<br>introduzco caracteres con diacríticos, entonces el<br>sistema los normaliza al juego admitido por el<br>billete y me muestra el resultado. Dada una fecha<br>de nacimiento incompatible con el tipo de pasajero<br>a la fecha del vuelo, cuando intento avanzar,<br>entonces el sistema lo impide y solicita recotizar.|RF-061,<br>RF-062|
|**HU-11**|Como comprador quiero elegir entre<br>los medios de pago disponibles en mi<br>país para pagar con el instrumento<br>que utilizo habitualmente.|Dado el punto de venta colombiano, cuando llego<br>al paso de pago, entonces se me ofrecen las<br>tarjetas habilitadas, el débito bancario PSE y la<br>billetera. Dado que selecciono un servicio<br>adicional, cuando llego al pago, entonces la opción<br>de cuotas no se ofrece.|RF-080,<br>RF-082,<br>RF-089|
|**HU-12**|Como comprador quiero que un<br>reintento de pago no me genere un<br>doble cargo para no asumir un cobro<br>indebido.|Dado un pago cuya respuesta no llegó por pérdida<br>de conectividad, cuando el cliente reintenta con la<br>misma clave de idempotencia, entonces el sistema<br>devuelve el resultado de la operación original y no<br>genera un segundo cargo.|RF-087,<br>RN-18|
|**HU-13**|Como comprador quiero recibir la<br>confirmación con el localizador y el<br>itinerario para tener respaldo de mi<br>compra.|Dada una emisión exitosa, cuando finaliza el<br>proceso, entonces veo en pantalla el localizador, el<br>itinerario completo, los pasajeros y el total pagado,<br>y recibo la misma información en el correo<br>registrado dentro de los cinco minutos siguientes.|RF-092,<br>RF-093|
|**HU-14**|Como comprador quiero que, si el<br>cobro se realizó pero la emisión falla,<br>el dinero me sea devuelto sin que yo<br>tenga que reclamarlo.|Dado un cobro autorizado y una emisión fallida,<br>cuando el sistema detecta el fallo, entonces<br>ejecuta la compensación de forma automática, me<br>notifica la situación y registra el caso con<br>trazabilidad completa.|RF-094,<br>RN-17|
|**HU-15**|Como visitante quiero saber cuándo<br>un vuelo está por agotarse al precio|Dado un itinerario cuyo inventario en la clase<br>cotizada está por debajo del umbral, cuando lo|RF-026|



Página _31_ de _40_ 

SRS — Núcleo de Vuelos · Sistema de Vuelos · v1.0 

|**ID**<br>**Historia**|**Criterios de aceptación**<br>**RF**|
|---|---|
|mostrado para decidir con esa|visualizo, entonces se muestra la advertencia de<br>i|
|información.|últimos asientos disponibles a ese precio.|



Página _32_ de _40_ 

SRS — Núcleo de Vuelos · Sistema de Vuelos · v1.0 

# **8. Modelo de datos preliminar** 

El modelo siguiente describe las entidades del dominio y sus atributos principales. Se propone separar el contexto de búsqueda y cotización, de naturaleza efímera y alto volumen de lectura, del contexto de orden, de naturaleza transaccional y persistente. 

|**Entidad**|**Atributos principales**|**Relaciones y notas**|
|---|---|---|
|**Aeropuerto**|código IATA, nombre, ciudad, país,<br>zona horaria, indicador de operación|Pertenece a una ciudad; una ciudad puede agrupar<br>varios aeropuertos.|
|**Ciudad**|código, nombre, país, región|Agrupa aeropuertos; es la unidad de búsqueda<br>ofrecida al usuario.|
|**Aerolínea**|código IATA de dos letras, nombre<br>comercial, alianza|Se distingue la comercializadora de la operadora en<br>cada segmento.|
|**Vuelo**|número de vuelo, aerolínea<br>operadora, equipo, frecuencia,<br>vigencia|Define la operación programada de un tramo.|
|**Segmento**|vuelo, aeropuerto de salida,<br>aeropuerto de llegada, instante de<br>salida, instante de llegada, duración,<br>aerolínea operadora, aeronave|Unidad atómica del itinerario. Persiste instantes en<br>tiempo universal coordinado.|
|**Itinerario**|identificador, lista ordenada de<br>segmentos, duración total, cantidad<br>de escalas, indicador de cruce de día|Conecta origen y destino de un trayecto; contiene<br>uno o más segmentos.|
|**FamiliaTarifaria**|código, nombre comercial, cabina,<br>franquicia de mano, franquicia de<br>bodega, política de cambio, política<br>de devolución, selección de asiento,<br>elegibilidad de upgrade, factor de<br>acumulación|Catálogo diferenciado por mercado doméstico e<br>internacional.|
||itinerario, familia, clase de reserva,||
|**Tarifa**|tarifa base, tasas, impuestos, cargos,<br>moneda, equivalente en millas,<br>vigencia|Resultado de la cotización para una combinación<br>concreta.|
|**Oferta**|identificador, punto de venta,<br>moneda, trayectos con itinerario y<br>tarifa elegidos, composición de<br>pasajeros, total, instante de emisión,<br>vigencia, estado|Agregado raíz del contexto de cotización. Efímera.|
||tipo, nombres, apellidos, fecha de<br>nacimiento, género, nacionalidad,||
|**Pasajero**|tipo y número de documento,<br>vencimiento del documento, número<br>de socio|Asociado a una oferta y, tras la emisión, a la reserva.|



Página _33_ de _40_ 

SRS — Núcleo de Vuelos · Sistema de Vuelos · v1.0 

|**Entidad**|**Atributos principales**|**Relaciones y notas**|
|---|---|---|
|**Contacto**|correo electrónico, teléfono con<br>código de país, preferencia de idioma|Uno por reserva; destino de las notificaciones.|
|**ServicioAdicional**|tipo, segmento, pasajero,<br>descripción, precio, moneda, estado|Asiento, equipaje adicional, upgrade o cobertura. Se<br>respalda con documento electrónico.|
|**Pago**|identificador, oferta, medio, marca,<br>token, importe, moneda, cuotas,<br>millas debitadas, referencia de<br>autorización, estado, clave de<br>idempotencia|No persiste datos completos del instrumento de<br>pago.|
|**Reserva**|localizador, estado, punto de venta,<br>oferta origen, pasajeros, itinerarios,<br>instante de creación, límite de<br>emisión|Agregado raíz del contexto de orden.|
|**Billete**|número de trece dígitos, pasajero,<br>reserva, cupones por segmento,<br>estado, instante de emisión|Un billete por pasajero; un cupón por segmento.|
|**EventoDominio**|identificador, tipo, agregado<br>afectado, carga útil, instante,<br>identificador de correlación|Soporta la integración asincrónica con notificaciones,<br>fidelización y analítica.|



Página _34_ de _40_ 

SRS — Núcleo de Vuelos · Sistema de Vuelos · v1.0 

# **9. Interfaces externas e integraciones** 

|**Sistema**|**Naturaleza**|**Operaciones y consideraciones**|
|---|---|---|
|**PSS / inventario**|Sincrónica|Consulta de disponibilidad por par de ciudades y fecha; retención de<br>inventario; creación de reserva. Es la dependencia más crítica en<br>latencia y disponibilidad; exige cortacircuitos y degradación<br>controlada.|
|**Motor tarifario**|Sincrónica|Cotización por itinerario, familia y composición de pasajeros;<br>revalidación de precio. La revalidación nunca puede servirse desde<br>caché.|
|**Pasarela de pagos**|Sincrónica y<br>asincrónica|Tokenización, autenticación reforzada y autorización. Los medios<br>locales de confirmación diferida requieren un punto de recepción<br>de notificaciones con verificación de firma.|
|||Evaluación de riesgo previa a la autorización, con veredicto de|
|**Servicio antifraude**|Sincrónica|aprobación, revisión o rechazo. Debe tener tiempo límite estricto y<br>política de decisión ante falta de respuesta.|
|**Servicio de fidelización**|Sincrónica|Consulta de saldo, reserva y débito de millas, y confirmación de<br>acumulación tras la emisión. El débito exige compensación si la<br>emisión falla.|
|**Notificaciones**|Asincrónica|Envío de la confirmación de compra y de los documentos de viaje,<br>disparado por eventos de dominio.|
|**Catálogo de localización**|Sincrónica|Provisión de textos por idioma y mercado. Externo al despliegue del<br>servicio.|
|**Analítica y seguimiento**|Asincrónica|Recepción de eventos de embudo de compra. Las campañas<br>observadas trasladan parámetros de origen y medio a los<br>proveedores externos.|
|**Proveedores**<br>**complementarios**|Enlace|Alojamiento, autos, traslados, actividades y eSIM, con traslado del<br>contexto de viaje y atribución de campaña.|



## **9.1 Contratos propuestos de la API** 

Se propone una interfaz REST versionada, con identificadores opacos y semántica orientada a oferta y orden, alineada con la dirección marcada por los estándares de distribución de la industria. 

|**Método**|**Recurso**|**Propósito**|
|---|---|---|
|**GET**|/v1/catalogo/localidades?q=|Búsqueda incremental de ciudades y aeropuertos. Soporta<br>RF-004 y RF-005.|
|**GET**|/v1/disponibilidad|Consulta de itinerarios por trayecto según los criterios de<br>búsqueda. Soporta RF-020 a RF-031.|
|**GET**|/v1/itinerarios/{id}/tarifas|Familias tarifarias disponibles para un itinerario, con atributos<br>y precio. Soporta RF-040 a RF-049.|



Página _35_ de _40_ 

SRS — Núcleo de Vuelos · Sistema de Vuelos · v1.0 

|**Método**|**Recurso**|**Propósito**|
|---|---|---|
|**POST**|/v1/ofertas|Construcción de la oferta a partir de los itinerarios y familias<br>elegidos. Soporta RF-050.|
|**GET**|/v1/ofertas/{id}|Recuperación del estado vigente de una oferta. Soporta<br>RF-052 y RF-054.|
|**POST**|/v1/ofertas/{id}/revalidacion|Revalidación de precio y disponibilidad antes de confirmar.<br>Soporta RF-051.|
|**PUT**|/v1/ofertas/{id}/pasajeros|Registro y validación del conjunto de pasajeros y del<br>contacto. Soporta RF-060 a RF-068.|
|**POST**|/v1/ofertas/{id}/servicios|Incorporación de servicios adicionales con recálculo del total.<br>Soporta RF-070 a RF-075.|
|**GET**|/v1/ofertas/{id}/medios-pago|Medios de pago habilitados para el punto de venta y el<br>producto. Soporta RF-080.|
|**POST**|/v1/ofertas/{id}/pagos|Solicitud de cobro con clave de idempotencia obligatoria.<br>Soporta RF-081 a RF-089.|
|**POST**|/v1/ofertas/{id}/emision|Creación de la reserva y emisión de los billetes. Soporta<br>RF-090 a RF-095.|
|**GET**|/v1/reservas/{localizador}|Consulta de la reserva por localizador y apellido del titular.<br>Soporta RF-096.|
|**POST**|/v1/webhooks/pagos|Recepción de confirmaciones diferidas de los medios de pago<br>locales. Soporta RF-082.|



Página _36_ de _40_ 

SRS — Núcleo de Vuelos · Sistema de Vuelos · v1.0 

# **10. Matriz de trazabilidad** 

La matriz vincula cada módulo con sus requerimientos funcionales, los casos de uso que los ejercitan y las historias de usuario que los verifican, de modo que ningún requerimiento quede sin cobertura de prueba. 

|**Módulo**|**Requerimientos**|**Casos de uso**|**Historias de usuario**|
|---|---|---|---|
|**MOD-01 Contexto y**<br>**catálogo**|RF-001 a RF-008|CU-01|HU-02|
|**MOD-02 Motor de**<br>**búsqueda**|RF-010 a RF-019|CU-01|HU-01, HU-03, HU-07, HU-08,<br>HU-09|
|**MOD-03**<br>**Disponibilidad**|RF-020 a RF-031|CU-01|HU-01, HU-05, HU-06, HU-15|
|**MOD-04 Tarificación**|RF-040 a RF-049|CU-02, CU-05|HU-04, HU-09|
|**MOD-05 Oferta y**<br>**carrito**|RF-050 a RF-054|CU-02, CU-04|HU-04|
|**MOD-06 Pasajeros**|RF-060 a RF-068|CU-03|HU-10|
|**MOD-07 Servicios**<br>**adicionales**|RF-070 a RF-075|CU-04|HU-11|
|**MOD-08 Pago**|RF-080 a RF-089|CU-04, CU-05|HU-11, HU-12|
|**MOD-09 Emisión**|RF-090 a RF-096|CU-04|HU-13, HU-14|
|**MOD-10 Post-venta**|RF-100 a RF-103|Fuera de alcance|Fuera de alcance|



## **10.1 Priorización para la liberación mínima** 

Se propone el siguiente corte para el producto mínimo viable, orientado a habilitar la venta de un trayecto de ida y vuelta en cabina económica con pago mediante tarjeta en un único mercado. 

|**Incremento**|**Contenido**|**Criterio de cierre**|
|---|---|---|
|**Incremento 1 — Cotización**|MOD-01, MOD-02 y MOD-03 completos;<br>MOD-04 limitado a las familias de cabina<br>económica.|Un usuario obtiene resultados ordenados<br>con precio mínimo y puede compartir la<br>búsqueda por enlace.|
|**Incremento 2 — Oferta**|MOD-04 completo, MOD-05 y MOD-06.|Un usuario construye una oferta con<br>pasajeros validados y la oferta se revalida<br>correctamente al expirar.|
|**Incremento 3 — Compra**|MOD-08 con tarjeta y MOD-09<br>completos.|Una compra extremo a extremo produce<br>localizador y billete, con compensación<br>verificada ante fallo de emisión.|
|**Incremento 4 — Extensión**|MOD-07, medios de pago locales,<br>redención con millas y multidestino.|La cobertura alcanza los mercados y<br>modalidades definidos por negocio.|



Página _37_ de _40_ 

SRS — Núcleo de Vuelos · Sistema de Vuelos · v1.0 

# **11. Riesgos y asuntos pendientes de definición** 

|**ID**|**Riesgo o asunto**|**Impacto**|**Mitigación o acción requerida**|
|---|---|---|---|
|**R-01**|Dependencia crítica de la latencia del<br>PSS para la consulta de disponibilidad.|Incumplimiento de los<br>objetivos de rendimiento y<br>abandono del embudo de<br>compra.|Cacheo acotado de resultados,<br>consultas anticipadas para<br>rutas de alta demanda y<br>degradación controlada con<br>mensaje explícito.|
|**R-02**|Variación de precio entre la cotización<br>y la revalidación.|Fricción en el cierre de la<br>compra y reclamos de<br>usuarios.|Vigencia corta y visible de la<br>cotización, y confirmación<br>explícita ante cualquier<br>variación.|
|**R-03**|Cobro autorizado con emisión fallida.|Impacto económico directo y<br>daño reputacional.|Transacción con<br>compensación, reconciliación<br>automática y alerta operativa<br>inmediata.|
|**R-04**|Heterogeneidad de medios de pago y<br>de nomenclatura tarifaria entre<br>mercados.|Proliferación de casos<br>particulares en el código.|Externalizar el catálogo de<br>medios de pago y de familias<br>tarifarias a configuración por<br>mercado.|
|**R-05**|Alcance del cumplimiento PCI DSS.|Retraso en la certificación y<br>bloqueo de la salida a<br>producción.|Delegar íntegramente la<br>captura del instrumento de<br>pago en la pasarela y excluir el<br>microservicio del alcance de<br>auditoría.|
|**R-06**|Doble cargo ante reintentos del<br>cliente.|Cobro indebido y costo de<br>reversa.|Clave de idempotencia<br>obligatoria en toda operación<br>de pago y prueba de contrato<br>específica.|
|**A-01**|Límite máximo de pasajeros por<br>reserva.|Determina RN-05 y la<br>derivación a venta de grupos.|Requiere definición del área<br>comercial.|
|**A-02**|Ventana de venta y anticipación<br>mínima por ruta.|Determina RN-03 y la<br>validación de fechas.|Requiere definición del área<br>de planificación de malla.|
|**A-03**|Tiempo de vigencia de la oferta y de la<br>retención de inventario.|Determina RNF-05 y RF-053.|Requiere acuerdo entre<br>negocio y operaciones.|
|**A-04**|Umbral para la advertencia de escasez<br>de inventario.|Determina RF-026.|Requiere definición del área<br>comercial.|
|**A-05**|Tabla de equivalencia entre millas y<br>dinero por ruta y familia.|Determina RF-046 y RF-084.|Requiere definición del<br>programa de fidelización.|



Página _38_ de _40_ 

SRS — Núcleo de Vuelos · Sistema de Vuelos · v1.0 

# **Anexo A. Evidencia del levantamiento** 

Se documenta la evidencia recogida durante el recorrido del sitio productivo, que sustenta los requerimientos marcados con origen "Observado". 

## **A.1 Transacción de referencia** 

|**Campo**|**Detalle**|
|---|---|
|**Portal**|Portal de Colombia en español|
|**Trayecto**|Bogotá (BOG) — Santiago de Chile (SCL), ida y vuelta|
|**Fechas**|Ida el 15 de octubre de 2026; regreso el 22 de octubre de 2026|
|**Pasajeros**|Un adulto|
|**Cabina**|Económica|
|**Modalidad**|Monetaria, sin redención de millas|
|**Ordenamiento**|Recomendado|



## **A.2 Parámetros observados en el enlace profundo** 

La página de resultados codifica los criterios de búsqueda en los siguientes parámetros de consulta, lo que sustenta directamente el requerimiento RF-017. 

|**Parámetro**|**Significado observado**|
|---|---|
|**origin**|Código IATA del aeropuerto o ciudad de origen.|
|**destination**|Código IATA del aeropuerto o ciudad de destino.|
|**outbound**|Instante de la fecha de ida, expresado en formato ISO 8601 con zona horaria universal.|
|**inbound**|Instante de la fecha de regreso, con el mismo formato.|
|**adt / chd / inf**|Cantidad de adultos, niños e infantes respectivamente.|
|**trip**|Tipo de viaje; el valor observado corresponde a ida y vuelta.|
|**cabin**|Cabina solicitada; el valor observado corresponde a cabina económica.|
|**redemption**|Indicador booleano de la modalidad de cotización con millas.|
|**sort**|Criterio de ordenamiento aplicado al conjunto de resultados.|



## **A.3 Hallazgos relevantes** 

- El formulario de búsqueda ofreció tres tipos de viaje —ida y vuelta, solo ida y multidestino— junto con selector de cabina, calendario de ida y vuelta, selector de pasajeros, campo de código promocional y una casilla para cotizar con millas más dinero. 

Página _39_ de _40_ 

SRS — Núcleo de Vuelos · Sistema de Vuelos · v1.0 

- El campo de origen declaró más de mil quinientas opciones seleccionables, y el de destino una menos, lo que confirma que el catálogo de destinos se recalcula tras elegir el origen. 

- El conjunto de resultados para el trayecto de ida superó los cuarenta itinerarios, con opciones directas, de una escala y de dos escalas. 

- Se observaron cinco aerolíneas operadoras distintas en un mismo conjunto de resultados, incluyendo una transportadora ajena al grupo en un vuelo directo, lo que obliga a modelar el operador a nivel de segmento. 

- El menú de ordenamiento ofreció siete criterios, y la interfaz advirtió explícitamente que el orden elegido se aplicaría también al trayecto de vuelta. 

- El panel de tarifas de un vuelo directo presentó cinco familias con sus atributos comparables y el precio por pasajero declarado con tasas e impuestos incluidos. 

- El detalle del itinerario expuso el modelo de aeronave y los servicios a bordo, cada uno con notas aclaratorias diferenciadas. 

- Se activó un diálogo de reconciliación geográfica que advirtió la discrepancia entre el portal solicitado y el país inferido de la conexión, ofreciendo cambiar de portal o continuar en el actual. 

- Cada tarjeta de vuelo incorporó una descripción textual completa del itinerario destinada a tecnologías de asistencia, lo que evidencia un nivel de cumplimiento de accesibilidad que el proyecto debe igualar. 

- El portal enlazó productos complementarios de proveedores externos —alojamiento, autos, traslados, actividades y eSIM— trasladando parámetros de atribución de campaña. 

## **A.4 Limitaciones del levantamiento** 

El recorrido se detuvo antes de la captura de datos de pasajeros, por tratarse de un entorno productivo en el que avanzar habría implicado retener inventario real e iniciar un proceso de pago. En consecuencia, los requerimientos de los módulos MOD-06 a MOD-09 se derivaron del análisis documental de fuentes oficiales de la aerolínea y de prácticas estándar de la industria, y están marcados como "Documental" o "Dominio". Se recomienda validar esos módulos mediante acceso al entorno de pruebas de la plataforma o mediante entrevistas con el área funcional antes de congelar el alcance. 

_Fin del documento — SRS Núcleo de Vuelos v1.0_ 

Página _40_ de _40_ 

