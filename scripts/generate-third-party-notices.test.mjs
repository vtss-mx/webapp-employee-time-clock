// Verifica identidad física, textos originales y bloqueo sin sobrescribir evidencia válida.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { collectProduction, productionTree, renderNotices, generateNotices } from './generate-third-party-notices.mjs';

const hash = (text) => createHash('sha256').update(text).digest('hex');
const fixture = (fn) => {
  const root = mkdtempSync(join(tmpdir(), 'timeclock-notices-'));
  for (const dir of ['public', 'scripts/third-party-licenses', 'node_modules']) mkdirSync(join(root, dir), { recursive: true });
  const tree = { dependencies: {} };
  const lock = { packages: {} };
  const add = (name, version, location = `node_modules/${name}`, license = 'MIT', files = { LICENSE: 'Copyright Original\r\nMIT original text\n\n' }) => {
    const path = join(root, location); mkdirSync(path, { recursive: true });
    writeFileSync(join(path, 'package.json'), JSON.stringify({ name, version, license, repository: { url: 'git+https://example.invalid/source.git' } }));
    for (const [file, text] of Object.entries(files)) writeFileSync(join(path, file), text);
    lock.packages[location] = { version, license, integrity: 'sha512-test' };
    return { version, path };
  };
  tree.dependencies['pkg-a'] = add('pkg-a', '1.0.0');
  const save = () => { writeFileSync(join(root, 'package-lock.json'), JSON.stringify(lock)); writeFileSync(join(root, 'scripts/third-party-license-evidence.json'), '{}'); };
  save();
  try { fn({ root, tree, lock, add, save }); } finally { rmSync(root, { recursive: true, force: true }); }
};
const failure = (setup, pattern) => fixture((f) => { setup(f); assert.throws(() => renderNotices(f.root, f.tree), pattern); });

