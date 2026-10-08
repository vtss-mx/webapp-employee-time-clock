import { derive } from '../../derive';
import es from '../es-MX/attendance';

/**
 * Textos de la asistencia vista por la empresa (y de los registros en revisión, `review`) en español de España
 * (es-ES): solo lo que cambia respecto de es-MX (vocabulario; glosario §3).
 */
export default derive(es, {
  minutes: {
    late: '{time} de retraso',
  },
  breaks: {
    add: 'Añadir descanso',
    empty: 'Sin descansos: añade los que tomó.',
  },
  summary: {
    deadline: 'Se puede fichar hasta las {time}',
    workedPending: 'Se calcula al fichar la salida',
  },
  timeline: {
    missed: 'Programada {time} · el límite para fichar fue a las {deadline}',
    pending: 'Programada {time} · se puede fichar hasta las {deadline}',
  },
  manual: {
    stillWorking: 'Aún no ha salido',
    reasonPlaceholder: 'Por ejemplo: olvidó fichar la salida.',
    validation: {
      checkOut: 'Indica la hora de salida o marca «Aún no ha salido»',
    },
    confirm: {
      editNote: 'Lo anterior queda en el historial y el empleado verá el motivo.',
    },
    success: {
      correctedText: 'Lo anterior queda en el historial de {name}.',
    },
  },
  review: {
    intro: 'Algo de la captura o la ubicación no fue del todo fiable. Revisa la evidencia y confirma o rechaza el registro.',
  },
});
