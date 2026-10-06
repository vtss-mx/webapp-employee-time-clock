/** Textos de menú lateral, menú del teléfono y marco de la aplicación (es-MX). */
export default {
  /** Dónde opera la persona, bajo el nombre de la app (sin empresa). */
  workspace: {
    verifiedIdentity: 'Identidad verificada',
    platform: 'Consola de la plataforma',
  },
  /** Región del menú lateral (lectores de pantalla). */
  sidebar: 'Navegación principal',
  menu: {
    label: 'Menú',
    open: 'Abrir menú',
    close: 'Cerrar menú',
    expand: 'Expandir menú',
    collapse: 'Contraer menú',
    /** Ayuda del botón con su atajo de teclado. */
    withShortcut: '{action} (Ctrl/⌘ + B)',
    preferenceFailed: 'No se pudo guardar la preferencia del menú',
  },
  /** Ícono de la app en la barra del teléfono (lleva al inicio). */
  home: 'Inicio',
} as const;
