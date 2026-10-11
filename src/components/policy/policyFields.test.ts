import { describe, expect, it } from 'vitest';
import { testCatalogs } from '../../test/catalogs';
import { sampleAdminPolicy } from '../../test/fixtures';
import { appliesTo, describeFieldChange, fieldLabel, fieldValue, footnote, onOff, withChanges } from './policyFields';

/*
 * Nombre y valor legibles de cada campo del historial de la política. Un campo o valor que la app no conoce (otra
 * versión del backend) se muestra tal cual: nunca se oculta un cambio.
 */
const label = (field: string) => fieldLabel(field, sampleAdminPolicy, testCatalogs);
const value = (field: string, raw: unknown) => fieldValue(field, raw, testCatalogs);

describe('fieldLabel: el nombre de cada campo', () => {
  it('interruptores, ajustes, motor de riesgo y prueba de presencia usan los textos de la pantalla', () => {
    expect(label('anti_spoofing')).toBe('Detección de suplantación');
    expect(label('liveness_timeout_seconds')).toBe('Tiempo para la prueba de vida');
    expect(label('risk_high_score')).toBe('Riesgo alto desde');
    expect(label('site_codes')).toBe('Código de sitio');
  });

  it('la voz de la guía y el orden del registro de identidad tienen su nombre propio', () => {
    expect(label('voice_profile')).toBe('Voz de la guía');
    expect(label('enrollment_steps')).toBe('Orden del registro');
  });

  it('un accesorio con regla se nombra con su frase del catálogo; uno inactivo se muestra tal cual', () => {
    expect(label('block_glasses')).toBe('Retirar los lentes');
    expect(fieldLabel('block_glasses', sampleAdminPolicy, { accessories: [] })).toBe('block_glasses');
  });

  it('el modo y los puntos de una señal del motor llevan el nombre de la señal; sin ella, su código', () => {
    expect(label('risk_signals.REPLAY_PERCEPTUAL.mode')).toBe('Modo de «Reenvío perceptual»');
    expect(label('risk_signals.REPLAY_PERCEPTUAL.points')).toBe('Puntos de «Reenvío perceptual»');
    expect(label('risk_signals.NUEVA_SENAL.mode')).toBe('Modo de «NUEVA_SENAL»');
  });

  it('un campo que la app no conoce se muestra con su nombre crudo', () => {
    expect(label('campo_futuro')).toBe('campo_futuro');
    expect(label('risk_signals.minusculas.mode')).toBe('risk_signals.minusculas.mode');
    expect(label('risk_signals.REPLAY_PERCEPTUAL.otro')).toBe('risk_signals.REPLAY_PERCEPTUAL.otro');
  });
});

