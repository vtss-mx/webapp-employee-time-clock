import type { Translation } from '../../../../types/i18n';
import type es from '../../es-MX/policy/tuning';

/** Ajustes de los candados de la política y su confirmación en alemán (de-DE): las mismas llaves que es-MX. */
export default {
  title: 'Einstellungen der Schutzmechanismen',
  hint: 'Strengere Einstellungen schützen besser, können aber häufiger eine neue Aufnahme verlangen.',
  confirmTitle: '„{label}“ auf {value} ändern?',
  relaxes: 'Dieser Wert schützt weniger vor Identitätstäuschung.',
  confirmLabel: 'Einstellung speichern',
  antiSpoofing: {
    label: 'Empfindlichkeit der Täuschungserkennung',
    description: 'Wie streng Fotos, Bildschirme und Videos erkannt werden.',
    saved: 'Täuschungserkennung: Stufe {level}',
  },
  steps: {
    label: 'Bewegungen der Lebenderkennung',
    description: 'Zufällige Kopfbewegungen (drehen, nach oben oder unten schauen, näher kommen).',
    one: 'Eine zufällige Bewegung (schneller, weniger sicher).',
    two: 'Zwei zufällige Bewegungen: Ein aufgezeichnetes Video müsste die Abfolge treffen.',
    three: 'Drei zufällige Bewegungen: am schwersten zu täuschen, auch für ein generiertes Video.',
    option_one: '{count} Bewegung',
    option_other: '{count} Bewegungen',
    saved: 'Lebenderkennung aktualisiert',
    savedText_one: 'Es wird {count} zufällige Kopfbewegung verlangt.',
    savedText_other: 'Es werden {count} zufällige Kopfbewegungen verlangt.',
  },
  timeout: {
    label: 'Zeit für die Lebenderkennung',
    description: 'Für die Bewegungen der Lebenderkennung; läuft sie ab, wird eine neue Aufgabe gestellt, ohne erneut zu scannen.',
    saved: 'Zeit der Lebenderkennung aktualisiert',
    savedText: 'Jede Aufgabe läuft nach {time} ab.',
  },
  flash: {
    label: 'Farbblitz',
    retired: 'Durch Produktentscheidung deaktiviert (2026-10-06): der Bildschirm blitzt nicht mehr in Farben. Die Bewegungen, die Serie und die Stimmprüfung decken die Lebenderkennung ab.',
  },
  quality: {
    label: 'Mindestqualität der Aufnahme',
    description:
      'Dunkle oder unscharfe Aufnahmen lassen sich schlecht vergleichen und erleichtern Täuschungen; je höher, desto mehr Wiederholungen bei schlechtem Licht.',
    none: 'Kein Minimum',
    basic: 'Einfach',
    medium: 'Mittel',
    high: 'Hoch',
    saved: 'Mindestqualität aktualisiert',
    savedText: 'Aufnahmen mit einer Qualität unter „{level}“ werden abgelehnt.',
    savedAny: 'Jede Aufnahme, die die Grundprüfungen besteht, wird akzeptiert.',
  },
  lockoutSaved: 'Sperre aktualisiert',
  lockoutFailures: {
    label: 'Versuche bis zur Sperre',
    description: 'Aufeinanderfolgende fehlgeschlagene oder verdächtige Versuche, nach denen die Gesichtsprüfung vorübergehend gesperrt wird.',
    option_one: '{count} Versuch',
    option_other: '{count} Versuche',
    savedText_one: 'Die Sperre greift nach {count} fehlgeschlagenen Versuch.',
    savedText_other: 'Die Sperre greift nach {count} aufeinanderfolgenden fehlgeschlagenen Versuchen.',
  },
  lockoutMinutes: {
    label: 'Dauer der Sperre',
    description: 'Wie lange die Person (oder das Prüfgerät) warten muss, bevor ein neuer Versuch möglich ist.',
    savedText: 'Die Sperre dauert {time}.',
  },
  qrLifetime: {
    label: 'Gültigkeit des QR-Codes',
    description: 'Jeder QR-Code des Mitarbeiters erneuert sich nach Ablauf dieser Zeit automatisch und gilt nur einmal. Je kürzer, desto sicherer.',
    saved: 'Gültigkeit des QR-Codes aktualisiert',
    savedText: 'Jeder QR-Code gilt {time} und nur einmal.',
  },
  accuracy: {
    label: 'Genauigkeit der Position',
    description: 'Größte Abweichung, die das Telefon melden darf; strengere Werte können verlangen, die genaue Standortbestimmung zu aktivieren.',
    option: 'Bis {distance}',
    saved: 'Genauigkeit aktualisiert',
    savedText: 'Bei einer Abweichung der Position über {distance} muss die Zeitbuchung wiederholt werden.',
  },
  speed: {
    label: 'Maximale plausible Geschwindigkeit',
    description: 'Zwischen zwei aufeinanderfolgenden Zeitbuchungen; was eine höhere Geschwindigkeit erfordert, wird als unmögliche Reise abgelehnt.',
    saved: 'Geschwindigkeit aktualisiert',
    savedText: 'Zeitbuchungen, die seit der vorherigen eine Geschwindigkeit über {speed} erfordern, werden abgelehnt.',
  },
} satisfies Translation<typeof es>;
