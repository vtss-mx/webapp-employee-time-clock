import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/forms';

/** Textos de validaciones del cliente, cambios para confirmar y textos de hooks y utilidades en alemán (de-DE): las mismas llaves que es-MX. */
export default {
  validation: {
    minChars: 'Mindestens {min} Zeichen',
    maxChars: 'Höchstens {max} Zeichen',
    email: {
      required: 'Die E-Mail-Adresse ist erforderlich',
      invalid: 'Geben Sie eine gültige E-Mail-Adresse ein',
    },
    password: {
      required: 'Das Passwort ist erforderlich',
      lowercase: 'Muss einen Kleinbuchstaben enthalten',
      uppercase: 'Muss einen Großbuchstaben enthalten',
      digit: 'Muss eine Ziffer enthalten',
      repeat: 'Wiederholen Sie das Passwort',
      mismatch: 'Die Passwörter stimmen nicht überein',
    },
    name: {
      characters: 'Nur Buchstaben, Leerzeichen, Apostrophe, Punkte und Bindestriche',
    },
    birthDate: {
      required: 'Das Geburtsdatum ist erforderlich',
      invalid: 'Ungültiges Datum',
      notBeforeToday: 'Muss vor dem heutigen Tag liegen',
      minAge: 'Der Mitarbeiter muss mindestens {age} Jahre alt sein',
    },
    employeeNumber: {
      format: '1-30 Zeichen: Buchstaben, Ziffern, Bindestrich oder Unterstrich',
    },
    rfc: {
      generic: 'Der generische RFC ist nicht gültig; geben Sie den tatsächlichen RFC ein',
      length: 'Der RFC einer natürlichen Person hat {length} Zeichen; Sie haben {current} eingegeben',
      format: 'Prüfen Sie das Format des RFC (z. B. {example})',
      date: 'Das Datum im RFC (JJMMTT) ist nicht gültig',
      birthMismatch: 'Laut RFC ist das Geburtsdatum der {document}, angegeben ist jedoch der {birth}',
      companyLength: 'Der RFC muss 12 Zeichen (juristische Person) oder 13 Zeichen (natürliche Person) haben',
    },
    taxId: {
      length: 'Die Nummer ({name}) muss zwischen {min} und {max} Zeichen haben',
      lengthExact: 'Die Nummer ({name}) muss {length} Zeichen haben',
      format: 'Ungültiges Format für {name} (z. B. {example})',
    },
    curp: {
      length: 'Die CURP hat {length} Zeichen; Sie haben {current} eingegeben',
      format: 'Prüfen Sie das Format der CURP (z. B. {example})',
      date: 'Das Datum in der CURP (JJMMTT) ist nicht gültig',
      checkDigit: 'Die Prüfziffer der CURP stimmt nicht überein',
      birthMismatch: 'Laut CURP ist das Geburtsdatum der {document}, angegeben ist jedoch der {birth}',
      century: 'Das 17. Zeichen der CURP passt nicht zum Geburtsjahrhundert: Ziffer vor 2000, Buchstabe ab 2000',
    },
    nss: {
      length: 'Die NSS hat {length} Ziffern',
      checkDigit: 'Die Prüfziffer der NSS stimmt nicht überein',
    },
    maxEmployees: 'Geben Sie eine ganze Zahl größer als 0 ein',
  },
  phone: {
    required: 'Die Telefonnummer ist erforderlich',
    invalid: 'Die Telefonnummer ist für die Vorwahl +{code} nicht gültig',
    noCountries: 'Der Länderkatalog enthält keine aktiven Länder',
  },
  required: {
    firstName: 'Der Vorname ist erforderlich',
    lastName: 'Der Nachname ist erforderlich',
    tradeName: 'Der Handelsname ist erforderlich',
    legalName: 'Der Firmenname ist erforderlich',
  },
  changes: {
    newSecret: 'Neu',
    more: '{count} weitere',
  },
  ranges: {
    today: 'Heute',
    yesterday: 'Gestern',
    week: 'Diese Woche',
    lastWeek: 'Letzte Woche',
    month: 'Dieser Monat',
    lastMonth: 'Letzter Monat',
    last30: 'Letzte 30 Tage',
  },
  device: {
    unknown: 'Unbekanntes Gerät',
    browser: 'Browser',
    system: 'Unbekanntes System',
  },
} satisfies Translation<typeof es>;
