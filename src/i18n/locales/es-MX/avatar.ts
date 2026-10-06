/** Textos de la foto de perfil: el avatar, el cargador y el recorte (es-MX). */
export default {
  /** Texto alternativo de la foto (o de las iniciales) de una persona. */
  alt: 'Foto de perfil de {name}',
  uploader: {
    add: 'Agregar foto',
    change: 'Cambiar foto',
    remove: 'Quitar foto',
    pickerLabel: 'Nueva foto de perfil',
    pickerHint: 'JPG, PNG o WEBP de hasta {max}. Después eliges qué parte se ve.',
    choose: 'Elegir una foto',
    drop: 'o suéltala aquí',
    other: 'Elegir otra',
    save: 'Guardar foto',
    uploading: 'Subiendo tu foto…',
    /** Nombre de la vista previa circular (confirmación). */
    preview: 'Así se verá tu foto',
    errors: {
      type: 'Elige una imagen JPG, PNG o WEBP.',
      size: 'La foto pesa {size} y el máximo es {max}.',
      small: 'La imagen es muy pequeña: cada lado debe medir al menos {min} px.',
      unreadable: 'Este navegador no pudo abrir la imagen. Prueba con una foto JPG o PNG.',
    },
  },
  cropper: {
    label: 'Recorte de la foto',
    hint: 'Arrastra la foto para acomodarla; acércala con el control, la rueda del ratón o dos dedos. Teclado: flechas para moverla, + y − para acercarla, 0 para reiniciar.',
    zoom: 'Acercamiento',
    zoomIn: 'Acercar',
    zoomOut: 'Alejar',
    /** Valor del acercamiento: "2.5 ×". */
    zoomValue: '{value} ×',
  },
} as const;
