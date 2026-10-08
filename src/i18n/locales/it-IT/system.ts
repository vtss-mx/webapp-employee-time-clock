import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/system';

/** Textos de pantallas del sistema: errores de la app, sin permiso, no encontrada, versión nueva, sin conexión en italiano (it-IT): las mismas llaves que es-MX. */
export default {
  goHome: 'Torna alla pagina iniziale',
  loadError: {
    badge: 'Errore di caricamento',
    title: 'Impossibile caricare le informazioni',
    message: "Controlla la connessione e riprova. Se il problema persiste, avvisa l'amministratore della tua azienda.",
  },
  crash: {
    title: 'Errore in questa schermata',
    message: 'I tuoi dati sono al sicuro. Riprova.',
  },
  unexpected: {
    title: 'Si è verificato un problema',
    text: 'Riprova. Se il problema persiste, ricarica la pagina.',
  },
  newVersion: {
    eyebrow: 'Aggiornamento',
    title: 'Nuova versione disponibile',
    text: 'Aggiorna per usare i miglioramenti più recenti.',
    later: 'Più tardi',
    reload: 'Aggiorna ora',
  },
  offline: 'Nessuna connessione. Nuovo tentativo automatico in corso.',
  forbidden: {
    title: 'Accesso negato',
    text: "Non hai l'autorizzazione per visualizzare questa sezione.",
  },
  notFound: {
    title: 'Pagina non trovata',
    text: 'Questa pagina non esiste o è stata spostata.',
  },
} satisfies Translation<typeof es>;
