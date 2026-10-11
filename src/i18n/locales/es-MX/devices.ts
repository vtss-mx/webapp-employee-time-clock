/**
 * Dispositivos de un empleado (antifraude 1b, decisión D2): la ficha del empleado (la empresa los aprueba o revoca) y
 * Mi perfil (el empleado los ve).
 */
export default {
  title: 'Dispositivos',
  intro:
    'Navegadores y teléfonos desde los que verificó su identidad, cada uno con una llave que no se puede copiar. Según la política, uno sin aprobar pide un paso más o deja sus registros en revisión.',
  mineTitle: 'Mis dispositivos',
  mineIntro:
    'Los navegadores o teléfonos desde los que verificaste tu identidad. Tu empresa puede aprobarlos o revocarlos.',
  empty: {
    title: 'Sin dispositivos',
    description: 'Aquí verás los navegadores y teléfonos usados para verificar la identidad.',
  },
  noun: {
    one: 'dispositivo',
    other: 'dispositivos',
  },
  firstSeen: 'Primer uso: {date}',
  lastSeen: 'último uso: {date}',
  uses_one: '{count} uso',
  uses_other: '{count} usos',
  steppedUp: 'superó un paso más el {date}',
  reviewedBy: 'Decidió {name}',
  loadError: 'No se pudieron cargar los dispositivos',
  error: 'No se pudo actualizar el dispositivo',
  eyebrow: 'Dispositivo del empleado',
  actionLabel: '{action}: {name}',
  approve: {
    label: 'Aprobar',
    title: '¿Aprobar «{name}»?',
    message: 'Sus registros dejarán de quedar en revisión o de pedir un paso más por el dispositivo. Lo demás del motor de riesgo sigue igual.',
  },
  revoke: {
    label: 'Revocar',
    title: '¿Revocar «{name}»?',
    message: 'Volverá a tratarse como un dispositivo desconocido: según la política, sus registros pedirán un paso más o quedarán en revisión.',
  },
} as const;
