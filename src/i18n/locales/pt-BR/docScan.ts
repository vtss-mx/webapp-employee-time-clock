import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/docScan';

/** Scanner de documento (DocumentScanner, pt-BR): mesmas chaves e variáveis que es-MX. */
export default {
  title: 'Foto do documento',
  subtitle: 'Posicione o documento na guia; a foto é tirada sozinha.',
  take: 'Tirar foto',
  cameraFallback: 'Se a câmera não abrir, escolha um arquivo.',
  captureError: 'Não foi possível tirar a foto',
  fileName: 'documento',
  guide: {
    searching: 'Posicione o documento na guia',
    tooFar: 'Aproxime-se',
    tooDark: 'Mais luz',
    tooBright: 'Evite a luz direta',
    glare: 'Evite reflexos',
    straighten: 'Centralize o documento',
    holdStill: 'Segure firme',
    capturing: 'Capturando…',
  },
} satisfies Translation<typeof es>;
