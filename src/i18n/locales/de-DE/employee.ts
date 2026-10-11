import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/employee';

/** Textos de pantallas del empleado (verificación, registro facial, mi QR) en alemán (de-DE): las mismas llaves que es-MX. */
export default {
  menu: {
    eyebrow: 'Identifizierung',
    hello: 'Hallo, {name}',
    helloAnonymous: 'Hallo',
    question: 'Wie möchten Sie sich identifizieren?',
    face: 'MIT GESICHT VERIFIZIEREN',
    faceLiveness: 'Gesichtserkennung mit Lebenderkennung',
    faceOnly: 'Gesichtserkennung',
    start: 'Starten',
    qr: 'MEINEN QR-CODE ZEIGEN',
    qrText: 'Zeigen Sie ihn am Prüfgerät vor: Er ändert sich alle {seconds} s und gilt nur einmal',
    show: 'Anzeigen',
    footer: 'Identität von Ihrem Unternehmen validiert · Geschützte Verbindung',
  },
  verify: {
    title: 'Gesichtsverifizierung',
    submitting: 'Ihre Identität wird verifiziert…',
    failed: 'Ihre Identität konnte nicht verifiziert werden',
    showQr: 'Meinen QR-Code anzeigen',
  },
  enrollment: {
    title: 'Gesichtsregistrierung',
    tips: {
      light: 'Suchen Sie einen gut beleuchteten Ort auf.',
      front: 'Schauen Sie mit unverdecktem Gesicht direkt in die Kamera.',
    },
    rejected: {
      title: 'Ihre vorherige Registrierung wurde abgelehnt',
      reason: 'Grund: „{reason}“.',
      noReason: 'Ihr Unternehmen konnte Ihre Identität mit den gesendeten Aufnahmen nicht validieren.',
    },
    reverify: {
      title: 'Verifizieren Sie Ihre Identität erneut',
      eyebrow: 'Anfrage Ihres Unternehmens',
      step: 'Registrieren Sie Ihr Gesicht mit Lebenderkennung; das dauert etwa eine Minute.',
    },
    confirm: {
      replaces: 'Ihre vorherige Registrierung wird durch diese ersetzt.',
      replacesPhoto: 'Ihr vorheriges erstes Foto wird durch dieses ersetzt.',
      open: 'Kamera öffnen',
      photo: {
        title: 'Erstes Foto aufnehmen?',
        message: 'Die Kamera wird geöffnet, um ein Foto Ihres Gesichts von vorne aufzunehmen. Es wird für Ihre Registrierung verschlüsselt gespeichert.',
      },
      captures: {
        title: 'Aufnahmen starten?',
        message: 'Die Kamera wird geöffnet, um {count} Aufnahmen Ihres Gesichts zu machen und die Lebenderkennung durchzuführen.',
      },
      video: {
        title: 'Video aufnehmen?',
        message_one: 'Kamera und Mikrofon werden geöffnet, damit Sie {count} Frage im Video beantworten.',
        message_other: 'Kamera und Mikrofon werden geöffnet, damit Sie {count} Fragen im Video beantworten.',
      },
    },
    submitting: 'Ihre Registrierung wird gesendet…',
    sent: {
      title: 'Registrierung gesendet',
      text: 'Ihr Unternehmen validiert Ihre Identität in Kürze.',
      offline: 'Ihr Unternehmen validiert Ihre Identität in Kürze. Die Ansicht wird aktualisiert, sobald die Verbindung wieder besteht.',
    },
    fatal: 'Die Registrierung konnte nicht abgeschlossen werden',
    again: 'Registrieren Sie Ihr Gesicht erneut',
    welcome: 'Willkommen, {name}',
    intro: 'Registrieren Sie Ihr Gesicht, um Ihre Identität zu schützen. Das ist nur einmal nötig, und Ihr Unternehmen validiert es.',
    after: {
      title: 'Danach: Validierung durch Ihr Unternehmen',
      text: 'Ihr Unternehmen prüft und bestätigt Ihre Identität; das Ergebnis sehen Sie in der App.',
    },
    before: 'Bevor Sie beginnen:',
    privacy: 'Ihre Fotos, Ihr Video und Ihre Stimme werden verschlüsselt gespeichert und nur von Ihrem Unternehmen geprüft; sie werden nie weitergegeben.',
    /** El indicador sobre el visor: los pasos los manda el servidor y su nombre sale del catálogo; «Listo» es el final. */
    steps: {
      label: 'Schritt {current} von {total}',
      done: 'Fertig',
    },
    /** Mientras se guarda la foto inicial. */
    photoSaving: 'Ihr Foto wird gespeichert…',
    /** El índice del registro: estado, aviso y botón de cada paso (su nombre y descripción, del catálogo). */
    index: {
      steps_one: '{count} Schritt',
      steps_other: '{count} Schritte',
      resume: 'Erledigen Sie die Schritte der Reihe nach. Sie können nach jedem Schritt aufhören und an einem anderen Tag weitermachen. Ihr Fortschritt bleibt gespeichert.',
      errorTitle: 'Ihre Registrierung konnte nicht geladen werden',
      label: 'Schritte Ihrer Registrierung',
      state: {
        pending: 'Offen',
        done: 'Erledigt · {date}',
        complete: 'Erledigt',
        locked: 'Gesperrt',
        expired: 'Abgelaufen',
        exhausted: 'Keine Versuche mehr',
        answered: '{answered} von {total} beantwortet',
      },
      hint: {
        /** `step`: el nombre del paso que falta, del catálogo. */
        blocked: 'Schließen Sie zuerst „{step}“ ab.',
        validUntil: 'Gültig bis {date}',
        expired: 'Ihr Foto ist abgelaufen. Nehmen Sie es erneut auf.',
        exhausted: 'Die Versuche sind aufgebraucht. Wiederholen Sie das erste Foto und die Aufnahmen.',
        unknown: 'Aktualisieren Sie die App, um diesen Schritt fortzusetzen.',
      },
      action: {
        photo: 'Foto aufnehmen',
        retakePhoto: 'Foto wiederholen',
        captures: 'Aufnahmen starten',
        video: 'Video aufnehmen',
        resumeVideo: 'Video fortsetzen',
        document: 'Dokument hochladen',
        replaceDocument: 'Dokument ersetzen',
      },
    },
    /** La pantalla de un paso que ahora no se puede abrir: qué pasa (su vacío) y de vuelta al índice. */
    blocked: {
      back: 'Zurück zur Registrierung',
      blocked: {
        title: 'Ein Schritt kommt zuerst',
        text: 'Schließen Sie „{step}“ ab, um mit diesem Schritt fortzufahren.',
      },
      done: {
        title: 'Schritt abgeschlossen',
        text: 'Er ist schon fertig. Fahren Sie mit dem nächsten Schritt fort.',
      },
      disabled: {
        title: 'Schritt nicht verlangt',
        text: 'Ihr Unternehmen verlangt diesen Schritt Ihrer Registrierung nicht.',
      },
      exhausted: {
        title: 'Keine Versuche mehr',
        text: 'Wiederholen Sie das erste Foto und die Aufnahmen, um es erneut zu versuchen.',
      },
      unknown: {
        title: 'Schritt nicht verfügbar',
        text: 'Aktualisieren Sie die App, um diesen Schritt fortzusetzen.',
      },
    },
    /** Un 409 del servidor: el paso ya no toca (lo bloquea otro o la empresa dejó de pedirlo). */
    stepGone: 'Dieser Schritt ist nicht mehr verfügbar',
    /** Un paso que se cumple con un documento de identidad: cómo va. */
    document: {
      pending: 'Ihr Dokument fehlt noch.',
      done: 'Dokument erhalten · {date}',
      doneNoDate: 'Dokument erhalten.',
    },
  },
  myQr: {
    errorTitle: 'Ihr QR-Code konnte nicht erstellt werden',
    alt: 'QR-Code von {name}',
    eyebrow: 'Digitaler Ausweis',
    title: 'Mein QR-Code',
    intro: 'Zeigen Sie ihn am Prüfgerät vor, um sich zu identifizieren. Er ändert sich alle {seconds} s und gilt nur einmal.',
    validated: 'Identität validiert',
    employeeNumber: 'Personalnummer {number}',
    enlarge: 'Groß anzeigen',
    another: 'Neuen erstellen',
    brightness: 'Erhöhen Sie die Bildschirmhelligkeit, damit er schneller gelesen wird.',
    singleUse:
      'Jeder Code gilt nur einmal und läuft nach Sekunden ab: Ein Foto oder Bildschirmfoto funktioniert nicht. Er enthält weder Ihre personenbezogenen noch Ihre biometrischen Daten.',
    brightnessLarge: 'Erhöhen Sie die Helligkeit, damit er sofort gelesen wird.',
    unavailable: {
      qrTitle: 'QR nicht verfügbar',
      faceTitle: 'Gesichtsregistrierung ausstehend',
    },
  },
  pending: {
    errorTitle: 'Der Status konnte nicht aktualisiert werden',
    title: 'Ihre Identität wird validiert',
    text: '{name}, Ihre Gesichtsregistrierung wurde gesendet. Ein Administrator Ihres Unternehmens prüft sie; hier sehen Sie, sobald sie freigegeben ist.',
    sent: {
      title: 'Gesichtsregistrierung gesendet',
      text: 'Gesicht, Lebenderkennung und Qualität geprüft.',
    },
    review: {
      title: 'Validierung durch Ihr Unternehmen',
      text: 'Ein Administrator bestätigt, dass Sie es sind.',
    },
    access: {
      title: 'Zugang freigeschaltet',
      text: 'Sie können sich mit Ihrem Gesicht oder Ihrem QR-Code identifizieren.',
    },
    refresh: 'Status aktualisieren',
    auto: 'Diese Ansicht wird automatisch aktualisiert.',
  },
} satisfies Translation<typeof es>;
