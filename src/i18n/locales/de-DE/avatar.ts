import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/avatar';

/** Textos de la foto de perfil: el avatar, el cargador y el recorte en alemán (de-DE): las mismas llaves que es-MX. */
export default {
  alt: 'Profilfoto von {name}',
  uploader: {
    add: 'Foto hinzufügen',
    change: 'Foto ändern',
    remove: 'Foto entfernen',
    pickerLabel: 'Neues Profilfoto',
    pickerHint: 'JPG, PNG oder WEBP bis {max}. Danach wählen Sie den sichtbaren Ausschnitt.',
    choose: 'Foto auswählen',
    drop: 'oder hier ablegen',
    other: 'Anderes auswählen',
    save: 'Foto speichern',
    uploading: 'Ihr Foto wird hochgeladen…',
    preview: 'So wird Ihr Foto angezeigt',
    errors: {
      type: 'Wählen Sie ein Bild im Format JPG, PNG oder WEBP.',
      size: 'Das Foto ist {size} groß, erlaubt sind höchstens {max}.',
      small: 'Das Bild ist zu klein: Jede Seite muss mindestens {min} px messen.',
      unreadable: 'Dieser Browser konnte das Bild nicht öffnen. Versuchen Sie es mit einem Foto im Format JPG oder PNG.',
    },
  },
  cropper: {
    label: 'Fotoausschnitt',
    hint:
      'Ziehen Sie das Foto, um es auszurichten; vergrößern Sie es mit dem Regler, dem Mausrad oder zwei Fingern. Tastatur: Pfeiltasten zum Verschieben, + und − zum Vergrößern, 0 zum Zurücksetzen.',
    zoom: 'Vergrößerung',
    zoomIn: 'Vergrößern',
    zoomOut: 'Verkleinern',
    zoomValue: '{value} ×',
  },
} satisfies Translation<typeof es>;
