import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/policy';
import antifraud from './policy/antifraud';
import tuning from './policy/tuning';

/**
 * Textos de política de verificación y ajustes de la prueba de vida de una empresa en alemán (de-DE): las mismas
 * llaves que es-MX. Los «candados» son los «Schutzmechanismen».
 */
export default {
  loadError: 'Die Prüfrichtlinie konnte nicht geladen werden',
  title: 'Prüfrichtlinie',
  saveError: 'Das Speichern ist fehlgeschlagen',
  recommended: 'Empfohlen',
  appliesTo: 'Gilt innerhalb von Sekunden für das gesamte Personal von {company}.',
  confidence: {
    title: 'Vertrauensniveau',
    intro: 'Mindestwahrscheinlichkeit, dass die Person vor der Kamera der registrierte Mitarbeiter ist.',
    identifyIntro:
      '{lead} (Prüfgeräte): Sie können mehr verlangen, weil die Suche unter vielen die Zahl falscher Treffer erhöht. Es gilt nie unter dem vorherigen Niveau.',
    identifyLead: 'Bei der Identifizierung unter allen Mitarbeitern',
    identifyLabel: 'Vertrauensniveau zur Identifizierung unter allen Mitarbeitern',
    saved: 'Vertrauensniveau aktualisiert',
    savedText: 'Bei jeder Gesichtsverifizierung wird {value} verlangt.',
    identifySaved: 'Vertrauensniveau zur Identifizierung aktualisiert',
    identifySavedText: 'Prüfgeräte verlangen {value} bei der Identifizierung unter allen Mitarbeitern.',
  },
  sections: {
    face: {
      title: 'Anforderungen an das Gesicht',
      hint: 'Was die Person vor dem Scannen ablegen muss. Ein verdecktes Gesicht verringert die Genauigkeit.',
    },
    security: {
      title: 'Sicherheit',
      hint: 'Schutz vor Identitätstäuschung; diese Maßnahmen sollten aktiv bleiben.',
    },
    locks: {
      title: 'Schutzmechanismen gegen Täuschung',
      hint: 'Jeder Schutzmechanismus blockiert eine andere Art, die Gesichtserkennung zu täuschen; alle sollten aktiv bleiben.',
    },
    learning: {
      title: 'Kontinuierliches Lernen',
      hint: 'Jede sichere Identifizierung zeigt, wie jeder Mitarbeiter heute aussieht. Die vom Unternehmen validierten Aufnahmen werden nie ersetzt.',
    },
    location: {
      title: 'Position bei der Prüfung',
      hint: 'Jede Prüfung enthält die Position des Telefons und die Uhrzeit des Servers; passen Sie unten Genauigkeit und Geschwindigkeit an.',
    },
    methods: {
      title: 'Methoden der Identifizierung',
      hint: 'Wie sich Mitarbeiter identifizieren können.',
    },
    antifraud: {
      title: 'Betrugsschutz',
      hint:
        'Im Zweifel verlangt die Risikobewertung einen zusätzlichen Schritt oder legt die Prüfung dem Unternehmen zur Revision vor. Nachweise zu verdächtigen Versuchen sieht nur der Administrator unter „Betrugsfälle“.',
    },
    capture: {
      title: 'Aufnahmeprotokoll',
      hint: 'Prüfungen in Echtzeit gegen eingespeiste Videos. Vorerst wird nur gemessen.',
    },
    devices: {
      title: 'Geräte der Prüfgeräte',
      hint: 'Nur Prüfgeräte haben Einschränkungen; Mitarbeiter und Administratoren können jedes Gerät verwenden.',
    },
  },
  accessories: {
    remove: '{phrase} abnehmen',
    blockGlasses: {
      on: 'Die Brille muss abgenommen werden (auch Sonnenbrillen).',
      off: 'Die Identifizierung mit Brille ist erlaubt.',
    },
    blockHeadwear: {
      on: 'Mützen, Hüte und Schirmmützen müssen abgenommen werden (außer bei Mitarbeitern, die aus religiösen oder medizinischen Gründen befreit sind).',
      off: 'Die Identifizierung mit Kopfbedeckung ist erlaubt.',
    },
    blockMask: {
      on: 'Die Maske muss abgenommen werden (physische Prüfung von Nase und Wangen).',
      off: 'Die Identifizierung mit Maske ist erlaubt (geringere Genauigkeit).',
    },
  },
  options: {
    livenessChallenge: {
      label: 'Lebenderkennung',
      on: 'Die Person macht zufällige Kopfbewegungen.',
      off: 'Keine Aufgabe mit Bewegungen.',
    },
    enableTurnRight: {
      label: 'Nach rechts drehen',
      on: 'Die Lebenderkennung kann verlangen, den Kopf nach rechts zu drehen.',
      off: 'Die Lebenderkennung verlangt kein Drehen nach rechts.',
    },
    enableTurnLeft: {
      label: 'Nach links drehen',
      on: 'Die Lebenderkennung kann verlangen, den Kopf nach links zu drehen.',
      off: 'Die Lebenderkennung verlangt kein Drehen nach links.',
    },
    enableLookUp: {
      label: 'Nach oben schauen',
      on: 'Die Lebenderkennung kann verlangen, nach oben zu schauen.',
      off: 'Die Lebenderkennung verlangt kein Schauen nach oben.',
    },
    enableLookDown: {
      label: 'Nach unten schauen',
      on: 'Die Lebenderkennung kann verlangen, nach unten zu schauen.',
      off: 'Die Lebenderkennung verlangt kein Schauen nach unten.',
    },
    antiSpoofing: {
      label: 'Täuschungserkennung',
      on: 'Erkennt gedruckte Fotos, Bildschirme und Videos vor der Kamera.',
      off: 'Fotos und Bildschirme werden nicht analysiert.',
    },
    blockVirtualCameras: {
      label: 'Virtuelle Kameras blockieren',
      on: 'Programme, die sich als Kamera ausgeben (OBS, ManyCam…), werden abgelehnt.',
      off: 'Jede Kamera wird akzeptiert, auch virtuelle.',
    },
    rejectForeignImages: {
      label: 'Nur Echtzeitaufnahmen',
      on: 'Bilder aus der Galerie oder bearbeitete Bilder werden abgelehnt.',
      off: 'Bilder aus der Galerie oder bearbeitete Bilder werden akzeptiert.',
    },
    detectStaticCaptures: {
      label: 'Standbilder erkennen',
      on: 'Ein Versuch wird abgelehnt, wenn seine Aufnahmen identisch sind (ein mehrfach gesendetes Foto).',
      off: 'Die Aufnahmen werden nicht miteinander verglichen.',
    },
    detectReplays: {
      label: 'Wiederverwendete Aufnahmen erkennen',
      on: 'Jede Aufnahme gilt nur einmal: Erneut gesendete gespeicherte oder abgefangene Aufnahmen werden abgelehnt.',
      off: 'Bereits empfangene Aufnahmen werden nicht wiedererkannt.',
    },
    checkCaptureContinuity: {
      label: 'Durchgehende Aufnahme verlangen',
      on: 'Alle Aufnahmen müssen von derselben Kamera stammen, mit durchgehendem Gesicht und Licht beim Drehen.',
      off: 'Kamera, Bildausschnitt und Licht werden zwischen den Aufnahmen nicht verglichen.',
    },
    enforceHumanTiming: {
      label: 'Menschliche Reaktionszeit bei der Lebenderkennung',
      on: 'Antworten auf die Aufgabe, die schneller sind, als ein Mensch reagieren kann, werden abgelehnt (automatisierte Programme).',
      off: 'Die Antwortzeit auf die Aufgabe wird nicht gemessen.',
    },
    detectDuplicateFaces: {
      label: 'Doppelte Gesichter erkennen',
      on:
        'Bei der Registrierung eines Gesichts, das bereits für einen anderen Mitarbeiter freigegeben ist: Es wird zur Prüfung markiert oder, vor Ort, blockiert.',
      off: 'Die Registrierung wird nicht mit den anderen Mitarbeitern verglichen.',
    },
    lockoutEnabled: {
      label: 'Sperre nach fehlgeschlagenen Versuchen',
      on: 'Nach mehreren aufeinanderfolgenden fehlgeschlagenen oder verdächtigen Versuchen wird vorübergehend gesperrt (unten anpassen).',
      off: 'Unbegrenzte Versuche (nur das allgemeine Limit an Anfragen).',
    },
    adaptiveLearning: {
      label: 'Aus jeder sicheren Identifizierung lernen',
      on: 'Lernt nur aus Identifizierungen mit Lebenderkennung und deutlicher Übereinstimmung (anderes Licht, andere Kamera, Frisur oder Bart).',
      off: 'Jeder Mitarbeiter wird nur mit den Aufnahmen seiner freigegebenen Registrierung verglichen.',
    },
    detectImpossibleTravel: {
      label: 'Unmögliche Reisen erkennen',
      on: 'Eine Prüfung, die für die vergangene Zeit zu weit von der vorherigen entfernt ist, wird abgelehnt (gefälschte Position oder geteiltes Konto).',
      off: 'Die Position einer Prüfung wird nicht mit der vorherigen verglichen.',
    },
    qrEnabled: {
      label: 'Verifizierung per QR-Code',
      on: 'Die Mitarbeiter zeigen auf ihrem Telefon einen dynamischen QR-Code: Er ändert sich automatisch, und jeder Code gilt nur einmal.',
      off: 'Nur Gesichtserkennung.',
    },
    validatorDeviceApproval: {
      label: 'Geräte von Prüfgeräten freigeben',
      on: 'Jeder Tabletcomputer und jedes Telefon eines Prüfgeräts muss unter Prüfgeräte › Geräte freigegeben werden.',
      off: 'Prüfgeräte können sich mit E-Mail-Adresse und Passwort auf jedem Gerät anmelden.',
    },
    riskEngine: {
      label: 'Risikobewertung',
      on: 'Jeder Versuch wird anhand seiner Signale bewertet und nach seiner Risikostufe entschieden (unten anpassen).',
      off: 'Nur die Schutzmechanismen entscheiden; die Signale werden nicht addiert.',
    },
    flashPaced: {
      label: 'Vom Server vorgegebener Blitz',
      on: 'Jede Farbe wird erst im Moment enthüllt: Niemand kann die Aufnahmen vorbereiten.',
      off: 'Die Farben werden mit der Aufgabe gesendet.',
    },
    captureBurst: {
      label: 'Serie von Gesichtsausschnitten',
      on: 'Es werden einige Sekunden an Ausschnitten gesendet, um natürliche Bewegung und Kontinuität zu messen.',
      off: 'Es werden nur einzelne Aufnahmen gesendet.',
    },
    fraudEvidence: {
      label: 'Nachweise verdächtiger Versuche speichern',
      on:
        'Von jedem verdächtigen Versuch werden einige verschlüsselte Einzelbilder gespeichert, um den Fall zu prüfen; sie werden nach Ablauf automatisch gelöscht.',
      off: 'Fälle werden ohne Einzelbilder eröffnet: nur mit den Messwerten.',
    },
    voiceVerification: {
      label: 'Sprach- und Videoprüfung bei der Registrierung',
      on: 'Nach den Fotos beantwortet der Mitarbeiter per Video drei Fragen zu seinen Daten; Stimme und Gesicht werden auf dem Server verglichen und das Unternehmen prüft das Video.',
      off: 'Die Registrierung endet mit den Fotos.',
    },
    voiceGuidance: {
      label: 'Sprachführung',
      on: 'Die Ansagen der Registrierung werden auf dem Gerät vorgelesen.',
      off: 'Die Registrierung liest die Ansagen nicht vor.',
    },
    validatorMobileOnly: {
      label: 'Prüfgeräte nur über Tabletcomputer oder Telefon',
      on: 'Prüfgeräte melden sich nur auf Tabletcomputern und Telefonen an.',
      off: 'Prüfgeräte können auch über einen Computer mit Kamera arbeiten.',
    },
  },
  warnings: {
    spoofing: 'Dies verringert den Schutz vor Identitätstäuschung (Fotos, Bildschirme oder Videos).',
    impossibleTravel: 'Eine Prüfung mit gefälschter Position oder von einem anderen Ort wird nicht anhand der Entfernung erkannt.',
    deviceApproval: 'Wer E-Mail-Adresse und Passwort eines Prüfgeräts kennt, kann es von jedem Gerät aus bedienen.',
    mobileOnly: 'Prüfgeräte können dann über Computer arbeiten, deren Kamera sich meist leichter mit Fotos oder Bildschirmen täuschen lässt.',
    riskEngine:
      'Die Signale werden nicht mehr addiert: Ein Versuch mit mehreren Hinweisen auf Täuschung kommt durch, wenn ihn kein einzelner Schutzmechanismus stoppt.',
    captureProtocol: 'Ein im Voraus vorbereitetes Video ist schwerer zu erkennen.',
    voiceVerification: 'Eine Registrierung mit den Fotos einer anderen Person hat keine zweite Prüfung von Stimme und Gesicht per Video mehr.',
  },
  toggle: {
    eyebrow: 'Prüfrichtlinie',
    eyebrowSecurity: 'Empfohlener Schutz',
    activateTitle: '„{label}“ aktivieren?',
    deactivateTitle: '„{label}“ deaktivieren?',
    on: 'Aktiviert',
    off: 'Deaktiviert',
    activate: 'Aktivieren',
    deactivate: 'Deaktivieren',
    activated: '{label}: aktiviert',
    deactivated: '{label}: deaktiviert',
  },
  voice: {
    title: 'Sprachführung',
    hint: 'Liest die Ansagen der Gesichtsregistrierung mit der Sprachsynthese des Geräts vor.',
    profile: {
      label: 'Stimme der Sprachführung',
      description: 'Stimme, die die Ansagen während der Registrierung vorliest.',
      saved: 'Stimme der Sprachführung aktualisiert',
      savedText: 'Die Ansagen werden mit der Stimme „{name}“ vorgelesen.',
      confirmTitle: '„{value}“-Stimme verwenden?',
      confirmLabel: 'Stimme speichern',
    },
    preview: 'Stimme testen',
  },
  /** Schritte der Identitätsregistrierung und ihre Reihenfolge: der ADMIN entscheidet je Unternehmen. */
  enrollment: {
    title: 'Schritte der Identitätsregistrierung',
    hint: 'Wählen Sie, was von jedem Mitarbeiter verlangt wird und in welcher Reihenfolge. Der Mitarbeiter geht die Schritte in dieser Reihenfolge durch.',
    label: 'Schritte der Registrierung, in Reihenfolge',
    required: 'Pflicht',
    locked: 'Wird immer verlangt: Es ist die Registrierung, die das Unternehmen prüft.',
    position: 'Schritt {position} von {total}',
    notAsked: 'Wird nicht verlangt',
    moveUp: '„{name}“ nach oben',
    moveDown: '„{name}“ nach unten',
    note: 'Der Schritt „{step}“ wird immer verlangt und bleibt am Ende des Ablaufs.',
    warning: 'Weniger Schritte zu verlangen verringert die Nachweise, dass die Person die ist, die sie zu sein behauptet.',
    confirm: {
      enableTitle: '„{name}“ verlangen?',
      enableText: 'Jeder Mitarbeiter muss „{name}“ in seiner Registrierung abschließen.',
      disableTitle: '„{name}“ nicht mehr verlangen?',
      moveTitle: '„{name}“ auf Schritt {position} verschieben?',
      moveText: 'Es werden die gleichen Schritte verlangt, in anderer Reihenfolge.',
      order: 'Reihenfolge der Registrierung',
      save: 'Reihenfolge speichern',
    },
    notice: {
      enabled: '{name}: wird jetzt verlangt',
      disabled: '{name}: wird nicht mehr verlangt',
      moved: '{name}: verschoben',
      text: 'Gilt für die Registrierung aller, die sie noch nicht beendet haben.',
    },
  },
  tuning,
  ...antifraud,
} satisfies Translation<typeof es>;
