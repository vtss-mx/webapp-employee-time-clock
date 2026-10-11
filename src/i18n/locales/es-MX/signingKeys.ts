/**
 * Textos de las claves de FIRMA de la empresa (es-MX; migración 0105 del backend). Son la otra mitad de las cuatro
 * credenciales de una conexión: la URL base y la llave viven en `apiKeys`, la clave privada y la pública aquí.
 *
 * Los textos de fila que significan lo mismo que en una llave de la API (vencimiento, último uso, quién la creó o
 * la revocó, «Rotar», «Revocar») NO se repiten aquí: se reutilizan de `apiKeys.row.*`.
 */
export default {
  list: {
    title: 'Claves de firma',
    subtitle: 'Cada petición de la API va firmada con la clave privada de tu empresa.',
    back: 'Integraciones',
    add: 'Agregar clave',
    loadError: 'No se pudieron cargar las claves de firma',
    noun: { one: 'clave', other: 'claves' },
    empty: {
      title: 'Sin claves de firma',
      description: 'Registra tu clave pública para empezar a firmar.',
    },
    /** Cuántas claves pueden firmar hoy y cuántas caben: las dos cifras las envía el servidor. */
    active: 'Vigentes: {active} de {max}',
    full: 'Llegaste al tope',
    fullHint: 'Revoca una clave vigente para registrar otra',
    footer: 'La plataforma nunca guarda tu clave privada: solo tu clave pública y su huella.',
  },
  /** Una clave en la lista (lo demás se reutiliza de `apiKeys.row`). */
  row: {
    fingerprint: 'Huella',
    uploaded: 'Clave pública que registraste',
    generated: 'Par generado por la plataforma',
    copyFingerprint: 'Copiar huella',
  },
  /** La clave con que la plataforma firma lo que responde. */
  platform: {
    title: 'Clave pública de la plataforma',
    description: 'Con ella compruebas que la respuesta viene de la plataforma y nadie la cambió en el camino.',
    publicKey: 'Clave pública',
    copyFingerprint: 'Copiar huella de la plataforma',
    copyPublicKey: 'Copiar clave pública de la plataforma',
    note: 'Cada respuesta de verificación llega firmada con esta clave.',
    off: {
      title: 'Sin firma en las respuestas',
      description: 'La plataforma no firma lo que responde: no hay nada que comprobar.',
    },
  },
  revoke: {
    eyebrow: 'Revocar clave',
    title: '¿Revocar «{name}»?',
    message: 'Las peticiones firmadas con esta clave dejarán de pasar de inmediato.',
    detailsTitle: 'Dejará de servir',
    lastUsed: 'Último uso',
    note: 'Es inmediato, a diferencia de rotar. No se puede deshacer.',
    confirm: 'Revocar clave',
    error: 'No se pudo revocar la clave',
    done: 'Clave revocada',
    doneText: 'Las peticiones firmadas con «{name}» ya no pasan.',
  },
  form: {
    title: 'Agregar clave de firma',
    rotateTitle: 'Rotar clave de firma',
    subtitle: 'Tu sistema firma cada petición y la plataforma solo guarda tu clave pública.',
    back: 'Claves de firma',
    loadError: 'No se pudieron cargar las claves de firma',
    system: 'Sistema que firma',
    namePlaceholder: 'Nómina, ERP, control de acceso…',
    nameHint: 'Para reconocer la clave en la lista.',
    nameRequired: 'Escribe para qué sistema es la clave',
    path: 'De dónde sale el par',
    own: {
      title: 'Registro mi clave pública',
      description: 'Recomendado: generas el par donde quieras y tu clave privada nunca llega al servidor.',
    },
    platform: {
      title: 'Que la plataforma genere el par',
      description: 'Verás la clave privada una sola vez y la plataforma no la guarda en ningún lugar.',
    },
    why: {
      title: 'Por qué conviene registrar tu clave pública',
      message: 'Si tu clave privada nunca sale de tu sistema, nadie más puede firmar en tu nombre.',
    },
    publicKey: 'Clave pública',
    publicKeyPlaceholder: 'Pega aquí tu clave pública',
    /** Los formatos van como código (iguales en todos los idiomas). */
    publicKeyHint: 'En {pem} o su {der} en {base64}.',
    publicKeyRequired: 'Pega tu clave pública o elige su archivo',
    file: 'Archivo de la clave',
    fileHint: 'Se lee en tu navegador; al servidor solo viaja el texto de la clave pública.',
    fileError: 'No se pudo leer el archivo',
    lifetime: 'Vigencia',
    expiresIn: 'Vence en',
    daysUnit: 'días',
    days_one: '{count} día',
    days_other: '{count} días',
    lifetimeHint_one: 'A lo más {count} día.',
    lifetimeHint_other: 'A lo más {count} días.',
    replaces: 'Reemplaza a',
    replacesNone: 'Ninguna: es una clave más',
    replacesHint_one: 'La clave que reemplaces seguirá firmando {count} día más.',
    replacesHint_other: 'La clave que reemplaces seguirá firmando {count} días más.',
    submit: 'Registrar clave',
    submitGenerate: 'Generar el par',
    incomplete: 'Escribe el nombre y pega tu clave pública',
    incompleteName: 'Escribe para qué sistema es la clave',
    error: 'No se pudo registrar la clave',
    generateError: 'No se pudo generar el par',
    limitError: 'Llegaste al tope de claves vigentes',
    duplicateError: 'Esa clave pública ya está registrada',
    done: 'Clave de firma registrada',
    doneText: 'Tu sistema ya puede firmar sus peticiones con «{name}».',
    confirm: {
      title: '¿Registrar la clave «{name}»?',
      generateTitle: '¿Generar el par de «{name}»?',
      message: 'Tu sistema podrá firmar sus peticiones con esta clave.',
      generateMessage: 'Verás la clave privada una sola vez: cópiala antes de cerrar el aviso.',
      detailsTitle: 'Se registrará',
      note: 'Puedes revocarla cuando quieras.',
      generateNote: 'La clave privada no se podrá volver a consultar.',
      rotateNote_one: 'La clave que reemplazas seguirá firmando {count} día y después dejará de servir.',
      rotateNote_other: 'La clave que reemplazas seguirá firmando {count} días y después dejará de servir.',
    },
  },
  /** La clave privada del par recién generado: se ve una sola vez y no se guarda en ningún lugar. */
  private: {
    eyebrow: 'Par de claves generado',
    title: 'Copia la clave privada de «{name}»',
    text: 'No se volverá a mostrar: la plataforma no la guarda en ningún lugar.',
    copy: 'Copiar clave privada',
    store: 'Guárdala donde tu sistema proteja secretos.',
    never: 'Nunca en texto plano, en un correo, en un chat ni en el navegador.',
    lost: 'Si se pierde, registra otra clave y revoca esta.',
    saved: 'Ya la guardé',
  },
} as const;
