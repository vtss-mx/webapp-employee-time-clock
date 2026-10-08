import { derive } from '../../derive';
import es from '../es-MX/departments';

/** Textos de departamentos y responsables en español de España (es-ES): solo lo que cambia respecto de es-MX (vocabulario; glosario §3). */
export default derive(es, {
  detail: {
    addManager: 'Añadir responsable',
    noManagersDescription: 'Añade a quien supervisa este departamento.',
  },
  assign: {
    managers: {
      title: 'Añadir responsables',
      error: 'No se pudo añadir al responsable',
      done: 'Responsable añadido',
    },
  },
});
