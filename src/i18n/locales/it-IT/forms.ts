import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/forms';

/** Textos de validaciones del cliente, cambios para confirmar y textos de hooks y utilidades en italiano (it-IT): las mismas llaves que es-MX. */
export default {
  validation: {
    minChars: 'Minimo {min} caratteri',
    maxChars: 'Massimo {max} caratteri',
    email: {
      required: "L'e-mail è obbligatoria",
      invalid: "Inserisci un'e-mail valida",
    },
    password: {
      required: 'La password è obbligatoria',
      lowercase: 'Deve includere una lettera minuscola',
      uppercase: 'Deve includere una lettera maiuscola',
      digit: 'Deve includere un numero',
      repeat: 'Ripeti la password',
      mismatch: 'Le password non coincidono',
    },
    name: {
      characters: 'Solo lettere, spazi, apostrofi, punti e trattini',
    },
    birthDate: {
      required: 'La data di nascita è obbligatoria',
      invalid: 'Data non valida',
      notBeforeToday: 'Deve essere precedente a oggi',
      minAge: 'Il dipendente deve avere almeno {age} anni',
    },
    employeeNumber: {
      format: '1-30 caratteri: lettere, numeri, trattino o trattino basso',
    },
    rfc: {
      generic: "L'RFC generico non è valido; inserisci l'RFC reale",
      length: "L'RFC di una persona fisica ha {length} caratteri; ne hai inseriti {current}",
      format: "Controlla il formato del codice RFC (ad es. {example})",
      date: 'La data del codice RFC (aammgg) non è valida',
      birthMismatch: "L'RFC indica la nascita il {document}, ma la data di nascita è {birth}",
      companyLength: "L'RFC deve avere 12 caratteri (persona giuridica) o 13 (persona fisica)",
    },
    taxId: {
      length: 'Il numero di {name} deve avere da {min} a {max} caratteri',
      lengthExact: 'Il numero di {name} deve avere {length} caratteri',
      format: 'Formato di {name} non valido (ad es. {example})',
    },
    curp: {
      length: 'La CURP ha {length} caratteri; ne hai inseriti {current}',
      format: 'Controlla il formato della CURP (ad es. {example})',
      date: 'La data della CURP (aammgg) non è valida',
      checkDigit: 'La cifra di controllo della CURP non corrisponde',
      birthMismatch: 'La CURP indica la nascita il {document}, ma la data di nascita è {birth}',
      century: 'Il 17º carattere della CURP non corrisponde al secolo di nascita: un numero prima del 2000, una lettera dal 2000',
    },
    nss: {
      length: "L'NSS ha {length} cifre",
      checkDigit: 'La cifra di controllo del numero NSS non corrisponde',
    },
    maxEmployees: 'Inserisci un numero intero maggiore di 0',
  },
  phone: {
    required: 'Il telefono è obbligatorio',
    invalid: 'Il telefono non è valido per il prefisso +{code}',
    noCountries: 'Il catalogo dei paesi non ha paesi attivi',
  },
  required: {
    firstName: 'Il nome è obbligatorio',
    lastName: 'Il cognome è obbligatorio',
    tradeName: 'Il nome commerciale è obbligatorio',
    legalName: 'La ragione sociale è obbligatoria',
  },
  changes: {
    newSecret: 'Nuova',
    more: 'altri {count}',
  },
  ranges: {
    today: 'Oggi',
    yesterday: 'Ieri',
    week: 'Questa settimana',
    lastWeek: 'Settimana scorsa',
    month: 'Questo mese',
    lastMonth: 'Mese scorso',
    last30: 'Ultimi 30 giorni',
  },
  device: {
    unknown: 'Dispositivo sconosciuto',
    browser: 'Browser',
    system: 'Sistema sconosciuto',
  },
} satisfies Translation<typeof es>;
