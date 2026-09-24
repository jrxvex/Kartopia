/*
 * Prueba de carga de MindsPrint con k6 (https://k6.io, gratis).
 *
 * Simula usuarios reales: cada uno abre la app, carga su lista de páginas,
 * abre una y se queda un minuto "trabajando" en ella (la app consulta cada 5 s
 * si alguien la ha cambiado y guarda cada 15 s, como el autoguardado). El
 * número de usuarios a la vez sube por escalones hasta MAX_VUS.
 *
 * ── Antes de empezar ─────────────────────────────────────────────────────────
 * 1. Instala k6 (Windows):             winget install k6
 * 2. Crea una cuenta solo para pruebas en la app y, desde Admin → Usuarios,
 *    regálale Pro (así no choca con los límites de páginas del plan gratis).
 * 3. Inicia sesión con esa cuenta en el navegador y copia dos cookies
 *    (F12 → Aplicación → Cookies → https://mindsprint.uk):
 *       mp_session  y  mp_csrf
 * 4. Pon una llave de pruebas (mín. 24 caracteres) en Fly:
 *       fly secrets set LOADTEST_KEY="una-frase-larga-y-secreta-123" -a mindsprint
 *    (Fly reinicia la app al guardarla; espera ~1 minuto.)
 *
 * ── Ejecutar (PowerShell, desde la carpeta del proyecto) ─────────────────────
 *    k6 run -e SESSION=... -e CSRF=... -e KEY=una-frase-larga-y-secreta-123 `
 *           -e MAX_VUS=150 loadtest/mindsprint-k6.js
 *
 *    Mientras corre, mira Admin → Servidor: CPU, memoria, latencia de la BD y
 *    cuándo Fly enciende otra máquina (eso marca el límite de una sola).
 *
 * ── Al terminar ──────────────────────────────────────────────────────────────
 *    fly secrets unset LOADTEST_KEY -a mindsprint
 *    (El panel de admin avisa mientras la llave siga puesta.)
 *
 * Las páginas de prueba se crean al empezar y se mandan a la papelera al final.
 * El texto que se guarda tiene siempre la misma longitud, así que no llena el
 * historial de versiones.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const BASE = (__ENV.BASE || 'https://mindsprint.uk').replace(/\/$/, '');
const SESSION = __ENV.SESSION || '';
const CSRF = __ENV.CSRF || '';
const KEY = __ENV.KEY || '';
const MAX_VUS = parseInt(__ENV.MAX_VUS || '150', 10);
const TEST_PAGES = 10;

if (!SESSION || !CSRF || !KEY) {
  throw new Error('Faltan SESSION, CSRF o KEY. Mira las instrucciones al principio del fichero.');
}

const tVersion = new Trend('t_consulta_colaboracion', true);
const tSave = new Trend('t_guardar', true);
const tOpen = new Trend('t_abrir_pagina', true);

export const options = {
  scenarios: {
    usuarios: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: Math.min(20, MAX_VUS) },
        { duration: '2m', target: Math.min(50, MAX_VUS) },
        { duration: '2m', target: Math.min(100, MAX_VUS) },
        { duration: '2m', target: MAX_VUS },
        { duration: '3m', target: MAX_VUS },   // mantener el máximo
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],             // menos del 1 % de errores
    t_consulta_colaboracion: ['p(95)<500'],     // la consulta de cada 5 s, rápida
    t_guardar: ['p(95)<1000'],
    t_abrir_pagina: ['p(95)<1500'],
  },
};

function params(tag, extraHeaders) {
  return {
    headers: Object.assign({
      Cookie: `mp_session=${SESSION}; mp_csrf=${CSRF}`,
      'X-CSRF-Token': CSRF,
      'X-Loadtest-Key': KEY,
      'Content-Type': 'application/json',
    }, extraHeaders || {}),
    tags: { name: tag },
    redirects: 0,
  };
}

export function setup() {
  const ids = [];
  for (let i = 0; i < TEST_PAGES; i++) {
    const r = http.post(`${BASE}/api/pages`, JSON.stringify({
      title: `Prueba de carga ${i + 1}`, page_type: 'note', icon: '🧪',
    }), params('crear página'));
    if (r.status !== 200 && r.status !== 201) {
      throw new Error(`No se pudo crear la página de prueba (${r.status}): ${r.body}. ` +
        '¿Cookies caducadas, llave mal puesta o cuenta sin Pro?');
    }
    ids.push(r.json('id'));
  }
  return { ids };
}

export default function (data) {
  const pageId = data.ids[(__VU - 1) % data.ids.length];

  // Entrar en la app
  const app = http.get(`${BASE}/app`, params('app (HTML)'));
  check(app, { 'app 200': (r) => r.status === 200 });
  http.get(`${BASE}/api/pages`, params('lista de páginas'));
  http.get(`${BASE}/api/notifications/count`, params('notificaciones'));

  // Abrir una página
  const open = http.get(`${BASE}/api/pages/${pageId}`, params('abrir página'));
  tOpen.add(open.timings.duration);
  check(open, { 'abrir 200': (r) => r.status === 200 });

  // Un minuto trabajando en ella
  for (let i = 1; i <= 12; i++) {
    sleep(5);
    const v = http.get(`${BASE}/api/pages/${pageId}/version`, params('consulta colaboración'));
    tVersion.add(v.timings.duration);
    check(v, { 'version 200': (r) => r.status === 200 });
    if (i % 3 === 0) {
      const stamp = String(Date.now()).padStart(16, '0');   // longitud fija
      const s = http.put(`${BASE}/api/pages/${pageId}`, JSON.stringify({
        title: `Prueba de carga`, icon: '🧪', content: `<p>Texto de prueba ${stamp} VU ${String(__VU).padStart(4, '0')}</p>`,
      }), params('guardar'));
      tSave.add(s.timings.duration);
      check(s, { 'guardar 200': (r) => r.status === 200 });
    }
  }
}

export function teardown(data) {
  for (const id of data.ids) {
    http.del(`${BASE}/api/pages/${id}`, null, params('borrar página'));
  }
}
