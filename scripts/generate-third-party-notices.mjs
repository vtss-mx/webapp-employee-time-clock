// Genera avisos desde la ruta física exacta del árbol de producción y falla cerrado.
// Los textos originales no se traducen, recortan ni sustituyen por licencias de otro paquete.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LICENSE_FILE = /^(licen[cs]e|notice|copying)(?:[._-]|$)/i;
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const declaredLicense = (manifest) => typeof manifest.license === 'string' ? manifest.license : manifest.license?.type;
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const origin = (manifest) => String(manifest.repository?.url ?? manifest.repository ?? manifest.homepage ?? '').replace(/^git\+/, '').replace(/\.git$/, '');

const HEADER = `AVISOS DE TERCEROS — Employee Time Clock (aplicación web)
=========================================================

Qué es este archivo y por qué existe
------------------------------------
La aplicación web que se ejecuta en su navegador incorpora componentes de software libre de terceros.
Sus licencias (MIT, Apache 2.0, ISC y 0BSD) permiten ese uso, pero exigen que el aviso de derechos de
autor y el texto de la licencia viajen CON cada copia del software. El paquete que su navegador
descarga pasa por un minificador que elimina todos los comentarios, y con ellos esos avisos: este
archivo los restituye.

Alcance: los componentes que forman parte del paquete de producción, es decir los que realmente se
envían al navegador. Las herramientas que solo se usan para desarrollar, revisar o construir el
proyecto no se distribuyen y por eso no aparecen aquí.

Por qué los textos están en inglés
----------------------------------
Una licencia es un documento legal y se reproduce VERBATIM, tal como la escribió quien tiene los
derechos. Traducirla la invalidaría. El único texto nuestro es esta introducción. No es una mezcla de
idiomas por descuido: es un anexo legal, no un texto de la interfaz.

Generado por scripts/generate-third-party-notices.mjs. No se edita a mano.


MODELO DE INTELIGENCIA ARTIFICIAL QUE SE EJECUTA EN SU NAVEGADOR
================================================================

MediaPipe Face Detector — BlazeFace (short range)
Archivo: blaze_face_short_range.tflite
Licencia: Apache License 2.0
Autor: Google LLC
Procedencia: https://ai.google.dev/edge/mediapipe/solutions/vision/face_detector

Se usa ÚNICAMENTE para guiar la captura de la cámara (encuadre y encaje del rostro) dentro de su
propio dispositivo: la imagen no sale de él por este modelo. La detección que cuenta para verificar
una identidad la vuelve a hacer el servidor con otro modelo. La ficha del modelo declara
imágenes obtenidas con consentimiento; la revisión de sus derechos y alcance se mantiene separada
del paquete de código. Este archivo reproduce avisos y no constituye una aprobación comercial.

El texto de la Apache License 2.0 se reproduce más abajo, con el paquete @mediapipe/tasks-vision.
Los derechos de fuentes, recursos, pesos y datos no se deducen de licencias de bibliotecas.


COMPONENTES DEL PAQUETE DE PRODUCCIÓN
=====================================
`;


/** npm publica rutas físicas con --long; un error de resolución invalida toda la evidencia. */
export const productionTree = (projectRoot, run = execFileSync) => JSON.parse(run('npm', ['ls', '--omit=dev', '--all', '--long', '--json'], {
  cwd: projectRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
}));

/** No colapsa versiones ni recupera silenciosamente un paquete raíz para uno anidado. */
export const collectProduction = (tree, projectRoot) => {
  const packages = new Map();
  const walk = (node) => {
    if (node.problems?.length || node.invalid || node.missing || node.extraneous || node.error) throw new Error('PRODUCTION_TREE_INVALID');
    for (const [name, info] of Object.entries(node.dependencies ?? {})) {
      if (!info.version || !info.path) throw new Error(`PACKAGE_IDENTITY_MISSING: ${name}`);
      const path = realpathSync(info.path);
      const location = relative(realpathSync(projectRoot), path);
      if (location === '..' || location.startsWith('../') || isAbsolute(location)) throw new Error(`PACKAGE_PATH_OUTSIDE_PROJECT: ${name}`);
      const entry = { name, version: info.version, path, location: location.replaceAll('\\', '/') };
      const previous = packages.get(path);
      if (previous && (previous.name !== name || previous.version !== entry.version)) throw new Error(`PACKAGE_IDENTITY_CONFLICT: ${name}`);
      packages.set(path, entry);
      walk(info);
    }
  };
  walk(tree);
  return [...packages.values()].sort((a, b) => compare(a.name, b.name) || compare(a.version, b.version) || compare(a.location, b.location));
};

