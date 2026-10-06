/** Textos de QR dinámico del empleado y lector de QR (es-MX). */
export default {
  /** Código QR dinámico del empleado (DynamicQrCode, QrCountdown). */
  dynamic: {
    used: {
      title: 'Código usado',
      text: 'Generando uno nuevo…',
    },
    replaced: {
      title: 'Código reemplazado',
      text: 'Se generó otro en otro dispositivo o tu empresa lo invalidó.',
      action: 'Mostrar un código nuevo',
    },
    paused: {
      title: 'En pausa',
      text: 'Venció mientras no lo veías.',
      action: 'Mostrar código',
    },
    error: 'No se pudo generar tu código',
    imageError: 'No se pudo mostrar tu código QR',
    enlarge: 'Ampliar código QR',
    /** `seconds`: el texto de `seconds` (abajo), en negritas. */
    renewsIn: 'Se renueva en {seconds}',
    seconds: '{value} s',
  },
  /** Lector de QR con la cámara (QrScanPanel). */
  scan: {
    aim: 'Apunta la cámara al código QR',
    busy: 'QR detectado. Verificando…',
    invalid: 'QR inválido. Usa el código generado para tu cuenta',
    noPersonalData: 'El código no contiene datos personales.',
  },
  /** Sección "Código QR" del detalle de un empleado (QrCodePanel). */
  panel: {
    title: 'Código QR dinámico',
    errorTitle: 'No se pudo cargar la actividad del QR',
    live: 'En pantalla',
    none: 'Sin código vigente',
    intro: 'El empleado lo genera en su teléfono (Mi código QR). Cambia cada {seconds} s y sirve una sola vez: no se descarga ni se imprime.',
    liveUntil: 'Vigente hasta',
    lastIssued: 'Último generado',
    lastUsed: 'Último uso',
    never: 'Nunca',
    revoke: {
      action: 'Invalidar código vigente',
      eyebrow: 'Código QR',
      title: '¿Invalidar el código vigente?',
      message: 'El código en pantalla del empleado dejará de servir de inmediato. Podrá mostrar uno nuevo en su teléfono.',
      confirm: 'Invalidar',
      error: 'No se pudo invalidar el código',
      done: 'Código invalidado',
      doneText: 'El empleado puede mostrar uno nuevo en su teléfono.',
    },
  },
  /** Cómo continuar en la tableta o el teléfono de un validador (PhoneAccessGuide). */
  phoneGuide: {
    open: 'Abre la tableta o el teléfono.',
    openHow: 'Usa el navegador (Safari, Chrome…) o la cámara.',
    /** `scan`: el texto de `scanCode`, en negritas. */
    scanOrType: '{scan} o escribe esta dirección:',
    scanCode: 'Escanea el código',
    copyAddress: 'Copiar dirección',
    /** `address`: el texto de `accessAddress`, en negritas. */
    enterAddress: '{address} que te proporcionó tu empresa.',
    accessAddress: 'Ingresa a la dirección de acceso',
    /** `action`: el texto de `signInAction`, en negritas. */
    signIn: '{action} con tu mismo correo y contraseña.',
    signInAction: 'Inicia sesión',
    scan: 'Escanéalo con la tableta o el teléfono',
    qrAlt: 'Código QR para abrir la aplicación. Escanéalo con la tableta o el teléfono',
    /** `option`: el texto de `desktopSiteOption`, en negritas. */
    desktopSite: '¿Ya estás en una tableta o un teléfono? Desactiva {option} en el menú del navegador e intenta de nuevo.',
    desktopSiteOption: '«Sitio de escritorio»',
  },
} as const;
