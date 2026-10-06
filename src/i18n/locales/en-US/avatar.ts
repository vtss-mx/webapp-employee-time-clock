import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/avatar';

/** Textos de la foto de perfil: el avatar, el cargador y el recorte en inglés (en-US): las mismas llaves que es-MX. */
export default {
  alt: 'Profile photo of {name}',
  uploader: {
    add: 'Add photo',
    change: 'Change photo',
    remove: 'Remove photo',
    pickerLabel: 'New profile photo',
    pickerHint: 'JPG, PNG or WEBP up to {max}. Then choose what part to show.',
    choose: 'Choose a photo',
    drop: 'or drop it here',
    other: 'Choose another',
    save: 'Save photo',
    uploading: 'Uploading your photo…',
    preview: 'This is how your photo will look',
    errors: {
      type: 'Choose a JPG, PNG or WEBP image.',
      size: 'The photo is {size} and the maximum is {max}.',
      small: 'The image is too small: each side must be at least {min} px.',
      unreadable: "This browser can't open the image. Try a JPG or PNG photo.",
    },
  },
  cropper: {
    label: 'Photo crop',
    hint: 'Drag the photo to position it; zoom with the control, the mouse wheel or two fingers. Keyboard: arrows to move, + and − to zoom, 0 to reset.',
    zoom: 'Zoom',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    zoomValue: '{value} ×',
  },
} satisfies Translation<typeof es>;
