/** Textos de Mi asistencia: registro, jornada y solicitudes del empleado (es-MX). */
export default {
  /** Etiquetas que se repiten en tarjetas, confirmaciones y formularios. */
  labels: {
    from: 'Desde',
    to: 'Hasta',
    shift: 'Turno',
  },
  /** Inicio del empleado: su reloj checador. */
  home: {
    eyebrow: 'Mi asistencia',
    clockTitle: 'Tu reloj checador',
    loadError: 'No se pudo cargar tu asistencia',
    greeting: 'Hola, {name}',
    greetingNoName: 'Hola',
    workday: 'Tu jornada',
    placesToday: 'Dónde puedes checar hoy',
    placesNext: 'Dónde checarás tu próxima jornada',
    history: 'Historial',
    shiftChange: 'Cambio de turno',
    myRequests: 'Mis solicitudes',
    daysOff: 'Mis días libres',
    noShift: {
      title: 'Sin turno asignado',
      description: 'Solicita uno para empezar a checar.',
      action: 'Solicitar un turno',
    },
  },
  clock: {
    label: 'Reloj checador',
    nextWorkday: 'Próxima jornada: {date} · puedes checar desde las {time}',
    checkIn: 'Entrada',
    worked: 'Trabajado',
    onBreakSince: 'En descanso desde',
    breaks: 'Descansos',
    /** Descansos usados de los permitidos: "1 de 2". */
    breaksUsed: '{used} de {allowed}',
    breakLength: 'de {duration} cada uno',
    /** Lo que corre en el reloj (la etiqueta antes del tiempo y lo que se dice al llegar). */
    countdown: {
      breakEnds: 'Tu descanso termina en',
      breakOver: 'Terminó tu tiempo de descanso',
      checkOutIn: 'Tu salida es en',
      checkOutNow: 'Ya es hora de tu salida',
      shiftStarts: 'Tu turno empieza en',
      shiftStarted: 'Tu turno ya empezó',
      opensIn: 'Podrás checar en',
      open: 'Ya puedes checar',
    },
    breakWindow: {
      taken: 'Ya tomaste tus descansos',
      available: 'Descanso disponible hasta las {time} · {duration}',
      opensAt: 'Podrás tomar tu descanso desde las {time}',
      closed: 'Tu horario terminó: ya no puedes iniciar un descanso',
    },
    /** Lo que falta: "2 d 3 h", "14 min 05 s", "45 s" (unidades del sistema métrico, iguales en ambos idiomas). */
    left: {
      days: '{days} d',
      daysHours: '{days} d {hours} h',
      minutesSeconds: '{minutes} min {seconds} s',
      seconds: '{seconds} s',
    },
  },
  dayOff: {
    label: 'Día libre',
    today: 'Hoy no trabajas',
    upcoming: 'Tus próximos días libres',
    holiday: 'Día festivo: {name}',
  },
  places: {
    noSite: {
      title: 'Sin sitio de trabajo activo',
      description: 'Pide a tu empresa que revise tu turno.',
    },
    remote: {
      title: 'Puedes checar de forma remota',
      detail: 'Desde cualquier lugar, con tu rostro y tu ubicación.',
    },
  },
  /** Un registro: el botón, su confirmación y sus pasos (ubicación, rostro y resultado). */
  record: {
    /** "Registrar entrada" (la acción es el nombre del catálogo, en minúsculas). */
    label: 'Registrar {action}',
    confirm: {
      title: '¿Registrar tu {action}?',
      message: 'Se leerá tu ubicación y se abrirá la cámara para confirmar que eres tú. La hora la pone el servidor.',
      checkOutNote: 'Con tu salida se cierra tu jornada de hoy.',
    },
    locating: {
      title: 'Obteniendo tu ubicación…',
      text: 'Tu registro lleva tu ubicación y tu rostro. Si el navegador lo pide, permite el acceso.',
    },
    problem: {
      title: 'No se registró tu asistencia',
      text: 'Corrige lo indicado e intenta de nuevo.',
      back: 'Volver a mi asistencia',
    },
    submitting: 'Registrando tu {action}…',
    failed: 'No se pudo registrar tu {action}',
  },
  /** El registro hecho (popup del resultado). */
  result: {
    at: 'a las {time}',
    done: 'Listo',
    inReview: 'Se guardó, pero tu empresa debe revisarlo. Verás el resultado en tu historial.',
    schedule: 'Horario',
    checkOutBy: 'Salida a más tardar',
    break: 'Descanso',
    breakMax: 'Puede durar hasta',
    lasted: 'Duró',
    worked: 'Tiempo trabajado',
    onBreak: 'Tiempo en descanso',
  },
  /** Lo que impide registrar (ubicación o estado), con qué hacer. */
  problems: {
    tapRetry: 'Toca «Reintentar».',
    stale: {
      title: 'Tu asistencia cambió',
      footnote: 'Revisa lo que puedes registrar ahora.',
    },
    inaccurate: {
      precise: 'Activa la ubicación precisa: en iPhone, Ajustes › Privacidad › Localización › Safari › «Ubicación exacta».',
      outdoors: 'Sal a un lugar abierto o acércate a una ventana y espera unos segundos.',
    },
    outOfSite: {
      title: 'Estás fuera de tu sitio de trabajo',
      approach: 'Acércate a uno de tus sitios de trabajo (los ves en «Mi asistencia»).',
      gps: 'Activa la ubicación precisa (GPS) del teléfono.',
    },
    impossibleTravel: {
      title: 'Tu ubicación no es creíble',
      spoofing: 'Desactiva cualquier aplicación que cambie o simule tu ubicación (y la VPN).',
      gps: 'Activa la ubicación precisa (GPS) e intenta de nuevo.',
      report: 'Si sigue ocurriendo, avisa a tu empresa.',
    },
  },
  /** Tarjetas de las listas del empleado (solicitudes, ausencias y festivos). */
  items: {
    cancel: 'Cancelar solicitud',
    companyReply: 'Respuesta de tu empresa:',
    days: 'Días',
    requestedByYou: 'La pediste',
    registeredByCompany: 'La registró tu empresa',
    previousShift: 'Turno anterior',
    noShift: 'Sin turno',
    requested: 'Pedida',
    official: 'Oficial',
    companyHoliday: 'De tu empresa',
  },
  history: {
    title: 'Mi historial',
    subtitle: 'Tus entradas, salidas, descansos y tiempo trabajado.',
    loadError: 'No se pudo cargar tu historial',
    shift: 'Turno {name}',
    empty: {
      title: 'Sin jornadas',
      description: 'Aquí verás tus entradas y salidas de cada día.',
    },
    noun: { one: 'jornada', other: 'jornadas' },
  },
  /** Cancelar una solicitud pendiente (cambio de turno, vacaciones o permiso). */
  cancelRequest: {
    eyebrow: 'Tu solicitud',
    keep: 'Conservarla',
    error: 'No se pudo cancelar la solicitud',
  },
  daysOff: {
    subtitle: 'Tus vacaciones, permisos y próximos días festivos.',
    request: 'Solicitar vacaciones o permiso',
    absences: 'Mis vacaciones y permisos',
    absencesError: 'No se pudieron cargar tus vacaciones y permisos',
    absencesEmpty: {
      title: 'Sin vacaciones ni permisos',
      description: 'Solicita vacaciones o un permiso cuando lo necesites.',
    },
    absencesNoun: { one: 'ausencia', other: 'ausencias' },
    holidays: 'Próximos días festivos',
    holidaysError: 'No se pudieron cargar los días festivos',
    holidaysEmpty: {
      title: 'Sin días festivos próximos',
      description: 'Aquí verás los próximos festivos de tu empresa.',
    },
    holidaysNoun: { one: 'día festivo', other: 'días festivos' },
    cancel: {
      title: '¿Cancelar tu solicitud de {type}?',
      message: 'Tu empresa ya no la revisará. Puedes pedirla de nuevo después.',
    },
  },
  shiftRequests: {
    subtitle: 'Pide otro turno con al menos un día de anticipación.',
    new: 'Pedir cambio de turno',
    loadError: 'No se pudieron cargar tus solicitudes',
    pendingNote: 'Solo puedes tener una solicitud pendiente. Espera la respuesta o cancélala para pedir otra.',
    empty: {
      title: 'Sin solicitudes',
      description: 'Aquí verás tus solicitudes de cambio de turno.',
    },
    noun: { one: 'solicitud', other: 'solicitudes' },
    cancel: {
      title: '¿Cancelar tu solicitud de cambio de turno?',
      message: 'Tu empresa ya no la revisará. Después podrás pedir otra.',
      shift: 'Turno que pediste',
    },
  },
  shiftRequestForm: {
    loadError: 'No se pudieron cargar los turnos',
    shiftSection: 'Turno que quieres',
    shiftPlaceholder: 'Elige un turno',
    shiftHint: 'Cada turno indica su horario, días y dónde se checa.',
    currentShift: 'Tu turno actual',
    fromSection: 'Desde cuándo',
    fromHint: 'Con al menos un día de anticipación (desde mañana).',
    reasonSection: 'Motivo',
    reasonLabel: '¿Por qué pides el cambio?',
    reasonPlaceholder: 'Por ejemplo: entro a la escuela por las mañanas.',
    reasonHint: 'Tu empresa lo verá (5 a 500 caracteres).',
    errors: {
      shift: 'Elige el turno que quieres',
      dateMissing: 'Elige desde cuándo quieres el cambio',
      dateTooSoon: 'Elige mañana o una fecha posterior',
      reason: 'Explica el motivo (al menos 5 caracteres)',
    },
    confirm: {
      title: '¿Pedir el cambio de turno?',
      shift: 'Turno que pides',
      done: 'Aquí verás la respuesta de tu empresa.',
    },
    noShifts: {
      title: 'Sin turnos disponibles',
      description: 'Tu empresa aún no tiene turnos para elegir.',
    },
  },
  absenceForm: {
    whatSection: '¿Qué pides?',
    type: 'Tipo',
    whenSection: '¿Cuándo?',
    fromHint: 'Desde hoy en adelante.',
    sameDay: 'El mismo día si es solo uno.',
    /** Cuántos días son, con las dos fechas completas y en orden. */
    span_one: 'Es 1 día.',
    span_other: 'Son {count} días (ambos incluidos).',
    noteSection: 'Nota para tu empresa',
    noteLabel: 'Nota (opcional)',
    notePlaceholder: 'Por ejemplo: viaje familiar ya pagado.',
    noteHint: 'Tu empresa la verá.',
    errors: {
      type: 'Elige qué quieres pedir',
      firstDay: 'Elige el primer día',
      lastDay: 'Elige el último día',
      past: 'Elige hoy o una fecha posterior',
    },
    confirm: {
      title: '¿Pedir {type}?',
      done: 'Aquí verás la respuesta de tu empresa; mientras tanto, puedes cancelarla.',
    },
    unavailable: {
      title: 'No puedes pedir días aquí',
      description: 'Tu empresa los registra; pídeselos a tu responsable.',
    },
  },
  /** Enviar una solicitud a la empresa (cambio de turno, vacaciones o permiso). */
  request: {
    subtitle: 'Tu empresa revisa la solicitud y decide si la aprueba.',
    send: 'Enviar solicitud',
    sent: 'Solicitud enviada',
    error: 'No se pudo enviar tu solicitud',
    eyebrow: 'Solicitud a tu empresa',
    message: 'Tu empresa la revisará. Mientras esté pendiente, puedes cancelarla.',
    detailsTitle: 'Se enviará',
  },
  /** Código del sitio antes del rostro (antifraude 2b): QR del kiosco o sus 6 dígitos. */
  siteCode: {
    title: 'Código del sitio',
    text: 'Escanea el QR del kiosco del sitio o escribe los 6 dígitos que muestra.',
    busy: 'QR detectado…',
    invalidQr: 'Ese QR no es el del kiosco. Apunta al QR de la tableta del sitio.',
    digits: 'Código de 6 dígitos',
    digitsHint: 'El que muestra ahora la tableta del sitio.',
    remote: 'No estoy en el sitio',
    /** Título del popup cuando el servidor pide otro código (el motivo es su mensaje). */
    rejected: 'No se pudo usar el código del sitio',
  },
} as const;
