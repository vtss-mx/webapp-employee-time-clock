import { beforeEach, describe, expect, it } from 'vitest';
import { setLocale } from '../i18n/core';
import { paths } from '../routes/paths';
import { ADDRESS_TYPES, CAPTURES_DONE, CHECKED, CUSTOM_FIVE, CUSTOM_TWO, EXPIRES, NOTHING_DONE, OFFICIAL_ID_TYPES, PHOTO_DONE, progress, SENT, step } from '../test/enrollment';
import {
  completedSteps,
  DEFAULT_ENROLLMENT_STEPS,
  enrollmentFlowRows,
  enrollmentStepBlock,
  enrollmentStepPath,
  enrollmentStepViews,
  isDocumentStep,
  isEnrollmentStep,
  moveEnrollmentStep,
  openableStep,
  REQUIRED_ENROLLMENT_STEP,
  stepOf,
  stepperSteps,
  toggleEnrollmentStep,
  usesCamera,
} from './enrollmentStepRules';

/*
 * Las reglas puras del registro de identidad dinámico (decisión del dueño del producto, 2026-10-08): traducen lo que
 * manda el servidor a lo que ve la persona y a dónde lleva cada paso, y las de la configuración del ADMIN. Nada se
 * calcula: un estado nuevo va primero al backend.
 */
const CATALOG = ['INITIAL_PHOTO', 'FACE_CAPTURES', 'VOICE_VIDEO', 'OFFICIAL_ID', 'PROOF_OF_ADDRESS'];
/** El nombre de un paso como lo daría el catálogo (el backend lo manda traducido). */
const NAMES: Record<string, string> = {
  INITIAL_PHOTO: 'Foto inicial',
  FACE_CAPTURES: 'Identificación biométrica',
  VOICE_VIDEO: 'Video con preguntas',
  OFFICIAL_ID: 'Identificación oficial',
  PROOF_OF_ADDRESS: 'Comprobante de domicilio',
};
const name = (code: string | null) => (code ? (NAMES[code] ?? code) : '');

beforeEach(async () => {
  await setLocale('es-MX');
});

describe('códigos, rutas y confirmación de cada paso', () => {
  it('reconoce los cinco pasos y nada más', () => {
    expect(CATALOG.every(isEnrollmentStep)).toBe(true);
    expect(isEnrollmentStep('FUTURE_STEP')).toBe(false);
    expect(isEnrollmentStep(null)).toBe(false);
  });

  it('cada paso conocido tiene su pantalla; uno desconocido, ninguna', () => {
    expect(enrollmentStepPath('INITIAL_PHOTO')).toBe(paths.employee.enrollPhoto);
    expect(enrollmentStepPath('FACE_CAPTURES')).toBe(paths.employee.enrollCapture);
    expect(enrollmentStepPath('VOICE_VIDEO')).toBe(paths.employee.enrollVoice);
    expect(enrollmentStepPath('OFFICIAL_ID')).toBe('/employee/enroll/document/OFFICIAL_ID');
    expect(enrollmentStepPath('PROOF_OF_ADDRESS')).toBe('/employee/enroll/document/PROOF_OF_ADDRESS');
    expect(enrollmentStepPath('FUTURE_STEP')).toBeNull();
  });

  it('solo los pasos de cámara se confirman antes de abrirse; los de documentos van a su formulario', () => {
    expect(['INITIAL_PHOTO', 'FACE_CAPTURES', 'VOICE_VIDEO'].every(usesCamera)).toBe(true);
    expect(usesCamera('OFFICIAL_ID')).toBe(false);
    expect(['OFFICIAL_ID', 'PROOF_OF_ADDRESS'].every(isDocumentStep)).toBe(true);
    expect(isDocumentStep('INITIAL_PHOTO')).toBe(false);
  });

  it('el flujo por omisión y el paso que nunca se quita son los del backend', () => {
    expect(DEFAULT_ENROLLMENT_STEPS).toEqual(['INITIAL_PHOTO', 'FACE_CAPTURES', 'VOICE_VIDEO']);
    expect(REQUIRED_ENROLLMENT_STEP).toBe('FACE_CAPTURES');
  });

  it('busca un paso del flujo por su código', () => {
    expect(stepOf(PHOTO_DONE, 'FACE_CAPTURES')?.status).toBe('pending');
    expect(stepOf(PHOTO_DONE, 'OFFICIAL_ID')).toBeUndefined();
  });

  it('el botón del índice abre un paso del flujo con su pantalla', () => {
    expect(openableStep(PHOTO_DONE, 'FACE_CAPTURES')).toEqual({ step: stepOf(PHOTO_DONE, 'FACE_CAPTURES'), path: paths.employee.enrollCapture });
    expect(openableStep(CUSTOM_FIVE, 'OFFICIAL_ID').path).toBe('/employee/enroll/document/OFFICIAL_ID');
  });

  it('un paso que el flujo no trae, o que la app no conoce, es un fallo de la app con un código estable (nunca un toque ignorado)', () => {
    expect(() => openableStep(PHOTO_DONE, 'OFFICIAL_ID')).toThrow('ENROLLMENT_STEP_NOT_OPENABLE'); // no está en el flujo
    expect(() => openableStep(progress([step('FUTURE_STEP', 'pending')]), 'FUTURE_STEP')).toThrow('ENROLLMENT_STEP_NOT_OPENABLE'); // está, pero sin pantalla
  });
});

