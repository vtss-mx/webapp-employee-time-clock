/**
 * Pruebas de las reglas propias de la traducción (eslint-rules/i18n.js) con el RuleTester de ESLint:
 * qué textos marcan y cuáles no (códigos, identificadores, unidades, símbolos, nombres propios).
 */
import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, it } from 'vitest';
import i18n from './i18n.js';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester({
  languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } },
});

const error = (count = 1) => Array.from({ length: count }, () => ({ messageId: 'hardcoded' }));

tester.run('no-hardcoded-text', i18n.rules['no-hardcoded-text'], {
  valid: [
    { code: "const a = <p>{t('common.actions.save')}</p>;" },
    { code: 'const a = <p>{name} · {count}</p>;' },
    { code: 'const a = <p>  —  </p>;' },
    { code: 'const a = <dt>RFC</dt>;' },
    { code: 'const a = <Button variant="primary" className="btn btn--ghost" type="button" data-label="Nombre" aria-hidden="true" />;' },
    { code: 'const a = <Field label={t(\'x\')} autoComplete="current-password" inputMode="email" />;' },
    { code: "throw new Error('SESSION_RENEW_FAILED'); const e = TypeError(code);" },
    { code: "const e = localizedError(() => t('errors.unexpected'));" },
    { code: 'const a = <path d="M12 2 L 4 5 Z" transform="rotate(45 12 12)" />;' },
    { code: "const a = { title: t('x'), code: 'TURN_LEFT', variant: 'primary', unit: 'km' };" },
    { code: "const zone = 'America/Mexico_City'; const key = 'Escape';" },
    { code: "function f() { return 'primary'; }" },
    { code: "const f = () => 'btn--ghost';" },
    { code: "console.error('Algo falló en la consola');" },
    { code: "const a = <p>Safari</p>; const b = { label: 'Google Maps' };", options: [{ allow: ['Safari', 'Google Maps'] }] },
    { code: 'const a = <Comp {...props} disabled />;' },
    { code: 'const a = { [key]: \'Texto calculado\' };' },
  ],
  invalid: [
    { code: 'const a = <p>Guardar cambios</p>;', errors: error() },
    { code: "const a = <p>{'Hola'}</p>;", errors: error() },
    { code: "const a = <p>{ok ? 'Sí' : 'No'}</p>;", errors: error(2) },
    { code: 'const a = <p>{`${n} días`}</p>;', errors: error() },
    { code: 'const a = <>{loading && \'Cargando\'}</>;', errors: error() },
    { code: 'const a = <button aria-label="Cerrar" title="Cerrar ventana" />;', errors: error(2) },
    { code: 'const a = <Field label="Nombre" hint={`Entre ${min} y ${max} m`} placeholder="10 dígitos" />;', errors: error(3) },
    { code: "const a = { title: 'Sin cambios', message: cond ? 'Uno' : 'Dos' };", errors: error(3) },
    { code: "function Loader({ text = 'Cargando información' }) { return text; }", errors: error() },
    { code: "feedback.success('Guardado');", errors: error() },
    { code: "function f() { return 'El correo es obligatorio'; }", errors: error() },
    { code: "const f = () => 'Sin turno';", errors: error() },
    { code: "const EMPTY = 'Sin capturar';", errors: error() },
    { code: "const a = { label: 'Teléfono' };", errors: error() },
    // Lo que siempre se ve o se lee, aunque sea una palabra en minúsculas o un ejemplo.
    { code: 'const a = <input placeholder="nombre@empresa.com" title="buscar" aria-label="cerrar" alt="foto" />;', errors: error(4) },
    // El texto de un error que puede llegar a un popup.
    { code: "throw new Error('No se pudo leer el archivo'); const e = TypeError('Respuesta inesperada del servidor');", errors: error(2) },
  ],
});

tester.run('no-hardcoded-locale', i18n.rules['no-hardcoded-locale'], {
  valid: [
    { code: 'const a = n.toLocaleString(currentLocale()); const b = new Intl.NumberFormat(locale, options);' },
    { code: "const c = a.localeCompare(b, currentLocale()); const d = date.toLocaleDateString(locale, { month: 'short' });" },
    { code: 'const e = name.toLocaleUpperCase(); const f = Intl.getCanonicalLocales(tag); const g = other.format(); const h = n.toString();' },
  ],
  invalid: [
    { code: "const a = n.toLocaleString('es-MX');", errors: [{ messageId: 'literal' }] },
    { code: "const b = new Intl.DateTimeFormat('en-US', { month: 'short' });", errors: [{ messageId: 'literal' }] },
    { code: "const c = Intl.NumberFormat(['es-MX']);", errors: [{ messageId: 'literal' }] },
    { code: 'const d = date.toLocaleDateString(); const e = new Intl.RelativeTimeFormat();', errors: [{ messageId: 'missing' }, { messageId: 'missing' }] },
    { code: "const f = a.localeCompare(b); const g = word.toLocaleUpperCase('tr');", errors: [{ messageId: 'missing' }, { messageId: 'literal' }] },
  ],
});

tester.run('no-module-level-t', i18n.rules['no-module-level-t'], {
  valid: [
    { code: "const labels = () => ({ name: t('common.fields.name') });" },
    { code: "function Title() { return t('x'); }" },
    { code: "class A { label = t('x'); method() { return t('y'); } }" },
    { code: "const x = translate('x'); obj.t('y');" },
  ],
  invalid: [
    { code: "const LABEL = t('common.fields.name');", errors: [{ messageId: 'moduleLevel' }] },
    { code: "const LABELS = { name: t('common.fields.name') };", errors: [{ messageId: 'moduleLevel' }] },
  ],
});
