--
-- PostgreSQL database dump
--

\restrict jmzpu7aIwed1sbAJOmmrOP0ULa7Sc7FCLU9BlZf5CfcuOdEgtOWC5XeBANa4aba

-- Dumped from database version 16.15 (Debian 16.15-1.pgdg13+2)
-- Dumped by pg_dump version 16.15 (Debian 16.15-1.pgdg13+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: auditoria_administrativa; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auditoria_administrativa (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    entidad character varying(50) NOT NULL,
    "entidadId" character varying(100) NOT NULL,
    "actorId" uuid NOT NULL,
    accion character varying(30) NOT NULL,
    antes jsonb NOT NULL,
    despues jsonb NOT NULL,
    "creadoEn" timestamp(3) with time zone DEFAULT now() NOT NULL
);


--
-- Name: auditoria_saga_pasos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auditoria_saga_pasos (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "sagaId" uuid NOT NULL,
    secuencia integer NOT NULL,
    nombre character varying(40) NOT NULL,
    estado character varying(12) NOT NULL,
    detalle character varying(300),
    "duracionMs" integer NOT NULL,
    en timestamp(3) with time zone NOT NULL
);


--
-- Name: auditoria_sagas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auditoria_sagas (
    "sagaId" uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tipo character varying(40) NOT NULL,
    referencia character varying(100) NOT NULL,
    "propietarioId" character varying(100) NOT NULL,
    "correlationId" character varying(100) NOT NULL,
    estado character varying(12) DEFAULT 'EN_CURSO'::character varying NOT NULL,
    error character varying(300),
    "iniciadaEn" timestamp(3) with time zone NOT NULL,
    "finalizadaEn" timestamp(3) with time zone
);


--
-- Name: auditoria_transacciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auditoria_transacciones (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "eventoId" uuid NOT NULL,
    tipo character varying(60) NOT NULL,
    "agregadoId" character varying(100) NOT NULL,
    mercado character varying(5),
    "propietarioId" character varying(100),
    "correlationId" character varying(100) NOT NULL,
    resumen character varying(300) NOT NULL,
    "ocurridoEn" timestamp(3) with time zone NOT NULL,
    "registradoEn" timestamp(3) with time zone DEFAULT now() NOT NULL
);


--
-- Name: catalogo_externo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.catalogo_externo (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "proveedorId" uuid NOT NULL,
    "externalId" character varying(100) NOT NULL,
    tipo character varying(30) NOT NULL,
    nombre character varying(200) NOT NULL,
    descripcion text NOT NULL,
    duracion character varying(60),
    "precioMinor" bigint NOT NULL,
    moneda character(3) NOT NULL,
    "imagenUrl" character varying(500),
    "cancelacionGratis" boolean DEFAULT false NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    "sincronizadoEn" timestamp with time zone NOT NULL
);


--
-- Name: catalogo_externo_categorias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.catalogo_externo_categorias (
    "catalogoId" uuid NOT NULL,
    categoria character varying(60) NOT NULL
);


--
-- Name: ecom_aceptaciones_condiciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ecom_aceptaciones_condiciones (
    "ofertaId" uuid NOT NULL,
    terminos character varying(20) NOT NULL,
    "condicionesTransporte" character varying(20) NOT NULL,
    "aceptadoEn" timestamp with time zone NOT NULL
);


--
-- Name: ecom_cliente_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ecom_cliente_roles (
    "clienteId" uuid NOT NULL,
    rol character varying(20) NOT NULL
);


--
-- Name: ecom_clientes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ecom_clientes (
    "clienteId" uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    correo character varying(150) NOT NULL,
    "correoVerificado" boolean DEFAULT false NOT NULL,
    "hashContrasena" character varying(300) NOT NULL,
    nombres character varying(100) NOT NULL,
    apellidos character varying(100) NOT NULL,
    "fechaNacimiento" date NOT NULL,
    telefono character varying(30),
    "numeroSocio" character varying(20) NOT NULL,
    "mercadoPreferido" character varying(5) NOT NULL,
    "idiomaPreferido" character varying(5) NOT NULL,
    "canalNotificacion" character varying(12) DEFAULT 'EMAIL'::character varying NOT NULL,
    "consentimientoMarketing" boolean DEFAULT false NOT NULL,
    "terminosVersionAceptada" character varying(20) NOT NULL,
    "terminosAceptadosEn" timestamp with time zone NOT NULL,
    "intentosFallidos" integer DEFAULT 0 NOT NULL,
    "bloqueadoHasta" timestamp with time zone,
    "tokenVerificacionHash" character(64),
    "tokenVerificacionVenceEn" timestamp with time zone,
    "creadoEn" timestamp with time zone DEFAULT now() NOT NULL,
    "actualizadoEn" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ecom_datos_facturacion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ecom_datos_facturacion (
    "datosFacturacionId" uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "tipoIdentificacion" character varying(30) NOT NULL,
    "numeroIdentificacion" text NOT NULL,
    "razonSocial" text NOT NULL,
    direccion text NOT NULL,
    pais character(2) NOT NULL,
    "creadoEn" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ecom_factura_detalles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ecom_factura_detalles (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "facturaId" uuid NOT NULL,
    linea integer NOT NULL,
    tipo character varying(20) DEFAULT 'TARIFA'::character varying NOT NULL,
    concepto character varying(200) NOT NULL,
    cantidad integer NOT NULL,
    "precioUnitarioMinor" bigint NOT NULL,
    "ivaMinor" bigint NOT NULL,
    "totalMinor" bigint NOT NULL
);


--
-- Name: ecom_facturas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ecom_facturas (
    "facturaId" uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "numeroFactura" character varying(20) NOT NULL,
    "ordenId" uuid,
    "datosFacturacionId" uuid NOT NULL,
    moneda character(3) NOT NULL,
    "subtotalMinor" bigint NOT NULL,
    "ivaMinor" bigint NOT NULL,
    "totalMinor" bigint NOT NULL,
    estado character varying(10) DEFAULT 'EMITIDA'::character varying NOT NULL,
    "emitidaEn" timestamp with time zone DEFAULT now() NOT NULL,
    "reservaExternaId" uuid,
    CONSTRAINT "CHK_ecom_facturas_origen" CHECK ((("ordenId" IS NOT NULL) <> ("reservaExternaId" IS NOT NULL)))
);


--
-- Name: ecom_localidades; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ecom_localidades (
    iata character(3) NOT NULL,
    ciudad character varying(100) NOT NULL,
    nombre character varying(150) NOT NULL,
    pais character(2) NOT NULL,
    "paisNombre" character varying(100) NOT NULL,
    "zonaHoraria" character varying(50) NOT NULL,
    "ciudadNorm" character varying(100) NOT NULL,
    "nombreNorm" character varying(150) NOT NULL
);


--
-- Name: ecom_mercado_documentos_legales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ecom_mercado_documentos_legales (
    "mercadoCodigo" character varying(5) NOT NULL,
    tipo character varying(25) NOT NULL,
    version character varying(20) NOT NULL,
    url character varying(300) NOT NULL
);


--
-- Name: ecom_mercado_identificaciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ecom_mercado_identificaciones (
    "mercadoCodigo" character varying(5) NOT NULL,
    tipo character varying(20) NOT NULL,
    etiqueta character varying(60) NOT NULL,
    patron character varying(100) NOT NULL,
    orden integer NOT NULL
);


--
-- Name: ecom_mercado_idiomas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ecom_mercado_idiomas (
    "mercadoCodigo" character varying(5) NOT NULL,
    idioma character varying(5) NOT NULL,
    orden integer NOT NULL
);


--
-- Name: ecom_mercado_medio_cuotas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ecom_mercado_medio_cuotas (
    "medioId" uuid NOT NULL,
    cuotas integer NOT NULL
);


--
-- Name: ecom_mercado_medio_marcas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ecom_mercado_medio_marcas (
    "medioId" uuid NOT NULL,
    marca character varying(20) NOT NULL,
    orden integer NOT NULL
);


--
-- Name: ecom_mercado_medio_productos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ecom_mercado_medio_productos (
    "medioId" uuid NOT NULL,
    producto character varying(10) NOT NULL
);


--
-- Name: ecom_mercado_medios_pago; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ecom_mercado_medios_pago (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "mercadoCodigo" character varying(5) NOT NULL,
    tipo character varying(20) NOT NULL,
    orden integer NOT NULL
);


--
-- Name: ecom_mercado_productos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ecom_mercado_productos (
    "mercadoCodigo" character varying(5) NOT NULL,
    producto character varying(30) NOT NULL,
    orden integer NOT NULL
);


--
-- Name: ecom_mercado_regla_familias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ecom_mercado_regla_familias (
    "reglaId" uuid NOT NULL,
    familia character varying(20) NOT NULL
);


--
-- Name: ecom_mercado_reglas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ecom_mercado_reglas (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "mercadoCodigo" character varying(5) NOT NULL,
    regla character varying(15) NOT NULL,
    "diasHabiles" integer,
    "retencionPorcentaje" numeric(5,2),
    "horasAntesDelVuelo" integer,
    "maximoPorPasaje" integer,
    "maximoPorAnio" integer
);


--
-- Name: ecom_mercados; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ecom_mercados (
    codigo character varying(5) NOT NULL,
    pais character(2) NOT NULL,
    nombre character varying(100) NOT NULL,
    "idiomaPorDefecto" character varying(5) NOT NULL,
    moneda character(3) NOT NULL,
    "tipoCambioDesdeUsd" numeric(14,6) NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    "actualizadoEn" timestamp with time zone DEFAULT now() NOT NULL,
    "razonSocial" character varying(200) NOT NULL
);


--
-- Name: ecom_notificaciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ecom_notificaciones (
    "notificacionId" uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "eventoId" uuid NOT NULL,
    tipo character varying(30) NOT NULL,
    canal character varying(12) NOT NULL,
    destinatario character varying(150) NOT NULL,
    mercado character varying(5),
    idioma character varying(5) NOT NULL,
    "plantillaVersion" integer NOT NULL,
    asunto character varying(200) NOT NULL,
    cuerpo text NOT NULL,
    referencia character varying(100) NOT NULL,
    estado character varying(10) NOT NULL,
    intentos integer DEFAULT 0 NOT NULL,
    error character varying(300),
    "creadoEn" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ecom_oferta_pasajero_asientos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ecom_oferta_pasajero_asientos (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "pasajeroId" uuid NOT NULL,
    "vueloId" uuid NOT NULL,
    asiento character varying(4) NOT NULL
);


--
-- Name: ecom_oferta_pasajero_necesidades; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ecom_oferta_pasajero_necesidades (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "pasajeroId" uuid NOT NULL,
    necesidad character varying(40) NOT NULL
);


--
-- Name: ecom_oferta_pasajeros; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ecom_oferta_pasajeros (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "ofertaId" uuid NOT NULL,
    orden integer NOT NULL,
    "idCliente" character varying(100) NOT NULL,
    tipo character varying(10) NOT NULL,
    "asociadoA" character varying(100),
    nombres text NOT NULL,
    apellidos text NOT NULL,
    "fechaNacimiento" text NOT NULL,
    genero character(1) NOT NULL,
    nacionalidad character(2) NOT NULL,
    "documentoTipo" character varying(20) NOT NULL,
    "documentoNumero" text NOT NULL,
    "documentoVencimiento" date,
    "numeroSocio" character varying(30)
);


--
-- Name: ecom_oferta_trayecto_precios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ecom_oferta_trayecto_precios (
    "trayectoId" uuid NOT NULL,
    "tipoPasajero" character varying(10) NOT NULL,
    "baseMinor" bigint NOT NULL,
    "tasasMinor" bigint NOT NULL
);


--
-- Name: ecom_oferta_trayectos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ecom_oferta_trayectos (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "ofertaId" uuid NOT NULL,
    orden integer NOT NULL,
    "vueloId" uuid NOT NULL,
    "gdsItinerarioId" uuid NOT NULL,
    familia character varying(20) NOT NULL,
    "totalMinor" bigint NOT NULL
);


--
-- Name: ecom_ofertas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ecom_ofertas (
    "ofertaId" uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    mercado character varying(5) NOT NULL,
    moneda character(3) NOT NULL,
    "ownerId" character varying(100) NOT NULL,
    estado character varying(20) DEFAULT 'ABIERTA'::character varying NOT NULL,
    "totalMinor" bigint NOT NULL,
    "totalPropuestoMinor" bigint,
    "gdsOfferId" uuid NOT NULL,
    "holdId" uuid NOT NULL,
    "venceEn" timestamp with time zone NOT NULL,
    "revalidadaEn" timestamp with time zone,
    "enPagoDesde" timestamp with time zone,
    "creadaEn" timestamp with time zone DEFAULT now() NOT NULL,
    "actualizadaEn" timestamp with time zone DEFAULT now() NOT NULL,
    adultos integer NOT NULL,
    jovenes integer DEFAULT 0 NOT NULL,
    ninos integer DEFAULT 0 NOT NULL,
    infantes integer DEFAULT 0 NOT NULL,
    "contactoCorreo" text,
    "contactoTelefono" text,
    "datosFacturacionId" uuid
);


--
-- Name: ecom_orden_historial; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ecom_orden_historial (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "ordenId" uuid NOT NULL,
    secuencia integer NOT NULL,
    estado character varying(25) NOT NULL,
    en timestamp(3) with time zone NOT NULL,
    motivo character varying(300)
);


--
-- Name: ecom_ordenes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ecom_ordenes (
    "ordenId" uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "numeroOrden" character varying(20) NOT NULL,
    "ofertaId" uuid NOT NULL,
    "ownerId" character varying(100) NOT NULL,
    "clienteId" uuid,
    mercado character varying(5) NOT NULL,
    moneda character(3) NOT NULL,
    "totalMinor" bigint NOT NULL,
    estado character varying(25) NOT NULL,
    canal character varying(10) DEFAULT 'WEB'::character varying NOT NULL,
    pnr character(6),
    "bookingId" uuid,
    "creadaEn" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "actualizadaEn" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "datosFacturacionId" uuid NOT NULL,
    "contactoCorreo" text NOT NULL,
    "contactoTelefono" text NOT NULL
);


--
-- Name: ecom_pago_antifraude_motivos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ecom_pago_antifraude_motivos (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "pagoId" uuid NOT NULL,
    motivo character varying(60) NOT NULL
);


--
-- Name: ecom_pagos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ecom_pagos (
    "pagoId" uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "ofertaId" uuid,
    "ordenId" uuid,
    "ownerId" character varying(100) NOT NULL,
    mercado character varying(5) NOT NULL,
    moneda character(3) NOT NULL,
    "montoMinor" bigint NOT NULL,
    cuotas integer DEFAULT 1 NOT NULL,
    estado character varying(25) DEFAULT 'PENDIENTE'::character varying NOT NULL,
    "autorizacionRef" character varying(100),
    "codigoRechazo" character varying(50),
    "claveIdempotencia" character varying(100) NOT NULL,
    "creadoEn" timestamp with time zone DEFAULT now() NOT NULL,
    "actualizadoEn" timestamp with time zone DEFAULT now() NOT NULL,
    "reembolsoMinor" bigint,
    marca character varying(20) NOT NULL,
    ultimos4 character(4),
    "antifraudeVeredicto" character varying(10),
    "antifraudePuntaje" integer,
    "reservaExternaId" uuid,
    CONSTRAINT "CHK_ecom_pagos_origen" CHECK ((("ofertaId" IS NOT NULL) <> ("reservaExternaId" IS NOT NULL)))
);


--
-- Name: ecom_plantillas_notificacion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ecom_plantillas_notificacion (
    "plantillaId" uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tipo character varying(30) NOT NULL,
    mercado character varying(5),
    idioma character varying(5) NOT NULL,
    version integer NOT NULL,
    asunto character varying(200) NOT NULL,
    cuerpo text NOT NULL,
    activa boolean DEFAULT true NOT NULL
);


--
-- Name: ecom_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ecom_roles (
    codigo character varying(20) NOT NULL,
    descripcion character varying(100) NOT NULL
);


--
-- Name: peticiones_http; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.peticiones_http (
    id bigint NOT NULL,
    metodo character varying(10) NOT NULL,
    ruta character varying(200) NOT NULL,
    estado integer NOT NULL,
    "duracionMs" integer NOT NULL,
    "correlationId" character varying(100) NOT NULL,
    "creadaEn" timestamp(3) with time zone NOT NULL
);


--
-- Name: peticiones_http_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.peticiones_http_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: peticiones_http_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.peticiones_http_id_seq OWNED BY public.peticiones_http.id;


--
-- Name: proveedor_salud; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.proveedor_salud (
    id bigint NOT NULL,
    "proveedorId" uuid NOT NULL,
    estado character varying(10) NOT NULL,
    "latenciaMs" integer,
    detalle character varying(200),
    "comprobadoEn" timestamp(3) with time zone NOT NULL
);


--
-- Name: proveedor_salud_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.proveedor_salud_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: proveedor_salud_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.proveedor_salud_id_seq OWNED BY public.proveedor_salud.id;


--
-- Name: proveedores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.proveedores (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    nombre character varying(100) NOT NULL,
    equipo character varying(100) NOT NULL,
    "baseUrl" character varying(300) NOT NULL,
    "tipoServicio" character varying(20) NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    "creadoEn" timestamp with time zone DEFAULT now() NOT NULL,
    "actualizadoEn" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: reservas_externas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reservas_externas (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "ownerId" character varying(100) NOT NULL,
    "clienteId" uuid,
    "proveedorId" uuid NOT NULL,
    "catalogoId" uuid NOT NULL,
    "externalReservationId" uuid,
    estado character varying(20) DEFAULT 'PENDIENTE'::character varying NOT NULL,
    fecha date NOT NULL,
    hora character varying(10),
    cantidad integer NOT NULL,
    "nombreCliente" text NOT NULL,
    "correoCliente" text NOT NULL,
    "totalMinor" bigint NOT NULL,
    moneda character(3) NOT NULL,
    "datosFacturacionId" uuid NOT NULL,
    motivo character varying(300),
    "creadaEn" timestamp with time zone DEFAULT now() NOT NULL,
    "actualizadaEn" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vuelos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vuelos (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "codigoAerolinea" character varying(2) NOT NULL,
    "codigoVuelo" character varying(20) NOT NULL,
    "origenIATA" character(3) NOT NULL,
    "destinoIATA" character(3) NOT NULL,
    "fechaSalida" timestamp with time zone NOT NULL,
    "fechaLlegada" timestamp with time zone NOT NULL,
    "precioBase" numeric(10,2) NOT NULL,
    "asientosDisponibles" integer NOT NULL,
    "capacidadTotal" integer DEFAULT 180 NOT NULL,
    "durationMinutes" integer NOT NULL,
    estado character varying(12) DEFAULT 'SCHEDULED'::character varying NOT NULL,
    CONSTRAINT "CHK_vuelos_asientos" CHECK ((("asientosDisponibles" >= 0) AND ("asientosDisponibles" <= "capacidadTotal"))),
    CONSTRAINT "CHK_vuelos_iata_formato" CHECK ((("origenIATA" ~ '^[A-Z]{3}$'::text) AND ("destinoIATA" ~ '^[A-Z]{3}$'::text))),
    CONSTRAINT "CHK_vuelos_origen_distinto" CHECK (("origenIATA" <> "destinoIATA"))
);


--
-- Name: vuelos_aerolineas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vuelos_aerolineas (
    codigo character varying(2) NOT NULL,
    nombre character varying(150) NOT NULL
);


--
-- Name: vuelos_baggage_purchases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vuelos_baggage_purchases (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "bookingId" uuid NOT NULL,
    "passengerId" uuid NOT NULL,
    "itineraryId" uuid NOT NULL,
    "vueloId" uuid NOT NULL,
    quantity integer NOT NULL,
    "unitPriceMinor" integer NOT NULL,
    "totalMinor" integer NOT NULL,
    currency character(3) NOT NULL,
    "paymentReference" character varying(100) NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vuelos_booking_cambios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vuelos_booking_cambios (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "bookingId" uuid NOT NULL,
    "cambiadoEn" timestamp(3) with time zone NOT NULL,
    descripcion character varying(500) NOT NULL
);


--
-- Name: vuelos_bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vuelos_bookings (
    "bookingId" uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    pnr character varying(6) NOT NULL,
    "holdId" uuid NOT NULL,
    status character varying(30) DEFAULT 'PENDING'::character varying NOT NULL,
    "ownerId" character varying(100) NOT NULL,
    currency character varying(3) NOT NULL,
    "paymentReference" character varying(100) NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT now() NOT NULL,
    "totalMinor" bigint NOT NULL
);


--
-- Name: vuelos_cancellation_quotes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vuelos_cancellation_quotes (
    "quoteId" uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "bookingId" uuid NOT NULL,
    "ownerId" character varying(100) NOT NULL,
    "isRefundable" boolean NOT NULL,
    "refundMinor" integer NOT NULL,
    "penaltyMinor" integer NOT NULL,
    currency character(3) NOT NULL,
    status character varying(10) DEFAULT 'OPEN'::character varying NOT NULL,
    "expiresAt" timestamp with time zone NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vuelos_check_ins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vuelos_check_ins (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "bookingId" uuid NOT NULL,
    "passengerId" uuid NOT NULL,
    "vueloId" uuid NOT NULL,
    seat character varying(4),
    "boardingGroup" character(1) NOT NULL,
    "boardingPosition" integer NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vuelos_date_change_offers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vuelos_date_change_offers (
    "changeOfferId" uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "bookingId" uuid NOT NULL,
    "ownerId" character varying(100) NOT NULL,
    "itineraryId" uuid NOT NULL,
    "fromVueloId" uuid NOT NULL,
    "toVueloId" uuid NOT NULL,
    "fareDifferenceMinor" integer NOT NULL,
    "taxDifferenceMinor" integer NOT NULL,
    "changeFeeMinor" integer NOT NULL,
    "totalToPayMinor" integer NOT NULL,
    currency character(3) NOT NULL,
    status character varying(10) DEFAULT 'OPEN'::character varying NOT NULL,
    "paymentReference" character varying(100),
    "expiresAt" timestamp with time zone NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vuelos_fare_families; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vuelos_fare_families (
    code character varying(20) NOT NULL,
    name character varying(100) NOT NULL,
    "carryOnKg" integer NOT NULL,
    "checkedBags" integer NOT NULL,
    changeable boolean NOT NULL,
    refundable boolean NOT NULL,
    "seatSelectionIncluded" boolean NOT NULL,
    "upgradeEligible" boolean NOT NULL,
    "accrualFactor" double precision NOT NULL,
    "priceMultiplier" double precision NOT NULL
);


--
-- Name: vuelos_flight_hold_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vuelos_flight_hold_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "holdId" uuid NOT NULL,
    orden integer NOT NULL,
    "itineraryId" uuid NOT NULL,
    "vueloId" uuid NOT NULL,
    seats integer NOT NULL,
    "cabinClass" character varying(20) DEFAULT 'ECONOMY'::character varying NOT NULL,
    "fareBrand" character varying(20) NOT NULL
);


--
-- Name: vuelos_flight_holds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vuelos_flight_holds (
    "holdId" uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "offerId" uuid NOT NULL,
    "ownerId" character varying(100) NOT NULL,
    status character varying(20) DEFAULT 'HELD'::character varying NOT NULL,
    currency character varying(3) NOT NULL,
    "ttlMinutes" integer NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "expiresAt" timestamp without time zone NOT NULL,
    "lockedTaxesMinor" integer,
    "lockedPriceMinor" bigint NOT NULL,
    adults integer NOT NULL,
    youths integer DEFAULT 0 NOT NULL,
    children integer DEFAULT 0 NOT NULL,
    infants integer DEFAULT 0 NOT NULL
);


--
-- Name: vuelos_flight_offer_itineraries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vuelos_flight_offer_itineraries (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "offerId" uuid NOT NULL,
    orden integer NOT NULL,
    "itineraryId" uuid NOT NULL,
    "vueloId" uuid NOT NULL
);


--
-- Name: vuelos_flight_offers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vuelos_flight_offers (
    "offerId" uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    currency character varying(3) NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "expiresAt" timestamp without time zone NOT NULL,
    "grandTotalMinor" bigint NOT NULL,
    adults integer NOT NULL,
    youths integer DEFAULT 0 NOT NULL,
    children integer DEFAULT 0 NOT NULL,
    infants integer DEFAULT 0 NOT NULL
);


--
-- Name: vuelos_idempotency_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vuelos_idempotency_records (
    "idempotencyKey" character varying(100) NOT NULL,
    route character varying(100) NOT NULL,
    "ownerId" character varying(100) NOT NULL,
    "requestHash" character(64) NOT NULL,
    state character varying(12) DEFAULT 'IN_PROGRESS'::character varying NOT NULL,
    "responseStatus" integer,
    "responseBody" jsonb,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: vuelos_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vuelos_migrations (
    id integer NOT NULL,
    "timestamp" bigint NOT NULL,
    name character varying NOT NULL
);


--
-- Name: vuelos_migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.vuelos_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: vuelos_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.vuelos_migrations_id_seq OWNED BY public.vuelos_migrations.id;


--
-- Name: vuelos_passengers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vuelos_passengers (
    "passengerId" uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "bookingId" uuid NOT NULL,
    "clientPassengerId" character varying(100) NOT NULL,
    "associatedAdultClientId" character varying(100),
    "passengerType" character varying(10) NOT NULL,
    "firstName" text NOT NULL,
    "lastName" text NOT NULL,
    "documentType" character varying(20) NOT NULL,
    "documentNumber" text NOT NULL,
    nationality character varying(2) NOT NULL,
    "birthDate" text NOT NULL,
    gender character varying(1) NOT NULL,
    "contactEmail" text NOT NULL,
    "contactPhone" text NOT NULL
);


--
-- Name: vuelos_seat_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vuelos_seat_assignments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "vueloId" uuid NOT NULL,
    "seatNumber" character varying(4) NOT NULL,
    "bookingId" uuid NOT NULL,
    "passengerId" uuid NOT NULL
);


--
-- Name: vuelos_tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vuelos_tickets (
    "ticketId" uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "bookingId" uuid NOT NULL,
    "passengerId" uuid NOT NULL,
    "eTicketNumber" character varying(13) NOT NULL,
    status character varying(20) DEFAULT 'ISSUED'::character varying NOT NULL,
    "issuedAt" timestamp without time zone NOT NULL
);


--
-- Name: vuelos_webhook_deliveries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vuelos_webhook_deliveries (
    "deliveryId" uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "subscriptionId" uuid NOT NULL,
    "eventId" uuid NOT NULL,
    "eventType" character varying(40) NOT NULL,
    payload jsonb NOT NULL,
    status character varying(12) DEFAULT 'PENDING'::character varying NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    "nextAttemptAt" timestamp with time zone NOT NULL,
    "lastStatusCode" integer,
    "lastError" character varying(300),
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "deliveredAt" timestamp with time zone
);


--
-- Name: vuelos_webhook_subscription_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vuelos_webhook_subscription_events (
    "subscriptionId" uuid NOT NULL,
    evento character varying(40) NOT NULL
);


--
-- Name: vuelos_webhook_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vuelos_webhook_subscriptions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "ownerId" character varying(100) NOT NULL,
    url character varying(500) NOT NULL,
    secret text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: peticiones_http id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.peticiones_http ALTER COLUMN id SET DEFAULT nextval('public.peticiones_http_id_seq'::regclass);


--
-- Name: proveedor_salud id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proveedor_salud ALTER COLUMN id SET DEFAULT nextval('public.proveedor_salud_id_seq'::regclass);


--
-- Name: vuelos_migrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos_migrations ALTER COLUMN id SET DEFAULT nextval('public.vuelos_migrations_id_seq'::regclass);


--
-- Name: ecom_mercado_identificaciones PK_01a16d1e0b035241b891c8a8e7b; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_mercado_identificaciones
    ADD CONSTRAINT "PK_01a16d1e0b035241b891c8a8e7b" PRIMARY KEY ("mercadoCodigo", tipo);


--
-- Name: ecom_factura_detalles PK_03141245bf608123d5a8f217289; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_factura_detalles
    ADD CONSTRAINT "PK_03141245bf608123d5a8f217289" PRIMARY KEY (id);


--
-- Name: peticiones_http PK_088733f5a367b02f8db2ef0ec97; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.peticiones_http
    ADD CONSTRAINT "PK_088733f5a367b02f8db2ef0ec97" PRIMARY KEY (id);


--
-- Name: ecom_ofertas PK_0a536e611cc7ace315a3c2d0901; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_ofertas
    ADD CONSTRAINT "PK_0a536e611cc7ace315a3c2d0901" PRIMARY KEY ("ofertaId");


--
-- Name: vuelos_webhook_deliveries PK_0aed36861c1c0f5d8d0d6fd4df0; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos_webhook_deliveries
    ADD CONSTRAINT "PK_0aed36861c1c0f5d8d0d6fd4df0" PRIMARY KEY ("deliveryId");


--
-- Name: catalogo_externo PK_0e91ad1aabd0de68b0e97b16af7; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogo_externo
    ADD CONSTRAINT "PK_0e91ad1aabd0de68b0e97b16af7" PRIMARY KEY (id);


--
-- Name: ecom_ordenes PK_0ed6bc9b11179e735e0ce960c43; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_ordenes
    ADD CONSTRAINT "PK_0ed6bc9b11179e735e0ce960c43" PRIMARY KEY ("ordenId");


--
-- Name: vuelos_flight_offer_itineraries PK_11effd18b117146c26291cf8999; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos_flight_offer_itineraries
    ADD CONSTRAINT "PK_11effd18b117146c26291cf8999" PRIMARY KEY (id);


--
-- Name: ecom_mercado_idiomas PK_19958fa58d6c79be017e7c4ee01; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_mercado_idiomas
    ADD CONSTRAINT "PK_19958fa58d6c79be017e7c4ee01" PRIMARY KEY ("mercadoCodigo", idioma);


--
-- Name: proveedores PK_1dcf121f19f362fb1b4c0a493a9; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proveedores
    ADD CONSTRAINT "PK_1dcf121f19f362fb1b4c0a493a9" PRIMARY KEY (id);


--
-- Name: proveedor_salud PK_248f7f58105f0a27d3ccc733e23; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proveedor_salud
    ADD CONSTRAINT "PK_248f7f58105f0a27d3ccc733e23" PRIMARY KEY (id);


--
-- Name: vuelos_flight_holds PK_26dbfcb86aec01776b1063373a9; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos_flight_holds
    ADD CONSTRAINT "PK_26dbfcb86aec01776b1063373a9" PRIMARY KEY ("holdId");


--
-- Name: vuelos_booking_cambios PK_2a0cfa01cd3a96759c1460e69e9; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos_booking_cambios
    ADD CONSTRAINT "PK_2a0cfa01cd3a96759c1460e69e9" PRIMARY KEY (id);


--
-- Name: vuelos_migrations PK_2fa15e73a9acbf297e4aa45d094; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos_migrations
    ADD CONSTRAINT "PK_2fa15e73a9acbf297e4aa45d094" PRIMARY KEY (id);


--
-- Name: ecom_plantillas_notificacion PK_331dd4e1eee6421a15b6f32736d; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_plantillas_notificacion
    ADD CONSTRAINT "PK_331dd4e1eee6421a15b6f32736d" PRIMARY KEY ("plantillaId");


--
-- Name: catalogo_externo_categorias PK_3471b5cfb9781393ac707565168; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogo_externo_categorias
    ADD CONSTRAINT "PK_3471b5cfb9781393ac707565168" PRIMARY KEY ("catalogoId", categoria);


--
-- Name: vuelos_check_ins PK_3746e18aec6aaa832bbc610e09f; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos_check_ins
    ADD CONSTRAINT "PK_3746e18aec6aaa832bbc610e09f" PRIMARY KEY (id);


--
-- Name: ecom_mercado_productos PK_397b3dac650696c5ff7d5b506ab; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_mercado_productos
    ADD CONSTRAINT "PK_397b3dac650696c5ff7d5b506ab" PRIMARY KEY ("mercadoCodigo", producto);


--
-- Name: vuelos_bookings PK_3bbdd08ac0995dbd91c9cf4b705; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos_bookings
    ADD CONSTRAINT "PK_3bbdd08ac0995dbd91c9cf4b705" PRIMARY KEY ("bookingId");


--
-- Name: ecom_pagos PK_3c8e0abe050063acf45f6ca6c44; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_pagos
    ADD CONSTRAINT "PK_3c8e0abe050063acf45f6ca6c44" PRIMARY KEY ("pagoId");


--
-- Name: vuelos_passengers PK_435372adbba10927c92d81caa69; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos_passengers
    ADD CONSTRAINT "PK_435372adbba10927c92d81caa69" PRIMARY KEY ("passengerId");


--
-- Name: vuelos_tickets PK_459bf33701e8e58e33f67333fdc; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos_tickets
    ADD CONSTRAINT "PK_459bf33701e8e58e33f67333fdc" PRIMARY KEY ("ticketId");


--
-- Name: ecom_notificaciones PK_4b1456297573edae92a513906af; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_notificaciones
    ADD CONSTRAINT "PK_4b1456297573edae92a513906af" PRIMARY KEY ("notificacionId");


--
-- Name: ecom_mercado_documentos_legales PK_4e705c22ca26a329955469fe865; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_mercado_documentos_legales
    ADD CONSTRAINT "PK_4e705c22ca26a329955469fe865" PRIMARY KEY ("mercadoCodigo", tipo);


--
-- Name: vuelos_cancellation_quotes PK_50705aa513c64db7ad1e6b910c7; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos_cancellation_quotes
    ADD CONSTRAINT "PK_50705aa513c64db7ad1e6b910c7" PRIMARY KEY ("quoteId");


--
-- Name: ecom_mercado_medios_pago PK_53dff9fc03002fc370b67c76e73; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_mercado_medios_pago
    ADD CONSTRAINT "PK_53dff9fc03002fc370b67c76e73" PRIMARY KEY (id);


--
-- Name: ecom_clientes PK_66a7585676f3f887fe05f8a9cec; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_clientes
    ADD CONSTRAINT "PK_66a7585676f3f887fe05f8a9cec" PRIMARY KEY ("clienteId");


--
-- Name: vuelos_fare_families PK_686bbbccba21e887051886e7a7a; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos_fare_families
    ADD CONSTRAINT "PK_686bbbccba21e887051886e7a7a" PRIMARY KEY (code);


--
-- Name: ecom_facturas PK_7034f59ee55d5b164e49e7e55c2; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_facturas
    ADD CONSTRAINT "PK_7034f59ee55d5b164e49e7e55c2" PRIMARY KEY ("facturaId");


--
-- Name: ecom_aceptaciones_condiciones PK_721cc0fad6f2a6acfbaa5bb989b; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_aceptaciones_condiciones
    ADD CONSTRAINT "PK_721cc0fad6f2a6acfbaa5bb989b" PRIMARY KEY ("ofertaId");


--
-- Name: ecom_oferta_trayectos PK_7320e39916e8508f1b212f652e7; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_oferta_trayectos
    ADD CONSTRAINT "PK_7320e39916e8508f1b212f652e7" PRIMARY KEY (id);


--
-- Name: vuelos_webhook_subscriptions PK_73cbf67b88c14731eabcf0a48b8; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos_webhook_subscriptions
    ADD CONSTRAINT "PK_73cbf67b88c14731eabcf0a48b8" PRIMARY KEY (id);


--
-- Name: ecom_oferta_trayecto_precios PK_7526a6bcb2fd6437b30f4590b2c; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_oferta_trayecto_precios
    ADD CONSTRAINT "PK_7526a6bcb2fd6437b30f4590b2c" PRIMARY KEY ("trayectoId", "tipoPasajero");


--
-- Name: ecom_oferta_pasajero_asientos PK_78093152f5014dcc9be2f5c4f17; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_oferta_pasajero_asientos
    ADD CONSTRAINT "PK_78093152f5014dcc9be2f5c4f17" PRIMARY KEY (id);


--
-- Name: ecom_roles PK_7aedf2c5b7fa89c86458219d30e; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_roles
    ADD CONSTRAINT "PK_7aedf2c5b7fa89c86458219d30e" PRIMARY KEY (codigo);


--
-- Name: ecom_mercado_medio_cuotas PK_8ab1b46e7ee0331d42be98a8cfb; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_mercado_medio_cuotas
    ADD CONSTRAINT "PK_8ab1b46e7ee0331d42be98a8cfb" PRIMARY KEY ("medioId", cuotas);


--
-- Name: ecom_cliente_roles PK_93876597c679b1613bd103c653d; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_cliente_roles
    ADD CONSTRAINT "PK_93876597c679b1613bd103c653d" PRIMARY KEY ("clienteId", rol);


--
-- Name: ecom_mercados PK_97ef3cca280f8f75605d6d38931; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_mercados
    ADD CONSTRAINT "PK_97ef3cca280f8f75605d6d38931" PRIMARY KEY (codigo);


--
-- Name: ecom_mercado_regla_familias PK_9f7b395ee7eeab8a078bd3f1c73; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_mercado_regla_familias
    ADD CONSTRAINT "PK_9f7b395ee7eeab8a078bd3f1c73" PRIMARY KEY ("reglaId", familia);


--
-- Name: reservas_externas PK_a085570bcf485a4cb2aaeee0f3c; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservas_externas
    ADD CONSTRAINT "PK_a085570bcf485a4cb2aaeee0f3c" PRIMARY KEY (id);


--
-- Name: vuelos_webhook_subscription_events PK_a5a41587ed8e44a8eeeeb9f3ef3; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos_webhook_subscription_events
    ADD CONSTRAINT "PK_a5a41587ed8e44a8eeeeb9f3ef3" PRIMARY KEY ("subscriptionId", evento);


--
-- Name: vuelos_seat_assignments PK_ab82d690879685d44d7d3d11a7f; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos_seat_assignments
    ADD CONSTRAINT "PK_ab82d690879685d44d7d3d11a7f" PRIMARY KEY (id);


--
-- Name: vuelos_flight_offers PK_b201debc294100d2c4ac8c5193c; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos_flight_offers
    ADD CONSTRAINT "PK_b201debc294100d2c4ac8c5193c" PRIMARY KEY ("offerId");


--
-- Name: vuelos_idempotency_records PK_b9a6210e86238c2ad78cd4f5a42; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos_idempotency_records
    ADD CONSTRAINT "PK_b9a6210e86238c2ad78cd4f5a42" PRIMARY KEY ("idempotencyKey", route, "ownerId");


--
-- Name: ecom_oferta_pasajeros PK_b9d8b7ccad723066604a2307a07; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_oferta_pasajeros
    ADD CONSTRAINT "PK_b9d8b7ccad723066604a2307a07" PRIMARY KEY (id);


--
-- Name: ecom_oferta_pasajero_necesidades PK_bbbe1348103e8d8336440157943; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_oferta_pasajero_necesidades
    ADD CONSTRAINT "PK_bbbe1348103e8d8336440157943" PRIMARY KEY (id);


--
-- Name: ecom_orden_historial PK_c1098295fbc8dc8996439e7d58e; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_orden_historial
    ADD CONSTRAINT "PK_c1098295fbc8dc8996439e7d58e" PRIMARY KEY (id);


--
-- Name: ecom_pago_antifraude_motivos PK_ca8cc25d8ce472f7be3796527b7; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_pago_antifraude_motivos
    ADD CONSTRAINT "PK_ca8cc25d8ce472f7be3796527b7" PRIMARY KEY (id);


--
-- Name: vuelos_aerolineas PK_cd08e677046192144f5fc0d31e7; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos_aerolineas
    ADD CONSTRAINT "PK_cd08e677046192144f5fc0d31e7" PRIMARY KEY (codigo);


--
-- Name: vuelos_flight_hold_items PK_cd3738408629deed4e39c51b0e0; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos_flight_hold_items
    ADD CONSTRAINT "PK_cd3738408629deed4e39c51b0e0" PRIMARY KEY (id);


--
-- Name: ecom_datos_facturacion PK_d26b9469961cf9b4fb0dc054a43; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_datos_facturacion
    ADD CONSTRAINT "PK_d26b9469961cf9b4fb0dc054a43" PRIMARY KEY ("datosFacturacionId");


--
-- Name: auditoria_sagas PK_d53d64d5a8d0ec1a40d75dcb29c; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_sagas
    ADD CONSTRAINT "PK_d53d64d5a8d0ec1a40d75dcb29c" PRIMARY KEY ("sagaId");


--
-- Name: auditoria_transacciones PK_d561c8b4c37a329eb0076b1a556; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_transacciones
    ADD CONSTRAINT "PK_d561c8b4c37a329eb0076b1a556" PRIMARY KEY (id);


--
-- Name: auditoria_administrativa PK_ddcbb875c3362399871e02f347b; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_administrativa
    ADD CONSTRAINT "PK_ddcbb875c3362399871e02f347b" PRIMARY KEY (id);


--
-- Name: vuelos_baggage_purchases PK_e3f92f7e07becc22f019625ba5a; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos_baggage_purchases
    ADD CONSTRAINT "PK_e3f92f7e07becc22f019625ba5a" PRIMARY KEY (id);


--
-- Name: auditoria_saga_pasos PK_e971272f196e4e8470874310909; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_saga_pasos
    ADD CONSTRAINT "PK_e971272f196e4e8470874310909" PRIMARY KEY (id);


--
-- Name: ecom_mercado_reglas PK_f015b9ce5f20eef29b4a96d3b0d; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_mercado_reglas
    ADD CONSTRAINT "PK_f015b9ce5f20eef29b4a96d3b0d" PRIMARY KEY (id);


--
-- Name: vuelos PK_f4e1ec4253ec27fa0253b7c6a1a; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos
    ADD CONSTRAINT "PK_f4e1ec4253ec27fa0253b7c6a1a" PRIMARY KEY (id);


--
-- Name: ecom_localidades PK_f8977adf132d583d5c4857ed20b; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_localidades
    ADD CONSTRAINT "PK_f8977adf132d583d5c4857ed20b" PRIMARY KEY (iata);


--
-- Name: vuelos_date_change_offers PK_fbd33f65613cb1ce25608044a2a; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos_date_change_offers
    ADD CONSTRAINT "PK_fbd33f65613cb1ce25608044a2a" PRIMARY KEY ("changeOfferId");


--
-- Name: ecom_mercado_medio_marcas PK_fbf2e7dca4ac58065cdbd08c44a; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_mercado_medio_marcas
    ADD CONSTRAINT "PK_fbf2e7dca4ac58065cdbd08c44a" PRIMARY KEY ("medioId", marca);


--
-- Name: ecom_mercado_medio_productos PK_ff1a5397010dff07268e26c5cca; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_mercado_medio_productos
    ADD CONSTRAINT "PK_ff1a5397010dff07268e26c5cca" PRIMARY KEY ("medioId", producto);


--
-- Name: vuelos_bookings UQ_06aafb7c3a77a2d3bc3840376d1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos_bookings
    ADD CONSTRAINT "UQ_06aafb7c3a77a2d3bc3840376d1" UNIQUE ("paymentReference");


--
-- Name: vuelos_bookings UQ_099f1753cb68383ba9d2739c6e9; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos_bookings
    ADD CONSTRAINT "UQ_099f1753cb68383ba9d2739c6e9" UNIQUE ("holdId");


--
-- Name: ecom_facturas UQ_1c8b1048bb913701bf1cd0279a8; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_facturas
    ADD CONSTRAINT "UQ_1c8b1048bb913701bf1cd0279a8" UNIQUE ("reservaExternaId");


--
-- Name: ecom_facturas UQ_55123faa63aed0ae13ef2aac1b9; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_facturas
    ADD CONSTRAINT "UQ_55123faa63aed0ae13ef2aac1b9" UNIQUE ("ordenId");


--
-- Name: vuelos_tickets UQ_651a1d31793af007b706dc1e70b; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos_tickets
    ADD CONSTRAINT "UQ_651a1d31793af007b706dc1e70b" UNIQUE ("eTicketNumber");


--
-- Name: vuelos_bookings UQ_95b0267b3fa60d0b37e2998a050; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos_bookings
    ADD CONSTRAINT "UQ_95b0267b3fa60d0b37e2998a050" UNIQUE (pnr);


--
-- Name: auditoria_saga_pasos UQ_auditoria_saga_paso; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_saga_pasos
    ADD CONSTRAINT "UQ_auditoria_saga_paso" UNIQUE ("sagaId", secuencia);


--
-- Name: catalogo_externo UQ_catalogo_externo_proveedor_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogo_externo
    ADD CONSTRAINT "UQ_catalogo_externo_proveedor_id" UNIQUE ("proveedorId", "externalId");


--
-- Name: ecom_plantillas_notificacion UQ_ecom_plantillas; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_plantillas_notificacion
    ADD CONSTRAINT "UQ_ecom_plantillas" UNIQUE (tipo, mercado, idioma, version);


--
-- Name: ecom_factura_detalles UQ_factura_detalle_linea; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_factura_detalles
    ADD CONSTRAINT "UQ_factura_detalle_linea" UNIQUE ("facturaId", linea);


--
-- Name: ecom_ordenes UQ_fc9cffaa121dd234afbca935287; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_ordenes
    ADD CONSTRAINT "UQ_fc9cffaa121dd234afbca935287" UNIQUE ("bookingId");


--
-- Name: vuelos_flight_hold_items UQ_hold_item_itinerary; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos_flight_hold_items
    ADD CONSTRAINT "UQ_hold_item_itinerary" UNIQUE ("holdId", "itineraryId");


--
-- Name: vuelos_flight_hold_items UQ_hold_item_orden; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos_flight_hold_items
    ADD CONSTRAINT "UQ_hold_item_orden" UNIQUE ("holdId", orden);


--
-- Name: ecom_mercado_medios_pago UQ_mercado_medio_tipo; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_mercado_medios_pago
    ADD CONSTRAINT "UQ_mercado_medio_tipo" UNIQUE ("mercadoCodigo", tipo);


--
-- Name: ecom_mercado_reglas UQ_mercado_regla; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_mercado_reglas
    ADD CONSTRAINT "UQ_mercado_regla" UNIQUE ("mercadoCodigo", regla);


--
-- Name: ecom_oferta_pasajero_asientos UQ_oferta_pasajero_asiento; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_oferta_pasajero_asientos
    ADD CONSTRAINT "UQ_oferta_pasajero_asiento" UNIQUE ("pasajeroId", "vueloId");


--
-- Name: ecom_oferta_pasajeros UQ_oferta_pasajero_cliente; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_oferta_pasajeros
    ADD CONSTRAINT "UQ_oferta_pasajero_cliente" UNIQUE ("ofertaId", "idCliente");


--
-- Name: ecom_oferta_pasajero_necesidades UQ_oferta_pasajero_necesidad; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_oferta_pasajero_necesidades
    ADD CONSTRAINT "UQ_oferta_pasajero_necesidad" UNIQUE ("pasajeroId", necesidad);


--
-- Name: ecom_oferta_trayectos UQ_oferta_trayecto_orden; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_oferta_trayectos
    ADD CONSTRAINT "UQ_oferta_trayecto_orden" UNIQUE ("ofertaId", orden);


--
-- Name: vuelos_flight_offer_itineraries UQ_offer_itinerary_itinerary; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos_flight_offer_itineraries
    ADD CONSTRAINT "UQ_offer_itinerary_itinerary" UNIQUE ("itineraryId");


--
-- Name: vuelos_flight_offer_itineraries UQ_offer_itinerary_orden; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos_flight_offer_itineraries
    ADD CONSTRAINT "UQ_offer_itinerary_orden" UNIQUE ("offerId", orden);


--
-- Name: ecom_orden_historial UQ_orden_historial_secuencia; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_orden_historial
    ADD CONSTRAINT "UQ_orden_historial_secuencia" UNIQUE ("ordenId", secuencia);


--
-- Name: ecom_pago_antifraude_motivos UQ_pago_antifraude_motivo; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_pago_antifraude_motivos
    ADD CONSTRAINT "UQ_pago_antifraude_motivo" UNIQUE ("pagoId", motivo);


--
-- Name: vuelos_check_ins UQ_vuelos_checkin_passenger_flight; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos_check_ins
    ADD CONSTRAINT "UQ_vuelos_checkin_passenger_flight" UNIQUE ("bookingId", "passengerId", "vueloId");


--
-- Name: vuelos UQ_vuelos_codigo_salida; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos
    ADD CONSTRAINT "UQ_vuelos_codigo_salida" UNIQUE ("codigoVuelo", "fechaSalida");


--
-- Name: vuelos_seat_assignments UQ_vuelos_seat_vuelo_numero; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos_seat_assignments
    ADD CONSTRAINT "UQ_vuelos_seat_vuelo_numero" UNIQUE ("vueloId", "seatNumber");


--
-- Name: vuelos_webhook_deliveries UQ_vuelos_webhook_delivery_event; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos_webhook_deliveries
    ADD CONSTRAINT "UQ_vuelos_webhook_delivery_event" UNIQUE ("subscriptionId", "eventId");


--
-- Name: IDX_auditoria_sagas_correlacion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_auditoria_sagas_correlacion" ON public.auditoria_sagas USING btree ("correlationId");


--
-- Name: IDX_auditoria_sagas_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_auditoria_sagas_estado" ON public.auditoria_sagas USING btree (tipo, estado, "iniciadaEn");


--
-- Name: IDX_auditoria_sagas_referencia; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_auditoria_sagas_referencia" ON public.auditoria_sagas USING btree (referencia);


--
-- Name: IDX_auditoria_transacciones_agregado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_auditoria_transacciones_agregado" ON public.auditoria_transacciones USING btree ("agregadoId");


--
-- Name: IDX_auditoria_transacciones_correlacion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_auditoria_transacciones_correlacion" ON public.auditoria_transacciones USING btree ("correlationId");


--
-- Name: IDX_auditoria_transacciones_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_auditoria_transacciones_tipo" ON public.auditoria_transacciones USING btree (tipo, "ocurridoEn");


--
-- Name: IDX_booking_cambio_booking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_booking_cambio_booking" ON public.vuelos_booking_cambios USING btree ("bookingId", "cambiadoEn");


--
-- Name: IDX_catalogo_externo_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_catalogo_externo_tipo" ON public.catalogo_externo USING btree (tipo, activo);


--
-- Name: IDX_ecom_auditoria_entidad; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ecom_auditoria_entidad" ON public.auditoria_administrativa USING btree (entidad, "entidadId", "creadoEn");


--
-- Name: IDX_ecom_facturas_emitida; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ecom_facturas_emitida" ON public.ecom_facturas USING btree ("emitidaEn");


--
-- Name: IDX_ecom_localidades_ciudad_norm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ecom_localidades_ciudad_norm" ON public.ecom_localidades USING btree ("ciudadNorm");


--
-- Name: IDX_ecom_notificaciones_creado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ecom_notificaciones_creado" ON public.ecom_notificaciones USING btree ("creadoEn");


--
-- Name: IDX_ecom_notificaciones_referencia; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ecom_notificaciones_referencia" ON public.ecom_notificaciones USING btree (referencia, "creadoEn");


--
-- Name: IDX_ecom_ofertas_creada; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ecom_ofertas_creada" ON public.ecom_ofertas USING btree ("creadaEn");


--
-- Name: IDX_ecom_ofertas_hold; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ecom_ofertas_hold" ON public.ecom_ofertas USING btree ("holdId");


--
-- Name: IDX_ecom_ofertas_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ecom_ofertas_owner" ON public.ecom_ofertas USING btree ("ownerId", "creadaEn");


--
-- Name: IDX_ecom_ordenes_booking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ecom_ordenes_booking" ON public.ecom_ordenes USING btree ("bookingId");


--
-- Name: IDX_ecom_ordenes_creada; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ecom_ordenes_creada" ON public.ecom_ordenes USING btree ("creadaEn", "ordenId");


--
-- Name: IDX_ecom_ordenes_owner_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ecom_ordenes_owner_created" ON public.ecom_ordenes USING btree ("ownerId", "creadaEn", "ordenId");


--
-- Name: IDX_ecom_ordenes_pnr; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ecom_ordenes_pnr" ON public.ecom_ordenes USING btree (pnr);


--
-- Name: IDX_ecom_pagos_creado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ecom_pagos_creado" ON public.ecom_pagos USING btree ("creadoEn");


--
-- Name: IDX_ecom_pagos_oferta; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ecom_pagos_oferta" ON public.ecom_pagos USING btree ("ofertaId", "creadoEn");


--
-- Name: IDX_hold_item_vuelo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_hold_item_vuelo" ON public.vuelos_flight_hold_items USING btree ("vueloId");


--
-- Name: IDX_mercado_regla_mercado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_mercado_regla_mercado" ON public.ecom_mercado_reglas USING btree ("mercadoCodigo");


--
-- Name: IDX_oferta_pasajero_oferta; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_oferta_pasajero_oferta" ON public.ecom_oferta_pasajeros USING btree ("ofertaId", orden);


--
-- Name: IDX_oferta_trayecto_vuelo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_oferta_trayecto_vuelo" ON public.ecom_oferta_trayectos USING btree ("vueloId");


--
-- Name: IDX_offer_itinerary_vuelo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_offer_itinerary_vuelo" ON public.vuelos_flight_offer_itineraries USING btree ("vueloId");


--
-- Name: IDX_orden_historial_orden; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_orden_historial_orden" ON public.ecom_orden_historial USING btree ("ordenId");


--
-- Name: IDX_peticiones_http_correlacion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_peticiones_http_correlacion" ON public.peticiones_http USING btree ("correlationId");


--
-- Name: IDX_peticiones_http_creada; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_peticiones_http_creada" ON public.peticiones_http USING btree ("creadaEn");


--
-- Name: IDX_proveedor_salud_proveedor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_proveedor_salud_proveedor" ON public.proveedor_salud USING btree ("proveedorId", "comprobadoEn");


--
-- Name: IDX_reservas_externas_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_reservas_externas_owner" ON public.reservas_externas USING btree ("ownerId", "creadaEn");


--
-- Name: IDX_reservas_externas_proveedor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_reservas_externas_proveedor" ON public.reservas_externas USING btree ("proveedorId", estado);


--
-- Name: IDX_vuelos_baggage_booking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_vuelos_baggage_booking" ON public.vuelos_baggage_purchases USING btree ("bookingId");


--
-- Name: IDX_vuelos_baggage_payment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_vuelos_baggage_payment" ON public.vuelos_baggage_purchases USING btree ("paymentReference");


--
-- Name: IDX_vuelos_bookings_owner_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_vuelos_bookings_owner_created" ON public.vuelos_bookings USING btree ("ownerId", "createdAt", "bookingId");


--
-- Name: IDX_vuelos_cancel_quotes_booking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_vuelos_cancel_quotes_booking" ON public.vuelos_cancellation_quotes USING btree ("bookingId");


--
-- Name: IDX_vuelos_change_offers_booking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_vuelos_change_offers_booking" ON public.vuelos_date_change_offers USING btree ("bookingId");


--
-- Name: IDX_vuelos_checkin_vuelo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_vuelos_checkin_vuelo" ON public.vuelos_check_ins USING btree ("vueloId");


--
-- Name: IDX_vuelos_holds_status_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_vuelos_holds_status_expires" ON public.vuelos_flight_holds USING btree (status, "expiresAt");


--
-- Name: IDX_vuelos_idempotency_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_vuelos_idempotency_created" ON public.vuelos_idempotency_records USING btree ("createdAt");


--
-- Name: IDX_vuelos_passengers_booking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_vuelos_passengers_booking" ON public.vuelos_passengers USING btree ("bookingId");


--
-- Name: IDX_vuelos_ruta_salida; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_vuelos_ruta_salida" ON public.vuelos USING btree ("origenIATA", "destinoIATA", "fechaSalida");


--
-- Name: IDX_vuelos_tickets_booking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_vuelos_tickets_booking" ON public.vuelos_tickets USING btree ("bookingId");


--
-- Name: IDX_vuelos_webhook_delivery_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_vuelos_webhook_delivery_due" ON public.vuelos_webhook_deliveries USING btree (status, "nextAttemptAt");


--
-- Name: IDX_vuelos_webhooks_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_vuelos_webhooks_owner" ON public.vuelos_webhook_subscriptions USING btree ("ownerId");


--
-- Name: UQ_auditoria_transacciones_evento; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_auditoria_transacciones_evento" ON public.auditoria_transacciones USING btree ("eventoId");


--
-- Name: UQ_ecom_clientes_correo; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_ecom_clientes_correo" ON public.ecom_clientes USING btree (correo);


--
-- Name: UQ_ecom_clientes_socio; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_ecom_clientes_socio" ON public.ecom_clientes USING btree ("numeroSocio");


--
-- Name: UQ_ecom_facturas_numero; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_ecom_facturas_numero" ON public.ecom_facturas USING btree ("numeroFactura");


--
-- Name: UQ_ecom_notificaciones_evento; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_ecom_notificaciones_evento" ON public.ecom_notificaciones USING btree ("eventoId");


--
-- Name: UQ_ecom_ordenes_numero; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_ecom_ordenes_numero" ON public.ecom_ordenes USING btree ("numeroOrden");


--
-- Name: UQ_ecom_ordenes_oferta_activa; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_ecom_ordenes_oferta_activa" ON public.ecom_ordenes USING btree ("ofertaId") WHERE ((estado)::text <> 'FALLIDA_COMPENSADA'::text);


--
-- Name: UQ_proveedores_nombre; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_proveedores_nombre" ON public.proveedores USING btree (nombre);


--
-- Name: ecom_oferta_pasajero_asientos FK_0015b7a7b6b69a8081343ec8248; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_oferta_pasajero_asientos
    ADD CONSTRAINT "FK_0015b7a7b6b69a8081343ec8248" FOREIGN KEY ("pasajeroId") REFERENCES public.ecom_oferta_pasajeros(id) ON DELETE CASCADE;


--
-- Name: ecom_plantillas_notificacion FK_00d2f3219c2239c887be67f8d99; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_plantillas_notificacion
    ADD CONSTRAINT "FK_00d2f3219c2239c887be67f8d99" FOREIGN KEY (mercado) REFERENCES public.ecom_mercados(codigo) ON DELETE CASCADE;


--
-- Name: ecom_ordenes FK_055120c5ea4249e99c19882477f; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_ordenes
    ADD CONSTRAINT "FK_055120c5ea4249e99c19882477f" FOREIGN KEY ("clienteId") REFERENCES public.ecom_clientes("clienteId") ON DELETE RESTRICT;


--
-- Name: auditoria_administrativa FK_0848808f932c8e3dbb4a2a4d576; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_administrativa
    ADD CONSTRAINT "FK_0848808f932c8e3dbb4a2a4d576" FOREIGN KEY ("actorId") REFERENCES public.ecom_clientes("clienteId") ON DELETE RESTRICT;


--
-- Name: vuelos_bookings FK_099f1753cb68383ba9d2739c6e9; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos_bookings
    ADD CONSTRAINT "FK_099f1753cb68383ba9d2739c6e9" FOREIGN KEY ("holdId") REFERENCES public.vuelos_flight_holds("holdId") ON DELETE RESTRICT;


--
-- Name: vuelos_tickets FK_0b897c3f83751aac155ae4a9ec0; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos_tickets
    ADD CONSTRAINT "FK_0b897c3f83751aac155ae4a9ec0" FOREIGN KEY ("bookingId") REFERENCES public.vuelos_bookings("bookingId") ON DELETE CASCADE;


--
-- Name: vuelos FK_199648ccd765d66d1e6c3cef61f; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos
    ADD CONSTRAINT "FK_199648ccd765d66d1e6c3cef61f" FOREIGN KEY ("destinoIATA") REFERENCES public.ecom_localidades(iata) ON DELETE RESTRICT;


--
-- Name: ecom_mercado_productos FK_19a27f15fec4b276e6dd89340e9; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_mercado_productos
    ADD CONSTRAINT "FK_19a27f15fec4b276e6dd89340e9" FOREIGN KEY ("mercadoCodigo") REFERENCES public.ecom_mercados(codigo) ON DELETE CASCADE;


--
-- Name: ecom_facturas FK_1c8b1048bb913701bf1cd0279a8; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_facturas
    ADD CONSTRAINT "FK_1c8b1048bb913701bf1cd0279a8" FOREIGN KEY ("reservaExternaId") REFERENCES public.reservas_externas(id) ON DELETE RESTRICT;


--
-- Name: vuelos_date_change_offers FK_1d5c0bb21dcd7f5314df2201477; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos_date_change_offers
    ADD CONSTRAINT "FK_1d5c0bb21dcd7f5314df2201477" FOREIGN KEY ("bookingId") REFERENCES public.vuelos_bookings("bookingId") ON DELETE CASCADE;


--
-- Name: ecom_notificaciones FK_1e990639b1a74cc4c44e95b2cc8; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_notificaciones
    ADD CONSTRAINT "FK_1e990639b1a74cc4c44e95b2cc8" FOREIGN KEY (mercado) REFERENCES public.ecom_mercados(codigo) ON DELETE RESTRICT;


--
-- Name: vuelos_webhook_subscription_events FK_24aec4fff473771e4f4fed63825; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos_webhook_subscription_events
    ADD CONSTRAINT "FK_24aec4fff473771e4f4fed63825" FOREIGN KEY ("subscriptionId") REFERENCES public.vuelos_webhook_subscriptions(id) ON DELETE CASCADE;


--
-- Name: vuelos_cancellation_quotes FK_255148b3c2d57636ac3bf8332b7; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos_cancellation_quotes
    ADD CONSTRAINT "FK_255148b3c2d57636ac3bf8332b7" FOREIGN KEY ("bookingId") REFERENCES public.vuelos_bookings("bookingId") ON DELETE CASCADE;


--
-- Name: ecom_cliente_roles FK_2a5c9f792d9737aa9dc49edae55; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_cliente_roles
    ADD CONSTRAINT "FK_2a5c9f792d9737aa9dc49edae55" FOREIGN KEY ("clienteId") REFERENCES public.ecom_clientes("clienteId") ON DELETE CASCADE;


--
-- Name: reservas_externas FK_2aeccd97871812e7bd8106df16d; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservas_externas
    ADD CONSTRAINT "FK_2aeccd97871812e7bd8106df16d" FOREIGN KEY ("catalogoId") REFERENCES public.catalogo_externo(id) ON DELETE RESTRICT;


--
-- Name: vuelos_webhook_deliveries FK_2b236534855fe279c232dffb194; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos_webhook_deliveries
    ADD CONSTRAINT "FK_2b236534855fe279c232dffb194" FOREIGN KEY ("subscriptionId") REFERENCES public.vuelos_webhook_subscriptions(id) ON DELETE CASCADE;


--
-- Name: vuelos_date_change_offers FK_2eee94050b607020bc1f6e6578c; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos_date_change_offers
    ADD CONSTRAINT "FK_2eee94050b607020bc1f6e6578c" FOREIGN KEY ("toVueloId") REFERENCES public.vuelos(id) ON DELETE RESTRICT;


--
-- Name: ecom_mercado_medio_productos FK_384921df6dbc32c49a2396ae9b8; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_mercado_medio_productos
    ADD CONSTRAINT "FK_384921df6dbc32c49a2396ae9b8" FOREIGN KEY ("medioId") REFERENCES public.ecom_mercado_medios_pago(id) ON DELETE CASCADE;


--
-- Name: ecom_pagos FK_3f6dcf9a549b843247a553f6de9; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_pagos
    ADD CONSTRAINT "FK_3f6dcf9a549b843247a553f6de9" FOREIGN KEY ("ofertaId") REFERENCES public.ecom_ofertas("ofertaId") ON DELETE RESTRICT;


--
-- Name: vuelos_check_ins FK_3ffe447d842889a1d48f74361df; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos_check_ins
    ADD CONSTRAINT "FK_3ffe447d842889a1d48f74361df" FOREIGN KEY ("passengerId") REFERENCES public.vuelos_passengers("passengerId") ON DELETE CASCADE;


--
-- Name: vuelos_flight_hold_items FK_467a8e81bcfb5e826ecf5f43de1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos_flight_hold_items
    ADD CONSTRAINT "FK_467a8e81bcfb5e826ecf5f43de1" FOREIGN KEY ("fareBrand") REFERENCES public.vuelos_fare_families(code) ON DELETE RESTRICT;


--
-- Name: vuelos_baggage_purchases FK_49133df26acadbc64872fef8f39; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos_baggage_purchases
    ADD CONSTRAINT "FK_49133df26acadbc64872fef8f39" FOREIGN KEY ("vueloId") REFERENCES public.vuelos(id) ON DELETE RESTRICT;


--
-- Name: vuelos FK_49318576d16072a363ba9346375; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos
    ADD CONSTRAINT "FK_49318576d16072a363ba9346375" FOREIGN KEY ("codigoAerolinea") REFERENCES public.vuelos_aerolineas(codigo) ON DELETE RESTRICT;


--
-- Name: ecom_oferta_pasajero_asientos FK_4c836be7cdc4bf6fbc4bd57a8f2; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_oferta_pasajero_asientos
    ADD CONSTRAINT "FK_4c836be7cdc4bf6fbc4bd57a8f2" FOREIGN KEY ("vueloId") REFERENCES public.vuelos(id) ON DELETE CASCADE;


--
-- Name: ecom_mercado_regla_familias FK_4ef19348499875d65eb6b0b71fa; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_mercado_regla_familias
    ADD CONSTRAINT "FK_4ef19348499875d65eb6b0b71fa" FOREIGN KEY (familia) REFERENCES public.vuelos_fare_families(code) ON DELETE RESTRICT;


--
-- Name: ecom_oferta_trayecto_precios FK_52089691206dae2b46ac5f64adb; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_oferta_trayecto_precios
    ADD CONSTRAINT "FK_52089691206dae2b46ac5f64adb" FOREIGN KEY ("trayectoId") REFERENCES public.ecom_oferta_trayectos(id) ON DELETE CASCADE;


--
-- Name: reservas_externas FK_5345810031dfa6374555e62cef9; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservas_externas
    ADD CONSTRAINT "FK_5345810031dfa6374555e62cef9" FOREIGN KEY ("clienteId") REFERENCES public.ecom_clientes("clienteId") ON DELETE RESTRICT;


--
-- Name: ecom_facturas FK_55123faa63aed0ae13ef2aac1b9; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_facturas
    ADD CONSTRAINT "FK_55123faa63aed0ae13ef2aac1b9" FOREIGN KEY ("ordenId") REFERENCES public.ecom_ordenes("ordenId") ON DELETE RESTRICT;


--
-- Name: ecom_pago_antifraude_motivos FK_593b7beb7e65347eaaa5a99a02f; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_pago_antifraude_motivos
    ADD CONSTRAINT "FK_593b7beb7e65347eaaa5a99a02f" FOREIGN KEY ("pagoId") REFERENCES public.ecom_pagos("pagoId") ON DELETE CASCADE;


--
-- Name: ecom_pagos FK_5c19981628812b5497fe3b4272d; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_pagos
    ADD CONSTRAINT "FK_5c19981628812b5497fe3b4272d" FOREIGN KEY ("ordenId") REFERENCES public.ecom_ordenes("ordenId") ON DELETE RESTRICT;


--
-- Name: ecom_ofertas FK_5c893270923419e61c29f127b59; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_ofertas
    ADD CONSTRAINT "FK_5c893270923419e61c29f127b59" FOREIGN KEY (mercado) REFERENCES public.ecom_mercados(codigo) ON DELETE RESTRICT;


--
-- Name: vuelos_check_ins FK_5cd5fed9dedc39d437f8f60e072; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos_check_ins
    ADD CONSTRAINT "FK_5cd5fed9dedc39d437f8f60e072" FOREIGN KEY ("bookingId") REFERENCES public.vuelos_bookings("bookingId") ON DELETE CASCADE;


--
-- Name: ecom_mercado_idiomas FK_603f0d57c5982e2c52796ce5c99; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_mercado_idiomas
    ADD CONSTRAINT "FK_603f0d57c5982e2c52796ce5c99" FOREIGN KEY ("mercadoCodigo") REFERENCES public.ecom_mercados(codigo) ON DELETE CASCADE;


--
-- Name: ecom_mercado_identificaciones FK_61745e291395458a9755f9e1f07; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_mercado_identificaciones
    ADD CONSTRAINT "FK_61745e291395458a9755f9e1f07" FOREIGN KEY ("mercadoCodigo") REFERENCES public.ecom_mercados(codigo) ON DELETE CASCADE;


--
-- Name: vuelos_passengers FK_62805bcc117e59825423ccdeae9; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos_passengers
    ADD CONSTRAINT "FK_62805bcc117e59825423ccdeae9" FOREIGN KEY ("bookingId") REFERENCES public.vuelos_bookings("bookingId") ON DELETE CASCADE;


--
-- Name: catalogo_externo_categorias FK_664fb28bd6da1b766079f18736e; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogo_externo_categorias
    ADD CONSTRAINT "FK_664fb28bd6da1b766079f18736e" FOREIGN KEY ("catalogoId") REFERENCES public.catalogo_externo(id) ON DELETE CASCADE;


--
-- Name: auditoria_transacciones FK_68f589832449637a377ca749787; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_transacciones
    ADD CONSTRAINT "FK_68f589832449637a377ca749787" FOREIGN KEY (mercado) REFERENCES public.ecom_mercados(codigo) ON DELETE RESTRICT;


--
-- Name: ecom_orden_historial FK_6b8c8bb333c38edc7a977589a0b; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_orden_historial
    ADD CONSTRAINT "FK_6b8c8bb333c38edc7a977589a0b" FOREIGN KEY ("ordenId") REFERENCES public.ecom_ordenes("ordenId") ON DELETE CASCADE;


--
-- Name: ecom_aceptaciones_condiciones FK_721cc0fad6f2a6acfbaa5bb989b; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_aceptaciones_condiciones
    ADD CONSTRAINT "FK_721cc0fad6f2a6acfbaa5bb989b" FOREIGN KEY ("ofertaId") REFERENCES public.ecom_ofertas("ofertaId") ON DELETE CASCADE;


--
-- Name: vuelos_tickets FK_764133613c662032292639df9d9; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos_tickets
    ADD CONSTRAINT "FK_764133613c662032292639df9d9" FOREIGN KEY ("passengerId") REFERENCES public.vuelos_passengers("passengerId") ON DELETE CASCADE;


--
-- Name: ecom_ordenes FK_783a965fbc93bb82c918ead19a1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_ordenes
    ADD CONSTRAINT "FK_783a965fbc93bb82c918ead19a1" FOREIGN KEY ("datosFacturacionId") REFERENCES public.ecom_datos_facturacion("datosFacturacionId") ON DELETE RESTRICT;


--
-- Name: ecom_mercado_medio_cuotas FK_7ee372b61cfae300f0156eaa9a7; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_mercado_medio_cuotas
    ADD CONSTRAINT "FK_7ee372b61cfae300f0156eaa9a7" FOREIGN KEY ("medioId") REFERENCES public.ecom_mercado_medios_pago(id) ON DELETE CASCADE;


--
-- Name: ecom_mercado_medio_marcas FK_80c0a0eef821b75190d3563dff4; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_mercado_medio_marcas
    ADD CONSTRAINT "FK_80c0a0eef821b75190d3563dff4" FOREIGN KEY ("medioId") REFERENCES public.ecom_mercado_medios_pago(id) ON DELETE CASCADE;


--
-- Name: ecom_mercado_reglas FK_812e331fc733fbce6b9ba7096e9; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_mercado_reglas
    ADD CONSTRAINT "FK_812e331fc733fbce6b9ba7096e9" FOREIGN KEY ("mercadoCodigo") REFERENCES public.ecom_mercados(codigo) ON DELETE CASCADE;


--
-- Name: vuelos_booking_cambios FK_81664257fb7012a7d43441dbb29; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos_booking_cambios
    ADD CONSTRAINT "FK_81664257fb7012a7d43441dbb29" FOREIGN KEY ("bookingId") REFERENCES public.vuelos_bookings("bookingId") ON DELETE CASCADE;


--
-- Name: ecom_cliente_roles FK_853b9355d674b61f8a9db212846; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_cliente_roles
    ADD CONSTRAINT "FK_853b9355d674b61f8a9db212846" FOREIGN KEY (rol) REFERENCES public.ecom_roles(codigo) ON DELETE RESTRICT;


--
-- Name: ecom_mercado_regla_familias FK_87dc57438c7a4a8b3b78e395ef0; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_mercado_regla_familias
    ADD CONSTRAINT "FK_87dc57438c7a4a8b3b78e395ef0" FOREIGN KEY ("reglaId") REFERENCES public.ecom_mercado_reglas(id) ON DELETE CASCADE;


--
-- Name: ecom_oferta_pasajeros FK_8d860f1bd37875d5a3f3f9f87de; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_oferta_pasajeros
    ADD CONSTRAINT "FK_8d860f1bd37875d5a3f3f9f87de" FOREIGN KEY ("ofertaId") REFERENCES public.ecom_ofertas("ofertaId") ON DELETE CASCADE;


--
-- Name: vuelos_baggage_purchases FK_90393cbd1fa1b49f144739600bc; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos_baggage_purchases
    ADD CONSTRAINT "FK_90393cbd1fa1b49f144739600bc" FOREIGN KEY ("bookingId") REFERENCES public.vuelos_bookings("bookingId") ON DELETE CASCADE;


--
-- Name: vuelos_flight_offer_itineraries FK_9ae615c2d6e7f78c93d90fbceb7; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos_flight_offer_itineraries
    ADD CONSTRAINT "FK_9ae615c2d6e7f78c93d90fbceb7" FOREIGN KEY ("offerId") REFERENCES public.vuelos_flight_offers("offerId") ON DELETE CASCADE;


--
-- Name: ecom_oferta_pasajero_necesidades FK_9b8060083b9acbc05948f2415a6; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_oferta_pasajero_necesidades
    ADD CONSTRAINT "FK_9b8060083b9acbc05948f2415a6" FOREIGN KEY ("pasajeroId") REFERENCES public.ecom_oferta_pasajeros(id) ON DELETE CASCADE;


--
-- Name: ecom_ordenes FK_9c32f7215ee4b4a299e7e51011a; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_ordenes
    ADD CONSTRAINT "FK_9c32f7215ee4b4a299e7e51011a" FOREIGN KEY ("ofertaId") REFERENCES public.ecom_ofertas("ofertaId") ON DELETE RESTRICT;


--
-- Name: ecom_oferta_trayectos FK_a172ce24894c24efc32516b51d9; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_oferta_trayectos
    ADD CONSTRAINT "FK_a172ce24894c24efc32516b51d9" FOREIGN KEY (familia) REFERENCES public.vuelos_fare_families(code) ON DELETE RESTRICT;


--
-- Name: vuelos FK_a52dca549e38252add49b1c6a3a; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos
    ADD CONSTRAINT "FK_a52dca549e38252add49b1c6a3a" FOREIGN KEY ("origenIATA") REFERENCES public.ecom_localidades(iata) ON DELETE RESTRICT;


--
-- Name: catalogo_externo FK_a699077001e55c72072a4f4854c; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogo_externo
    ADD CONSTRAINT "FK_a699077001e55c72072a4f4854c" FOREIGN KEY ("proveedorId") REFERENCES public.proveedores(id) ON DELETE CASCADE;


--
-- Name: ecom_pagos FK_a6c26390f26d08746efff4f0f00; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_pagos
    ADD CONSTRAINT "FK_a6c26390f26d08746efff4f0f00" FOREIGN KEY ("reservaExternaId") REFERENCES public.reservas_externas(id) ON DELETE RESTRICT;


--
-- Name: vuelos_check_ins FK_a730e64a13cbb260401c57c45b7; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos_check_ins
    ADD CONSTRAINT "FK_a730e64a13cbb260401c57c45b7" FOREIGN KEY ("vueloId") REFERENCES public.vuelos(id) ON DELETE RESTRICT;


--
-- Name: ecom_mercado_documentos_legales FK_a7b388b7502a15d1b2aeafae4c9; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_mercado_documentos_legales
    ADD CONSTRAINT "FK_a7b388b7502a15d1b2aeafae4c9" FOREIGN KEY ("mercadoCodigo") REFERENCES public.ecom_mercados(codigo) ON DELETE CASCADE;


--
-- Name: ecom_pagos FK_a831438c5a88c564832aae4fcf7; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_pagos
    ADD CONSTRAINT "FK_a831438c5a88c564832aae4fcf7" FOREIGN KEY (mercado) REFERENCES public.ecom_mercados(codigo) ON DELETE RESTRICT;


--
-- Name: ecom_ordenes FK_aee9c37ea11864b2ef95f247435; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_ordenes
    ADD CONSTRAINT "FK_aee9c37ea11864b2ef95f247435" FOREIGN KEY (mercado) REFERENCES public.ecom_mercados(codigo) ON DELETE RESTRICT;


--
-- Name: proveedor_salud FK_b90e34d1c46b727f041013a3aaa; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proveedor_salud
    ADD CONSTRAINT "FK_b90e34d1c46b727f041013a3aaa" FOREIGN KEY ("proveedorId") REFERENCES public.proveedores(id) ON DELETE CASCADE;


--
-- Name: vuelos_date_change_offers FK_bbc5c452d242bb4c9f29a3830bd; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos_date_change_offers
    ADD CONSTRAINT "FK_bbc5c452d242bb4c9f29a3830bd" FOREIGN KEY ("fromVueloId") REFERENCES public.vuelos(id) ON DELETE RESTRICT;


--
-- Name: ecom_clientes FK_bc28a00feab82ea61582930e252; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_clientes
    ADD CONSTRAINT "FK_bc28a00feab82ea61582930e252" FOREIGN KEY ("mercadoPreferido") REFERENCES public.ecom_mercados(codigo) ON DELETE RESTRICT;


--
-- Name: vuelos_flight_holds FK_bea4bda7c03c97f5d58b683cda4; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos_flight_holds
    ADD CONSTRAINT "FK_bea4bda7c03c97f5d58b683cda4" FOREIGN KEY ("offerId") REFERENCES public.vuelos_flight_offers("offerId") ON DELETE RESTRICT;


--
-- Name: auditoria_saga_pasos FK_c9431e8075785f21387f5e69a66; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_saga_pasos
    ADD CONSTRAINT "FK_c9431e8075785f21387f5e69a66" FOREIGN KEY ("sagaId") REFERENCES public.auditoria_sagas("sagaId") ON DELETE CASCADE;


--
-- Name: vuelos_seat_assignments FK_ce1a1e7bedd70b678356366c7cd; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos_seat_assignments
    ADD CONSTRAINT "FK_ce1a1e7bedd70b678356366c7cd" FOREIGN KEY ("vueloId") REFERENCES public.vuelos(id) ON DELETE RESTRICT;


--
-- Name: vuelos_seat_assignments FK_d2cc868056d91ca3a5867a91098; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos_seat_assignments
    ADD CONSTRAINT "FK_d2cc868056d91ca3a5867a91098" FOREIGN KEY ("bookingId") REFERENCES public.vuelos_bookings("bookingId") ON DELETE CASCADE;


--
-- Name: reservas_externas FK_d51c36e5782d7991eed429ed1e9; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservas_externas
    ADD CONSTRAINT "FK_d51c36e5782d7991eed429ed1e9" FOREIGN KEY ("proveedorId") REFERENCES public.proveedores(id) ON DELETE RESTRICT;


--
-- Name: vuelos_baggage_purchases FK_dc7a00257c7c026ad259c21a891; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos_baggage_purchases
    ADD CONSTRAINT "FK_dc7a00257c7c026ad259c21a891" FOREIGN KEY ("passengerId") REFERENCES public.vuelos_passengers("passengerId") ON DELETE CASCADE;


--
-- Name: ecom_factura_detalles FK_e34412a0215faed3e26b468a3d5; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_factura_detalles
    ADD CONSTRAINT "FK_e34412a0215faed3e26b468a3d5" FOREIGN KEY ("facturaId") REFERENCES public.ecom_facturas("facturaId") ON DELETE CASCADE;


--
-- Name: ecom_oferta_trayectos FK_e372255673b7538827e7d929606; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_oferta_trayectos
    ADD CONSTRAINT "FK_e372255673b7538827e7d929606" FOREIGN KEY ("ofertaId") REFERENCES public.ecom_ofertas("ofertaId") ON DELETE CASCADE;


--
-- Name: vuelos_flight_hold_items FK_e3b05a5fa29b533bfa55422470b; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos_flight_hold_items
    ADD CONSTRAINT "FK_e3b05a5fa29b533bfa55422470b" FOREIGN KEY ("vueloId") REFERENCES public.vuelos(id) ON DELETE RESTRICT;


--
-- Name: ecom_ofertas FK_e5d907e6d2c49497e7cebd25c33; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_ofertas
    ADD CONSTRAINT "FK_e5d907e6d2c49497e7cebd25c33" FOREIGN KEY ("holdId") REFERENCES public.vuelos_flight_holds("holdId") ON DELETE RESTRICT;


--
-- Name: ecom_ofertas FK_e96c7d36ef6f1c61cf5b8b505bc; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_ofertas
    ADD CONSTRAINT "FK_e96c7d36ef6f1c61cf5b8b505bc" FOREIGN KEY ("datosFacturacionId") REFERENCES public.ecom_datos_facturacion("datosFacturacionId") ON DELETE RESTRICT;


--
-- Name: vuelos_flight_hold_items FK_ea721c9605fb88efcf52a73cfa0; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos_flight_hold_items
    ADD CONSTRAINT "FK_ea721c9605fb88efcf52a73cfa0" FOREIGN KEY ("holdId") REFERENCES public.vuelos_flight_holds("holdId") ON DELETE CASCADE;


--
-- Name: ecom_mercado_medios_pago FK_eab599de34d4bdba9a86f36b66b; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_mercado_medios_pago
    ADD CONSTRAINT "FK_eab599de34d4bdba9a86f36b66b" FOREIGN KEY ("mercadoCodigo") REFERENCES public.ecom_mercados(codigo) ON DELETE CASCADE;


--
-- Name: ecom_oferta_trayectos FK_ee7d7a4f7773b3000bbde97aa52; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_oferta_trayectos
    ADD CONSTRAINT "FK_ee7d7a4f7773b3000bbde97aa52" FOREIGN KEY ("vueloId") REFERENCES public.vuelos(id) ON DELETE RESTRICT;


--
-- Name: vuelos_seat_assignments FK_eebcb9d54cf4b1be76b53648485; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos_seat_assignments
    ADD CONSTRAINT "FK_eebcb9d54cf4b1be76b53648485" FOREIGN KEY ("passengerId") REFERENCES public.vuelos_passengers("passengerId") ON DELETE CASCADE;


--
-- Name: reservas_externas FK_eed08c76e8df5e62d53e64dd10a; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservas_externas
    ADD CONSTRAINT "FK_eed08c76e8df5e62d53e64dd10a" FOREIGN KEY ("datosFacturacionId") REFERENCES public.ecom_datos_facturacion("datosFacturacionId") ON DELETE RESTRICT;


--
-- Name: ecom_ordenes FK_fc9cffaa121dd234afbca935287; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_ordenes
    ADD CONSTRAINT "FK_fc9cffaa121dd234afbca935287" FOREIGN KEY ("bookingId") REFERENCES public.vuelos_bookings("bookingId") ON DELETE RESTRICT;


--
-- Name: vuelos_flight_offer_itineraries FK_fd9e2a93597edaa15bfa1c2301e; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vuelos_flight_offer_itineraries
    ADD CONSTRAINT "FK_fd9e2a93597edaa15bfa1c2301e" FOREIGN KEY ("vueloId") REFERENCES public.vuelos(id) ON DELETE CASCADE;


--
-- Name: ecom_facturas FK_fe205763c82e0a16dbdc0ca8236; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecom_facturas
    ADD CONSTRAINT "FK_fe205763c82e0a16dbdc0ca8236" FOREIGN KEY ("datosFacturacionId") REFERENCES public.ecom_datos_facturacion("datosFacturacionId") ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict jmzpu7aIwed1sbAJOmmrOP0ULa7Sc7FCLU9BlZf5CfcuOdEgtOWC5XeBANa4aba

--
-- PostgreSQL database dump
--

\restrict II10YaxbjhVTUxeb0bfohGhDOvnMlXjHocfC6c0mydcCnB1d4zFcOyv4BgtWw5Z

-- Dumped from database version 16.15 (Debian 16.15-1.pgdg13+2)
-- Dumped by pg_dump version 16.15 (Debian 16.15-1.pgdg13+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: ecom_localidades; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.ecom_localidades VALUES ('BOG', 'Bogotá', 'El Dorado', 'CO', 'Colombia', 'America/Bogota', 'bogota', 'el dorado');
INSERT INTO public.ecom_localidades VALUES ('MDE', 'Medellín', 'José María Córdova', 'CO', 'Colombia', 'America/Bogota', 'medellin', 'jose maria cordova');
INSERT INTO public.ecom_localidades VALUES ('CLO', 'Cali', 'Alfonso Bonilla Aragón', 'CO', 'Colombia', 'America/Bogota', 'cali', 'alfonso bonilla aragon');
INSERT INTO public.ecom_localidades VALUES ('CTG', 'Cartagena', 'Rafael Núñez', 'CO', 'Colombia', 'America/Bogota', 'cartagena', 'rafael nunez');
INSERT INTO public.ecom_localidades VALUES ('UIO', 'Quito', 'Mariscal Sucre', 'EC', 'Ecuador', 'America/Guayaquil', 'quito', 'mariscal sucre');
INSERT INTO public.ecom_localidades VALUES ('GYE', 'Guayaquil', 'José Joaquín de Olmedo', 'EC', 'Ecuador', 'America/Guayaquil', 'guayaquil', 'jose joaquin de olmedo');
INSERT INTO public.ecom_localidades VALUES ('CUE', 'Cuenca', 'Mariscal Lamar', 'EC', 'Ecuador', 'America/Guayaquil', 'cuenca', 'mariscal lamar');
INSERT INTO public.ecom_localidades VALUES ('GPS', 'Galápagos', 'Seymour (Baltra)', 'EC', 'Ecuador', 'Pacific/Galapagos', 'galapagos', 'seymour (baltra)');
INSERT INTO public.ecom_localidades VALUES ('LIM', 'Lima', 'Jorge Chávez', 'PE', 'Perú', 'America/Lima', 'lima', 'jorge chavez');
INSERT INTO public.ecom_localidades VALUES ('CUZ', 'Cusco', 'Alejandro Velasco Astete', 'PE', 'Perú', 'America/Lima', 'cusco', 'alejandro velasco astete');
INSERT INTO public.ecom_localidades VALUES ('SCL', 'Santiago', 'Arturo Merino Benítez', 'CL', 'Chile', 'America/Santiago', 'santiago', 'arturo merino benitez');
INSERT INTO public.ecom_localidades VALUES ('EZE', 'Buenos Aires', 'Ministro Pistarini (Ezeiza)', 'AR', 'Argentina', 'America/Argentina/Buenos_Aires', 'buenos aires', 'ministro pistarini (ezeiza)');
INSERT INTO public.ecom_localidades VALUES ('AEP', 'Buenos Aires', 'Jorge Newbery (Aeroparque)', 'AR', 'Argentina', 'America/Argentina/Buenos_Aires', 'buenos aires', 'jorge newbery (aeroparque)');
INSERT INTO public.ecom_localidades VALUES ('GRU', 'São Paulo', 'Guarulhos', 'BR', 'Brasil', 'America/Sao_Paulo', 'sao paulo', 'guarulhos');
INSERT INTO public.ecom_localidades VALUES ('GIG', 'Río de Janeiro', 'Galeão', 'BR', 'Brasil', 'America/Sao_Paulo', 'rio de janeiro', 'galeao');
INSERT INTO public.ecom_localidades VALUES ('MVD', 'Montevideo', 'Carrasco', 'UY', 'Uruguay', 'America/Montevideo', 'montevideo', 'carrasco');
INSERT INTO public.ecom_localidades VALUES ('ASU', 'Asunción', 'Silvio Pettirossi', 'PY', 'Paraguay', 'America/Asuncion', 'asuncion', 'silvio pettirossi');
INSERT INTO public.ecom_localidades VALUES ('LPB', 'La Paz', 'El Alto', 'BO', 'Bolivia', 'America/La_Paz', 'la paz', 'el alto');
INSERT INTO public.ecom_localidades VALUES ('PTY', 'Ciudad de Panamá', 'Tocumen', 'PA', 'Panamá', 'America/Panama', 'ciudad de panama', 'tocumen');
INSERT INTO public.ecom_localidades VALUES ('MEX', 'Ciudad de México', 'Benito Juárez', 'MX', 'México', 'America/Mexico_City', 'ciudad de mexico', 'benito juarez');
INSERT INTO public.ecom_localidades VALUES ('CUN', 'Cancún', 'Cancún', 'MX', 'México', 'America/Cancun', 'cancun', 'cancun');
INSERT INTO public.ecom_localidades VALUES ('MIA', 'Miami', 'Miami International', 'US', 'Estados Unidos', 'America/New_York', 'miami', 'miami international');
INSERT INTO public.ecom_localidades VALUES ('JFK', 'Nueva York', 'John F. Kennedy', 'US', 'Estados Unidos', 'America/New_York', 'nueva york', 'john f. kennedy');
INSERT INTO public.ecom_localidades VALUES ('MAD', 'Madrid', 'Adolfo Suárez Madrid-Barajas', 'ES', 'España', 'Europe/Madrid', 'madrid', 'adolfo suarez madrid-barajas');


--
-- Data for Name: ecom_mercados; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.ecom_mercados VALUES ('ec', 'EC', 'Ecuador', 'es', 'USD', 1.000000, true, 1, '2026-10-25 23:56:23.887214+00', 'RAM Alliance (proyecto académico, sin venta real)');


--
-- Data for Name: ecom_mercado_documentos_legales; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.ecom_mercado_documentos_legales VALUES ('ec', 'TERMINOS', '2026-10', '/terminos');
INSERT INTO public.ecom_mercado_documentos_legales VALUES ('ec', 'PRIVACIDAD', '2026-10', '/privacidad');
INSERT INTO public.ecom_mercado_documentos_legales VALUES ('ec', 'CONDICIONES_TRANSPORTE', '2026-10', '/condiciones-transporte');


--
-- Data for Name: ecom_mercado_identificaciones; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.ecom_mercado_identificaciones VALUES ('ec', 'CEDULA', 'Cédula (10 dígitos)', '\d{10}', 0);
INSERT INTO public.ecom_mercado_identificaciones VALUES ('ec', 'RUC', 'RUC (13 dígitos)', '\d{13}', 1);
INSERT INTO public.ecom_mercado_identificaciones VALUES ('ec', 'PASAPORTE', 'Pasaporte', '[A-Za-z0-9]{5,20}', 2);


--
-- Data for Name: ecom_mercado_idiomas; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.ecom_mercado_idiomas VALUES ('ec', 'es', 0);


--
-- Data for Name: ecom_mercado_medios_pago; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.ecom_mercado_medios_pago VALUES ('08a8a4cb-cadd-40aa-b4d1-38fae1964e2e', 'ec', 'TARJETA', 0);


--
-- Data for Name: ecom_mercado_medio_cuotas; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.ecom_mercado_medio_cuotas VALUES ('08a8a4cb-cadd-40aa-b4d1-38fae1964e2e', 1);
INSERT INTO public.ecom_mercado_medio_cuotas VALUES ('08a8a4cb-cadd-40aa-b4d1-38fae1964e2e', 3);
INSERT INTO public.ecom_mercado_medio_cuotas VALUES ('08a8a4cb-cadd-40aa-b4d1-38fae1964e2e', 6);
INSERT INTO public.ecom_mercado_medio_cuotas VALUES ('08a8a4cb-cadd-40aa-b4d1-38fae1964e2e', 12);


--
-- Data for Name: ecom_mercado_medio_marcas; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.ecom_mercado_medio_marcas VALUES ('08a8a4cb-cadd-40aa-b4d1-38fae1964e2e', 'VISA', 0);
INSERT INTO public.ecom_mercado_medio_marcas VALUES ('08a8a4cb-cadd-40aa-b4d1-38fae1964e2e', 'MASTERCARD', 1);
INSERT INTO public.ecom_mercado_medio_marcas VALUES ('08a8a4cb-cadd-40aa-b4d1-38fae1964e2e', 'AMEX', 2);
INSERT INTO public.ecom_mercado_medio_marcas VALUES ('08a8a4cb-cadd-40aa-b4d1-38fae1964e2e', 'DINERS', 3);


--
-- Data for Name: ecom_mercado_medio_productos; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.ecom_mercado_medio_productos VALUES ('08a8a4cb-cadd-40aa-b4d1-38fae1964e2e', 'PASAJE');
INSERT INTO public.ecom_mercado_medio_productos VALUES ('08a8a4cb-cadd-40aa-b4d1-38fae1964e2e', 'ADICIONAL');


--
-- Data for Name: ecom_mercado_productos; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.ecom_mercado_productos VALUES ('ec', 'VUELOS', 0);


--
-- Data for Name: ecom_plantillas_notificacion; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.ecom_plantillas_notificacion VALUES ('b1763681-d2af-4d00-ac1d-a3b09821f002', 'CONFIRMACION_COMPRA', NULL, 'es', 1, 'Confirmación de tu compra {{numeroOrden}}', 'Hola {{nombre}},

¡Tu compra fue confirmada!

Número de orden: {{numeroOrden}}
Código de reserva (PNR): {{pnr}}

Itinerario:
{{itinerario}}

Pasajeros y billetes electrónicos:
{{pasajeros}}

Total pagado: {{total}}

Puedes gestionar tu viaje con el número de orden o el código de reserva y el apellido del pasajero.

{{razonSocial}}
Términos y condiciones: {{urlTerminos}}', true);
INSERT INTO public.ecom_plantillas_notificacion VALUES ('1dcbeada-16b1-4789-8b68-fb59a40faa2f', 'CONFIRMACION_COMPRA', NULL, 'en', 1, 'Your purchase {{numeroOrden}} is confirmed', 'Hello {{nombre}},

Your purchase is confirmed!

Order number: {{numeroOrden}}
Booking reference (PNR): {{pnr}}

Itinerary:
{{itinerario}}

Passengers and e-tickets:
{{pasajeros}}

Total paid: {{total}}

Manage your trip with the order number or booking reference and the passenger surname.

{{razonSocial}}
Términos y condiciones: {{urlTerminos}}', true);
INSERT INTO public.ecom_plantillas_notificacion VALUES ('50e4a6ca-0d8d-4bd2-b383-f77683739cca', 'EMISION_FALLIDA', NULL, 'es', 1, 'No pudimos emitir tu orden {{numeroOrden}}', 'Hola,

No pudimos emitir los billetes de tu orden {{numeroOrden}}. La autorización de tu pago fue liberada: no se te cobró.

Puedes volver a intentar la compra o elegir otro vuelo.

{{razonSocial}}
Términos y condiciones: {{urlTerminos}}', true);
INSERT INTO public.ecom_plantillas_notificacion VALUES ('2fa60f6f-7e45-4c73-aeec-638da2359f9f', 'VERIFICACION_CORREO', NULL, 'es', 1, 'Confirma tu correo', 'Hola {{nombre}},

Confirma tu correo con este enlace (vale 24 horas):
{{enlace}}

Si no creaste una cuenta, ignora este mensaje.

{{razonSocial}}
Términos y condiciones: {{urlTerminos}}', true);
INSERT INTO public.ecom_plantillas_notificacion VALUES ('7bedce6f-6cdd-4981-b87d-64d5c181a1a6', 'CUENTA_BLOQUEADA', NULL, 'es', 1, 'Bloqueamos temporalmente tu cuenta', 'Hola {{nombre}},

Detectamos varios intentos fallidos de inicio de sesión y bloqueamos tu cuenta por {{minutos}} minutos. Si no fuiste tú, recupera tu acceso.

{{razonSocial}}
Términos y condiciones: {{urlTerminos}}', true);


--
-- Data for Name: ecom_roles; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.ecom_roles VALUES ('CUSTOMER', 'Cliente de la plataforma');
INSERT INTO public.ecom_roles VALUES ('ADMIN', 'Administrador del back-office');


--
-- Data for Name: vuelos_aerolineas; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.vuelos_aerolineas VALUES ('LA', 'LATAM Airlines');
INSERT INTO public.vuelos_aerolineas VALUES ('AV', 'Avianca');
INSERT INTO public.vuelos_aerolineas VALUES ('AR', 'Aerolíneas Argentinas');
INSERT INTO public.vuelos_aerolineas VALUES ('CM', 'Copa Airlines');
INSERT INTO public.vuelos_aerolineas VALUES ('UX', 'Air Europa');
INSERT INTO public.vuelos_aerolineas VALUES ('G3', 'Gol Linhas Aéreas');


--
-- Data for Name: vuelos_fare_families; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.vuelos_fare_families VALUES ('BASIC', 'Basic', 0, 0, false, false, false, false, 0.5, 1);
INSERT INTO public.vuelos_fare_families VALUES ('LIGHT', 'Light', 10, 0, false, false, false, true, 1, 1.15);
INSERT INTO public.vuelos_fare_families VALUES ('FULL', 'Full', 10, 1, true, true, true, true, 1, 1.35);


--
-- Data for Name: vuelos_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.vuelos_migrations VALUES (1, 1791167576852, 'InitVuelosSchema1791167576852');
INSERT INTO public.vuelos_migrations VALUES (2, 1791254000000, 'EncryptPassengerPii1791254000000');
INSERT INTO public.vuelos_migrations VALUES (3, 1791340000000, 'AdminOrderIndex1791340000000');
INSERT INTO public.vuelos_migrations VALUES (4, 1791430000000, 'ObservabilityIndexes1791430000000');
INSERT INTO public.vuelos_migrations VALUES (5, 1791520000000, 'PostSaleAndWebhooks1791520000000');
INSERT INTO public.vuelos_migrations VALUES (6, 1791610000000, 'HoldLockedTaxes1791610000000');
INSERT INTO public.vuelos_migrations VALUES (7, 1792970623866, 'NormalizeSchema1792970623866');
INSERT INTO public.vuelos_migrations VALUES (8, 1792972360174, 'AddProveedores1792972360174');


--
-- Name: vuelos_migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.vuelos_migrations_id_seq', 8, true);


--
-- PostgreSQL database dump complete
--

\unrestrict II10YaxbjhVTUxeb0bfohGhDOvnMlXjHocfC6c0mydcCnB1d4zFcOyv4BgtWw5Z

