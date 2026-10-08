import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/qr';

/** Textos de QR dinámico del empleado y lector de QR en alemán (de-DE): las mismas llaves que es-MX. */
export default {
  dynamic: {
    used: {
      title: 'Code verwendet',
      text: 'Ein neuer wird erstellt…',
    },
    replaced: {
      title: 'Code ersetzt',
      text: 'Auf einem anderen Gerät wurde ein neuer erstellt oder Ihr Unternehmen hat ihn entwertet.',
      action: 'Neuen Code anzeigen',
    },
    paused: {
      title: 'Pausiert',
      text: 'Er ist abgelaufen, während Sie ihn nicht angesehen haben.',
      action: 'Code anzeigen',
    },
    error: 'Ihr Code konnte nicht erstellt werden',
    imageError: 'Ihr QR-Code konnte nicht angezeigt werden',
    enlarge: 'QR-Code vergrößern',
    renewsIn: 'Erneuert sich in {seconds}',
    seconds: '{value} s',
  },
  scan: {
    aim: 'Richten Sie die Kamera auf den QR-Code',
    busy: 'QR-Code erkannt. Wird verifiziert…',
    invalid: 'Ungültiger QR-Code. Verwenden Sie den für Ihr Konto erstellten Code',
    noPersonalData: 'Der Code enthält keine personenbezogenen Daten.',
  },
  panel: {
    title: 'Dynamischer QR-Code',
    errorTitle: 'Die Aktivität des QR-Codes konnte nicht geladen werden',
    live: 'Auf dem Bildschirm',
    none: 'Kein gültiger Code',
    intro:
      'Der Mitarbeiter erstellt ihn auf seinem Telefon (Mein QR-Code). Er ändert sich alle {seconds} s und gilt nur einmal: Er kann weder heruntergeladen noch gedruckt werden.',
    liveUntil: 'Gültig bis',
    lastIssued: 'Zuletzt erstellt',
    lastUsed: 'Zuletzt verwendet',
    never: 'Nie',
    revoke: {
      action: 'Aktuellen Code entwerten',
      eyebrow: 'QR-Code',
      title: 'Aktuellen Code entwerten?',
      message: 'Der Code auf dem Bildschirm des Mitarbeiters funktioniert sofort nicht mehr. Er kann auf seinem Telefon einen neuen anzeigen.',
      confirm: 'Entwerten',
      error: 'Der Code konnte nicht entwertet werden',
      done: 'Code entwertet',
      doneText: 'Der Mitarbeiter kann auf seinem Telefon einen neuen anzeigen.',
    },
  },
  phoneGuide: {
    open: 'Nehmen Sie den Tabletcomputer oder das Telefon zur Hand.',
    openHow: 'Verwenden Sie den Browser (Safari, Chrome…) oder die Kamera.',
    scanOrType: '{scan} oder geben Sie diese Adresse ein:',
    scanCode: 'Scannen Sie den Code',
    copyAddress: 'Adresse kopieren',
    enterAddress: '{address}, die Ihnen Ihr Unternehmen gegeben hat.',
    accessAddress: 'Öffnen Sie die Zugangsadresse',
    signIn: '{action} mit derselben E-Mail-Adresse und demselben Passwort.',
    signInAction: 'Anmelden',
    scan: 'Scannen Sie ihn mit dem Tabletcomputer oder dem Telefon',
    qrAlt: 'QR-Code zum Öffnen der App. Scannen Sie ihn mit dem Tabletcomputer oder dem Telefon',
    desktopSite: 'Sie sind bereits auf einem Tabletcomputer oder Telefon? Deaktivieren Sie {option} im Menü des Browsers und versuchen Sie es erneut.',
    desktopSiteOption: '„Desktop-Website“',
  },
} satisfies Translation<typeof es>;
