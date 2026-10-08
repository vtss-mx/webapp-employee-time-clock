import { derive } from '../../derive';
import es from '../es-MX/calendar';

/**
 * Textos del calendario (festivos, ausencias, solicitudes y días laborables) en español de España (es-ES): solo lo que
 * cambia respecto de es-MX (vocabulario; glosario §3): «fichar», «añadir» y «baja médica» por «incapacidad».
 */
export default derive(es, {
  validation: {
    rangeMax: 'Una ausencia dura como máximo {max} días',
  },
  holidays: {
    addOfficial: 'Añadir festivos oficiales de {year}',
    add: 'Añadir festivo',
    empty: {
      description: 'Añade los festivos oficiales o los de tu empresa.',
    },
    officialConfirm: {
      title: '¿Añadir los festivos oficiales de {year}?',
      message:
        'Se añaden los días de descanso obligatorio de {year} (Ley Federal del Trabajo, art. 74) que aún no estén en tu calendario. Esos días nadie tiene que fichar.',
      after: 'Al terminar verás cada fecha que se añadió; cualquiera se puede eliminar después.',
      confirm: 'Añadir festivos',
      error: 'No se pudieron añadir los festivos oficiales',
    },
    officialDone: {
      allThereText: 'Los {existing} festivos oficiales de {year} ya estaban en tu calendario: no se añadió nada.',
      added_one: 'Se añadió {count} festivo oficial',
      added_other: 'Se añadieron {count} festivos oficiales',
    },
    removeConfirm: {
      message: 'Ese día vuelve a ser laborable: quien tenga turno tendrá que fichar.',
    },
  },
  absences: {
    intro: 'Vacaciones, permisos y bajas médicas de tu equipo.',
    empty: {
      description: 'Registra vacaciones, permisos o bajas médicas.',
    },
    cancelConfirm: {
      message: 'Sus días vuelven a ser laborables: tendrá que fichar en ellos.',
    },
  },
  requests: {
    approveConfirm: {
      message: 'Esos días no tendrá que fichar.',
      doneText: '{name} no tiene que fichar: {range}.',
    },
  },
  workdays: {
    create: 'Añadir día laborable',
    removeConfirm: {
      message: 'Ese día vuelve a ser libre para la persona: ya no tendrá que fichar.',
    },
  },
  absenceForm: {
    subtitle: 'Vacaciones, permiso o baja médica de uno o varios empleados: esos días no tienen que fichar.',
    notePlaceholder: 'P. ej. vacaciones de fin de año o el número de la baja médica',
    confirm: {
      message:
        'Queda aprobada: esos días no tienen que fichar. A quien esté inactivo o ya tenga otra ausencia esos días no se le registra (el resultado lo dice).',
    },
  },
  reject: {
    intro: 'Pidió {kind}: {range} ({days}). Esos días seguirá teniendo que fichar y verá esta nota en su solicitud.',
    confirmMessage: 'Esos días seguirá teniendo que fichar y verá tu nota en su solicitud.',
  },
  holidayForm: {
    title: 'Añadir día festivo',
    dateHint: 'Los festivos oficiales del año se añaden con un botón en el calendario.',
    submit: 'Añadir festivo',
    error: 'No se pudo añadir el día festivo',
    confirm: {
      title: '¿Añadir {name} como día festivo?',
      message: 'Es un día de descanso para toda la empresa: nadie tiene que fichar, salvo quien tenga un día laborable especial.',
    },
    done: 'Día festivo añadido',
    doneText: '{name}: {date}. Ese día nadie tiene que fichar.',
  },
  workdayForm: {
    error: 'No se pudo añadir el día laborable',
    confirm: {
      title: '¿Añadir el día laborable?',
      message: 'Ese día, aunque sea festivo o esté dentro de su ausencia, la persona sí trabaja y ficha.',
    },
    done: 'Día laborable añadido',
    doneText: '{name} trabaja el {date}: ese día sí ficha.',
  },
});
