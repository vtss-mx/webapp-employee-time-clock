/** Textos de validaciones del cliente, cambios para confirmar y textos de hooks y utilidades (es-MX). */
export default {
  /**
   * Validaciones de los formularios (`utils/validation.ts`, `utils/phone.ts`): solo son UX, el
   * backend vuelve a validar todo. Se calculan al dibujarse: un error visible sigue al idioma.
   */
  validation: {
    minChars: 'Mínimo {min} caracteres',
    maxChars: 'Máximo {max} caracteres',
    email: {
      required: 'El correo es obligatorio',
      invalid: 'Ingresa un correo válido',
    },
    password: {
      required: 'La contraseña es obligatoria',
      lowercase: 'Debe incluir una letra minúscula',
      uppercase: 'Debe incluir una letra mayúscula',
      digit: 'Debe incluir un número',
      repeat: 'Repite la contraseña',
      mismatch: 'Las contraseñas no coinciden',
    },
    name: {
      characters: 'Solo letras, espacios, apóstrofes, puntos y guiones',
    },
    birthDate: {
      required: 'La fecha de nacimiento es obligatoria',
      invalid: 'Fecha inválida',
      notBeforeToday: 'Debe ser anterior a hoy',
      minAge: 'El empleado debe tener al menos {age} años',
    },
    employeeNumber: {
      format: '1-30 caracteres: letras, números, guion o guion bajo',
    },
    /**
     * `document` y `birth` son fechas numéricas en el orden del idioma ("01/09/2003"); `example`, un
     * RFC o una CURP de ejemplo (un código: no se traduce).
     */
    rfc: {
      generic: 'El RFC genérico no es válido; escribe el RFC real',
      length: 'El RFC de una persona física tiene {length} caracteres; llevas {current}',
      format: 'Revisa el formato del RFC (p. ej. {example})',
      date: 'La fecha del RFC (aammdd) no es válida',
      birthMismatch: 'El RFC indica nacimiento el {document}, pero la fecha de nacimiento es {birth}',
      companyLength: 'El RFC debe tener 12 caracteres (persona moral) o 13 (persona física)',
    },
    /**
     * Identificador fiscal de una empresa de otro tipo (los mismos textos del backend): `name` es la sigla del tipo
     * («EIN», «CUIT») y `example`, un número de ejemplo; los dos vienen del catálogo.
     */
    taxId: {
      length: 'El número de {name} debe tener de {min} a {max} caracteres',
      lengthExact: 'El número de {name} debe tener {length} caracteres',
      format: 'Formato de {name} no válido (p. ej. {example})',
    },
    curp: {
      length: 'La CURP tiene {length} caracteres; llevas {current}',
      format: 'Revisa el formato de la CURP (p. ej. {example})',
      date: 'La fecha de la CURP (aammdd) no es válida',
      checkDigit: 'El dígito verificador de la CURP no coincide',
      birthMismatch: 'La CURP indica nacimiento el {document}, pero la fecha de nacimiento es {birth}',
      century: 'El carácter 17 de la CURP no coincide con el siglo de nacimiento: número antes de 2000, letra desde 2000',
    },
    nss: {
      length: 'El NSS tiene {length} dígitos',
      checkDigit: 'El dígito verificador del NSS no coincide',
    },
    maxEmployees: 'Escribe un número entero mayor a 0',
  },
  /** Teléfonos internacionales (`utils/phone.ts`). */
  phone: {
    required: 'El teléfono es obligatorio',
    invalid: 'El teléfono no es válido para la lada +{code}',
    noCountries: 'El catálogo de países no tiene países activos',
  },
  /** Etiquetas que arman "{label} es obligatorio" en las reglas de los formularios (`utils/formRules.ts`). */
  /** Aviso de campo vacío de cada campo (completo: el género y el número cambian según el campo). */
  required: {
    firstName: 'El nombre es obligatorio',
    lastName: 'El apellido es obligatorio',
    tradeName: 'El nombre comercial es obligatorio',
    legalName: 'La razón social es obligatoria',
  },
  /** Confirmaciones de crear y editar (`utils/changes.ts`). */
  changes: {
    /** Un secreto que cambia: "Contraseña: •••••••• → Nueva". */
    newSecret: 'Nueva',
    /** El último elemento de "Ana, Luis y 3 más". */
    more: '{count} más',
  },
  /** Rangos de un clic (`utils/dateRanges.ts`). */
  ranges: {
    today: 'Hoy',
    yesterday: 'Ayer',
    week: 'Esta semana',
    lastWeek: 'Semana pasada',
    month: 'Este mes',
    lastMonth: 'Mes pasado',
    last30: 'Últimos 30 días',
  },
  /** Navegador y sistema leídos del User-Agent (`utils/userAgent.ts`): "Safari · iOS". */
  device: {
    unknown: 'Dispositivo desconocido',
    browser: 'Navegador',
    system: 'Sistema desconocido',
  },
} as const;
