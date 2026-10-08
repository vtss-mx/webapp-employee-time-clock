import { describe, expect, it } from 'vitest';
import { cancelCount, fakeVoice, lastUtterance, removeSpeechSupport, setVoices, spokenTexts } from '../test/speechSynthesis';
import { PROFILE_PARAMS, cancelSpeech, pickVoice, speak, speechSupported } from './speech';

/**
 * Guía por voz (decisión del dueño, 2026-10-08): el único módulo que toca `speechSynthesis`, con su síntesis simulada
 * (`test/speechSynthesis`). Se prueba el soporte, cada perfil, la elección de voz por idioma y género, y que calla lo
 * anterior antes de hablar.
 */
describe('speech: síntesis de voz de la guía', () => {
  it('reconoce el soporte del navegador', () => {
    expect(speechSupported()).toBe(true);
    removeSpeechSupport();
    expect(speechSupported()).toBe(false);
  });

  it('tiene los cinco perfiles del contrato con su género, tono y ritmo', () => {
    expect(Object.keys(PROFILE_PARAMS)).toEqual(['FEMALE_WARM', 'FEMALE_CLEAR', 'MALE_CALM', 'MALE_DEEP', 'NEUTRAL']);
    expect(PROFILE_PARAMS.FEMALE_WARM).toEqual({ gender: 'female', pitch: 1.05, rate: 1.0 });
    expect(PROFILE_PARAMS.NEUTRAL).toEqual({ gender: 'any', pitch: 1.0, rate: 1.0 });
  });

  describe('pickVoice', () => {
    it('sin voces aún devuelve null', () => {
      expect(pickVoice('es-MX', 'any')).toBeNull();
    });

    it('prefiere el idioma exacto, luego el idioma base y, si no, cualquiera', () => {
      setVoices([fakeVoice('A', 'en-US'), fakeVoice('B', 'es-MX')]);
      expect(pickVoice('es-MX', 'any')?.name).toBe('B'); // exacto
      setVoices([fakeVoice('C', 'es_ES')]); // guion bajo del sistema → mismo idioma base «es»
      expect(pickVoice('es-MX', 'any')?.name).toBe('C');
      setVoices([fakeVoice('D', 'fr-FR')]); // ningún español → cualquiera
      expect(pickVoice('es-MX', 'any')?.name).toBe('D');
    });

    it('elige por género según el nombre de la voz (palabra o nombre propio)', () => {
      setVoices([fakeVoice('Spanish Male', 'es-MX'), fakeVoice('Spanish Female', 'es-MX')]);
      expect(pickVoice('es-MX', 'female')?.name).toBe('Spanish Female');
      expect(pickVoice('es-MX', 'male')?.name).toBe('Spanish Male');
      setVoices([fakeVoice('Jorge', 'es-MX'), fakeVoice('Paulina', 'es-MX')]);
      expect(pickVoice('es-MX', 'female')?.name).toBe('Paulina');
      expect(pickVoice('es-MX', 'male')?.name).toBe('Jorge');
    });

    it('sin una voz del género pedido usa la primera del grupo', () => {
      setVoices([fakeVoice('Voz 1', 'es-MX'), fakeVoice('Voz 2', 'es-MX')]);
      expect(pickVoice('es-MX', 'female')?.name).toBe('Voz 1');
    });

    it('sin soporte devuelve null', () => {
      removeSpeechSupport();
      expect(pickVoice('es-MX', 'female')).toBeNull();
    });
  });

  describe('speak', () => {
    it('lee el texto con el tono y el ritmo del perfil y corta lo anterior', () => {
      speak('Mira al frente', { profile: 'FEMALE_CLEAR', locale: 'es-MX' });
      expect(spokenTexts()).toEqual(['Mira al frente']);
      expect(cancelCount()).toBe(1); // interrupt por omisión
      const utterance = lastUtterance();
      expect(utterance?.pitch).toBe(1.15);
      expect(utterance?.rate).toBe(0.92);
      expect(utterance?.lang).toBe('es-MX');
    });

    it('con interrupt:false no corta lo anterior', () => {
      speak('uno', { profile: 'NEUTRAL', locale: 'es-MX', interrupt: false });
      expect(cancelCount()).toBe(0);
    });

    it('con un perfil desconocido o sin perfil usa el de omisión (FEMALE_WARM)', () => {
      speak('hola', { profile: 'NO_EXISTE', locale: 'es-MX' });
      expect(lastUtterance()?.pitch).toBe(PROFILE_PARAMS.FEMALE_WARM.pitch);
      speak('hola', { locale: 'es-MX' }); // sin perfil
      expect(lastUtterance()?.pitch).toBe(PROFILE_PARAMS.FEMALE_WARM.pitch);
    });

    it('cada perfil fija su tono y su ritmo', () => {
      for (const [code, params] of Object.entries(PROFILE_PARAMS)) {
        speak(`voz ${code}`, { profile: code, locale: 'es-MX' });
        expect(lastUtterance()?.pitch).toBe(params.pitch);
        expect(lastUtterance()?.rate).toBe(params.rate);
      }
    });

    it('usa la voz del sistema que coincide y toma su idioma', () => {
      setVoices([fakeVoice('Paulina', 'es-MX')]);
      speak('hola', { profile: 'FEMALE_WARM', locale: 'es-MX' });
      expect(lastUtterance()?.voice?.name).toBe('Paulina');
      expect(lastUtterance()?.lang).toBe('es-MX');
    });

    it('con texto vacío no dice nada', () => {
      speak('', { profile: 'FEMALE_WARM', locale: 'es-MX' });
      expect(spokenTexts()).toEqual([]);
    });

    it('sin soporte no lanza ni dice nada', () => {
      removeSpeechSupport();
      expect(() => speak('hola', { profile: 'FEMALE_WARM', locale: 'es-MX' })).not.toThrow();
    });
  });

  describe('cancelSpeech', () => {
    it('corta lo que se esté diciendo', () => {
      cancelSpeech();
      expect(cancelCount()).toBe(1);
    });

    it('sin soporte no lanza', () => {
      removeSpeechSupport();
      expect(() => cancelSpeech()).not.toThrow();
    });
  });
});
