import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/sites';

/** Textos de sitios donde se checa en alemán (de-DE): las mismas llaves que es-MX. */
export default {
  list: {
    title: 'Arbeitsstandorte',
    loadError: 'Die Standorte konnten nicht geladen werden',
    subtitle_one: '{count} Standort · wo vor Ort gestempelt wird und in welchem Radius',
    subtitle_other: '{count} Standorte · wo vor Ort gestempelt wird und in welchem Radius',
    new: 'Neuer Standort',
    searchPlaceholder: 'Nach Name suchen',
    searchLabel: 'Standorte suchen',
    noun: { one: 'Standort', other: 'Standorte' },
    columns: {
      site: 'Standort',
      address: 'Adresse',
      radius: 'Radius',
      employees: 'Mitarbeiter heute',
      code: 'Code',
    },
    kiosksOf_one: '{count} Kiosk in {name}',
    kiosksOf_other: '{count} Kioske in {name}',
    noMatch: {
      title: 'Keine Ergebnisse',
      description: 'Versuchen Sie es mit einer anderen Suche oder einem anderen Filter.',
    },
    empty: {
      title: 'Keine Arbeitsstandorte',
      description: 'Erstellen Sie einen Standort, an dem Ihr Personal stempelt.',
    },
  },
  form: {
    loadError: 'Der Standort konnte nicht geladen werden',
    newTitle: 'Neuer Standort',
    editTitle: 'Standort bearbeiten',
    newSubtitle: 'Ein Ort, an dem Ihr Personal vor Ort stempelt: Werk, Filiale, Büro…',
    create: 'Standort erstellen',
    createError: 'Der Standort konnte nicht erstellt werden',
    saveError: 'Der Standort konnte nicht gespeichert werden',
    rule: 'Radius zum Stempeln: {distance}.',
    created: {
      title: 'Standort erstellt',
      text: '{name} kann jetzt Ihren Schichten hinzugefügt werden. {rule}',
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
    radius: 'Radius zum Stempeln (Meter)',
    radiusHint: 'Zwischen {min} und {max} m: die Größe des Orts plus die Toleranz des GPS.',
    suggestedRadii: 'Empfohlene Radien',
    onSiteNote: 'Vor Ort wird innerhalb dieses Radius mit dem Gesicht und der Position des Telefons gestempelt.',
    locationIntro: 'Suchen Sie den Ort oder tippen Sie auf die Karte. Der Kreis zeigt den Radius zum Stempeln.',
    pointRequired: 'Markieren Sie den Punkt des Standorts auf der Karte',
  },
  fields: {
    address: 'Adresse',
    references: 'Hinweise zum Ort',
    point: 'Punkt auf der Karte',
    radius: 'Radius zum Stempeln',
  },
  confirm: {
    createTitle: 'Standort {name} erstellen?',
    createMessage: 'Er kann Ihren Schichten hinzugefügt werden; wer diese Schichten hat, stempelt hier.',
    willCreate: 'Wird erstellt',
    editTitle: 'Änderungen am Standort {name} speichern?',
  },
  status: {
    title: 'Status des Standorts',
    activeMeaning: 'Er kann Schichten hinzugefügt werden, und wer diese Schichten hat, kann hier stempeln.',
    inactiveMeaning: 'An diesem Standort kann niemand stempeln, und er kann keiner Schicht hinzugefügt werden.',
    deactivateWarning:
      'Niemand kann hier stempeln oder ihn einer Schicht hinzufügen, bis Sie ihn aktivieren. Schichten, die ihn enthalten, und bereits Erfasstes bleiben unverändert.',
    removeWarning:
      'Er kann nur gelöscht werden, wenn ihn keine Schicht verwendet und dort noch niemand gestempelt hat. Verwendet ihn eine Schicht, entfernen Sie ihn aus der Schicht; wurde dort bereits gestempelt, deaktivieren Sie ihn.',
    activateQuestion: 'Standort {name} aktivieren?',
    deactivateQuestion: 'Standort {name} deaktivieren?',
    removeQuestion: 'Standort {name} löschen?',
    activated: 'Standort aktiviert',
    deactivated: 'Standort deaktiviert',
    removed: 'Standort gelöscht',
    inUse: 'Der Standort wird verwendet: Deaktivieren Sie ihn',
  },
  trash: {
    restoreTitle: 'Standort {name} wiederherstellen?',
    banner: 'Standort gelöscht',
  },
  presence: {
    label: 'Standortcode',
    hint: 'Verlangt beim Ein- und Ausstempeln den Code, den der Kiosk des Standorts anzeigt.',
    on: 'Code erforderlich',
    off: 'Ohne Code',
  },
} satisfies Translation<typeof es>;
