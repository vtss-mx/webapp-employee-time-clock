import { derive } from '../../derive';
import es from '../es-MX/validators';

/** Textos de los validadores en español de España (es-ES): solo lo que cambia respecto de es-MX (vocabulario; glosario §3). */
export default derive(es, {
  list: {
    add: 'Añadir validador',
    empty: {
      description: 'Añade un validador para identificar a tu personal.',
    },
    neverLoggedIn: 'Aún no ha iniciado sesión',
    noAddress: 'Sin domicilio: edítalo para añadirlo',
    logged: 'Cada identificación queda en el historial con el validador que la hizo.',
  },
  delete: {
    message: 'Se eliminará su cuenta y sus dispositivos ya no podrán iniciar sesión. El historial de sus identificaciones se conserva.',
    doneText: 'El historial de sus identificaciones se conserva.',
  },
  form: {
    addTitle: 'Añadir validador',
    addressIntro: 'Busca el lugar o toca el mapa: Google rellena el domicilio y puedes corregirlo.',
    nameHint: 'Así lo verás en el historial: p. ej. “Recepción planta 1”',
    addError: 'No se pudo añadir el validador',
    createConfirm: {
      title: '¿Añadir el validador {name}?',
    },
    saved: {
      added: 'Validador añadido',
    },
  },
  devices: {
    intro: 'Cada tableta o teléfono donde el validador inicia sesión tiene una clave que no se puede copiar y funciona solo cuando lo autorizas.',
  },
});
