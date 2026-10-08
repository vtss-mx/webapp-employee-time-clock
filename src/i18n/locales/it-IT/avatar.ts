import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/avatar';

/** Textos de la foto de perfil: el avatar, el cargador y el recorte en italiano (it-IT): las mismas llaves que es-MX. */
export default {
  alt: 'Foto del profilo di {name}',
  uploader: {
    add: 'Aggiungi foto',
    change: 'Cambia foto',
    remove: 'Rimuovi foto',
    pickerLabel: 'Nuova foto del profilo',
    pickerHint: 'JPG, PNG o WEBP fino a {max}. Poi scegli quale parte mostrare.',
    choose: 'Scegli una foto',
    drop: 'o trascinala qui',
    other: "Scegline un'altra",
    save: 'Salva foto',
    uploading: 'Caricamento della foto…',
    preview: 'Ecco come apparirà la tua foto',
    errors: {
      type: "Scegli un'immagine JPG, PNG o WEBP.",
      size: 'La foto pesa {size} e il massimo è {max}.',
      small: "L'immagine è troppo piccola: ogni lato deve misurare almeno {min} px.",
      unreadable: "Questo browser non è riuscito ad aprire l'immagine. Prova con una foto JPG o PNG.",
    },
  },
  cropper: {
    label: 'Ritaglio della foto',
    hint: 'Trascina la foto per posizionarla; ingrandiscila con il controllo, la rotellina del mouse o due dita. Tastiera: frecce per spostarla, + e − per ingrandirla, 0 per ripristinarla.',
    zoom: 'Ingrandimento',
    zoomIn: 'Ingrandisci',
    zoomOut: 'Riduci',
    zoomValue: '{value} ×',
  },
} satisfies Translation<typeof es>;
