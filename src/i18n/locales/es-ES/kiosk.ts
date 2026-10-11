import { derive } from '../../derive';
import es from '../es-MX/kiosk';

/**
 * Quioscos de los sitios en español de España (es-ES): solo lo que cambia respecto de es-MX (vocabulario; glosario §3):
 * «quiosco», la forma preferida en España.
 */
export default derive(es, {
  pairing: {
    created: 'Quiosco creado',
    expires: 'Caduca el {date}.',
  },
  manage: {
    title: 'Quioscos',
    subtitle_one: '{count} quiosco',
    subtitle_other: '{count} quioscos',
    intro: 'La tableta de cada quiosco muestra el código que tu personal escanea o escribe al verificar su identidad en el sitio.',
    new: 'Nuevo quiosco',
    newTitle: 'Nuevo quiosco',
    kiosk: 'Quiosco',
    loadError: 'No se pudieron cargar los quioscos',
    empty: 'Sin quioscos',
    emptyDescription: 'Crea un quiosco para mostrar el código del sitio.',
    noun: { one: 'quiosco', other: 'quioscos' },
    columns: {
      kiosk: 'Quiosco',
    },
    nameRequired: 'Escribe el nombre del quiosco',
    create: 'Crear quiosco',
    createTitle: '¿Crear el quiosco {name}?',
    createError: 'No se pudo crear el quiosco',
    deleteOf: 'Eliminar el quiosco {name}',
    deleteTitle: '¿Eliminar el quiosco {name}?',
    deleteError: 'No se pudo eliminar el quiosco',
    deleted: 'Quiosco eliminado',
    restoreTitle: '¿Restaurar el quiosco {name}?',
  },
  display: {
    pairText: 'Escribe el código de vinculación que generó tu empresa en los quioscos del sitio.',
    pairHint: 'Diez letras y números; el guion se añade solo.',
    pairConfirmMessage: 'Mostrará el código del sitio para verificar la identidad.',
    hint: 'Escanéalo o escribe el código al verificar tu identidad.',
    footer: 'Quiosco del sitio',
  },
});
