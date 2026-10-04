import { describe, expect, it } from 'vitest';
import type { ShiftRef, SiteRef } from '../../types';
import { businessToday, formatDate } from '../../utils/format';
import {
  breaksText,
  businessTomorrow,
  clockMinutes,
  fitsInADay,
  metersText,
  momentAt,
  momentText,
  periodText,
  placeText,
  shiftTimeline,
  sortedDays,
  validateMinutes,
  validateName,
} from './shiftRules';
import { needsSite, placementErrors, remoteWithin } from './usePlacement';
import { shiftPayload, timelineOf, validateShiftForm, type ShiftFormValues } from './useShiftForm';
import { sitePayload, type SiteFormValues } from './useSiteForm';

const base: ShiftFormValues = {
  name: 'Matutino',
  start_time: '08:00',
  end_time: '16:00',
  breaks_count: '1',
  break_minutes: '30',
  early_check_in_minutes: '15',
  late_tolerance_minutes: '10',
  early_check_out_minutes: '0',
  late_check_out_minutes: '60',
};

const shift: ShiftRef = { id: 1, name: 'Matutino', start_time: '08:00:00', end_time: '16:00:00', overnight: false, weekdays: [0, 1, 2, 3, 4] };
const site: SiteRef = { id: 4, name: 'Planta Norte', latitude: 29, longitude: -110, radius_m: 100 };

describe('reglas de horas', () => {
  it('lee "HH:MM" y "HH:MM:SS"; lo incompleto o fuera de rango no es una hora', () => {
    expect(clockMinutes('08:30')).toBe(510);
    expect(clockMinutes('23:59:00')).toBe(1439);
    expect(clockMinutes('')).toBeNull();
    expect(clockMinutes('24:00')).toBeNull();
    expect(clockMinutes('7:5')).toBeNull();
  });

  it('una hora antes, durante o después del día del turno', () => {
    expect(momentAt(-15)).toEqual({ clock: '23:45', day: -1 });
    expect(momentAt(465)).toEqual({ clock: '07:45', day: 0 });
    expect(momentAt(1440 + 60)).toEqual({ clock: '01:00', day: 1 });
    expect(momentText({ clock: '23:45', day: -1 })).toBe('23:45 del día anterior');
    expect(momentText({ clock: '07:45', day: 0 })).toBe('07:45');
    expect(momentText({ clock: '01:00', day: 1 })).toBe('01:00 del día siguiente');
  });

  it('jornada de día y nocturna (salida igual o antes que la entrada: al día siguiente)', () => {
    const day = shiftTimeline({ start: 480, end: 960, breaksCount: 1, breakMinutes: 30, earlyCheckIn: 15, lateTolerance: 10, earlyCheckOut: 5, lateCheckOut: 60 });
    expect(day).toEqual({
      duration: 480,
      overnight: false,
      opens: { clock: '07:45', day: 0 },
      lateAfter: { clock: '08:10', day: 0 },
      leavesFrom: { clock: '15:55', day: 0 },
      deadline: { clock: '17:00', day: 0 },
      window: 555,
    });
    expect(fitsInADay(day)).toBe(true);
    const night = shiftTimeline({ start: 1320, end: 360, breaksCount: 0, breakMinutes: 0, earlyCheckIn: 30, lateTolerance: 0, earlyCheckOut: 0, lateCheckOut: 720 });
    expect(night.overnight).toBe(true);
    expect(night.duration).toBe(480);
    expect(night.deadline).toEqual({ clock: '18:00', day: 1 });
    expect(fitsInADay(night)).toBe(true); // 30 + 480 + 720 = 1230 < 1440
    expect(fitsInADay({ ...night, window: 1440 })).toBe(false);
  });

  it('minutos, nombres, días, metros y descansos', () => {
    expect(validateMinutes(' ', 0, 240)).toBe('Indica los minutos');
    expect(validateMinutes('1.5', 0, 240)).toBe('Escribe minutos enteros');
    expect(validateMinutes('-1', 0, 240)).toBe('Entre 0 y 240 min');
    expect(validateMinutes('241', 0, 240)).toBe('Entre 0 y 240 min');
    expect(validateMinutes('240', 0, 240)).toBeUndefined();
    expect(validateName(' a ', 80, 'Matutino')).toBe('Escribe un nombre (p. ej. "Matutino")');
    expect(validateName('x'.repeat(81), 80, 'Matutino')).toBe('Máximo 80 caracteres');
    expect(validateName('Nocturno', 80, 'Matutino')).toBeUndefined();
    expect(sortedDays([4, 0, 4, 2])).toEqual([0, 2, 4]);
    expect(metersText(100)).toBe('100 m');
    expect(metersText(1500)).toBe('1.5 km');
    expect(breaksText(0, 0)).toBe('Sin descansos');
    expect(breaksText(2, 15)).toBe('2 × 15 min');
  });

  it('mañana en la zona del negocio', () => {
    expect(businessTomorrow(new Date('2026-12-31T18:00:00Z'))).toBe('2027-01-01');
    expect(businessTomorrow() > businessToday()).toBe(true);
  });

  it('vigencia y lugar de una asignación', () => {
    expect(periodText({ valid_from: '2026-10-05', valid_to: null })).toBe(`Desde el ${formatDate('2026-10-05')}`);
    expect(periodText({ valid_from: '2026-09-01', valid_to: '2026-10-04' })).toBe(`Del ${formatDate('2026-09-01')} al ${formatDate('2026-10-04')}`);
    expect(placeText({ remote_weekdays: [], sites: [site] })).toBe('Solo en sitio: Planta Norte');
    expect(placeText({ remote_weekdays: [0, 2], sites: [] })).toBe('Remoto: Lun y mié · En sitio: ningún sitio');
  });
});

