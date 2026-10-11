import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/sites';

/** Texte der Prüfstandorte auf Deutsch (de-DE): dieselben Schlüssel wie es-MX. */
export default {
  list: {
    title: 'Prüfstandorte',
    loadError: 'Die Standorte konnten nicht geladen werden',
    subtitle_one: '{count} Standort · wo die Identität geprüft wird und in welchem Radius',
    subtitle_other: '{count} Standorte · wo die Identität geprüft wird und in welchem Radius',
    new: 'Neuer Standort',
    searchPlaceholder: 'Nach Name suchen',
    searchLabel: 'Standorte suchen',
    noun: { one: 'Standort', other: 'Standorte' },
    columns: {
      site: 'Standort',
      address: 'Adresse',
      radius: 'Radius',
      code: 'Code',
    },
    kiosksOf_one: '{count} Kiosk in {name}',
    kiosksOf_other: '{count} Kioske in {name}',
    noMatch: {
      title: 'Keine Ergebnisse',
      description: 'Versuchen Sie es mit einer anderen Suche oder einem anderen Filter.',
    },
    empty: {
      title: 'Keine Prüfstandorte',
      description: 'Erstellen Sie einen Standort, um zu begrenzen, wo geprüft wird.',
    },
  },
  form: {
    loadError: 'Der Standort konnte nicht geladen werden',
    newTitle: 'Neuer Standort',
    editTitle: 'Standort bearbeiten',
    newSubtitle: 'Ein Ort, an dem die Identität geprüft wird: Werk, Filiale, Büro…',
    create: 'Standort erstellen',
    createError: 'Der Standort konnte nicht erstellt werden',
    saveError: 'Der Standort konnte nicht gespeichert werden',
    rule: 'Radius für die Prüfung: {distance}.',
    created: {
      title: 'Standort erstellt',
      text: '{name} kann jetzt bei der Prüfung verwendet werden. {rule}',
    },
    updated: {
      title: 'Standort aktualisiert',
      text: '{name} · {rule}',
    },
    sections: {
      site: 'Standort',
      location: 'Lage',
    },
    name: 'Name des Standorts',
    nameExample: 'Werk Hermosillo',
    nameHint: 'Eindeutig in Ihrem Unternehmen: z. B. „Werk Hermosillo“',
    radius: 'Radius für die Prüfung (Meter)',
    radiusHint: 'Zwischen {min} und {max} m: die Größe des Orts plus die Toleranz des GPS.',
    suggestedRadii: 'Empfohlene Radien',
    onSiteNote: 'Vor Ort wird die Identität innerhalb dieses Radius mit dem Gesicht und der Position des Telefons geprüft.',
    locationIntro: 'Suchen Sie den Ort oder tippen Sie auf die Karte. Der Kreis zeigt den Radius für die Prüfung.',
    pointRequired: 'Markieren Sie den Punkt des Standorts auf der Karte',
  },
  fields: {
    address: 'Adresse',
    references: 'Hinweise zum Ort',
    point: 'Punkt auf der Karte',
    radius: 'Radius für die Prüfung',
  },
  confirm: {
    createTitle: 'Standort {name} erstellen?',
    createMessage: 'Er kann begrenzen, wo die Identität geprüft wird.',
    willCreate: 'Wird erstellt',
    editTitle: 'Änderungen am Standort {name} speichern?',
  },
  status: {
    title: 'Status des Standorts',
    activeMeaning: 'Er nimmt Identitätsprüfungen an diesem Ort an.',
    inactiveMeaning: 'Er nimmt an diesem Ort keine Identitätsprüfungen an.',
    deactivateWarning: 'Er nimmt hier keine Prüfungen an, bis Sie ihn aktivieren. Bereits Erfasstes bleibt unverändert.',
    removeWarning: 'Er kann nur gelöscht werden, wenn dort noch niemand geprüft wurde. Gibt es schon Prüfungen, deaktivieren Sie ihn.',
    activateQuestion: 'Standort {name} aktivieren?',
    deactivateQuestion: 'Standort {name} deaktivieren?',
    removeQuestion: 'Standort {name} löschen?',
    activated: 'Standort aktiviert',
    deactivated: 'Standort deaktiviert',
    removed: 'Standort gelöscht',
    inUse: 'Der Standort wird verwendet: Deaktivieren Sie ihn',
  },
  recordStatus: {
    activateError: '{name} konnte nicht aktiviert werden',
    deactivateError: '{name} konnte nicht deaktiviert werden',
    removeError: '{name} konnte nicht gelöscht werden',
  },
  validation: {
    nameRequired: 'Geben Sie den Namen des Standorts ein, z. B. „{example}“',
    nameMax: 'Höchstens {max} Zeichen',
  },
  trash: {
    restoreTitle: 'Standort {name} wiederherstellen?',
    banner: 'Standort gelöscht',
  },
  presence: {
    label: 'Standortcode',
    hint: 'Verlangt bei der Prüfung den Code, den der Kiosk des Standorts anzeigt.',
    on: 'Code erforderlich',
    off: 'Ohne Code',
  },
} satisfies Translation<typeof es>;
