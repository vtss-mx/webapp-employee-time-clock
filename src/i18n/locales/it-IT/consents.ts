import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/consents';

/** Textos del consentimiento biométrico en italiano (it-IT, trato de «tu»): las mismas llaves que es-MX. */
export default {
  title: 'Dati biometrici',
  intro: "Il tuo consenso per usare il tuo volto e la tua voce quando si verifica la tua identità.",
  loadError: 'Impossibile caricare il tuo consenso',
  granted: 'Concesso',
  pending: 'Non concesso',
  askedBy: 'La tua azienda lo richiede',
  grantedOn: 'Concesso il {date}',
  revokedOn: 'Revocato il {date}',
  version: 'Versione {version}',
  read: 'Leggi e concedi',
  review: 'Vedi il testo',
  revoke: 'Revoca',
  back: 'Torna a Il mio profilo',
  backToEnrollment: 'Torna alla tua registrazione',
  pageTitle: 'Consenso biometrico',
  pageSubtitle: 'Leggi il testo completo e decidi se concederlo',
  grant: 'Concedi il mio consenso',
  empty: {
    title: 'Nessun consenso',
    description: 'Qui vedrai ciò che la tua azienda ti chiede di autorizzare.',
  },
  onlyEmployees: {
    title: 'Solo per i dipendenti',
    description: 'Il tuo profilo non conserva dati biometrici.',
  },
  grantAsk: {
    eyebrow: 'Il tuo consenso',
    title: 'Concedere il tuo consenso?',
    message: 'Confermi di aver letto il testo completo e autorizzi quanto indicato.',
    note: 'Puoi revocarlo quando vuoi da Il mio profilo.',
    confirm: 'Concedi',
  },
  grantFailed: 'Impossibile concedere il tuo consenso',
  grantedTitle: 'Consenso concesso',
  revokeAsk: {
    eyebrow: 'Il tuo consenso',
    title: 'Revocare il tuo consenso biometrico?',
    message: 'Il tuo volto, le tue foto e la tua voce vengono eliminati subito e la tua registrazione del volto non esiste più.',
    note: "L'operazione non può essere annullata. La tua azienda dovrà verificare la tua identità in altro modo.",
    confirm: 'Revoca',
  },
  revokeFailed: 'Impossibile revocare il tuo consenso',
  revokedTitle: 'Consenso revocato',
  revokedText: 'I tuoi dati biometrici sono stati eliminati.',
  missingTitle: 'Manca il tuo consenso',
  inPersonTitle: 'Manca il consenso di {name}',
  inPersonText: 'Il consenso va concesso da Il mio profilo prima della registrazione del volto.',
} satisfies Translation<typeof es>;
