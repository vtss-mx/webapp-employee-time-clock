import { config } from '../utils/config';
import { isRecord } from '../utils/guards';

/** Compilación publicada en el servidor; null si no se puede saber (sin red, modo desarrollo). */
export async function deployedBuild(): Promise<string | null> {
  try {
    const response = await fetch(`${config.versionUrl}?t=${Date.now()}`, { cache: 'no-store' });
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
