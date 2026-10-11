import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Cabeceras de seguridad del servidor que entrega la aplicación web (brecha A1 de
 * `backend-employee-time-clock/docs/rd/certificaciones-seguridad-2026-10-08.md`; SOC 2 CC6.6 y CC6.7, ISO/IEC 27001
 * A.8.20, A.8.23 y A.8.26). Esta prueba es el guardián de la política: falla si
 *   - desaparece una cabecera (CSP, COOP, COEP, HSTS) o se afloja `script-src`;
 *   - la CSP se le pone también a `/api` o a `/docs`, donde rompería la API o Swagger UI;
 *   - el código empieza a llamar a un origen de terceros que la política NO permite (o que nadie decidió permitir);
 *   - la plantilla usa una variable `${NGINX_*}` que el script de arranque no define (quedaría literal en la
 *     configuración de Nginx);
 *   - el hash del script EN LÍNEA del index.html deja de calcularse bien (sin él, el aviso «Actualiza tu navegador»
 *     quedaría bloqueado en el navegador de la persona).
 * Solo se leen archivos de configuración: ninguna prueba abre el navegador ni la red.
 */
const ROOT = resolve(__dirname, '../..');
const TEMPLATE = readFileSync(resolve(ROOT, 'docker/nginx.conf.template'), 'utf8');
const MAIN_TEMPLATE = readFileSync(resolve(ROOT, 'docker/nginx.main.conf.template'), 'utf8');
const START_SCRIPT = resolve(ROOT, 'docker/15-gateway-config.sh');
const START = readFileSync(START_SCRIPT, 'utf8');
const DIST_INDEX = resolve(ROOT, 'dist/index.html');

/** La política tal como queda en la cabecera (el valor del `map` que decide la CSP de la aplicación). */
const POLICY = /^\s*1\s+"(default-src .*)";$/m.exec(TEMPLATE)?.[1] ?? '';
/** Una directiva de la política, sin su nombre. */
const directive = (name: string): string =>
  POLICY.split(';')
    .map((part) => part.trim())
    .find((part) => part === name || part.startsWith(`${name} `))
    ?.slice(name.length)
    .trim() ?? '';

/**
 * Orígenes que el código escribe pero que NUNCA son un subrecurso de la página: se abren en otra pestaña
 * (`target="_blank"`), así que la CSP de ESTA página no los gobierna. Uno nuevo se agrega aquí a propósito.
 */
const LINK_ONLY = ['db-ip.com'];

