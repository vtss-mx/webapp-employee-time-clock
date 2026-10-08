import { derive } from '../../derive';
import es from '../es-MX/shifts';

/**
 * Textos de turnos (con su formulario, las asignaciones y las solicitudes de cambio: `form`, `assign`, `requests`) en
 * español de España (es-ES): solo lo que cambia respecto de es-MX (vocabulario; glosario §3): «fichar», «retraso» por
 * «retardo», «antelación» y «se aplica» (en España «aplicar» no se usa como intransitivo).
 */
export default derive(es, {
  facts: {
    sites: 'Sitios donde ficha',
  },
  card: {
    label: 'Turno {name}: cuándo y dónde se ficha',
    remoteDetail: 'Esos días se ficha desde cualquier lugar, con el rostro y la ubicación.',
  },
  list: {
    subtitle_one: '{count} turno · cuándo y dónde se ficha',
    subtitle_other: '{count} turnos · cuándo y dónde se ficha',
    columns: {
      place: 'Dónde se ficha',
    },
    lateTolerance: '{minutes} min de retraso',
    noLateTolerance: 'Sin retraso tolerado',
  },
  choice: {
    chosenHint: 'Para cambiar el horario o dónde se ficha, edita el turno.',
  },
  form: {
    newSubtitle: 'Define el horario, los descansos y dónde se ficha.',
    editSubtitle: '{affects}. Los cambios se aplican a las jornadas que aún no han empezado.',
    updated: {
      text: 'Los cambios de {name} se aplican a las jornadas que aún no han empezado.',
    },
    fields: {
      earlyCheckIn: 'Fichar antes de la entrada',
      lateTolerance: 'Retraso tolerado',
      lateCheckOut: 'Límite para fichar la salida',
      sites: 'Sitios donde se ficha',
      remoteDays: 'Días en que se ficha en remoto',
    },
    sections: {
      place: 'Dónde se ficha',
    },
    tolerances: {
      earlyCheckIn: 'Minutos antes de la hora de entrada en que ya puede fichar',
      lateTolerance: 'Minutos después de la entrada que aún no cuentan como retraso',
      lateCheckOut: 'Minutos después de la hora de salida para fichar la salida',
    },
    place: {
      sitesLabel: 'Sitios donde se ficha en persona',
      sitesRequired: 'Obligatorio: los días no remotos se ficha dentro del radio de uno de estos sitios.',
      remoteLabel: 'Días en que se ficha en remoto',
      remoteHint: 'Esos días se ficha desde cualquier lugar; los demás, en uno de sus sitios.',
    },
    summary: {
      checkInRule: 'Puede fichar desde las {opens}; después de las {late} es retraso.',
    },
    confirm: {
      editMessage: '{affects}: desde ahora fichan con este horario y en estos lugares.',
      editNote: 'Se aplica a las jornadas que aún no han empezado. Lo ya registrado no cambia.',
    },
  },
  assign: {
    appliesFrom: 'Se aplica desde',
    errors: {
      dateRequired: 'Elige la fecha desde la que se aplica',
      fromTomorrow: 'Elige desde mañana: un cambio de turno se programa con un día de antelación.',
    },
    hints: {
      hasShift: 'Ya tiene turno: el cambio se aplica desde mañana o después y su turno actual termina el día anterior.',
    },
    history: {
      empty: {
        active: 'Asígnale uno para que pueda fichar.',
      },
      cancelConfirm: {
        wasFrom: 'Se iba a aplicar desde',
      },
    },
  },
  requests: {
    approve: {
      fromTomorrow: 'Elige desde mañana: el cambio de turno se programa con un día de antelación.',
    },
  },
});
