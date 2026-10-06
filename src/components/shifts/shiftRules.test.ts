import { describe, expect, it } from 'vitest';
import { setLocale } from '../../i18n/core';
import { morning, plantRef, weekend } from '../../test/shifts';
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
  remoteText,
  shiftFacts,
  shiftTimeline,
  sitesText,
  sortedDays,
  validateMinutes,
  validateName,
} from './shiftRules';
import { assignmentErrors } from './useAssignment';
import { affectsText, shiftPayload, timelineOf, validateShiftForm, type ShiftFormValues } from './useShiftForm';
import { needsSite, placeErrors } from './useShiftPlace';
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

const nowhere = { siteIds: [], remote: [] };

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
    expect(metersText(1234)).toBe('1.234 km'); // hasta 3 decimales en km
    expect(breaksText(0, 0)).toBe('Sin descansos');
    expect(breaksText(2, 15)).toBe('2 × 15 min');
  });

  it('mañana en la zona del negocio', () => {
    expect(businessTomorrow(new Date('2026-12-31T18:00:00Z'))).toBe('2027-01-01');
    expect(businessTomorrow() > businessToday()).toBe(true);
  });

  it('vigencia de una asignación', () => {
    expect(periodText({ valid_from: '2026-10-05', valid_to: null })).toBe(`Desde el ${formatDate('2026-10-05')}`);
    expect(periodText({ valid_from: '2026-09-01', valid_to: '2026-10-04' })).toBe(`Del ${formatDate('2026-09-01')} al ${formatDate('2026-10-04')}`);
  });

  it('dónde se checa con un turno: sus sitios y sus días remotos', () => {
    expect(placeText(morning)).toBe('Solo en sitio: Planta Norte');
    expect(placeText(weekend)).toBe('Remoto todos sus días');
    expect(placeText({ ...morning, remote_weekdays: [0, 2] })).toBe('Remoto: Lun y mié · En sitio: Planta Norte');
    expect(placeText({ ...morning, remote_weekdays: [0, 2], sites: [] })).toBe('Remoto: Lun y mié · En sitio: ningún sitio'); // datos inconsistentes: se dice igual
    expect(sitesText([plantRef, { ...plantRef, name: 'Planta Sur' }])).toBe('Planta Norte, Planta Sur');
    expect(sitesText([])).toBe('Ninguno: todos sus días son remotos');
    expect(remoteText([5, 6])).toBe('Sáb y dom');
    expect(remoteText([])).toBe('Ninguno');
    expect(shiftFacts(morning)).toEqual([
      { label: 'Horario', value: '08:00 – 16:00 · Lun a vie' },
      { label: 'Sitios donde checa', value: 'Planta Norte' },
      { label: 'Días remotos', value: 'Ninguno' },
    ]);
  });
});

describe('reglas en inglés (en-US)', () => {
  it('horas, validaciones, descansos, vigencia, lugar, datos del turno y fechas de una asignación', async () => {
    await setLocale('en-US');
    expect(momentText({ clock: '23:45', day: -1 })).toBe('11:45 PM the day before');
    expect(momentText({ clock: '01:00', day: 1 })).toBe('1:00 AM the next day');
    expect(validateMinutes('', 0, 240)).toBe('Enter the minutes');
    expect(validateMinutes('1.5', 0, 240)).toBe('Enter whole minutes');
    expect(validateMinutes('300', 0, 240)).toBe('Between 0 and 240 min');
    expect(validateName('a', 80, 'Morning')).toBe('Enter a name (e.g., "Morning")');
    expect(validateName('x'.repeat(81), 80, 'Morning')).toBe('Up to 80 characters');
    expect(metersText(12_500)).toBe('12.5 km');
    expect(breaksText(0, 0)).toBe('No breaks');
    expect(periodText({ valid_from: '2026-10-05', valid_to: null })).toBe('From Oct 5, 2026');
    expect(periodText({ valid_from: '2026-09-01', valid_to: '2026-10-04' })).toBe('From Sep 1, 2026 to Oct 4, 2026');
    expect(placeText(morning)).toBe('On site only: Planta Norte');
    expect(placeText(weekend)).toBe('Remote every day');
    expect(placeText({ ...morning, remote_weekdays: [0, 2], sites: [] })).toBe('Remote: Mon and Wed · On site: no site');
    expect(sitesText([])).toBe('None: all its days are remote');
    expect(shiftFacts(weekend)).toEqual([
      { label: 'Schedule', value: '10:00 PM – 6:00 AM (next day) · Sat and Sun' },
      { label: 'Check-in sites', value: 'None: all its days are remote' },
      { label: 'Remote days', value: 'Sat and Sun' },
    ]);
    expect(affectsText(1)).toBe('Affects 1 assigned employee');
    expect(affectsText(1200)).toBe('Affects 1,200 assigned employees');
    expect(validateShiftForm({ ...base, name: '', end_time: '08:00' })).toMatchObject({ name: 'Enter a name (e.g., "Morning")', end_time: 'The end time must be different from the start time' });
    expect(placeErrors([0], [], [])).toEqual({ site_ids: "Choose at least one site for non-remote days" });
    expect(assignmentErrors('', { shift: null, minDate: '2026-10-05', minMessage: () => 'Tomorrow or later' })).toEqual({ shift_id: 'Choose the shift', valid_from: 'Choose the date it takes effect' });
    expect(assignmentErrors('2026-10-04', { shift: morning, minDate: '2026-10-05', minMessage: () => 'Tomorrow or later' }).valid_from).toBe('Tomorrow or later');
    expect(assignmentErrors('04/10/2026', { shift: morning, minDate: '2026-10-05', minMessage: 'x' }).valid_from).toBe('Enter a valid date (mm/dd/yyyy)');
  });
});

