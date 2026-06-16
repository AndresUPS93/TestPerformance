import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Rate } from 'k6/metrics';

// ── Métrica personalizada para tasa de errores ──────────────────────────────
const errorRate = new Rate('error_rate');

// ── Carga de datos desde el CSV (se lee una sola vez, compartido entre VUs) ──
const users = new SharedArray('users', function () {
  // Parseo manual del CSV: omite la cabecera y construye objetos
  const rows = open('../data/users.csv').trim().split('\n');
  return rows.slice(1).map((row) => {
    const [username, password] = row.split(',');
    return { username: username.trim(), password: password.trim() };
  });
});

// ── Configuración del escenario ─────────────────────────────────────────────
// Para alcanzar 20 TPS con un tiempo de respuesta ~300ms se necesitan ~6 VUs,
// pero usamos rampa progresiva y llegamos a 25 TPS para tener margen.
export const options = {
  scenarios: {
    login_load: {
      executor: 'ramping-arrival-rate', // controla TPS directamente
      startRate: 1,                     // TPS inicial
      timeUnit: '1s',
      preAllocatedVUs: 50,              // VUs en espera
      maxVUs: 100,
      stages: [
        { target: 10, duration: '30s' }, // rampa subiendo a 10 TPS
        { target: 25, duration: '30s' }, // sube a 25 TPS (supera los 20 requeridos)
        { target: 25, duration: '60s' }, // mantiene 25 TPS por 1 minuto
        { target: 0,  duration: '10s' }, // bajada
      ],
    },
  },

  // ── Umbrales de aceptación ────────────────────────────────────────────────
  thresholds: {
    // Tiempo de respuesta: el 95% de las peticiones debe responder en < 1.5 s
    http_req_duration: ['p(95)<1500'],
    // Tasa de error: debe ser menor al 3 %
    error_rate: ['rate<0.03'],
  },
};

// ── Función principal (ejecutada por cada VU en cada iteración) ─────────────
export default function () {
  // Selecciona un usuario del CSV de forma circular según el índice del VU
  const user = users[__VU % users.length];

  const url = 'https://fakestoreapi.com/auth/login';

  const payload = JSON.stringify({
    username: user.username,
    password: user.password,
  });

  const params = {
    headers: { 'Content-Type': 'application/json' },
    timeout: '60s', // equivalente al --max-time 60 del curl
  };

  // ── Petición POST ─────────────────────────────────────────────────────────
  const res = http.post(url, payload, params);

  // ── Validaciones ──────────────────────────────────────────────────────────
  const success = check(res, {
    'status es 201':              (r) => r.status === 201,
    'respuesta contiene token':   (r) => r.json('token') !== undefined,
    'tiempo de respuesta < 1.5s': (r) => r.timings.duration < 1500,
  });

  // Registra el resultado en la métrica de errores (true = ok, false = error)
  errorRate.add(!success);

  sleep(0); // sin pausa adicional; el rate lo controla el executor
}