/** Copias legales fijadas a versión y fuentes de atribución verificadas por SHA-256. */
const externalTexts = (entry, manifest, projectRoot, evidence) => {
  const proof = evidence[`${entry.name}@${entry.version}`];
  if (!proof || proof.name !== entry.name || proof.version !== entry.version || proof.declaredLicense !== declaredLicense(manifest)) throw new Error(`LICENSE_EVIDENCE_MISSING: ${entry.name}@${entry.version}`);
  if (!proof.files?.length || !proof.attributions?.length) throw new Error(`LEGAL_TEXTS_INCOMPLETE: ${entry.name}`);
  const texts = proof.files.map((file) => {
    if (!file.url?.startsWith('https://')) throw new Error(`LICENSE_ORIGIN_MISSING: ${entry.name}`);
    const legalRoot = resolve(projectRoot, 'scripts', 'third-party-licenses');
    const legalPath = resolve(legalRoot, file.file);
    if (!legalPath.startsWith(legalRoot + '/')) throw new Error(`LICENSE_PATH_INVALID: ${entry.name}`);
    const bytes = readFileSync(legalPath);
    if (!bytes.length || sha256(bytes) !== file.sha256) throw new Error(`LICENSE_HASH_MISMATCH: ${entry.name}`);
    return { label: file.url, text: bytes.toString('utf8'), sha256: file.sha256 };
  });
  for (const source of proof.attributions) {
    const sourcePath = resolve(entry.path, source.file);
    if (!sourcePath.startsWith(entry.path + '/')) throw new Error(`ATTRIBUTION_PATH_INVALID: ${entry.name}`);
    const bytes = readFileSync(sourcePath);
    if (sha256(bytes) !== source.sha256) throw new Error(`ATTRIBUTION_HASH_MISMATCH: ${entry.name}`);
    const original = source.file.endsWith('.map') ? JSON.parse(bytes.toString('utf8')).sourcesContent.join('\n') : bytes.toString('utf8');
    if (!source.comments?.length || source.comments.some((text) => !text.length || !original.includes(text))) throw new Error(`ATTRIBUTION_NOT_ORIGINAL: ${entry.name}`);
    for (const text of source.comments) texts.push({ label: `Atribución original: ${source.file}`, text, sha256: sha256(text) });
  }
  return texts;
};

/** Valida árbol, manifiestos, lock y textos ANTES de escribir; conserva bytes legales exactos. */
export const renderNotices = (projectRoot, tree, evidence = {}) => {
  const lock = JSON.parse(readFileSync(join(projectRoot, 'package-lock.json'), 'utf8'));
  const components = [];
  const blocks = [];
  for (const entry of collectProduction(tree, projectRoot)) {
    const manifest = JSON.parse(readFileSync(join(entry.path, 'package.json'), 'utf8'));
    const locked = lock.packages?.[entry.location];
    const license = declaredLicense(manifest);
    if (manifest.name !== entry.name || manifest.version !== entry.version || !locked || locked.version !== entry.version || locked.link || (locked.license && locked.license !== license)) throw new Error(`PACKAGE_LOCK_MISMATCH: ${entry.location}`);
    if (!license) throw new Error(`LICENSE_DECLARATION_MISSING: ${entry.name}`);
    const files = readdirSync(entry.path).filter((file) => LICENSE_FILE.test(file) && statSync(join(entry.path, file)).isFile()).sort(compare);
    let texts = files.map((file) => {
      const bytes = readFileSync(join(entry.path, file));
      if (!bytes.length) throw new Error(`LEGAL_TEXT_EMPTY: ${entry.name}/${file}`);
      return { label: file, text: bytes.toString('utf8'), sha256: sha256(bytes) };
    });
    if (!files.some((file) => /^(licen[cs]e|copying)/i.test(file))) {
      // Un NOTICE solo no reemplaza LICENSE. Una fuente externa aporta ambos y sus copyrights.
      texts = [...texts, ...externalTexts(entry, manifest, projectRoot, evidence)];
    }
    const rule = '='.repeat(100);
    blocks.push(`${rule}\n${entry.name}  ${entry.version}\nRuta instalada: ${entry.location}\nLicencia declarada: ${license}\nOrigen: ${origin(manifest) || '(no declarado)'}\n${rule}\n\n` + texts.map(({ label, text, sha256: hash }) => `Documento: ${label}\nSHA-256: ${hash}\n\n${text}\n`).join('\n'));
    components.push({ name: entry.name, version: entry.version, path: entry.location, licenseDeclared: license, integrity: locked.integrity ?? null, legalTexts: texts.map(({ label, sha256: hash }) => ({ label, sha256: hash })) });
  }
  return { text: HEADER + '\n' + blocks.join('\n'), components };
};

export const generateNotices = (projectRoot = root, options = {}) => {
  const evidence = JSON.parse(readFileSync(join(projectRoot, 'scripts', 'third-party-license-evidence.json'), 'utf8'));
  const result = renderNotices(projectRoot, options.tree ?? productionTree(projectRoot), evidence);
  const out = join(projectRoot, 'public', 'third-party-notices.txt');
  const check = options.check ?? process.argv.includes('--check');
  if (check) {
    if (!existsSync(out) || readFileSync(out, 'utf8') !== result.text) throw new Error('NOTICES_OUT_OF_DATE');
  } else writeFileSync(out, result.text);
  console.log(`[avisos] ${result.components.length} componentes verificados; ${check ? 'sin escribir' : 'avisos generados'}`);
  return result;
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) generateNotices();