describe('formulario de turno', () => {
  it('sin errores con un turno válido; la vista previa y lo que se envía', () => {
    expect(Object.values(validateShiftForm(base)).filter(Boolean)).toEqual([]);
    expect(timelineOf(base)?.duration).toBe(480);
    expect(shiftPayload({ ...base, name: ' Matutino ' }, [4, 0], { siteIds: [9, 3], remote: [4] })).toEqual({
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
      site_ids: [3, 9],
      remote_weekdays: [4],
    });
    expect(shiftPayload({ ...base, breaks_count: '0' }, [0], nowhere).break_minutes).toBe(0);
    expect(affectsText(1)).toBe('Afecta a 1 empleado asignado');
    expect(affectsText(0)).toBe('Afecta a 0 empleados asignados');
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

describe('lugar del turno', () => {
  it('sin días en sitio no hacen falta sitios; si alguno es en sitio, se pide al menos uno', () => {
    expect(needsSite([0, 1, 2, 3, 4], [0, 1, 2, 3])).toBe(true);
    expect(needsSite([0, 1, 2, 3, 4], [0, 1, 2, 3, 4])).toBe(false);
    expect(placeErrors([0, 1], [], [])).toEqual({ site_ids: 'Elige al menos un sitio para los días no remotos' });
    expect(placeErrors([0, 1], [], [3])).toEqual({ site_ids: undefined });
    expect(placeErrors([0, 1], [0, 1], [])).toEqual({ site_ids: undefined });
  });
});

describe('asignación: turno y fecha', () => {
  const rules = { shift: morning, minDate: '2026-10-05', minMessage: 'Desde mañana' };

  it('pide el turno y una fecha válida desde la mínima', () => {
    expect(assignmentErrors('', { ...rules, shift: null })).toEqual({ shift_id: 'Elige el turno', valid_from: 'Elige la fecha desde la que aplica' });
    expect(assignmentErrors('31/02/2026', rules).valid_from).toBe('Escribe una fecha válida (dd/mm/aaaa)');
    expect(assignmentErrors('2026-10-04', rules).valid_from).toBe('Desde mañana');
    expect(assignmentErrors('2026-10-05', rules)).toEqual({ shift_id: undefined, valid_from: undefined });
  });
});

describe('formulario de sitio', () => {
  it('envía el domicilio con su punto (interior y referencias vacíos = null) y el radio', () => {
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
      neighborhood: ' Centro ',
      reference_notes: ' ',
    };
    expect(sitePayload(values, { lat: 29.1, lng: -110.9 }, true)).toEqual({
      name: 'Planta Norte',
      radius_m: 150,
      presence_code: true,
      address: {
        street: 'Calle 1',
        exterior_number: '10',
        interior_number: null,
        postal_code: '83000',
        country_code: 'MX',
        state: 'Sonora',
        municipality: 'Hermosillo',
        city: 'Hermosillo',
        neighborhood: 'Centro',
        reference_notes: null,
        latitude: 29.1,
        longitude: -110.9,
      },
    });
  });
});
