#!/usr/bin/env node
/**
 * Cadena de suministro del frontend (brecha A3 de
 * `backend-employee-time-clock/docs/rd/certificaciones-seguridad-2026-10-08.md`; SOC 2 CC7.1 y CC9.2,
 * ISO/IEC 27001 A.8.8, A.8.9 y A.5.21):
 *
 *   SBOM .......... inventario CycloneDX de lo que se ENVÍA al navegador, generado con `npm sbom` (viene con npm:
 *                   ninguna dependencia nueva, regla 6) y conservado POR VERSIÓN en `reports/sbom/`. Es la
 *                   evidencia que pide un auditor: «qué código de terceros corre en el navegador de la persona».
 *   npm audit ..... vulnerabilidades conocidas. CUALQUIERA falla la compuerta, con el mismo criterio que
 *                   `pip-audit` del backend (`scripts/quality.py`: una sola vulnerabilidad = fail): una
 *                   «moderada» de hoy es la crítica de la semana que viene, y la regla 11 obliga a estar al día.
 *                   Se mide en dos alcances para saber a qué expone cada una: lo que se envía al navegador
 *                   (`--omit=dev`, el equivalente exacto de `pip-audit -r requirements.txt`) y además la cadena
 *                   de construcción (el árbol completo, que también es un vector de cadena de suministro).
 *                   Sin red no se inventa un resultado: queda como advertencia, igual que en el backend.
 *
 * Se usa desde la compuerta (`node scripts/quality.mjs`, que lo pinta en su tabla) y a mano con
 * `npm run supply-chain`, que imprime lo mismo y termina en 1 si algo falla.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('..', import.meta.url).pathname;
/** Carpeta de evidencia: se conserva (no es un reporte desechable como coverage/). */
const SBOM_DIR = join(root, 'reports', 'sbom');

function npm(args) {
  const res = spawnSync('npm', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, shell: process.platform === 'win32' });
  return { code: res.status ?? 1, out: `${res.stdout ?? ''}`, err: `${res.stderr ?? ''}` };
}

/** La última línea con texto de una salida (el motivo de la falla, sin el ruido de npm). */
function lastLine(text) {
  const lines = text.trim().split('\n').filter((line) => line.trim());
  return lines.length ? lines[lines.length - 1].trim().slice(0, 160) : 'sin detalle';
}

/**
 * Vulnerabilidades por alcance. Devuelve `{ status, detail }` con el contrato de `record()` de la compuerta:
 * 'fail' con una sola vulnerabilidad (criterio de pip-audit), 'warn' si no se pudo consultar el registro.
 */
export function auditDependencies() {
  const scopes = [
    { label: 'navegador', args: ['--omit=dev'] },
    { label: 'construcción', args: [] },
  ];
  const counts = [];
  for (const scope of scopes) {
    const { out, err } = npm(['audit', '--json', ...scope.args]);
    let report;
    try {
      report = JSON.parse(out);
    } catch {
      return { status: 'warn', detail: `no se pudo consultar (¿sin red?): ${lastLine(err || out)}` };
    }
    const vulnerabilities = report?.metadata?.vulnerabilities;
    if (report?.error || !vulnerabilities) {
      return { status: 'warn', detail: `no se pudo consultar (¿sin red?): ${report?.error?.summary ?? lastLine(err || out)}` };
    }
    // `total` ya viene en el reporte; las demás llaves son el desglose por severidad.
    const bySeverity = Object.entries(vulnerabilities).filter(([name]) => name !== 'total' && vulnerabilities[name]);
    counts.push({ ...scope, total: vulnerabilities.total ?? 0, bySeverity });
  }
  const worst = counts.filter((scope) => scope.total > 0);
  if (!worst.length) return { status: 'ok', detail: 'sin vulnerabilidades conocidas (lo que se envía al navegador y la cadena de construcción)' };
  return {
    status: 'fail',
    detail: worst.map((scope) => `${scope.label}: ${scope.total} (${scope.bySeverity.map(([name, value]) => `${name} ${value}`).join(', ')})`).join(' · '),
  };
}

/**
 * SBOM CycloneDX de lo que se envía al navegador, en `reports/sbom/frontend-<versión>.cyclonedx.json`.
 * Solo las dependencias de producción: describen el artefacto que se despliega. Las de desarrollo no viajan al
 * navegador y su riesgo lo cubre `auditDependencies()` sobre el árbol completo.
 */
export function writeSbom() {
  const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const { code, out, err } = npm(['sbom', '--sbom-format', 'cyclonedx', '--sbom-type', 'application', '--omit=dev']);
  if (code !== 0) return { status: 'fail', detail: `npm sbom falló: ${lastLine(err || out)}` };
  let bom;
  try {
    bom = JSON.parse(out);
  } catch {
    return { status: 'fail', detail: `npm sbom no devolvió JSON: ${lastLine(out || err)}` };
  }
  if (bom.bomFormat !== 'CycloneDX' || !Array.isArray(bom.components)) {
    return { status: 'fail', detail: 'la salida de npm sbom no es un SBOM CycloneDX con componentes' };
  }
  mkdirSync(SBOM_DIR, { recursive: true });
  const file = join(SBOM_DIR, `frontend-${version}.cyclonedx.json`);
  writeFileSync(file, `${JSON.stringify(bom, null, 2)}\n`);
  return { status: 'ok', detail: `${bom.components.length} componentes · CycloneDX ${bom.specVersion} → ${relative(root, file)}` };
}

// Ejecutado a mano (`npm run supply-chain`): imprime los dos resultados y falla si alguno falla. Importado desde
// la compuerta, no imprime nada por su cuenta (`quality.mjs` lo pinta en su tabla).
function invokedDirectly() {
  try {
    return process.argv[1] !== undefined && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false; // argv[1] no es un archivo (node -e, un REPL): entonces se está importando
  }
}
if (invokedDirectly()) {
  const icon = { ok: '✔', warn: '▲', fail: '✖' };
  const results = [
    ['SBOM (CycloneDX)', writeSbom()],
    ['Vulnerabilidades (npm audit)', auditDependencies()],
  ];
  for (const [name, result] of results) console.log(`${icon[result.status]} ${name.padEnd(28)} ${result.detail}`);
  process.exit(results.some(([, result]) => result.status === 'fail') ? 1 : 0);
}
