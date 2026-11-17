// ============================================
//  Bigotes y Patitas - email-recibo.js   (Etapa 4)
//  Arma el recibo de una compra y lo envía al correo del cliente con EmailJS
//  (servicio gratuito que manda correos desde el navegador, sin servidor propio).
//
//  CÓMO ACTIVARLO (una sola vez, ~10 minutos):
//   1. Crea una cuenta gratis en https://www.emailjs.com
//   2. Email Services -> Add New Service -> Gmail -> conecta el Gmail de la tienda.
//      Copia el "Service ID" (ej. service_abc123).
//   3. Email Templates -> Create New Template:
//        To Email:  {{to_email}}
//        Subject:   Recibo de tu pedido {{folio}} - Bigotes y Patitas
//        Content (pestaña "Code"/HTML), por ejemplo:
//          <h2>¡Gracias por tu compra, {{to_name}}!</h2>
//          <p>Pedido: <b>{{folio}}</b> · Fecha: {{fecha}}</p>
//          <pre>{{productos}}</pre>
//          <p>Subtotal: {{subtotal}}<br>Descuento: {{descuento}}<br>Envío: {{envio}}<br>
//             {{iva_etiqueta}}: {{iva}}<br><b>Total: {{total}}</b></p>
//          <p>Método de pago: {{metodo_pago}} ({{estado_pago}})</p>
//          <p>{{referencia}}</p>
//          <p><a href="{{link_pedido}}">Ver mi pedido</a></p>
//      Copia el "Template ID" (ej. template_xyz789).
//   4. Account -> General -> copia tu "Public Key".
//   5. Pega los 3 valores en EMAILJS_CONFIG de aquí abajo. ¡Listo!
//  Mientras estén vacíos, la tienda funciona igual, solo no se manda el correo.
// ============================================

export const EMAILJS_CONFIG = {
  publicKey:  "NVwUghzHqOM-2CaC9",
  serviceId:  "service_5i0wsc6",
  templateId: "template_jl19tgn",
};

const URL_EMAILJS = "https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js";

export function correoConfigurado() {
  return !!(EMAILJS_CONFIG.publicKey && EMAILJS_CONFIG.serviceId && EMAILJS_CONFIG.templateId);
}

export function formatearMoneda(valor) {
  return `$${(Number(valor) || 0).toFixed(2)}`;
}

