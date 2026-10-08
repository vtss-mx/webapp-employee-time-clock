import { derive } from '../../derive';
import es from '../es-MX/admin';

/** Textos de la consola del ADMIN en español de España (es-ES): solo lo que cambia respecto de es-MX (vocabulario; glosario §3). */
export default derive(es, {
  create: {
    apiDescription: 'Permite a la empresa crear claves para conectar sus sistemas (nómina, ERP).',
    done: {
      apiOn: 'Tiene acceso a Integraciones (API): puede crear sus claves.',
      validatorsOff: 'Sin validadores; puedes darle plazas al editar la empresa.',
      billing: 'Su cobro empieza el {date}: su cuenta, sus cargos y sus pagos están en Facturación.',
      next: 'Desde aquí puedes añadir más administradores, editar sus datos o desactivarla.',
    },
  },
  edit: {
    planNote: 'Los cambios del plan se aplican desde el próximo cargo: los cargos ya emitidos no cambian.',
  },
  detail: {
    addAdmin: 'Añadir administrador',
    apiOn: 'La empresa puede crear claves para conectar sus sistemas (nómina, ERP).',
    apiOff: 'Sin acceso: la pantalla no aparece en su menú y sus claves no funcionan.',
    admins: {
      neverLogged: 'Aún no ha iniciado sesión',
    },
    done: {
      apiOnText: 'La empresa ya ve Integraciones (API) y sus claves funcionan.',
      apiOffText: 'Sus claves ya no funcionan hasta que le devuelvas el acceso.',
    },
    api: {
      giveMessage: 'Verá Integraciones (API) en su menú y podrá crear claves para conectar sus sistemas (nómina, ERP).',
      giveNote: 'Si ya tenía claves, vuelven a funcionar de inmediato.',
      removeNote: 'Las claves se conservan y vuelven a funcionar si le devuelves el acceso.',
    },
  },
  adminForm: {
    add: {
      title: 'Añadir administrador',
      action: 'Añadir',
      error: 'No se pudo añadir el administrador',
    },
    addTitle: '¿Añadir a {email} como administrador?',
    added: 'Administrador añadido',
  },
});
