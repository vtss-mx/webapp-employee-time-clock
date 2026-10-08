import { derive } from '../../derive';
import es from '../es-MX/myAttendance';

/**
 * Textos de Mi asistencia (registro, jornada y solicitudes del empleado) en español de España (es-ES): solo lo que
 * cambia respecto de es-MX (vocabulario; glosario §3): «fichar», «reloj de fichar», «quiosco», «antelación».
 */
export default derive(es, {
  home: {
    clockTitle: 'Tu reloj de fichar',
    placesToday: 'Dónde puedes fichar hoy',
    placesNext: 'Dónde ficharás tu próxima jornada',
    noShift: {
      description: 'Solicita uno para empezar a fichar.',
    },
  },
  clock: {
    label: 'Reloj de fichar',
    nextWorkday: 'Próxima jornada: {date} · puedes fichar desde las {time}',
    countdown: {
      opensIn: 'Podrás fichar en',
      open: 'Ya puedes fichar',
    },
  },
  places: {
    remote: {
      title: 'Puedes fichar en remoto',
    },
  },
  record: {
    problem: {
      text: 'Corrige lo indicado e inténtalo de nuevo.',
    },
  },
  problems: {
    impossibleTravel: {
      gps: 'Activa la ubicación precisa (GPS) e inténtalo de nuevo.',
    },
  },
  shiftRequests: {
    subtitle: 'Pide otro turno con al menos un día de antelación.',
  },
  shiftRequestForm: {
    shiftHint: 'Cada turno indica su horario, días y dónde se ficha.',
    fromHint: 'Con al menos un día de antelación (desde mañana).',
    reasonPlaceholder: 'Por ejemplo: tengo clase por las mañanas.',
  },
  siteCode: {
    text: 'Escanea el QR del quiosco del sitio o escribe los 6 dígitos que muestra.',
    invalidQr: 'Ese QR no es el del quiosco. Apunta al QR de la tableta del sitio.',
  },
});
