import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/documents';

/** Textos de los documentos de una empresa en alemán (de-DE): las mismas llaves que es-MX. */
export default {
  title: 'Dokumente',
  count_one: '{count} Dokument · für die Rechnungsstellung Ihres Unternehmens',
  count_other: '{count} Dokumente · für die Rechnungsstellung Ihres Unternehmens',
  noun: {
    one: 'Dokument',
    other: 'Dokumente',
  },
  loadError: 'Die Dokumente konnten nicht geladen werden',
  add: 'Dokument hochladen',
  columns: {
    file: 'Dokument',
    type: 'Typ',
    size: 'Größe',
    uploaded: 'Hochgeladen',
    note: 'Anmerkung',
    actions: 'Aktionen',
  },
  platform: 'Plattform',
  platformHint: 'Vom Administrator der Plattform hochgeladen',
  empty: {
    title: 'Keine Dokumente',
    description: 'Laden Sie die Steuerbescheinigung oder ein anderes Dokument hoch.',
  },
  download: 'Herunterladen',
  downloadLabel: '{name} herunterladen',
  downloadError: 'Das Dokument konnte nicht heruntergeladen werden',
  deleteLabel: '{name} löschen',
  deleteError: 'Das Dokument konnte nicht gelöscht werden',
  remove: {
    title: '{name} löschen?',
    message: 'Solange es unter „Gelöscht“ liegt, kann es nicht heruntergeladen werden.',
  },
  restoreTitle: '{name} wiederherstellen?',
  upload: {
    title: 'Dokument hochladen',
    subtitle: 'Es wird verschlüsselt gespeichert und kann nur über die App heruntergeladen werden.',
    fileSection: 'Datei',
    fileLabel: 'Dokument',
    hint: 'PDF, Word, Excel, XML, JPG oder PNG bis {max}.',
    dataSection: 'Angaben zum Dokument',
    typeLabel: 'Dokumenttyp',
    typePlaceholder: 'Typ auswählen',
    noteHint: 'Optional · Für das Unternehmen und die Plattform sichtbar.',
    uploading: 'Das Dokument wird hochgeladen…',
    error: 'Das Dokument konnte nicht hochgeladen werden',
    confirm: {
      title: '{name} hochladen?',
      message: 'Es wird verschlüsselt in den Dokumenten des Unternehmens gespeichert.',
      detailsTitle: 'Wird hochgeladen',
      file: 'Datei',
    },
    errors: {
      fileMissing: 'Wählen Sie die Datei aus, die Sie hochladen möchten.',
      type: 'Wählen Sie eine Datei im Format PDF, Word, Excel, XML, JPG oder PNG.',
      empty: 'Die Datei ist leer. Wählen Sie eine andere.',
      size: 'Die Datei ist {size} groß, erlaubt sind höchstens {max}.',
      typeMissing: 'Wählen Sie den Dokumenttyp.',
    },
  },
} satisfies Translation<typeof es>;
