#!/usr/bin/env node
/**
 * Detector de anomalías del frontend (npm run quality).
 *
 *   Tipado ............ tsc estricto + ESLint (any explícito/implícito, operaciones inseguras)
 *   Calidad ........... ESLint (APIs obsoletas, promesas sin manejar, hooks, complejidad)
 *   Duplicidad ........ jscpd (umbral en .jscpd.json)
 *   Ciclos ............ importaciones circulares entre módulos de src/ (API del compilador de
 *                       TypeScript; no cuentan `import type` ni las cargas diferidas `import()`)
 *   Pruebas/coverage .. vitest + umbrales mínimos (vitest.config.ts); cualquier
 *                       DeprecationWarning durante las pruebas también falla
 *   Dependencias ...... npm outdated (desactualizadas), registro npm (versiones deprecadas) y
 *                       npm audit (vulnerabilidades)
 *   Marcadores ........ @ts-ignore, eslint-disable, TODO/FIXME, console.log en el código
 *
 * Opciones:  --strict  también falla con dependencias desactualizadas o marcadores.
 *            --skip=coverage,deps   omite verificaciones.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

const args = process.argv.slice(2);
const strict = args.includes('--strict');
const skip = new Set((args.find((a) => a.startsWith('--skip=')) ?? '').replace('--skip=', '').split(',').filter(Boolean));
const root = new URL('..', import.meta.url).pathname;
const color = (code, text) => (process.stdout.isTTY ? `\x1b[${code}m${text}\x1b[0m` : text);
const results = [];

function run(cmd, cmdArgs) {
  const res = spawnSync(cmd, cmdArgs, { cwd: root, encoding: 'utf8', shell: process.platform === 'win32' });
  return { code: res.status ?? 1, out: `${res.stdout ?? ''}${res.stderr ?? ''}` };
}

function record(name, status, detail) {
  results.push({ name, status, detail });
  const icon = status === 'ok' ? color(32, '✔') : status === 'warn' ? color(33, '▲') : color(31, '✖');
  console.log(`${icon} ${name.padEnd(28)} ${detail}`);
}

function check(name, cmd, cmdArgs, summarize) {
  if (skip.has(name.split(' ')[0].toLowerCase())) return record(name, 'warn', 'omitido');
  const { code, out } = run(cmd, cmdArgs);
  const detail = summarize(out, code);
  record(name, code === 0 ? 'ok' : 'fail', detail);
  if (code !== 0) console.log(color(90, out.trim().split('\n').slice(-25).join('\n')));
  return out;
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

/** Importaciones de valor (en tiempo de ejecución) de un archivo: sin `import type` ni `import()`. */
function runtimeImports(file, options) {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const typeOnly = (clause) =>
    clause.isTypeOnly ||
    (!clause.name && clause.namedBindings && ts.isNamedImports(clause.namedBindings) && clause.namedBindings.elements.length > 0 && clause.namedBindings.elements.every((e) => e.isTypeOnly));
  return source.statements.flatMap((stmt) => {
    const isImport = ts.isImportDeclaration(stmt) && !(stmt.importClause && typeOnly(stmt.importClause));
    const isReexport = ts.isExportDeclaration(stmt) && !stmt.isTypeOnly && stmt.moduleSpecifier;
    if (!isImport && !isReexport) return [];
    const resolved = ts.resolveModuleName(stmt.moduleSpecifier.text, file, options, ts.sys).resolvedModule;
    return resolved && !resolved.isExternalLibraryImport ? [resolved.resolvedFileName] : [];
  });
}

/** Ciclos de importación entre módulos de src/ (componentes fuertemente conexos de Tarjan). */
function importCycles() {
  const { config } = ts.readConfigFile(join(root, 'tsconfig.app.json'), ts.sys.readFile);
  const { options } = ts.parseJsonConfigFileContent(config, ts.sys, root);
  const graph = new Map(walk(join(root, 'src')).map((file) => [file, runtimeImports(file, options)]));
  let index = 0;
  const meta = new Map();
  const stack = [];
  const cycles = [];
  const visit = (node) => {
    meta.set(node, { index, low: index, onStack: true });
    index += 1;
    stack.push(node);
    for (const next of graph.get(node) ?? []) {
      if (!graph.has(next)) continue;
      if (!meta.has(next)) visit(next);
      if (meta.get(next).onStack) meta.get(node).low = Math.min(meta.get(node).low, meta.get(next).low);
    }
    if (meta.get(node).low !== meta.get(node).index) return;
    const component = [];
    let member;
    do {
      member = stack.pop();
      meta.get(member).onStack = false;
      component.push(relative(root, member));
    } while (member !== node);
    if (component.length > 1 || graph.get(node).includes(node)) cycles.push(component);
  };
  for (const node of graph.keys()) if (!meta.has(node)) visit(node);
  return cycles;
}

