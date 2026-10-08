import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/checkpoint';

/** Textos de punto de control del validador en alemán (de-DE): las mismas llaves que es-MX. */
export default {
  errorTitle: 'Der Kontrollpunkt konnte nicht geladen werden',
  question: 'Wählen Sie, wie die nächste Person identifiziert wird.',
  start: 'Starten',
  footer: 'Es werden nur aktive Mitarbeiter von {company} identifiziert · Jeder Versuch wird protokolliert',
  notIdentified: 'Mitarbeiter nicht identifiziert',
  failed: 'Identifizierung nicht möglich',
  invalidQr: 'Ungültiger QR-Code. Bitten Sie den Mitarbeiter, seinen Code in der App anzuzeigen',
  qrDisabled: {
    title: 'Identifizierung per QR-Code deaktiviert',
    text:
      'Dieses Prüfgerät verwendet den Modus „{mode}“, aber Ihr Unternehmen hat den QR-Code deaktiviert. Bitten Sie einen Administrator, ihn zu aktivieren oder den Modus zu ändern.',
  },
  face: {
    title: 'Gesicht erkennen',
    submitting: 'Wird identifiziert…',
    useQr: 'QR-Code verwenden',
  },
  qr: {
    title: 'QR-Code scannen',
    text: 'Richten Sie die Kamera auf den QR-Code auf dem Telefon des Mitarbeiters. Er wird automatisch gelesen und gilt nur einmal.',
    busy: 'QR-Code erkannt. Wird identifiziert…',
  },
  qrFace: {
    qrTitle: 'Schritt 1 von 2 · QR-Code',
    qrText: 'Scannen Sie den QR-Code auf dem Telefon des Mitarbeiters. Danach wird sein Gesicht bestätigt.',
    busy: 'QR-Code erkannt. Mitarbeiter wird gesucht…',
    faceTitle: 'Schritt 2 von 2 · {name}',
  },
  recent: {
    title: 'Letzte Identifizierungen',
    errorTitle: 'Die letzten Identifizierungen konnten nicht geladen werden',
    emptyTitle: 'Keine Identifizierungen',
    emptyDescription: 'Hier sehen Sie, wen dieses Gerät identifiziert.',
    nounOne: 'Identifizierung',
    nounOther: 'Identifizierungen',
    identified: 'Identifiziert',
    notIdentified: 'Nicht identifiziert',
  },
} satisfies Translation<typeof es>;
