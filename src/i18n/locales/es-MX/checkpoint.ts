/** Textos de punto de control del validador (es-MX). */
export default {
  errorTitle: 'No se pudo cargar el punto de control',
  question: 'Elige cómo identificar a la siguiente persona.',
  start: 'Comenzar',
  /** `company`: el nombre de la empresa del validador. */
  footer: 'Solo se identifican empleados activos de {company} · Cada intento queda en la bitácora',
  notIdentified: 'Empleado no identificado',
  failed: 'No se pudo identificar',
  invalidQr: 'QR inválido. Pide al empleado que muestre su código desde la app',
  qrDisabled: {
    title: 'Identificación con QR desactivada',
    /** `mode`: el nombre del modo del validador (catálogo). */
    text: 'Este validador usa el modo «{mode}», pero tu empresa desactivó el QR. Pide a un administrador que lo active o cambie el modo.',
  },
  /** Reconocer el rostro (solo o después del QR). */
  face: {
    title: 'Reconocer rostro',
    submitting: 'Identificando…',
    useQr: 'Usar su código QR',
  },
  /** Leer el QR del empleado. */
  qr: {
    title: 'Escanear QR',
    text: 'Apunta la cámara al QR del teléfono del empleado. Se lee automáticamente y sirve una sola vez.',
    busy: 'QR detectado. Identificando…',
  },
  /** QR y rostro: primero el QR (de quién es) y luego su rostro. */
  qrFace: {
    qrTitle: 'Paso 1 de 2 · Código QR',
    qrText: 'Escanea el QR del teléfono del empleado. Después se confirmará su rostro.',
    busy: 'QR detectado. Buscando al empleado…',
    /** `name`: el empleado dueño del QR. */
    faceTitle: 'Paso 2 de 2 · {name}',
  },
  /** Identificaciones recientes de este dispositivo. */
  recent: {
    title: 'Últimas identificaciones',
    errorTitle: 'No se pudieron cargar las identificaciones recientes',
    emptyTitle: 'Sin identificaciones',
    emptyDescription: 'Aquí verás a quién identifica este dispositivo.',
    nounOne: 'identificación',
    nounOther: 'identificaciones',
    identified: 'Identificado',
    notIdentified: 'No identificado',
  },
} as const;
