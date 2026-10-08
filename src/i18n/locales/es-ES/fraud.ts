import { derive } from '../../derive';
import es from '../es-MX/fraud';

/** Textos de los casos de fraude en español de España (es-ES): solo lo que cambia respecto de es-MX (vocabulario; glosario §3). */
export default derive(es, {
  risk: { none: 'Sin puntuación' },
  detail: {
    addNote: 'Añadir nota',
  },
  attempts: {
    score: 'Puntuación {score}',
  },
  note: {
    title: 'Añadir una nota',
    submit: 'Añadir nota',
    confirmTitle: '¿Añadir la nota al caso #{id}?',
    error: 'No se pudo añadir la nota',
  },
});
