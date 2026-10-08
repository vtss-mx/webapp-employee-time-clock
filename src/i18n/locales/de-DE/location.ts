import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/location';

/**
 * Textos de domicilios, mapas, búsqueda de lugares y ubicación en alemán (de-DE): las mismas llaves que es-MX. La
 * ubicación GPS del dispositivo se dice «Position» (el «Standort» es el sitio de trabajo); el permiso del navegador y
 * del sistema, como lo nombran ellos: «Standort» y «genaue Standortbestimmung» (igual que los mensajes del backend).
 */
export default {
  eyebrow: 'Position',
  problems: {
    unsupported: {
      title: 'Position nicht verfügbar',
      text: 'Dieser Browser kann die Position nicht abrufen. Verwenden Sie ein aktuelles Safari oder Chrome.',
    },
    insecure: {
      title: 'Verbindung nicht sicher',
      text: 'Die Position kann nur über eine sichere Verbindung (https) abgerufen werden. Öffnen Sie die App über ihre sichere Adresse.',
    },
    denied: {
      title: 'Erlauben Sie den Zugriff auf Ihren Standort',
      text: 'Die Standortberechtigung ist in diesem Browser blockiert.',
    },
    unavailable: {
      title: 'Ihre Position konnte nicht ermittelt werden',
      text: 'Aktivieren Sie die Standortbestimmung (GPS) und versuchen Sie es erneut, am besten in der Nähe eines Fensters.',
    },
    timeout: {
      title: 'Die Ermittlung der Position hat zu lange gedauert',
      text: 'Aktivieren Sie die genaue Standortbestimmung des Geräts und versuchen Sie es erneut.',
    },
  },
  permissionSteps: {
    iphone: 'iPhone: Einstellungen › Datenschutz & Sicherheit › Ortungsdienste › Safari (oder Ihr Browser) › „Beim Verwenden der App“.',
    android: 'Android: Tippen Sie auf das Schloss neben der Adresse › Berechtigungen › Standort › Zulassen.',
  },
  deniedFor: {
    login: {
      text: 'Dieses Prüfgerät kann sich nur an seinem Einsatzort anmelden, und die Standortberechtigung ist blockiert.',
      next: 'Kehren Sie zur App zurück und melden Sie sich erneut an.',
    },
    attendance: {
      text: 'Für die Erfassung Ihrer Anwesenheit wird Ihre Position benötigt, und die Standortberechtigung ist in diesem Browser blockiert.',
      next: 'Kehren Sie hierher zurück und tippen Sie auf „Erneut versuchen“.',
    },
    map: {
      text: 'Um Sie auf der Karte zu finden, ist die Standortberechtigung nötig, und sie ist in diesem Browser blockiert.',
      next: 'Tippen Sie erneut auf „Meine Position“ (oder markieren Sie den Punkt auf der Karte).',
    },
    checkpoint: {
      text: 'Dieses Prüfgerät sendet bei jeder Identifizierung seine Position, und die Standortberechtigung ist in diesem Browser blockiert.',
      next: 'Öffnen Sie den Kontrollpunkt erneut.',
    },
    verification: {
      text: 'Für diese Verifizierung wird Ihre Position benötigt, und die Standortberechtigung ist in diesem Browser blockiert.',
      next: 'Kehren Sie hierher zurück und tippen Sie auf „Erneut versuchen“.',
    },
  },
  server: {
    outOfRange: 'Sie befinden sich außerhalb des erlaubten Bereichs',
    inaccurate: 'Ihre Position ist nicht genau',
    required: 'Ihre Position wird benötigt',
    approach: 'Gehen Sie näher an den Zugang, an dem dieses Prüfgerät eingesetzt wird.',
    gps: 'Aktivieren Sie die genaue Standortbestimmung (GPS) des Geräts.',
    signInAgain: 'Melden Sie sich erneut an.',
  },
  address: {
    country: {
      label: 'Land',
      hint: 'Land, in dem sich die Adresse befindet.',
      placeholder: 'Land auswählen',
      search: 'Land suchen',
      empty: 'Kein Land gefunden',
    },
    state: { label: 'Bundesland oder Provinz', hint: 'Bundesstaat, Bundesland oder Region.' },
    municipality: { label: 'Gemeinde oder Bezirk', hint: 'Verwaltungseinheit, zu der die Adresse gehört.' },
    city: { label: 'Stadt oder Ort', hint: 'Stadt, Dorf oder Ortschaft; der Name kann von dem der Gemeinde abweichen.' },
    neighborhood: { label: 'Ortsteil oder Viertel', hint: 'Gebiet oder Siedlung innerhalb des Orts.' },
    postalCode: { label: 'Postleitzahl', hint: 'Code des Postleitzahlgebiets.' },
    street: { label: 'Straße', hint: 'Name der Straße, Allee, Landstraße usw.' },
    exteriorNumber: { label: 'Hausnummer', hint: 'Nummer, die das Gebäude kennzeichnet; sie kann Buchstaben enthalten.' },
    interiorNumber: { label: 'Zusatznummer', hint: 'Wohnung, Büro oder Ladenlokal im Gebäude. Optional.' },
    referenceNotes: {
      label: 'Hinweise zum Ort',
      hint: 'Zusätzliche Hinweise zum Auffinden, etwa Querstraßen oder markante Punkte in der Nähe. Optional.',
      placeholder: 'Zwischen Juárez und Morelos, gegenüber dem Platz',
    },
    interior: 'Einheit {number}',
    required: {
      country: 'Wählen Sie das Land',
      state: 'Geben Sie das Bundesland oder die Provinz ein',
      municipality: 'Geben Sie die Gemeinde oder den Bezirk ein',
      city: 'Geben Sie die Stadt oder den Ort ein',
      neighborhood: 'Geben Sie den Ortsteil oder das Viertel ein',
      postalCode: 'Geben Sie die Postleitzahl ein',
      street: 'Geben Sie die Straße ein',
      exteriorNumber: 'Geben Sie die Hausnummer ein (oder o. Nr.)',
    },
    postalCodeMx: 'Eine mexikanische Postleitzahl hat 5 Ziffern',
    postalCodeInvalid: 'Die Postleitzahl ist nicht gültig',
    minLength: 'Geben Sie mindestens {min} Zeichen ein',
    maxLength: 'Höchstens {max} Zeichen',
  },
  picker: {
    notices: {
      geocoding: 'Die Adresse konnte nicht aus der Karte übernommen werden. Geben Sie sie manuell ein; der Punkt ist markiert.',
      geolocation: 'Ihre Position konnte nicht ermittelt werden. Markieren Sie den Punkt auf der Karte.',
      places: 'Die Ortssuche ist nicht verfügbar. Geben Sie die Adresse ein und markieren Sie den Punkt auf der Karte.',
      maps: 'Die Karte ist nicht verfügbar. Geben Sie die Adresse manuell ein.',
      offline: 'Google Maps hat nicht geantwortet. Prüfen Sie Ihre Verbindung und versuchen Sie es erneut.',
      notFound: 'Die Adresse wurde nicht gefunden. Prüfen Sie sie oder markieren Sie den Punkt auf der Karte.',
    },
    locateError: 'Der Punkt konnte nicht gefunden werden',
    notConfigured: 'Die Karte ist nicht eingerichtet: Die Adresse wird manuell erfasst, und eine Position kann nicht verlangt werden.',
    myLocation: 'Meine Position',
    point: 'Punkt: {point}',
    tapToMark: {
      access: 'Tippen Sie auf die Karte, um den Punkt des Zugangs zu markieren',
      site: 'Tippen Sie auf die Karte, um den Punkt des Standorts zu markieren',
    },
    findingAddress: 'Adresse wird gesucht…',
    locateWritten: 'Eingegebene Adresse suchen',
    removePoint: 'Punkt entfernen',
  },
  map: {
    label: 'Karte: Tippen, um den Punkt zu markieren',
    pin: 'Markierter Punkt',
    loading: 'Karte wird geladen…',
    failed: 'Die Karte ist nicht verfügbar. Geben Sie die Adresse manuell ein.',
  },
  search: {
    label: 'Nach einem Ort oder einer Adresse suchen',
    clear: 'Suche löschen',
    results: 'Gefundene Orte',
    credit: 'Ergebnisse von Google',
    creditNearest: 'Die nächstgelegenen zuerst · Ergebnisse von Google',
    failed: {
      title: 'Die Suche ist fehlgeschlagen',
      hint: 'Prüfen Sie Ihre Verbindung oder markieren Sie den Punkt auf der Karte.',
    },
    unavailable: {
      title: 'Keine Ergebnisse',
      hint: 'Geben Sie die Adresse ein und markieren Sie den Punkt auf der Karte.',
    },
    none: {
      title: 'Keine Ergebnisse',
      hint: 'Versuchen Sie es mit einer anderen Adresse oder markieren Sie den Punkt auf der Karte.',
    },
  },
} satisfies Translation<typeof es>;