describe('el índice: estado, aviso y botón de cada paso', () => {
  it('nada hecho: la foto por tomar y los demás bloqueados con el paso que falta', () => {
    const [photo, captures, video] = enrollmentStepViews(NOTHING_DONE, name);
    expect(photo).toMatchObject({ code: 'INITIAL_PHOTO', position: 1, known: true, tone: 'pending', badge: 'Pendiente', hint: null });
    expect(photo.action).toEqual({ label: 'photo', primary: true });
    expect(captures).toMatchObject({ tone: 'locked', badge: 'Bloqueado', hint: 'Primero completa «Foto inicial».', action: null });
    expect(video.hint).toBe('Primero completa «Identificación biométrica».');
  });

  it('la foto hecha y vigente se repite (acción secundaria) y dice hasta cuándo sirve', () => {
    const [photo, captures] = enrollmentStepViews(PHOTO_DONE, name);
    expect(photo.tone).toBe('done');
    expect(photo.badge).toContain('Completado · ');
    expect(photo.hint).toContain('Sirve hasta el ');
    expect(photo.action).toEqual({ label: 'retakePhoto', primary: false });
    expect(captures.action).toEqual({ label: 'captures', primary: true });
  });

  it('usada por las capturas, la foto ya no se repite; el video a medias dice cuántas respondió', () => {
    const [photo, , video] = enrollmentStepViews(CAPTURES_DONE, name);
    expect(photo.action).toBeNull();
    expect(photo.hint).toBeNull();
    expect(video.badge).toBe('2 de 3 respondidas');
    expect(video.action).toEqual({ label: 'resumeVideo', primary: true });
  });

  it('un video pendiente sin conteos (el servidor aún no arma la sesión) dice «Pendiente» y se graba desde el principio', () => {
    const [video] = enrollmentStepViews(progress([step('VOICE_VIDEO', 'pending')]), name);
    expect(video.badge).toBe('Pendiente');
    expect(video.action).toEqual({ label: 'video', primary: true });
  });

  it('un paso hecho sin fecha dice solo «Completado»', () => {
    const [done] = enrollmentStepViews(progress([step('FACE_CAPTURES', 'done')]), name);
    expect(done.badge).toBe('Completado');
  });

  it('la foto vencida se repite con su aviso', () => {
    const [photo] = enrollmentStepViews(progress([step('INITIAL_PHOTO', 'expired', { done_at: CHECKED, expires_at: EXPIRES })]), name);
    expect(photo.tone).toBe('warn');
    expect(photo.badge).toBe('Vencido');
    expect(photo.hint).toBe('Tu foto venció. Tómala de nuevo.');
    expect(photo.action).toEqual({ label: 'photo', primary: true });
  });

  it('el video sin intentos no ofrece nada y dice qué repetir', () => {
    const [video] = enrollmentStepViews(progress([step('VOICE_VIDEO', 'exhausted', { answered: 1, total: 3, attempts_left: 0 })]), name);
    expect(video.tone).toBe('warn');
    expect(video.badge).toBe('Intentos agotados');
    expect(video.hint).toContain('Se agotaron los intentos');
    expect(video.action).toBeNull();
  });

  it('un bloqueo sin el paso que falta (un contrato a medias) no rompe el aviso', () => {
    const [captures] = enrollmentStepViews(progress([step('FACE_CAPTURES', 'blocked')]), name);
    expect(captures.hint).toBe('Primero completa «».');
  });

  it('los CINCO pasos en el orden del ADMIN, con su posición y sus acciones de documentos', () => {
    const views = enrollmentStepViews(CUSTOM_FIVE, name);
    expect(views.map((view) => [view.code, view.position, view.tone])).toEqual([
      ['OFFICIAL_ID', 1, 'done'],
      ['PROOF_OF_ADDRESS', 2, 'pending'],
      ['VOICE_VIDEO', 3, 'locked'],
      ['INITIAL_PHOTO', 4, 'locked'],
      ['FACE_CAPTURES', 5, 'locked'],
    ]);
    expect(views[0].action).toEqual({ label: 'replaceDocument', primary: false }); // un documento hecho se reemplaza
    expect(views[1].action).toEqual({ label: 'document', primary: true });
  });

  it('un flujo de dos pasos solo dibuja esos dos', () => {
    expect(enrollmentStepViews(CUSTOM_TWO, name).map((view) => view.code)).toEqual(['OFFICIAL_ID', 'FACE_CAPTURES']);
  });

  it('un código que la app no conoce se dibuja atenuado, sin acción y pidiendo actualizar', () => {
    const [future] = enrollmentStepViews(progress([step('FUTURE_STEP', 'pending')]), name);
    expect(future).toMatchObject({ known: false, tone: 'locked', action: null });
    expect(future.hint).toBe('Actualiza la aplicación para continuar con este paso.');
  });
});

