import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/documents';

/** Textos de los documentos de una empresa en italiano (it-IT): las mismas llaves que es-MX. */
export default {
  title: 'Documenti',
  count_one: '{count} documento · per la fatturazione della tua azienda',
  count_other: '{count} documenti · per la fatturazione della tua azienda',
  noun: {
    one: 'documento',
    other: 'documenti',
  },
  loadError: 'Impossibile caricare i documenti',
  add: 'Carica documento',
  columns: {
    file: 'Documento',
    type: 'Tipo',
    size: 'Dimensione',
    uploaded: 'Caricato',
    note: 'Nota',
    actions: 'Azioni',
  },
  platform: 'Piattaforma',
  platformHint: "Caricato dall'amministratore della piattaforma",
  empty: {
    title: 'Nessun documento',
    description: 'Carica il certificato fiscale o un altro documento per iniziare.',
  },
  download: 'Scarica',
  downloadLabel: 'Scarica {name}',
  downloadError: 'Impossibile scaricare il documento',
  deleteLabel: 'Elimina {name}',
  deleteError: 'Impossibile eliminare il documento',
  remove: {
    title: 'Eliminare {name}?',
    message: 'Non si potrà scaricare finché resta in «Eliminati».',
  },
  restoreTitle: 'Ripristinare {name}?',
  upload: {
    title: 'Carica documento',
    subtitle: "Viene salvato cifrato e si scarica solo dall'applicazione.",
    fileSection: 'File',
    fileLabel: 'Documento',
    hint: 'PDF, Word, Excel, XML, JPG o PNG fino a {max}.',
    dataSection: 'Dati del documento',
    typeLabel: 'Tipo di documento',
    typePlaceholder: 'Scegli il tipo',
    noteHint: "Facoltativa · La vedono l'azienda e la piattaforma.",
    uploading: 'Caricamento del documento…',
    error: 'Impossibile caricare il documento',
    confirm: {
      title: 'Caricare {name}?',
      message: "Verrà salvato cifrato tra i documenti dell'azienda.",
      detailsTitle: 'Verrà caricato',
      file: 'File',
    },
    errors: {
      fileMissing: 'Scegli il file da caricare.',
      type: 'Scegli un file PDF, Word, Excel, XML, JPG o PNG.',
      empty: 'Il file è vuoto. Scegline un altro.',
      size: 'Il file pesa {size} e il massimo è {max}.',
      typeMissing: 'Scegli il tipo di documento.',
    },
  },
} satisfies Translation<typeof es>;