function esc(t) {
  return String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function fechaLegible(valor) {
  const d = valor?.toDate ? valor.toDate() : (valor ? new Date(valor) : new Date());
  return isNaN(d) ? "" : d.toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short" });
}

/**
 * Convierte una venta de Firestore (o los datos recién enviados en el checkout) al formato
 * de recibo que usan la pantalla de éxito, factura.html y el correo.
 */
export function reciboDesdeVenta(v) {
  const tasaIva = Number(v.tasaIva) || 0;
  return {
    ventaId: v.id || v.ventaId || "",
    folio: v.folio || "",
    fecha: fechaLegible(v.creadoEn || v.fecha),
    cliente: v.clienteNombre || v.cliente || "Cliente",
    correo: v.direccionEnvio?.correo || v.clienteCorreo || "",
    productos: (v.items || v.productos || []).map(i => ({
      nombre: i.nombre, precio: Number(i.precio) || 0, cantidad: Number(i.cantidad) || 0,
    })),
    subtotal: Number(v.subtotal) || 0,
    descuento: Number(v.descuento) || 0,
    cupon: v.cupon || null,
    descripcionCupon: v.descripcionCupon || "",
    envio: Number(v.envio) || 0,
    iva: Number(v.iva) || 0,
    tasaIva,
    ivaIncluido: !!v.ivaIncluido,
    total: Number(v.total) || 0,
    metodo: v.metodoPago || v.metodo || "No especificado",
    estadoPago: v.estadoPago || "Pagado",
    referencia: v.referenciaPago || v.referencia || null,
    estado: v.estado || "Confirmada",
    direccion: v.direccionEnvio || null,
  };
}

/**
 * Texto (HTML) con los datos para pagar en OXXO o por SPEI.
 * conCaja = true lo pinta con número grande (pantalla); false da texto simple (correo).
 */
export function textoReferencia(ref, total, conCaja = false) {
  if (!ref) return "";
  const vence = fechaLegible(ref.vence);
  if (ref.tipo === "SPEI") {
    const clabe = String(ref.clabe || "").replace(/(\d{3})(\d{3})(\d{11})(\d)/, "$1 $2 $3 $4");
    return conCaja
      ? `<strong>Paga por transferencia SPEI</strong>
         <span class="ref-numero">${esc(clabe)}</span>
         <div>CLABE interbancaria · Banco: <strong>${esc(ref.banco)}</strong></div>
         <div>Beneficiario: <strong>Bigotes y Patitas</strong></div>
         <div>Concepto: <strong>${esc(ref.concepto)}</strong></div>
         <div>Monto exacto: <strong>${formatearMoneda(total)}</strong></div>
         <div>Fecha límite: <strong>${esc(vence)}</strong></div>`
      : `Paga por SPEI a la CLABE ${clabe} (${ref.banco}), concepto ${ref.concepto}, monto ${formatearMoneda(total)}, antes del ${vence}.`;
  }
  if (ref.tipo === "OXXO") {
    const num = String(ref.referencia || "").replace(/(\d{4})(?=\d)/g, "$1 ");
    return conCaja
      ? `<strong>Paga en efectivo en OXXO</strong>
         <span class="ref-numero">${esc(num)}</span>
         <div>Dile al cajero que es un pago de <strong>OXXO Pay</strong> y dicta esta referencia.</div>
         <div>Monto exacto: <strong>${formatearMoneda(total)}</strong></div>
         <div>Fecha límite: <strong>${esc(vence)}</strong></div>`
      : `Paga en OXXO con la referencia ${num}, monto ${formatearMoneda(total)}, antes del ${vence}.`;
  }
  return "";
}

let promesaEmailJs = null;
function cargarEmailJs() {
  if (window.emailjs) return Promise.resolve(window.emailjs);
  if (!promesaEmailJs) {
    promesaEmailJs = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = URL_EMAILJS;
      s.onload = () => (window.emailjs ? resolve(window.emailjs) : reject(new Error("EmailJS no cargó.")));
      s.onerror = () => { promesaEmailJs = null; reject(new Error("No se pudo cargar EmailJS (revisa tu internet).")); };
      document.head.appendChild(s);
    });
  }
  return promesaEmailJs;
}

/** Envía el recibo al correo indicado. Lanza un error si falla o si EmailJS no está configurado. */
export async function enviarReciboPorCorreo(recibo, correoDestino) {
  if (!correoConfigurado()) {
    throw new Error("El envío de correos todavía no está configurado (faltan las claves de EmailJS en email-recibo.js).");
  }
  const correo = String(correoDestino || recibo.correo || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo)) throw new Error("No hay un correo válido para enviar el recibo.");

  const emailjs = await cargarEmailJs();
  const carpeta = window.location.href.replace(/[^/]*([?#].*)?$/, "");
  const parametros = {
    to_email: correo,
    to_name: recibo.cliente,
    folio: recibo.folio,
    fecha: recibo.fecha,
    productos: recibo.productos
      .map(p => `${p.cantidad} x ${p.nombre}  ${formatearMoneda(p.precio * p.cantidad)}`)
      .join("\n"),
    subtotal: formatearMoneda(recibo.subtotal),
    descuento: recibo.descuento > 0 ? `-${formatearMoneda(recibo.descuento)}` : "$0.00",
    envio: formatearMoneda(recibo.envio),
    iva_etiqueta: `${recibo.ivaIncluido ? "IVA incluido" : "IVA"} (${recibo.tasaIva}%)`,
    iva: formatearMoneda(recibo.iva),
    total: formatearMoneda(recibo.total),
    metodo_pago: recibo.metodo,
    estado_pago: recibo.estadoPago,
    referencia: textoReferencia(recibo.referencia, recibo.total, false),
    link_pedido: recibo.ventaId ? `${carpeta}factura.html?id=${encodeURIComponent(recibo.ventaId)}` : carpeta,
  };
  await emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templateId, parametros, { publicKey: EMAILJS_CONFIG.publicKey });
}