/** Archivos de la aplicación (sin pruebas ni utilidades de prueba, como en la cobertura). */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return path.endsWith('/test') ? [] : sources(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

/** Los dominios https:// literales que aparecen en el código (sin los armados con una variable). */
function externalHosts(): string[] {
  const hosts = sources(resolve(ROOT, 'src'))
    .flatMap((file) => [...readFileSync(file, 'utf8').matchAll(/https:\/\/([A-Za-z0-9.-]+)/g)].map((m) => m[1]))
    .filter((host) => host.includes('.') && !host.endsWith('.'));
  return [...new Set(hosts)].sort();
}

/** ¿La política permite ese dominio (por su nombre exacto o por un comodín `*.dominio`)? */
function allowed(host: string): boolean {
  if (POLICY.includes(`https://${host}`)) return true;
  return [...POLICY.matchAll(/https:\/\/\*\.([A-Za-z0-9.-]+)/g)].some(([, suffix]) => host.endsWith(`.${suffix}`));
}

describe('cabeceras de seguridad del gateway (brecha A1)', () => {
  it('la plantilla envía CSP, COOP, COEP y HSTS en la página de la aplicación', () => {
    expect(POLICY).toContain("default-src 'self'");
    expect(TEMPLATE).toContain('add_header ${NGINX_CSP_HEADER} $app_csp always;');
    expect(TEMPLATE).toContain('add_header Cross-Origin-Opener-Policy $app_coop always;');
    expect(TEMPLATE).toContain('add_header Cross-Origin-Embedder-Policy $app_coep always;');
    expect(TEMPLATE).toContain('add_header Strict-Transport-Security $app_hsts always;');
  });

  it('HSTS solo cuando la página se sirve por HTTPS, y nunca en /api ni en /docs', () => {
    // El valor sale del map "$served_by_app$forwarded_proto": solo la llave 1https lo trae.
    expect(TEMPLATE).toContain('map "$served_by_app$forwarded_proto" $app_hsts');
    expect(/1https\s+"\$\{NGINX_HSTS\}";/.test(TEMPLATE)).toBe(true);
    // Las cuatro cabeceras cuelgan de $served_by_app, que vale 0 en la API y en la documentación.
    for (const header of ['$app_csp', '$app_coop', '$app_coep', '$app_hsts']) {
      expect(new RegExp(`map ("\\$served_by_app[^"]*"|\\$served_by_app) \\${header}`).test(TEMPLATE)).toBe(true);
    }
    const served = /map \$uri \$served_by_app \{([^}]*)\}/.exec(TEMPLATE)?.[1] ?? '';
    expect(served).toMatch(/~\^\/api\/\s+0;/);
    expect(served).toMatch(/~\^\/\(docs\|redoc\|openapi\\\.json\)\$\s+0;/);
    expect(served).toMatch(/default\s+1;/);
  });

  it('script-src no afloja la política: sin unsafe-inline ni unsafe-eval, con wasm-unsafe-eval y el hash del inline', () => {
    const script = directive('script-src');
    expect(script).toContain("'self'");
    expect(script).toContain("'wasm-unsafe-eval'"); // MediaPipe compila WebAssembly en el navegador
    expect(script).toContain('${NGINX_CSP_SCRIPT_HASHES}'); // el aviso «Actualiza tu navegador», por su hash
    expect(script).not.toContain("'unsafe-inline'");
    expect(script.replace("'wasm-unsafe-eval'", '')).not.toContain("'unsafe-eval'");
    // Lo que de verdad frena un ataque, cerrado:
    expect(directive('object-src')).toBe("'none'");
    expect(directive('base-uri')).toBe("'self'");
    expect(directive('frame-ancestors')).toBe("'none'");
    expect(directive('form-action')).toBe("'self'");
  });

  it('la política cubre lo que la aplicación necesita de verdad', () => {
    expect(directive('img-src')).toContain('data:'); // QR dibujado en el navegador, fotos en base64 de la API
    expect(directive('img-src')).toContain('blob:'); // foto de perfil y recortes, solo en memoria
    expect(directive('media-src')).toContain('blob:'); // clip de video de la verificación por voz
    expect(directive('connect-src')).toContain("'self'"); // la API y el canal en vivo (wss del mismo origen)
    expect(directive('connect-src')).toContain('${NGINX_CSP_CONNECT_EXTRA}'); // API en otro dominio (regla 19)
    expect(directive('manifest-src')).toBe("'self'");
    // La telemetría del SDK de MediaPipe queda bloqueada a propósito (regla 13: nada sale hacia terceros).
    expect(POLICY).not.toContain('odml.pa.googleapis.com');
  });

  it('cada origen de terceros que el código usa está permitido o es solo un enlace', () => {
    const unknown = externalHosts().filter((host) => !allowed(host) && !LINK_ONLY.includes(host));
    // Si falla: o se agrega el origen a la CSP (docker/nginx.conf.template) o a LINK_ONLY si solo es un enlace.
    expect(unknown).toEqual([]);
    expect(externalHosts()).toContain('maps.googleapis.com'); // el barrido sigue encontrando los orígenes reales
  });

  it('la cámara, el micrófono y la ubicación quedan permitidos solo para el propio origen', () => {
    // `microphone=()` los bloquearía también para nosotros y el paso del video con preguntas no podría grabar.
    expect(TEMPLATE).toContain(
      'add_header Permissions-Policy "camera=(self), microphone=(self), geolocation=(self)" always;',
    );
  });

  it('un valor del .env no puede inyectar otra cabecera ni una variable de Nginx', () => {
    // El valor termina DENTRO de la configuración de Nginx: se valida antes de escribirla (como la regla 21 hace con
    // la base de datos). Un `"` cerraría la cadena y un `$` se volvería una variable del servidor.
    const run = (env: Record<string, string>) =>
      spawnSync('sh', [START_SCRIPT], { env: { ...process.env, ...env }, encoding: 'utf8' });
    for (const value of ['same-origin" always; add_header X-Malo "1', 'same-origin$host']) {
      const result = run({ NGINX_COOP: value });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('NGINX_COOP: valor inválido');
    }
    const mode = run({ NGINX_CSP_REPORT_ONLY: 'maybe' });
    expect(mode.status).toBe(1);
    expect(mode.stderr).toContain('debe ser true o false');
  });

  it('toda variable ${NGINX_*} de las plantillas la define el script de arranque', () => {
    const used = [...`${TEMPLATE}${MAIN_TEMPLATE}`.matchAll(/\$\{(NGINX_[A-Z0-9_]+)\}/g)].map((m) => m[1]);
    const defined = [
      ...START.matchAll(/^: "\$\{(NGINX_[A-Z0-9_]+):=/gm),
      ...START.matchAll(/^(?:export )?(NGINX_[A-Z0-9_]+)=/gm),
      ...START.matchAll(/^export ((?:NGINX_[A-Z0-9_]+ ?)+)$/gm),
    ].flatMap((m) => m[1].trim().split(' '));
    expect([...new Set(used)].filter((name) => !defined.includes(name))).toEqual([]);
  });
});

describe('hash del script en línea que autoriza la CSP', () => {
  /** El cuerpo exacto del n-ésimo `<script>` sin atributos, como lo lee un navegador. */
  function inlineBodies(html: string): string[] {
    return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  }
  const sha256 = (body: string) => `'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`;
  const hashesOf = (file: string) =>
    execFileSync('sh', [START_SCRIPT, '--csp-script-hashes', file], { encoding: 'utf8' }).trim();

  it('calcula el hash de cada script en línea, también de varias líneas, y omite los externos', () => {
    const file = join(tmpdir(), `csp-inline-${process.pid}.html`);
    const html = '<html><body><script>uno();</script>\n<script>dos();\ntres();</script>\n<script src="/x.js"></script></body></html>';
    writeFileSync(file, html);
    const bodies = inlineBodies(html);
    expect(bodies).toEqual(['uno();', 'dos();\ntres();']);
    expect(hashesOf(file)).toBe(bodies.map(sha256).join(' '));
  });

  it('sin scripts en línea no agrega ningún hash', () => {
    const file = join(tmpdir(), `csp-empty-${process.pid}.html`);
    writeFileSync(file, '<html><body><script src="/x.js"></script></body></html>');
    expect(hashesOf(file)).toBe('');
  });

  it('un archivo que no existe no tumba el arranque: la CSP sale sin hash', () => {
    expect(hashesOf(join(tmpdir(), 'no-existe-nunca.html'))).toBe('');
  });

  it.skipIf(!existsSync(DIST_INDEX))('el index.html construido trae UN script en línea y su hash es el que se publica', () => {
    const bodies = inlineBodies(readFileSync(DIST_INDEX, 'utf8'));
    expect(bodies).toHaveLength(1); // el aviso «Actualiza tu navegador» (decisión D-C1)
    expect(hashesOf(DIST_INDEX)).toBe(sha256(bodies[0]));
  });
});
