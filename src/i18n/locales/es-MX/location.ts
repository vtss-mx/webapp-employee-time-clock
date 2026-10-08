/** Textos de domicilios, mapas, búsqueda de lugares y ubicación (es-MX). */
export default {
  /** Etiqueta de los popups de ubicación. */
  eyebrow: 'Ubicación',
  /** Ubicación del dispositivo bloqueada o no disponible: título y explicación de cada problema. */
  problems: {
    unsupported: {
      title: 'Ubicación no disponible',
      text: 'Este navegador no permite leer la ubicación. Usa Safari o Chrome actualizados.',
    },
    insecure: {
      title: 'Conexión no segura',
      text: 'La ubicación solo se puede leer desde una conexión segura (https). Abre la aplicación con su dirección segura.',
    },
    denied: {
      title: 'Permite el acceso a tu ubicación',
      text: 'El permiso de ubicación está bloqueado en este navegador.',
    },
    unavailable: {
      title: 'No se pudo obtener tu ubicación',
      text: 'Activa la ubicación (GPS) e intenta de nuevo, de preferencia cerca de una ventana.',
    },
    timeout: {
      title: 'La ubicación tardó demasiado',
      text: 'Activa la ubicación precisa del dispositivo e intenta de nuevo.',
    },
  },
  /** Cómo volver a permitir la ubicación (los mismos pasos en cualquier pantalla). */
  permissionSteps: {
    iphone: 'iPhone: Ajustes › Privacidad › Localización › Safari (o tu navegador) › permite el acceso mientras usas la aplicación.',
    android: 'Android: toca el candado junto a la dirección › Permisos › Ubicación › Permitir.',
  },
  /** Permiso bloqueado: por qué se necesita y cómo seguir, según la pantalla que lo pidió. */
  deniedFor: {
    login: {
      text: 'Este validador solo puede iniciar sesión en su lugar de operación y el permiso de ubicación está bloqueado.',
      next: 'Vuelve a la aplicación e inicia sesión de nuevo.',
    },
    attendance: {
      text: 'Tu registro de asistencia necesita tu ubicación y el permiso está bloqueado en este navegador.',
      next: 'Regresa aquí y toca «Reintentar».',
    },
    map: {
      text: 'Para ubicarte en el mapa hace falta el permiso de ubicación y está bloqueado en este navegador.',
      next: 'Vuelve a tocar «Mi ubicación» (o marca el punto en el mapa).',
    },
    checkpoint: {
      text: 'Este validador envía su ubicación en cada identificación y el permiso está bloqueado en este navegador.',
      next: 'Vuelve a abrir el punto de control.',
    },
    verification: {
      text: 'Esta verificación necesita tu ubicación y el permiso está bloqueado en este navegador.',
      next: 'Regresa aquí y toca «Reintentar».',
    },
  },
  /** Respuestas del servidor sobre la ubicación (el texto lo explica el servidor). */
  server: {
    outOfRange: 'Estás fuera del lugar permitido',
    inaccurate: 'Tu ubicación no es precisa',
    required: 'Se necesita tu ubicación',
    approach: 'Acércate al acceso donde opera este validador.',
    gps: 'Activa la ubicación precisa (GPS) del dispositivo.',
    signInAgain: 'Vuelve a iniciar sesión.',
  },
  /** Campos del domicilio (decisión del dueño del producto: estas etiquetas y estas ayudas, iguales al backend). */
  address: {
    country: {
      label: 'País',
      hint: 'País donde se encuentra la dirección.',
      placeholder: 'Elige el país',
      search: 'Buscar país',
      empty: 'Ningún país coincide',
    },
    state: { label: 'Estado o provincia', hint: 'Entidad federativa o región.' },
    municipality: { label: 'Municipio o alcaldía', hint: 'División administrativa a la que pertenece.' },
    city: { label: 'Ciudad o localidad', hint: 'Ciudad, pueblo o localidad; puede tener un nombre distinto al municipio.' },
    neighborhood: { label: 'Colonia o barrio', hint: 'Zona o asentamiento dentro de la localidad.' },
    postalCode: { label: 'Código postal', hint: 'Código de la zona postal.' },
    street: { label: 'Calle o vialidad', hint: 'Nombre de la calle, avenida, carretera, etcétera.' },
    exteriorNumber: { label: 'Número exterior', hint: 'Número que identifica el inmueble; puede contener letras.' },
    interiorNumber: { label: 'Número interior', hint: 'Departamento, oficina o local dentro del inmueble. Es opcional.' },
    referenceNotes: {
      label: 'Referencias',
      hint: 'Indicaciones adicionales para localizarlo, como entrecalles o puntos cercanos. Son opcionales.',
      placeholder: 'Entre Juárez y Morelos, frente a la plaza',
    },
    /** El número interior dentro del domicilio de una línea: "Calle Dr. Paliza 71 Int. 2". */
    interior: 'Interior {number}',
    required: {
      country: 'Elige el país',
      state: 'Escribe el estado o provincia',
      municipality: 'Escribe el municipio o alcaldía',
      city: 'Escribe la ciudad o localidad',
      neighborhood: 'Escribe la colonia o barrio',
      postalCode: 'Escribe el código postal',
      street: 'Escribe la calle',
      exteriorNumber: 'Escribe el número exterior (o S/N)',
    },
    postalCodeMx: 'El código postal de México tiene 5 dígitos',
    postalCodeInvalid: 'El código postal no es válido',
    minLength: 'Escribe al menos {min} caracteres',
    maxLength: 'Máximo {max} caracteres',
  },
  /** El punto del domicilio en el mapa (avisos bajo el mapa: nunca un popup). */
  picker: {
    notices: {
      geocoding: 'No se pudo completar el domicilio desde el mapa. Escríbelo a mano; el punto sí quedó marcado.',
      geolocation: 'No se pudo obtener tu ubicación. Marca el punto en el mapa.',
      places: 'La búsqueda de lugares no está disponible. Escribe el domicilio y marca el punto en el mapa.',
      maps: 'El mapa no está disponible. Escribe el domicilio a mano.',
      offline: 'Google Maps no respondió. Revisa tu conexión e intenta de nuevo.',
      notFound: 'No se encontró la dirección. Revisa el domicilio o marca el punto en el mapa.',
    },
    locateError: 'No se pudo ubicar el punto',
    notConfigured: 'El mapa no está configurado: el domicilio se captura a mano y no se puede exigir ubicación.',
    myLocation: 'Mi ubicación',
    point: 'Punto: {point}',
    /** Qué punto se marca: el acceso de un validador o un sitio de trabajo. */
    tapToMark: {
      access: 'Toca el mapa para marcar el punto del acceso',
      site: 'Toca el mapa para marcar el punto del sitio',
    },
    findingAddress: 'buscando el domicilio…',
    locateWritten: 'Ubicar la dirección escrita',
    removePoint: 'Quitar punto',
  },
  map: {
    label: 'Mapa: toca para marcar el punto',
    pin: 'Punto marcado',
    loading: 'Cargando el mapa…',
    failed: 'El mapa no está disponible. Escribe el domicilio a mano.',
  },
  /** Buscador de lugares y direcciones (resultados de Google). */
  search: {
    label: 'Buscar un lugar o una dirección',
    clear: 'Borrar búsqueda',
    results: 'Lugares encontrados',
    credit: 'Resultados de Google',
    creditNearest: 'Los más cercanos primero · Resultados de Google',
    failed: {
      title: 'No se pudo buscar',
      hint: 'Revisa tu conexión o marca el punto en el mapa.',
    },
    unavailable: {
      title: 'Sin resultados',
      hint: 'Escribe el domicilio y marca el punto en el mapa.',
    },
    none: {
      title: 'Sin resultados',
      hint: 'Prueba con otra dirección o marca el punto en el mapa.',
    },
  },
} as const;
