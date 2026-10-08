import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/avatar';

/** Textos de la foto de perfil: el avatar, el cargador y el recorte en portugués de Brasil (pt-BR): las mismas llaves que es-MX. */
export default {
  alt: 'Foto de perfil de {name}',
  uploader: {
    add: 'Adicionar foto',
    change: 'Trocar foto',
    remove: 'Remover foto',
    pickerLabel: 'Nova foto de perfil',
    pickerHint: 'JPG, PNG ou WEBP de até {max}. Depois você escolhe qual parte aparece.',
    choose: 'Escolher uma foto',
    drop: 'ou solte aqui',
    other: 'Escolher outra',
    save: 'Salvar foto',
    uploading: 'Enviando sua foto…',
    preview: 'Assim ficará sua foto',
    errors: {
      type: 'Escolha uma imagem JPG, PNG ou WEBP.',
      size: 'A foto tem {size} e o máximo é {max}.',
      small: 'A imagem é muito pequena: cada lado deve ter pelo menos {min} px.',
      unreadable: 'Este navegador não conseguiu abrir a imagem. Tente com uma foto JPG ou PNG.',
    },
  },
  cropper: {
    label: 'Recorte da foto',
    hint: 'Arraste a foto para ajustá-la; aproxime com o controle, a roda do mouse ou dois dedos. Teclado: setas para movê-la, + e − para aproximar, 0 para redefinir.',
    zoom: 'Zoom',
    zoomIn: 'Aproximar',
    zoomOut: 'Afastar',
    zoomValue: '{value} ×',
  },
} satisfies Translation<typeof es>;
