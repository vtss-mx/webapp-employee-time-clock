/**
 * Palabras y frases generales que comparten muchas pantallas (es-MX). Solo lo que significa lo mismo
 * en cualquier pantalla: si en un área el texto cambia de género, número o sentido ("Activa" para
 * una empresa), va en el espacio de esa área.
 */
export default {
  actions: {
    accept: 'Aceptar',
    activate: 'Activar',
    approve: 'Aprobar',
    back: 'Volver',
    cancel: 'Cancelar',
    pause: 'Pausar',
    play: 'Reproducir',
    changeStatus: 'Cambiar estado',
    clear: 'Limpiar',
    close: 'Cerrar',
    confirm: 'Confirmar',
    continue: 'Continuar',
    copy: 'Copiar',
    create: 'Crear',
    deactivate: 'Desactivar',
    delete: 'Eliminar',
    edit: 'Editar',
    logout: 'Cerrar sesión',
    next: 'Siguiente',
    previous: 'Anterior',
    refresh: 'Actualizar',
    reject: 'Rechazar',
    retry: 'Reintentar',
    save: 'Guardar',
    saveChanges: 'Guardar cambios',
    saving: 'Guardando…',
    search: 'Buscar',
    view: 'Ver',
  },
  states: {
    active: 'Activo',
    inactive: 'Inactivo',
    loading: 'Cargando…',
  },
  fields: {
    company: 'Empresa',
    date: 'Fecha',
    department: 'Departamento',
    email: 'Correo electrónico',
    employee: 'Empleado',
    employeeNumber: 'Número de empleado',
    mobilePhone: 'Teléfono celular',
    name: 'Nombre',
    note: 'Nota',
    phone: 'Teléfono',
    reason: 'Motivo',
    status: 'Estado',
  },
  values: {
    yes: 'Sí',
    no: 'No',
    /** Un campo sin valor ("Teléfono: Sin capturar"). */
    empty: 'Sin capturar',
    optional: 'Opcional',
  },
  notes: {
    irreversible: 'No se puede deshacer.',
  },
} as const;
