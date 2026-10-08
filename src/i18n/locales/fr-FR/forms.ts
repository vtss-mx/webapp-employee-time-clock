import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/forms';

/** Textos de validaciones del cliente, cambios para confirmar y textos de hooks y utilidades en francés (fr-FR): las mismas llaves que es-MX. */
export default {
  validation: {
    minChars: '{min} caractères minimum',
    maxChars: '{max} caractères maximum',
    email: {
      required: "L'e-mail est obligatoire",
      invalid: 'Saisissez un e-mail valide',
    },
    password: {
      required: 'Le mot de passe est obligatoire',
      lowercase: 'Doit contenir une minuscule',
      uppercase: 'Doit contenir une majuscule',
      digit: 'Doit contenir un chiffre',
      repeat: 'Saisissez de nouveau le mot de passe',
      mismatch: 'Les mots de passe ne correspondent pas',
    },
    name: {
      characters: 'Lettres, espaces, apostrophes, points et tirets uniquement',
    },
    birthDate: {
      required: 'La date de naissance est obligatoire',
      invalid: 'Date non valide',
      notBeforeToday: "Doit être antérieure à aujourd'hui",
      minAge: "L'employé doit avoir au moins {age} ans",
    },
    employeeNumber: {
      format: '1 à 30 caractères: lettres, chiffres, tiret ou tiret bas',
    },
    rfc: {
      generic: "Le RFC générique n'est pas valide; saisissez le RFC réel",
      length: "Le RFC d'une personne physique comporte {length} caractères; vous en avez saisi {current}",
      format: 'Vérifiez le format du RFC (p. ex. {example})',
      date: "La date du RFC (année, mois et jour) n'est pas valide",
      birthMismatch: 'Le RFC indique une naissance le {document}, mais la date de naissance est le {birth}',
      companyLength: 'Le RFC doit comporter 12 caractères (personne morale) ou 13 (personne physique)',
    },
    taxId: {
      length: 'Le numéro {name} doit comporter de {min} à {max} caractères',
      lengthExact: 'Le numéro {name} doit comporter {length} caractères',
      format: 'Format de {name} non valide (p. ex. {example})',
    },
    curp: {
      length: 'La CURP comporte {length} caractères; vous en avez saisi {current}',
      format: 'Vérifiez le format de la CURP (p. ex. {example})',
      date: "La date de la CURP (année, mois et jour) n'est pas valide",
      checkDigit: 'Le chiffre de contrôle de la CURP ne correspond pas',
      birthMismatch: 'La CURP indique une naissance le {document}, mais la date de naissance est le {birth}',
      century: 'Le 17e caractère de la CURP ne correspond pas au siècle de naissance: un chiffre avant 2000, une lettre à partir de 2000',
    },
    nss: {
      length: 'Le NSS comporte {length} chiffres',
      checkDigit: 'Le chiffre de contrôle du NSS ne correspond pas',
    },
    maxEmployees: 'Saisissez un nombre entier supérieur à 0',
  },
  phone: {
    required: 'Le téléphone est obligatoire',
    invalid: "Le téléphone n'est pas valide pour l'indicatif +{code}",
    noCountries: "Le catalogue des pays n'a aucun pays actif",
  },
  required: {
    firstName: 'Le prénom est obligatoire',
    lastName: 'Le nom est obligatoire',
    tradeName: 'Le nom commercial est obligatoire',
    legalName: 'La raison sociale est obligatoire',
  },
  changes: {
    newSecret: 'Nouveau',
    more: '{count} de plus',
  },
  ranges: {
    today: "Aujourd'hui",
    yesterday: 'Hier',
    week: 'Cette semaine',
    lastWeek: 'Semaine dernière',
    month: 'Ce mois-ci',
    lastMonth: 'Mois dernier',
    last30: '30 derniers jours',
  },
  device: {
    unknown: 'Appareil inconnu',
    browser: 'Navigateur',
    system: 'Système inconnu',
  },
} satisfies Translation<typeof es>;