describe('el indicador y «En validación»', () => {
  it('los pasos del indicador salen del servidor (lo verde, de su estado «done»)', () => {
    expect(stepperSteps(CAPTURES_DONE)).toEqual([
      { code: 'INITIAL_PHOTO', done: true },
      { code: 'FACE_CAPTURES', done: true },
      { code: 'VOICE_VIDEO', done: false },
    ]);
  });

  it('un flujo terminado marca todos sus pasos', () => {
    expect(completedSteps(['OFFICIAL_ID', 'FACE_CAPTURES'])).toEqual([
      { code: 'OFFICIAL_ID', done: true },
      { code: 'FACE_CAPTURES', done: true },
    ]);
  });

  it('con la verificación por voz apagada, el servidor no pide el video: no se cuenta entre los pasos terminados', () => {
    const codes = ['INITIAL_PHOTO', 'FACE_CAPTURES', 'VOICE_VIDEO'];
    expect(completedSteps(codes, false)).toEqual([
      { code: 'INITIAL_PHOTO', done: true },
      { code: 'FACE_CAPTURES', done: true },
    ]);
    expect(completedSteps(codes, true).map((one) => one.code)).toEqual(codes); // encendida (por omisión), el video sí
  });
});

describe('el candado de la pantalla de un paso', () => {
  it('se puede abrir el paso que toca', () => {
    expect(enrollmentStepBlock('INITIAL_PHOTO', NOTHING_DONE)).toBeNull();
    expect(enrollmentStepBlock('FACE_CAPTURES', PHOTO_DONE)).toBeNull();
    expect(enrollmentStepBlock('VOICE_VIDEO', CAPTURES_DONE)).toBeNull();
  });

  it('un paso que la empresa no pide, uno desconocido, uno bloqueado, uno hecho y uno sin intentos', () => {
    expect(enrollmentStepBlock('OFFICIAL_ID', NOTHING_DONE)).toEqual({ reason: 'disabled', step: null });
    expect(enrollmentStepBlock('FUTURE_STEP', NOTHING_DONE)).toEqual({ reason: 'unknown', step: null });
    expect(enrollmentStepBlock('FACE_CAPTURES', NOTHING_DONE)).toEqual({ reason: 'blocked', step: 'INITIAL_PHOTO' });
    expect(enrollmentStepBlock('FACE_CAPTURES', CAPTURES_DONE)).toEqual({ reason: 'done', step: null });
    expect(enrollmentStepBlock('VOICE_VIDEO', progress([step('VOICE_VIDEO', 'exhausted', { attempts_left: 0 })]))).toEqual({ reason: 'exhausted', step: null });
  });

  it('un paso REPETIBLE hecho sí se abre: la foto vigente y un documento', () => {
    expect(enrollmentStepBlock('INITIAL_PHOTO', PHOTO_DONE)).toBeNull();
    expect(enrollmentStepBlock('INITIAL_PHOTO', CAPTURES_DONE)).toEqual({ reason: 'done', step: null }); // ya consumida
    expect(enrollmentStepBlock('OFFICIAL_ID', CUSTOM_FIVE)).toBeNull();
  });
});

