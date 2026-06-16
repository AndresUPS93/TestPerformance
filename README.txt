# TestPerformance — Prueba de carga: Login

## Herramienta
k6 (https://k6.io) — se escribe en JavaScript, no requiere instalar Node.js.

## Instalación de k6 (Windows)
Opción A — Chocolatey:
  choco install k6

Opción B — winget:
  winget install k6 --source winget

Opción C — descarga directa:
  https://github.com/grafana/k6/releases/latest

## Estructura del proyecto
TestPerformance/
├── data/
│   └── users.csv        ← credenciales parametrizadas
└── src/
    └── load_test.js     ← script de la prueba

## Cómo ejecutar
Desde la raíz del proyecto (c:\TestPerformance):

  k6 run src/load_test.js

Para guardar el reporte en JSON:

  k6 run --out json=results.json src/load_test.js

## Escenario
  - Rampa de 0 → 25 TPS en 60 s  (supera el mínimo de 20 TPS requerido)
  - Carga sostenida de 25 TPS por 60 s
  - Bajada en 10 s

## Criterios de aceptación (thresholds)
  ✔ p95 del tiempo de respuesta < 1 500 ms
  ✔ Tasa de error < 3 %

Si algún threshold se incumple, k6 devuelve exit code 1 (fallo).