test('conserva dos versiones anidadas y los bytes exactos LICENSE y NOTICE', () => fixture((f) => {
  f.tree.dependencies['pkg-a'].dependencies = { 'pkg-a': f.add('pkg-a', '2.0.0', 'node_modules/pkg-a/node_modules/pkg-a', 'Apache-2.0', { LICENSE: '  Apache ORIGINAL\r\n\n', NOTICE: 'Copyright Third Party\n' }) };
  f.save(); const result = renderNotices(f.root, f.tree);
  assert.equal(result.components.length, 2);
  assert.deepEqual(result.components.map((r) => r.version), ['1.0.0', '2.0.0']);
  for (const text of ['Copyright Original\r\nMIT original text\n\n', '  Apache ORIGINAL\r\n\n', 'Copyright Third Party\n']) assert.ok(result.text.includes(text));
  assert.ok(result.text.includes('node_modules/pkg-a/node_modules/pkg-a'));
}));
test('deduplica solo la misma ruta y rechaza identidad contradictoria', () => fixture((f) => {
  f.tree.dependencies['pkg-a'].dependencies = { 'pkg-a': f.tree.dependencies['pkg-a'] };
  // JSON de npm no es cíclico: comparte identidad, no objeto con hijos infinitos.
  f.tree.dependencies['pkg-a'].dependencies['pkg-a'] = { ...f.tree.dependencies['pkg-a'], dependencies: undefined };
  assert.equal(collectProduction(f.tree, f.root).length, 1);
  f.tree.dependencies['pkg-a'].dependencies['pkg-a'].version = '3.0.0';
  assert.throws(() => collectProduction(f.tree, f.root), /IDENTITY_CONFLICT/);
}));
test('npm ls fallido o JSON ilegible no se acepta como evidencia', () => {
  assert.throws(() => productionTree('/tmp', () => { throw new Error('npm failed'); }), /npm failed/);
  assert.throws(() => productionTree('/tmp', () => 'not json'), SyntaxError);
  assert.deepEqual(productionTree('/tmp', () => '{"dependencies":{}}'), { dependencies: {} });
});
for (const flag of ['invalid', 'missing', 'extraneous', 'error', 'problems']) test(`árbol ${flag} falla cerrado`, () => failure((f) => { f.tree[flag] = flag === 'problems' ? ['bad tree'] : true; }, /TREE_INVALID/));
for (const field of ['version', 'path']) test(`identidad sin ${field} falla`, () => failure((f) => { delete f.tree.dependencies['pkg-a'][field]; }, /IDENTITY_MISSING/));
test('ruta fuera del proyecto falla', () => failure((f) => { f.tree.dependencies['pkg-a'].path = tmpdir(); }, /PATH_OUTSIDE/));
for (const variant of ['name', 'version', 'lockVersion', 'missingLock', 'link', 'license']) test(`inconsistencia ${variant} falla`, () => failure((f) => {
  const p = join(f.root, 'node_modules/pkg-a/package.json'); const m = JSON.parse(readFileSync(p));
  if (variant === 'name') m.name = 'wrong';
  if (variant === 'version') m.version = '9';
  if (variant === 'lockVersion') f.lock.packages['node_modules/pkg-a'].version = '9';
  if (variant === 'missingLock') delete f.lock.packages['node_modules/pkg-a'];
  if (variant === 'link') f.lock.packages['node_modules/pkg-a'].link = true;
  if (variant === 'license') f.lock.packages['node_modules/pkg-a'].license = 'ISC';
  writeFileSync(p, JSON.stringify(m)); f.save();
}, /LOCK_MISMATCH/));
test('licencia no declarada y texto vacío fallan', () => {
  failure((f) => { const p = join(f.root, 'node_modules/pkg-a/package.json'); writeFileSync(p, JSON.stringify({ name: 'pkg-a', version: '1.0.0' })); delete f.lock.packages['node_modules/pkg-a'].license; f.save(); }, /DECLARATION_MISSING/);
  failure((f) => writeFileSync(join(f.root, 'node_modules/pkg-a/LICENSE'), ''), /TEXT_EMPTY/);
});
test('NOTICE solo no sirve de licencia ni una carpeta LICENSE se lee como archivo', () => failure((f) => { rmSync(join(f.root, 'node_modules/pkg-a/LICENSE')); mkdirSync(join(f.root, 'node_modules/pkg-a/LICENSE')); writeFileSync(join(f.root, 'node_modules/pkg-a/NOTICE'), 'Original notice'); }, /EVIDENCE_MISSING/));
const externalFixture = (fn) => fixture((f) => {
  rmSync(join(f.root, 'node_modules/pkg-a/LICENSE'));
  const comment = '/* Copyright Author\nApache-2.0 original */';
  const source = JSON.stringify({ sourcesContent: [comment] });
  writeFileSync(join(f.root, 'node_modules/pkg-a/original.map'), source);
  writeFileSync(join(f.root, 'scripts/third-party-licenses/exact.txt'), 'Exact license\r\n');
  const evidence = { 'pkg-a@1.0.0': { name: 'pkg-a', version: '1.0.0', declaredLicense: 'MIT', files: [{ file: 'exact.txt', url: 'https://example.invalid/license', sha256: hash('Exact license\r\n') }], attributions: [{ file: 'original.map', sha256: hash(source), comments: [comment] }] } };
  fn(f, evidence, evidence['pkg-a@1.0.0']);
});
test('fuente externa verificada conserva licencia y copyright original', () => externalFixture((f, evidence) => { const r = renderNotices(f.root, f.tree, evidence); assert.ok(r.text.includes('Exact license\r\n')); assert.ok(r.text.includes('/* Copyright Author\nApache-2.0 original */')); }));
for (const variant of ['wrongName', 'wrongVersion', 'wrongLicense', 'files', 'attributions', 'url', 'licenseHash', 'licensePath', 'sourceHash', 'sourcePath', 'comments', 'emptyComment', 'fakeComment']) test(`evidencia externa ${variant} falla`, () => externalFixture((f, evidence, proof) => {
  if (variant === 'wrongName') proof.name = 'fake';
  if (variant === 'wrongVersion') proof.version = '9';
  if (variant === 'wrongLicense') proof.declaredLicense = 'ISC';
  if (variant === 'files') proof.files = [];
  if (variant === 'attributions') proof.attributions = [];
  if (variant === 'url') delete proof.files[0].url;
  if (variant === 'licenseHash') proof.files[0].sha256 = 'bad';
  if (variant === 'licensePath') proof.files[0].file = '../../bad';
  if (variant === 'sourceHash') proof.attributions[0].sha256 = 'bad';
  if (variant === 'sourcePath') proof.attributions[0].file = '../bad';
  if (variant === 'comments') delete proof.attributions[0].comments;
  if (variant === 'emptyComment') proof.attributions[0].comments = [''];
  if (variant === 'fakeComment') proof.attributions[0].comments = ['Invented attribution'];
  assert.throws(() => renderNotices(f.root, f.tree, evidence), /EVIDENCE_MISSING|INCOMPLETE|ORIGIN_MISSING|HASH_MISMATCH|PATH_INVALID|NOT_ORIGINAL/);
}));
test('generación y --check no escriben al fallar', () => fixture((f) => {
  const initial = generateNotices(f.root, { tree: f.tree, check: false });
  const out = join(f.root, 'public/third-party-notices.txt');
  assert.equal(generateNotices(f.root, { tree: f.tree, check: true }).text, initial.text);
  writeFileSync(out, 'preserved output');
  assert.throws(() => generateNotices(f.root, { tree: f.tree, check: true }), /OUT_OF_DATE/);
  assert.equal(readFileSync(out, 'utf8'), 'preserved output');
  f.tree.invalid = true;
  assert.throws(() => generateNotices(f.root, { tree: f.tree }), /TREE_INVALID/);
  assert.equal(readFileSync(out, 'utf8'), 'preserved output');
}));
test('CLI verifica los avisos reales y sus fuentes versionadas', () => {
  const child = spawnSync(process.execPath, ['scripts/generate-third-party-notices.mjs', '--check'], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr);
});
test('licencia objeto, origen ausente y lock sin integrity conservan identidad', () => fixture((f) => {
  const p = join(f.root, 'node_modules/pkg-a/package.json');
  writeFileSync(p, JSON.stringify({ name: 'pkg-a', version: '1.0.0', license: { type: 'MIT' } }));
  delete f.lock.packages['node_modules/pkg-a'].integrity; f.save();
  const r = renderNotices(f.root, f.tree); assert.equal(r.components[0].integrity, null); assert.ok(r.text.includes('(no declarado)'));
  for (const manifest of [{ repository: 'git+https://example.invalid/repo.git' }, { homepage: 'https://example.invalid/site' }]) {
    writeFileSync(p, JSON.stringify({ name: 'pkg-a', version: '1.0.0', license: 'MIT', ...manifest }));
    assert.ok(renderNotices(f.root, f.tree).text.includes('https://example.invalid/'));
  }
}));
test('misma versión en rutas distintas permanece separada y se ordena establemente', () => fixture((f) => {
  f.tree.dependencies = { 'pkg-z': f.add('pkg-z', '1.0.0'), 'pkg-a': { ...f.tree.dependencies['pkg-a'], dependencies: { 'pkg-a': f.add('pkg-a', '1.0.0', 'node_modules/pkg-a/node_modules/pkg-a') } } };
  f.save(); const r = renderNotices(f.root, f.tree); assert.equal(r.components.length, 3); assert.equal(r.components[2].name, 'pkg-z');
}));
test('comentario en archivo fuente ordinario también se conserva sin modificar', () => externalFixture((f, evidence, proof) => {
  const s = proof.attributions[0]; s.file = 'original.js'; const text = s.comments[0]; s.sha256 = hash(text);
  writeFileSync(join(f.root, 'node_modules/pkg-a/original.js'), text);
  assert.ok(renderNotices(f.root, f.tree, evidence).text.includes(text));
}));
test('generación obtiene árbol real por defecto y check detecta salida ausente', () => fixture((f) => {
  writeFileSync(join(f.root, 'package.json'), JSON.stringify({ name: 'fixture', version: '1.0.0', dependencies: { 'pkg-a': '1.0.0' } }));
  assert.throws(() => generateNotices(f.root, { check: true }), /OUT_OF_DATE/);
  assert.equal(generateNotices(f.root).components.length, 1);
}));