describe('la configuración del ADMIN: qué pasos y en qué orden', () => {
  it('primero los que se piden, en su orden, y después los que no', () => {
    expect(enrollmentFlowRows(['OFFICIAL_ID', 'FACE_CAPTURES'], CATALOG)).toEqual([
      { code: 'OFFICIAL_ID', position: 1, enabled: true, locked: false, canUp: false, canDown: true },
      { code: 'FACE_CAPTURES', position: 2, enabled: true, locked: true, canUp: true, canDown: false },
      { code: 'INITIAL_PHOTO', position: null, enabled: false, locked: false, canUp: false, canDown: false },
      { code: 'VOICE_VIDEO', position: null, enabled: false, locked: false, canUp: false, canDown: false },
      { code: 'PROOF_OF_ADDRESS', position: null, enabled: false, locked: false, canUp: false, canDown: false },
    ]);
  });

  it('un código repetido se cuenta una vez y uno que el catálogo ya no trae también aparece', () => {
    const rows = enrollmentFlowRows(['FACE_CAPTURES', 'FACE_CAPTURES', 'FUTURE_STEP'], ['FACE_CAPTURES']);
    expect(rows.map((row) => [row.code, row.position])).toEqual([
      ['FACE_CAPTURES', 1],
      ['FUTURE_STEP', 2],
    ]);
  });

  it('pedir un paso lo agrega al final; dejar de pedirlo lo saca; pedir uno que ya está no duplica', () => {
    expect(toggleEnrollmentStep(['INITIAL_PHOTO', 'FACE_CAPTURES'], 'OFFICIAL_ID', true)).toEqual(['INITIAL_PHOTO', 'FACE_CAPTURES', 'OFFICIAL_ID']);
    expect(toggleEnrollmentStep(['INITIAL_PHOTO', 'FACE_CAPTURES'], 'INITIAL_PHOTO', false)).toEqual(['FACE_CAPTURES']);
    expect(toggleEnrollmentStep(['FACE_CAPTURES'], 'FACE_CAPTURES', true)).toEqual(['FACE_CAPTURES']);
  });

  it('mover un paso intercambia con su vecino; fuera de la lista o del borde, nada cambia', () => {
    const flow = ['INITIAL_PHOTO', 'FACE_CAPTURES', 'VOICE_VIDEO'];
    expect(moveEnrollmentStep(flow, 'FACE_CAPTURES', -1)).toEqual(['FACE_CAPTURES', 'INITIAL_PHOTO', 'VOICE_VIDEO']);
    expect(moveEnrollmentStep(flow, 'FACE_CAPTURES', 1)).toEqual(['INITIAL_PHOTO', 'VOICE_VIDEO', 'FACE_CAPTURES']);
    expect(moveEnrollmentStep(flow, 'INITIAL_PHOTO', -1)).toEqual(flow);
    expect(moveEnrollmentStep(flow, 'VOICE_VIDEO', 1)).toEqual(flow);
    expect(moveEnrollmentStep(flow, 'OFFICIAL_ID', -1)).toEqual(flow);
  });
});

describe('los tipos de documento de cada paso llegan del servidor', () => {
  it('cada paso de documentos trae los suyos', () => {
    expect(stepOf(CUSTOM_FIVE, 'OFFICIAL_ID')?.document_types).toEqual(OFFICIAL_ID_TYPES);
    expect(stepOf(CUSTOM_FIVE, 'PROOF_OF_ADDRESS')?.document_types).toEqual(ADDRESS_TYPES);
    expect(stepOf(CUSTOM_FIVE, 'OFFICIAL_ID')?.done_at).not.toBe(SENT);
  });
});
