import { derive } from '../../derive';
import es from '../es-MX/apiKeys';

/**
 * Textos de las claves de la API de integración en español de España (es-ES): solo lo que cambia respecto de es-MX
 * (vocabulario; glosario §3). En España una «API key» es una «clave», no una «llave».
 */
export default derive(es, {
  list: {
    create: 'Crear clave',
    loadError: 'No se pudieron cargar las claves',
    noun: { one: 'clave', other: 'claves' },
    empty: {
      title: 'Sin claves',
      description: 'Crea una clave para conectar tus sistemas.',
    },
    footer: 'Cada clave solo lee la información de tu empresa; nunca fotos ni datos biométricos.',
  },
  row: {
    expires: 'Caduca {date}',
    noExpiry: 'Sin caducidad',
    expiringSoon: 'Caduca pronto',
    expiresInDays_zero: 'Caduca hoy',
    expiresInDays_one: 'Caduca en {count} día',
    expiresInDays_other: 'Caduca en {count} días',
  },
  guide: {
    example: 'Ejemplo (consulta tu empresa y tu clave)',
    dates: 'Fechas en UTC (ISO 8601); los días de tu empresa se cuentan en la hora del centro de México.',
    rateLimit: 'Cada clave tiene un límite de peticiones por minuto (responde 429 si se excede).',
  },
  details: {
    key: 'Clave',
  },
  rotate: {
    eyebrow: 'Rotar clave',
    message: 'Se generará una clave nueva con los mismos permisos y vigencia. Actualízala en el sistema que se conecta.',
    note: 'La clave actual dejará de funcionar de inmediato.',
    confirm: 'Rotar clave',
    error: 'No se pudo rotar la clave',
  },
  revoke: {
    eyebrow: 'Revocar clave',
    message: 'La clave dejará de funcionar de inmediato y el sistema que la usa ya no podrá conectarse.',
    confirm: 'Revocar clave',
    error: 'No se pudo revocar la clave',
    done: 'Clave revocada',
  },
  form: {
    title: 'Crear clave de la API',
    subtitle: 'Usa una clave por sistema para revocarlas por separado.',
    nameHint: 'Para reconocerla en la lista y en el registro de uso.',
    nameRequired: 'Escribe para qué sistema es la clave',
    scopesIntro: 'Elige solo lo que el sistema necesita. Ninguna clave puede modificar datos ni ver fotos o datos biométricos.',
    verificationWarning: {
      title: 'Esta clave irá dentro de una aplicación móvil',
      message: 'Una clave dentro de una aplicación se puede extraer. Úsala solo con el permiso «Verificación» y rótala si sospechas que se ha filtrado.',
      mixed: 'Una clave dentro de una aplicación se puede extraer: no la combines con permisos de lectura. Crea una clave solo con «Verificación» y otra para tu servidor.',
    },
    submit: 'Crear clave',
    limitError: 'Llegaste al tope de claves',
    error: 'No se pudo crear la clave',
    expiresIn: 'Caduca en',
    lifetimeNote: 'Al caducar deja de funcionar. Antes puedes rotarla y conservar sus permisos.',
    confirm: {
      title: '¿Crear la clave «{name}»?',
    },
  },
  secret: {
    created: 'Clave creada',
    rotated: 'Clave rotada',
    title: 'Copia la clave de «{name}»',
    copy: 'Copiar clave',
  },
});
