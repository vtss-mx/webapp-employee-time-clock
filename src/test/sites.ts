import type { WorkSite } from '../types';
import { sampleValidator } from './fixtures';

/** Datos de prueba de los puntos de verificación (solo los usan las pruebas). */

/** Domicilio de los sitios de prueba (el mismo del validador de prueba). */
export const siteAddress = sampleValidator.address!;

/** Planta Norte: sitio activo de la empresa (100 m de radio). */
export const plant: WorkSite = { id: 3, name: 'Planta Norte', radius_m: 100, active: true, presence_code: false, kiosks: 0, created_at: '2026-10-01T00:00:00Z', address: siteAddress };

/** Página de la API. */
export const page = <T>(items: T[], total = items.length, size = 10) => ({ items, total, page: 1, size });