/** Dependencias directas cuya versión instalada está marcada como deprecada en el registro de npm. */
async function deprecatedPackages() {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const names = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
  const checks = names.map(async (name) => {
    const { version } = JSON.parse(readFileSync(join(root, 'node_modules', name, 'package.json'), 'utf8'));
    const response = await fetch(`https://registry.npmjs.org/${name.replace('/', '%2F')}/${version}`, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
    const manifest = await response.json();
    return manifest.deprecated ? `${name}@${version}: ${manifest.deprecated}` : null;
  });
  return (await Promise.all(checks)).filter(Boolean);
}

console.log(color(1, '\nDetección de anomalías — frontend\n'));

check('Tipado (tsc estricto)', 'npx', ['tsc', '-b', '--noEmit'], (out, code) =>
  code === 0 ? 'sin errores de tipos' : `${(out.match(/error TS/g) ?? []).length} errores de tipos`,
);

check('Lint (tipado/obsoletos)', 'npx', ['eslint', '.', '--max-warnings=0', '-f', 'stylish'], (out, code) => {
  if (code === 0) return 'sin problemas';
  const m = out.match(/(\d+) problems? \((\d+) errors?, (\d+) warnings?\)/);
  return m ? `${m[2]} errores, ${m[3]} advertencias` : 'falló';
});

check('Duplicidad (jscpd)', 'npx', ['jscpd', '--config', '.jscpd.json', '--silent', 'src'], (out) => {
  const m = out.match(/Found (\d+) clones/) ?? out.match(/Duplications detection: Found (\d+)/);
  const pct = out.match(/Total:.*?(\d+(?:\.\d+)?)%/);
  return `${m ? m[1] : 0} clones${pct ? ` (${pct[1]}% duplicado)` : ''}`;
});

if (skip.has('cycles')) record('Dependencias circulares', 'warn', 'omitido');
else {
  const cycles = importCycles();
  record('Dependencias circulares', cycles.length ? 'fail' : 'ok', cycles.length ? `${cycles.length} ciclos` : 'sin ciclos de importación');
  for (const cycle of cycles) console.log(color(90, `   ${cycle.join(' → ')}`));
}

const testOutput = check('Coverage (vitest)', 'npx', ['vitest', 'run', '--coverage', '--coverage.reporter=text-summary'], (out, code) => {
  const tests = out.match(/Tests\s+(\d+) passed/);
  const lines = out.match(/Lines\s+:\s+([\d.]+)%/);
  const branches = out.match(/Branches\s+:\s+([\d.]+)%/);
  const base = `${tests ? tests[1] : '?'} pruebas, líneas ${lines ? lines[1] : '?'}%, ramas ${branches ? branches[1] : '?'}%`;
  return code === 0 ? base : `${base} — pruebas fallidas o coverage bajo el umbral`;
});
if (testOutput !== undefined) {
  const deprecations = [...new Set(testOutput.match(/\w*DeprecationWarning: [^\n]+/g) ?? [])];
  record('Deprecaciones en ejecución', deprecations.length ? 'fail' : 'ok', deprecations.length ? `${deprecations.length}: ${deprecations[0].slice(0, 110)}` : 'ninguna');
}

// Dependencias desactualizadas y vulnerables.
if (!skip.has('deps')) {
  const outdated = run('npm', ['outdated', '--json']);
  let list = {};
  try {
    list = JSON.parse(outdated.out || '{}');
  } catch {
    list = {};
  }
  const names = Object.keys(list);
  const majors = names.filter((n) => String(list[n].latest).split('.')[0] !== String(list[n].current ?? list[n].wanted).split('.')[0]);
  record(
    'Dependencias desactualizadas',
    names.length === 0 ? 'ok' : strict ? 'fail' : 'warn',
    names.length === 0 ? 'todas al día' : `${names.length} (${majors.length} con versión mayor nueva): ${names.slice(0, 8).join(', ')}${names.length > 8 ? '…' : ''}`,
  );

  try {
    const deprecated = await deprecatedPackages();
    record('Librerías deprecadas (npm)', deprecated.length ? 'fail' : 'ok', deprecated.length ? deprecated.slice(0, 3).join('; ') : 'ninguna deprecada');
  } catch (error) {
    record('Librerías deprecadas (npm)', 'warn', `no se pudo consultar el registro (${error.message})`);
  }

  const audit = run('npm', ['audit', '--json']);
  let vulns = {};
  try {
    vulns = JSON.parse(audit.out || '{}').metadata?.vulnerabilities ?? {};
  } catch {
    vulns = {};
  }
  const serious = (vulns.high ?? 0) + (vulns.critical ?? 0);
  const total = Object.values(vulns).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0) - (vulns.total ?? 0);
  record('Vulnerabilidades (npm audit)', serious > 0 ? 'fail' : total > 0 ? 'warn' : 'ok', total > 0 ? JSON.stringify(vulns) : 'sin vulnerabilidades');
}

// Marcadores que suelen ocultar deuda técnica o tipado débil.
const markers = { '@ts-ignore/@ts-expect-error': /@ts-(ignore|expect-error)/, 'eslint-disable': /eslint-disable/, 'TODO/FIXME': /\b(TODO|FIXME|HACK)\b/, 'console.log': /console\.log\(/, ': any': /:\s*any\b|as any\b/ };
const found = Object.fromEntries(Object.keys(markers).map((k) => [k, []]));
for (const file of walk(join(root, 'src'))) {
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      for (const [key, re] of Object.entries(markers)) if (re.test(line)) found[key].push(`${relative(root, file)}:${i + 1}`);
    });
}
const markerCount = Object.values(found).reduce((a, b) => a + b.length, 0);
record(
  'Marcadores en el código',
  markerCount === 0 ? 'ok' : strict ? 'fail' : 'warn',
  Object.entries(found)
    .map(([k, v]) => `${k}: ${v.length}`)
    .join(' · '),
);
for (const [key, list] of Object.entries(found)) if (list.length) console.log(color(90, `   ${key}: ${list.slice(0, 5).join(', ')}${list.length > 5 ? '…' : ''}`));

const failed = results.filter((r) => r.status === 'fail');
const warned = results.filter((r) => r.status === 'warn');
console.log(
  `\n${failed.length ? color(31, `✖ ${failed.length} verificación(es) fallida(s)`) : color(32, '✔ Sin anomalías bloqueantes')}` +
    (warned.length ? color(33, ` · ${warned.length} advertencia(s)`) : '') +
    '\nReportes: coverage/index.html (coverage) · coverage/jscpd/jscpd-report.json (duplicidad)\n',
);
process.exit(failed.length ? 1 : 0);
