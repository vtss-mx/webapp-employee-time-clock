import { derive } from '../../derive';
import es from '../es-MX/sites';

/** Textos de los sitios donde se ficha en español de España (es-ES): solo lo que cambia respecto de es-MX (vocabulario; glosario §3). */
export default derive(es, {
  list: {
    subtitle_one: '{count} sitio · dónde se ficha en persona y con qué radio',
    subtitle_other: '{count} sitios · dónde se ficha en persona y con qué radio',
    kiosksOf_one: '{count} quiosco de {name}',
    kiosksOf_other: '{count} quioscos de {name}',
    empty: {
      description: 'Crea un sitio para indicar dónde ficha tu personal.',
    },
  },
  form: {
    newSubtitle: 'Un lugar donde tu personal ficha en persona: planta, sucursal, oficina…',
    rule: 'Radio para fichar: {distance}.',
    created: {
      text: '{name} ya se puede añadir a tus turnos. {rule}',
    },
    /** Un ejemplo sin una ciudad de México («Planta Hermosillo» en es-MX). */
    nameExample: 'Planta Norte',
    nameHint: 'Único en tu empresa: p. ej. “Planta Norte”',
    radius: 'Radio para fichar (metros)',
    onSiteNote: 'En el sitio se ficha con el rostro y la ubicación del teléfono, dentro de este radio.',
    locationIntro: 'Busca el lugar o toca el mapa. El círculo marca el radio para fichar.',
  },
  fields: {
    radius: 'Radio para fichar',
  },
  confirm: {
    createMessage: 'Se podrá añadir a tus turnos; quien los tenga fichará aquí.',
  },
  status: {
    activeMeaning: 'Se puede añadir a los turnos y quien los tenga puede fichar aquí.',
    inactiveMeaning: 'Nadie puede fichar en este sitio y no se puede añadir a un turno.',
    deactivateWarning: 'Nadie podrá fichar aquí ni añadirlo a un turno hasta que lo actives. Los turnos que lo incluyen y lo ya registrado no cambian.',
    removeWarning: 'Solo se puede eliminar si ningún turno lo usa y nadie ha fichado ahí. Si un turno lo usa, quítalo del turno; si ya se fichó ahí, desactívalo.',
  },
  presence: {
    hint: 'Pide en la entrada y la salida el código que muestra el quiosco del sitio.',
  },
});