describe('fieldValue: el valor legible', () => {
  it('sin valor, el guion', () => {
    expect(value('min_confidence', null)).toBe('—');
    expect(value('min_confidence', undefined)).toBe('—');
  });

  it('interruptores', () => {
    expect(value('anti_spoofing', true)).toBe('Activado');
    expect(value('anti_spoofing', false)).toBe('Desactivado');
  });

  it('números: confianza en porcentaje, puntos con su unidad y el resto con el formato del idioma', () => {
    expect(value('min_confidence', 0.8)).toBe('80 %');
    expect(value('risk_signals.REPLAY_PERCEPTUAL.points', 60)).toBe('60 pts');
    expect(value('risk_high_score', 50)).toBe('50 pts');
    expect(value('lockout_max_failures', 5)).toBe('5');
  });

  it('un código de catálogo se muestra con su nombre; uno desconocido, tal cual', () => {
    expect(value('risk_fallback_action', 'ALLOW')).toBe(testCatalogs.nameOf('risk_actions', 'ALLOW'));
    expect(value('risk_failure_policy', 'RETRY')).toBe(testCatalogs.nameOf('risk_fallback_actions', 'RETRY'));
    expect(value('site_codes', 'OBSERVE')).toBe('Solo medir');
    expect(value('risk_signals.REPLAY_PERCEPTUAL.mode', 'ENFORCE')).toBe('Obligatoria');
    expect(value('risk_signals.REPLAY_PERCEPTUAL.mode', 'NUEVO')).toBe('NUEVO');
    expect(value('anti_spoofing_level', 'NINGUNO')).toBe('NINGUNO');
  });

  it('texto libre y objetos: el texto tal cual y el JSON de lo demás', () => {
    expect(value('campo_futuro', 'hola')).toBe('hola');
    expect(value('campo_futuro', { a: 1 })).toBe('{"a":1}');
  });

  it('una lista de pasos se lee como el orden completo; vacía, con el guion; nunca el JSON crudo', () => {
    expect(value('enrollment_steps', ['INITIAL_PHOTO', 'FACE_CAPTURES', 'VOICE_VIDEO'])).toBe('Foto inicial, Identificación biométrica y Video con preguntas');
    expect(value('enrollment_steps', ['FACE_CAPTURES'])).toBe('Identificación biométrica');
    expect(value('enrollment_steps', ['FACE_CAPTURES', 'PASO_FUTURO'])).toBe('Identificación biométrica y PASO_FUTURO');
    expect(value('enrollment_steps', [])).toBe('—');
  });

  it('una lista en un campo que no es de pasos, o un valor de pasos que no es lista, no se interpreta como pasos', () => {
    expect(value('campo_futuro', ['A', 'B'])).toBe('["A","B"]');
    expect(value('enrollment_steps', 'FACE_CAPTURES')).toBe('FACE_CAPTURES');
  });
});

describe('textos al pie de una confirmación', () => {
  it('«Activado» / «Desactivado» y a quién aplica', () => {
    expect(onOff(true)).toBe('Activado');
    expect(onOff(false)).toBe('Desactivado');
    expect(appliesTo('Panificadora')).toBe('Aplica en segundos a todo el personal de Panificadora.');
  });

  it('relajar la seguridad con la regla de dos personas pide la aprobación de otro ADMIN; lo demás, a quién aplica', () => {
    expect(footnote('Panificadora', true, true)).not.toBe(appliesTo('Panificadora'));
    expect(footnote('Panificadora', true, false)).toBe(appliesTo('Panificadora'));
    expect(footnote('Panificadora', false, true)).toBe(appliesTo('Panificadora'));
  });
});

describe('describeFieldChange y withChanges', () => {
  it('un cambio del historial como «Campo: antes → después»', () => {
    expect(describeFieldChange({ field: 'enrollment_steps', before: ['FACE_CAPTURES'], after: ['INITIAL_PHOTO', 'FACE_CAPTURES'], relaxes: false }, sampleAdminPolicy, testCatalogs)).toEqual({
      label: 'Orden del registro',
      before: 'Identificación biométrica',
      after: 'Foto inicial e Identificación biométrica',
    });
  });

  it('la vista optimista reemplaza los campos directos y aplica el ajuste de cada señal sobre su fila', () => {
    const next = withChanges(sampleAdminPolicy, { min_confidence: 0.9, reason: 'Más estricto', risk_signals: { REPLAY_PERCEPTUAL: { mode: 'OBSERVE', points: 40 } } });
    expect(next.min_confidence).toBe(0.9);
    expect(next).not.toHaveProperty('reason');
    expect(next.risk_signals.find((signal) => signal.code === 'REPLAY_PERCEPTUAL')).toMatchObject({ mode: 'OBSERVE', points: 40 });
    expect(next.risk_signals.find((signal) => signal.code === 'SPOOF_PROB_LOW')).toMatchObject({ mode: 'ENFORCE' });
  });

  it('sin ajuste de señales conserva las de la política', () => {
    expect(withChanges(sampleAdminPolicy, { min_confidence: 0.7 }).risk_signals).toBe(sampleAdminPolicy.risk_signals);
  });
});
