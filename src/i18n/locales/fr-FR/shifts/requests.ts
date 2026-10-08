import type { Translation } from '../../../../types/i18n';
import type es from '../../es-MX/shifts/requests';

/** Textos de las solicitudes de cambio de turno en francés (fr-FR): las mismas llaves que es-MX. */
export default {
  title: "Demandes de changement d'horaire",
  backLabel: 'Demandes',
  loadError: 'Impossible de charger les demandes',
  subtitle_one: '{count} demande de vos employés',
  subtitle_other: '{count} demandes de vos employés',
  all: 'Toutes les demandes',
  filter: 'Filtrer par statut',
  noun: { one: 'demande', other: 'demandes' },
  empty: {
    pendingTitle: 'Tout est à jour',
    pendingDescription: "Aucune demande d'horaire à examiner.",
    statusTitle: 'Aucune demande',
    statusDescription: 'Essayez un autre statut.',
    allDescription: "Les changements d'horaire demandés par votre personnel apparaîtront ici.",
  },
  item: {
    approve: 'Approuver la demande de {name}',
    reject: 'Refuser la demande de {name}',
    when: 'À partir du {date} · demandée {ago}',
    companyNote: "Note de l'entreprise: «{note}»",
  },
  summary: {
    change: 'Changement',
    from: 'Début',
    requested: 'Demandée',
    noShift: 'Sans horaire',
    changesTo: 'passe à',
  },
  closed: {
    loadError: 'Impossible de charger la demande',
    title: "Cette demande n'est plus en attente",
    description: "Elle a déjà été approuvée, refusée ou annulée par l'employé.",
    action: 'Voir les demandes',
  },
  approve: {
    title: "Approuver le changement d'horaire",
    request: 'Demande',
    requestedShift: 'Horaire demandé',
    fromTomorrow: "Choisissez une date à partir de demain: le changement d'horaire est programmé un jour à l'avance.",
    dateHint: 'Demandé à partir du {date}. Son horaire actuel prend fin la veille et ce qui est déjà enregistré ne change pas.',
    error: "Impossible d'approuver le changement d'horaire",
    confirmTitle: "Approuver le passage de {employee} à l'horaire {shift}?",
    confirmMessage: 'Son horaire actuel prend fin la veille et ce qui est déjà enregistré ne change pas.',
    submit: 'Approuver le changement',
    done: {
      title: "Changement d'horaire approuvé",
      text: "{employee} aura l'horaire {shift} à partir du {date}.",
    },
  },
  reject: {
    title: "Refuser le changement d'horaire",
    intro: "Demande de passage à l'horaire {shift} à partir du {date}. L'employé conservera son horaire actuel et verra cette note dans sa demande.",
    placeholder: 'Expliquez pourquoi le changement est impossible (p. ex. personnel insuffisant sur cet horaire)',
    confirmTitle: 'Refuser le changement de {employee}?',
    confirmMessage: "L'employé conservera son horaire actuel et verra votre note dans sa demande.",
    requestedValue: '{shift} à partir du {date}',
    done: {
      title: 'Demande refusée',
      text: '{employee} conserve son horaire et verra votre note.',
    },
  },
} satisfies Translation<typeof es>;
