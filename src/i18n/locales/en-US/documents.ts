import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/documents';

/** Textos de los documentos de una empresa en inglés (en-US): las mismas llaves que es-MX. */
export default {
  title: 'Documents',
  count_one: "{count} document · for your company's invoicing",
  count_other: "{count} documents · for your company's invoicing",
  noun: {
    one: 'document',
    other: 'documents',
  },
  loadError: "Couldn't load the documents",
  add: 'Upload document',
  columns: {
    file: 'Document',
    type: 'Type',
    size: 'Size',
    uploaded: 'Uploaded',
    note: 'Note',
    actions: 'Actions',
  },
  platform: 'Platform',
  platformHint: 'Uploaded by the platform administrator',
  empty: {
    title: 'No documents',
    description: 'Upload the tax certificate or another document to get started.',
  },
  download: 'Download',
  downloadLabel: 'Download {name}',
  downloadError: "Couldn't download the document",
  deleteLabel: 'Delete {name}',
  deleteError: "Couldn't delete the document",
  remove: {
    title: 'Delete {name}?',
    message: "It can't be downloaded while it's in Deleted.",
  },
  restoreTitle: 'Restore {name}?',
  upload: {
    title: 'Upload document',
    subtitle: "It's stored encrypted and can only be downloaded from the app.",
    fileSection: 'File',
    fileLabel: 'Document',
    hint: 'PDF, Word, Excel, XML, JPG or PNG up to {max}.',
    dataSection: 'Document details',
    typeLabel: 'Document type',
    typePlaceholder: 'Choose the type',
    noteHint: 'Optional · Visible to the company and the platform.',
    uploading: 'Uploading the document…',
    error: "Couldn't upload the document",
    confirm: {
      title: 'Upload {name}?',
      message: "It will be stored encrypted in the company's documents.",
      detailsTitle: 'Will be uploaded',
      file: 'File',
    },
    errors: {
      fileMissing: 'Choose the file to upload.',
      type: 'Choose a PDF, Word, Excel, XML, JPG or PNG file.',
      empty: 'The file is empty. Choose another one.',
      size: 'The file is {size} and the limit is {max}.',
      typeMissing: 'Choose the document type.',
    },
  },
} satisfies Translation<typeof es>;
