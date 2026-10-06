import type { Shift, SiteRef, WorkSite } from '../types';
import { sampleValidator } from './fixtures';

/**
 * Datos de prueba de turnos y sitios (solo los usan las pruebas). El turno dice dónde y cuándo se
 * checa: el matutino en la Planta Norte; el de fin de semana, remoto todos sus días.
 */

/** Domicilio de los sitios de prueba (el mismo del validador de prueba). */
export const siteAddress = sampleValidator.address!;

/** Planta Norte: sitio activo de la empresa (100 m de radio). */
export const plant: WorkSite = { id: 3, name: 'Planta Norte', radius_m: 100, active: true, employees: 1, presence_code: false, kiosks: 0, created_at: '2026-10-01T00:00:00Z', address: siteAddress };

/** El mismo sitio como lo trae un turno. */
export const plantRef: SiteRef = { id: 3, name: 'Planta Norte', address: siteAddress, latitude: 29.1, longitude: -110.9, radius_m: 100, active: true };

/** Matutino: de lunes a viernes, de 08:00 a 16:00, un descanso de 30 min; se checa en la Planta Norte. */
export const morning: Shift = {
  id: 5,
  name: 'Matutino',
  start_time: '08:00:00',
  end_time: '16:00:00',
  overnight: false,
  weekdays: [0, 1, 2, 3, 4],
  remote_weekdays: [],
  sites: [plantRef],
  breaks_count: 1,
  break_minutes: 30,
  early_check_in_minutes: 15,
  late_tolerance_minutes: 10,
  early_check_out_minutes: 0,
  late_check_out_minutes: 60,
  duration_minutes: 480,
  active: true,
  employees: 8,
  created_at: '2026-10-01T00:00:00Z',
};

/** Fin de semana: nocturno, sábado y domingo, remoto todos sus días (sin sitios). */
export const weekend: Shift = { ...morning, id: 6, name: 'Fin de semana', start_time: '22:00:00', end_time: '06:00:00', overnight: true, weekdays: [5, 6], remote_weekdays: [5, 6], sites: [], breaks_count: 0, break_minutes: 0 };

/** Página de la API. */
export const page = <T>(items: T[], total = items.length, size = 10) => ({ items, total, page: 1, size });