describe('formulario de turno', () => {
  it('sin errores con un turno válido; la vista previa y lo que se envía', () => {
    expect(Object.values(validateShiftForm(base)).filter(Boolean)).toEqual([]);
    expect(timelineOf(base)?.duration).toBe(480);
    expect(shiftPayload({ ...base, name: ' Matutino ' }, [4, 0])).toEqual({
      name: 'Matutino',
      start_time: '08:00',
      end_time: '16:00',
      weekdays: [0, 4],
      breaks_count: 1,
      break_minutes: 30,
      early_check_in_minutes: 15,
      late_tolerance_minutes: 10,
      early_check_out_minutes: 0,
      late_check_out_minutes: 60,
    });
    expect(shiftPayload({ ...base, breaks_count: '0' }, [0]).break_minutes).toBe(0);
  });

  it('marca horas faltantes o iguales, descansos que no caben y una ventana de 24 h', () => {
    expect(validateShiftForm({ ...base, start_time: '', end_time: '' })).toMatchObject({ start_time: 'Indica la hora de entrada', end_time: 'Indica la hora de salida' });
    expect(validateShiftForm({ ...base, end_time: '08:00' }).end_time).toBe('La salida debe ser distinta de la entrada');
    expect(timelineOf({ ...base, end_time: '08:00' })).toBeNull();
    expect(validateShiftForm({ ...base, break_minutes: '2' }).break_minutes).toBe('Entre 5 y 240 min');
    expect(validateShiftForm({ ...base, breaks_count: '0', break_minutes: '2' }).break_minutes).toBeUndefined();
    expect(validateShiftForm({ ...base, end_time: '09:00', breaks_count: '2', break_minutes: '30' }).break_minutes).toBe('Los descansos no pueden sumar todo el turno');
    expect(validateShiftForm({ ...base, end_time: '07:00', late_check_out_minutes: '720' }).late_check_out_minutes).toBe(
      'La entrada temprana, el turno y el límite de salida deben sumar menos de 24 horas',
    );
    // Un límite fuera de rango conserva su propio error (y la vista previa cuenta lo inválido como 0).
    expect(validateShiftForm({ ...base, end_time: '07:00', late_check_out_minutes: '900' }).late_check_out_minutes).toBe('Entre 0 y 720 min');
    expect(timelineOf({ ...base, early_check_in_minutes: 'x' })?.opens.clock).toBe('08:00');
  });
});

describe('asignación: días remotos y sitios', () => {
  const rules = { shift, minDate: '2026-10-05', minMessage: 'Desde mañana', withPlace: true };

  it('los días remotos se limitan a los del turno; sin días en sitio no hacen falta sitios', () => {
    expect(remoteWithin([0, 5, 6], shift)).toEqual([0]);
    expect(remoteWithin([0], null)).toEqual([]);
    expect(needsSite(shift, [0, 1, 2, 3])).toBe(true);
    expect(needsSite(shift, [0, 1, 2, 3, 4])).toBe(false);
    expect(needsSite(null, [])).toBe(false);
  });

  it('fecha, turno y sitios', () => {
    expect(placementErrors({ validFrom: '', remote: [], siteIds: [] }, { ...rules, shift: null })).toEqual({
      shift_id: 'Elige el turno',
      valid_from: 'Elige la fecha desde la que aplica',
      site_ids: undefined,
    });
    expect(placementErrors({ validFrom: '31/02/2026', remote: [], siteIds: [4] }, rules).valid_from).toBe('Escribe una fecha válida (dd/mm/aaaa)');
    expect(placementErrors({ validFrom: '2026-10-04', remote: [], siteIds: [4] }, rules).valid_from).toBe('Desde mañana');
    expect(placementErrors({ validFrom: '2026-10-05', remote: [], siteIds: [] }, rules).site_ids).toBe('Elige al menos un sitio donde checar los días que no son remotos');
    expect(placementErrors({ validFrom: '2026-10-05', remote: [], siteIds: [] }, { ...rules, withPlace: false }).site_ids).toBeUndefined();
    expect(placementErrors({ validFrom: '2026-10-05', remote: [0, 1, 2, 3, 4], siteIds: [] }, rules)).toEqual({ shift_id: undefined, valid_from: undefined, site_ids: undefined });
  });
});

describe('formulario de sitio', () => {
  it('envía el domicilio con su punto (interior vacío = null) y el radio', () => {
    const values: SiteFormValues = {
      name: ' Planta Norte ',
      radius: '150',
      street: 'Calle 1 ',
      exterior_number: '10',
      interior_number: ' ',
      postal_code: '83000',
      country_code: 'MX',
      state: 'Sonora',
      municipality: 'Hermosillo',
      city: 'Hermosillo',
    };
    expect(sitePayload(values, { lat: 29.1, lng: -110.9 })).toEqual({
      name: 'Planta Norte',
      radius_m: 150,
      address: { street: 'Calle 1', exterior_number: '10', interior_number: null, postal_code: '83000', country_code: 'MX', state: 'Sonora', municipality: 'Hermosillo', city: 'Hermosillo', latitude: 29.1, longitude: -110.9 },
    });
  });
});
