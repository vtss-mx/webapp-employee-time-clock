import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/documents';

/** Textos de los documentos de una empresa en francés (fr-FR): las mismas llaves que es-MX. */
export default {
  title: 'Documents',
  count_one: '{count} document · pour la facturation de votre entreprise',
  count_other: '{count} documents · pour la facturation de votre entreprise',
  noun: {
    one: 'document',
    other: 'documents',
  },
  loadError: 'Impossible de charger les documents',
  add: 'Ajouter un document',
  columns: {
    file: 'Document',
    type: 'Type',
    size: 'Taille',
    uploaded: 'Ajouté le',
    note: 'Note',
    actions: 'Actions',
  },
  platform: 'Plateforme',
  platformHint: "Ajouté par l'administrateur de la plateforme",
  empty: {
    title: 'Aucun document',
    description: "Ajoutez l'attestation de situation fiscale ou un autre document pour commencer.",
  },
  download: 'Télécharger',
  downloadLabel: 'Télécharger {name}',
  downloadError: 'Impossible de télécharger le document',
  deleteLabel: 'Supprimer {name}',
  deleteError: 'Impossible de supprimer le document',
  remove: {
    title: 'Supprimer {name}?',
    message: "Il ne pourra pas être téléchargé tant qu'il sera dans «Supprimés».",
  },
  restoreTitle: 'Restaurer {name}?',
  upload: {
    title: 'Ajouter un document',
    subtitle: "Il est stocké chiffré et ne se télécharge que depuis l'application.",
    fileSection: 'Fichier',
    fileLabel: 'Document',
    hint: "PDF, Word, Excel, XML, JPG ou PNG jusqu'à {max}.",
    dataSection: 'Informations du document',
    typeLabel: 'Type de document',
    typePlaceholder: 'Choisissez le type',
    noteHint: "Facultatif · Visible par l'entreprise et la plateforme.",
    uploading: 'Envoi du document…',
    error: "Impossible d'ajouter le document",
    confirm: {
      title: 'Ajouter {name}?',
      message: "Il sera stocké chiffré dans les documents de l'entreprise.",
      detailsTitle: 'Sera ajouté',
      file: 'Fichier',
    },
    errors: {
      fileMissing: 'Choisissez le fichier à ajouter.',
      type: 'Choisissez un fichier PDF, Word, Excel, XML, JPG ou PNG.',
      empty: 'Le fichier est vide. Choisissez-en un autre.',
      size: 'Le fichier pèse {size} et le maximum est de {max}.',
      typeMissing: 'Choisissez le type de document.',
    },
  },
} satisfies Translation<typeof es>;
