import { config } from '../utils/config';
import { isRecord } from '../utils/guards';

/**
 * Espera máxima por version.json: el login espera esta respuesta antes de entrar, y con la red
 * lenta o el servidor saturado no debe quedarse esperando el tiempo límite del navegador (minutos).
 */
const VERSION_TIMEOUT_MS = 5_000;

/** Compilación publicada en el servidor; null si no se puede saber (sin red, sin respuesta a tiempo, modo desarrollo). */
export async function deployedBuild(): Promise<string | null> {
  try {
    const response = await fetch(`${config.versionUrl}?t=${Date.now()}`, { cache: 'no-store', signal: AbortSignal.timeout(VERSION_TIMEOUT_MS) });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    return isRecord(body) && typeof body.build === 'string' ? body.build : null;
  } catch {
    return null;
  }
}

/** ¿El servidor ya tiene una versión distinta de la que está ejecutando esta pestaña? */
export async function isOutdated(current: string = config.buildId): Promise<boolean> {
  const deployed = await deployedBuild();
  return deployed !== null && deployed !== current;
}

export function reloadApp(): void {
  window.location.reload();
}
