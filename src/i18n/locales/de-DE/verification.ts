import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/verification';

/** Textos de resultados e historial de verificaciones de identidad en alemán (de-DE): las mismas llaves que es-MX. */
export default {
  outcome: {
    success: 'Erfolgreich',
    failed: 'Fehlgeschlagen',
  },
  result: {
    kiosk: {
      title: 'Mitarbeiter identifiziert',
      greeting: 'Identität bestätigt: {name}.',
      next: 'Nächste Person',
      home: 'Zurück zum Start',
    },
    self: {
      title: 'Identität bestätigt',
      greeting: 'Hallo, {name}.',
      finish: 'Beenden',
      changeMethod: 'Methode wechseln',
    },
    number: 'Nummer',
    confidence: 'Übereinstimmung',
    dateTime: 'Datum und Uhrzeit',
    retry: 'Erneut versuchen',
  },
  history: {
    errorTitle: 'Das Protokoll konnte nicht geladen werden',
    emptyTitle: 'Keine Verifizierungen',
    emptyDescription: 'Hier sehen Sie jeden Versuch, die Identität zu verifizieren.',
    nounOne: 'Versuch',
    nounOther: 'Versuche',
    confidence: 'Übereinstimmung {value}',
  },
  map: {
    label: 'Karte der Verifizierungen',
    pin: 'Ort der Verifizierung',
    loading: 'Karte wird geladen…',
    failed: 'Die Karte ist nicht verfügbar.',
  },
  company: {
    title: 'Verifizierungen',
    subtitle: 'Wo und wann die Identität Ihrer Mitarbeiter verifiziert wurde.',
    loadError: 'Die Verifizierungen konnten nicht geladen werden',
    mapHint: 'Wählen Sie eine Verifizierung mit Position, um sie auf der Karte zu sehen.',
    notIdentified: 'Nicht identifiziert',
    noun: { one: 'Verifizierung', other: 'Verifizierungen' },
    filters: { all: 'Alle', success: 'Erfolgreich', failed: 'Fehlgeschlagen', from: 'Von', to: 'Bis' },
    columns: { when: 'Datum und Uhrzeit', result: 'Ergebnis', method: 'Methode', place: 'Ort' },
    place: { show: 'Auf der Karte ansehen', none: 'Ohne Position', accuracy: 'Genauigkeit {distance}' },
    empty: { title: 'Keine Verifizierungen', description: 'Hier sehen Sie, wo jede Verifizierung erfolgt ist.' },
    noMatch: { title: 'Keine Ergebnisse', description: 'Versuchen Sie einen anderen Filter oder Zeitraum.' },
  },
} satisfies Translation<typeof es>;
