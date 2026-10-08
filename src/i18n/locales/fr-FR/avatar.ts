import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/avatar';

/** Textos de la foto de perfil: el avatar, el cargador y el recorte en francés (fr-FR): las mismas llaves que es-MX. */
export default {
  alt: 'Photo de profil de {name}',
  uploader: {
    add: 'Ajouter une photo',
    change: 'Changer de photo',
    remove: 'Retirer la photo',
    pickerLabel: 'Nouvelle photo de profil',
    pickerHint: "JPG, PNG ou WEBP jusqu'à {max}. Vous choisirez ensuite la partie visible.",
    choose: 'Choisir une photo',
    drop: 'ou déposez-la ici',
    other: 'En choisir une autre',
    save: 'Enregistrer la photo',
    uploading: 'Envoi de votre photo…',
    preview: 'Aperçu de votre photo',
    errors: {
      type: 'Choisissez une image JPG, PNG ou WEBP.',
      size: 'La photo pèse {size} et le maximum est de {max}.',
      small: "L'image est trop petite: chaque côté doit mesurer au moins {min} px.",
      unreadable: "Ce navigateur n'a pas pu ouvrir l'image. Essayez avec une photo JPG ou PNG.",
    },
  },
  cropper: {
    label: 'Recadrage de la photo',
    hint: 'Faites glisser la photo pour la positionner; zoomez avec le curseur, la molette de la souris ou deux doigts. Clavier: flèches pour la déplacer, + et − pour zoomer, 0 pour réinitialiser.',
    zoom: 'Zoom',
    zoomIn: 'Zoom avant',
    zoomOut: 'Zoom arrière',
    zoomValue: '{value} ×',
  },
} satisfies Translation<typeof es>;
