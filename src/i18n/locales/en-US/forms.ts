import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/forms';

/** Textos de validaciones del cliente, cambios para confirmar y textos de hooks y utilidades en inglés (en-US): las mismas llaves que es-MX. */
export default {
  validation: {
    minChars: 'Minimum {min} characters',
    maxChars: 'Maximum {max} characters',
    email: {
      required: 'Email is required',
      invalid: 'Enter a valid email',
    },
    password: {
      required: 'Password is required',
      lowercase: 'Must include a lowercase letter',
      uppercase: 'Must include an uppercase letter',
      digit: 'Must include a number',
      repeat: 'Re-enter the password',
      mismatch: 'Passwords do not match',
    },
    name: {
      characters: 'Only letters, spaces, apostrophes, periods, and hyphens',
    },
    birthDate: {
      required: 'Date of birth is required',
      invalid: 'Invalid date',
      notBeforeToday: 'Must be before today',
      minAge: 'The employee must be at least {age} years old',
    },
    employeeNumber: {
      format: '1-30 characters: letters, numbers, hyphens, or underscores',
    },
    rfc: {
      generic: "The generic RFC isn't valid; enter the real one",
      length: 'An individual RFC has {length} characters; you entered {current}',
      format: 'Check the RFC format (e.g., {example})',
      date: 'The RFC date (yymmdd) is not valid',
      birthMismatch: 'The RFC indicates a birth date of {document}, but the date of birth is {birth}',
      companyLength: 'The RFC must have 12 characters (legal entity) or 13 (individual)',
    },
    taxId: {
      length: 'The {name} must have {min} to {max} characters',
      lengthExact: 'The {name} must have {length} characters',
      format: "The {name} format isn't valid (e.g., {example})",
    },
    curp: {
      length: 'The CURP has {length} characters; you entered {current}',
      format: 'Check the CURP format (e.g., {example})',
      date: 'The CURP date (yymmdd) is not valid',
      checkDigit: "The CURP check digit doesn't match",
      birthMismatch: 'The CURP indicates a birth date of {document}, but the date of birth is {birth}',
      century: "The CURP's 17th character doesn't match the birth century: a number before 2000, a letter from 2000 on",
    },
    nss: {
      length: 'The NSS has {length} digits',
      checkDigit: "The NSS check digit doesn't match",
    },
    maxEmployees: 'Enter a whole number greater than 0',
  },
  phone: {
    required: 'Phone number is required',
    invalid: 'The phone number is not valid for country code +{code}',
    noCountries: 'The country catalog has no active countries',
  },
  required: {
    firstName: 'First name is required',
    lastName: 'Last name is required',
    tradeName: 'Trade name is required',
    legalName: 'Legal name is required',
  },
  changes: {
    newSecret: 'New',
    more: '{count} more',
  },
  ranges: {
    today: 'Today',
    yesterday: 'Yesterday',
    week: 'This week',
    lastWeek: 'Last week',
    month: 'This month',
    lastMonth: 'Last month',
    last30: 'Last 30 days',
  },
  device: {
    unknown: 'Unknown device',
    browser: 'Browser',
    system: 'Unknown system',
  },
} satisfies Translation<typeof es>;
