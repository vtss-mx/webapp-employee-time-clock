import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/location';

/** Textos de domicilios, mapas, búsqueda de lugares y ubicación en inglés (en-US): las mismas llaves que es-MX. */
export default {
  eyebrow: 'Location',
  problems: {
    unsupported: {
      title: 'Location not available',
      text: "This browser can't access the location. Use an up-to-date Safari or Chrome.",
    },
    insecure: {
      title: 'Connection not secure',
      text: 'Location can only be read over a secure connection (https). Open the app using its secure address.',
    },
    denied: {
      title: 'Allow access to your location',
      text: 'Location permission is blocked in this browser.',
    },
    unavailable: {
      title: "Couldn't get your location",
      text: 'Turn on location (GPS) and try again, preferably near a window.',
    },
    timeout: {
      title: 'Getting your location took too long',
      text: 'Turn on precise location on the device and try again.',
    },
  },
  permissionSteps: {
    iphone: 'iPhone: Settings › Privacy & Security › Location Services › Safari (or your browser) › “While Using the App.”',
    android: 'Android: tap the lock next to the address › Permissions › Location › Allow.',
  },
  deniedFor: {
    login: {
      text: 'This validator can only sign in at its operating location, and location permission is blocked.',
      next: 'Return to the app and sign in again.',
    },
    map: {
      text: 'Locating you on the map requires location permission, and it is blocked in this browser.',
      next: 'Tap “My location” again (or mark the point on the map).',
    },
    checkpoint: {
      text: 'This validator sends its location with each identification, and permission is blocked in this browser.',
      next: 'Open the checkpoint again.',
    },
    verification: {
      text: 'This verification needs your location, and permission is blocked in this browser.',
      next: 'Come back here and tap “Retry.”',
    },
  },
  server: {
    outOfRange: "You're outside the allowed area",
    inaccurate: "Your location isn't accurate",
    required: 'Your location is required',
    approach: 'Move closer to the access point where this validator operates.',
    gps: 'Turn on precise location (GPS) on the device.',
    signInAgain: 'Sign in again.',
  },
  address: {
    country: {
      label: 'Country',
      hint: 'Country where the address is located.',
      placeholder: 'Choose the country',
      search: 'Search country',
      empty: 'No country matches',
    },
    state: { label: 'State or province', hint: 'State, province, or region.' },
    municipality: { label: 'Municipality or borough', hint: 'Administrative division the address belongs to.' },
    city: { label: 'City or town', hint: 'City, town, or village; its name may differ from the municipality.' },
    neighborhood: { label: 'Neighborhood', hint: 'Area or district within the city or town.' },
    postalCode: { label: 'Postal code', hint: 'Code for the postal area.' },
    street: { label: 'Street', hint: 'Name of the street, avenue, highway, and so on.' },
    exteriorNumber: { label: 'Street number', hint: 'Number that identifies the building; it may include letters.' },
    interiorNumber: { label: 'Unit number', hint: 'Apartment, office, or suite within the building. Optional.' },
    referenceNotes: {
      label: 'Reference notes',
      hint: 'Additional directions to find it, such as cross streets or nearby landmarks. Optional.',
      placeholder: 'Between Oak Street and Pine Avenue, across from the park',
    },
    interior: 'Unit {number}',
    required: {
      country: 'Choose the country',
      state: 'Enter the state or province',
      municipality: 'Enter the municipality or borough',
      city: 'Enter the city or town',
      neighborhood: 'Enter the neighborhood',
      postalCode: 'Enter the postal code',
      street: 'Enter the street',
      exteriorNumber: 'Enter the street number (or N/A)',
    },
    postalCodeMx: 'A Mexican postal code has 5 digits',
    postalCodeInvalid: 'The postal code is not valid',
    minLength: 'Enter at least {min} characters',
    maxLength: 'Maximum {max} characters',
  },
  picker: {
    notices: {
      geocoding: "Couldn't fill in the address from the map. Type it in; the point is still marked.",
      geolocation: "Couldn't get your location. Mark the point on the map.",
      places: "Place search isn't available. Type the address and mark the point on the map.",
      maps: "The map isn't available. Type the address manually.",
      offline: "Google Maps didn't respond. Check your connection and try again.",
      notFound: 'Address not found. Check it or mark the point on the map.',
    },
    locateError: "Couldn't locate the point",
    notConfigured: "The map isn't configured: the address is entered manually and a location can't be required.",
    myLocation: 'My location',
    point: 'Point: {point}',
    tapToMark: {
      access: 'Tap the map to mark the access point',
      site: "Tap the map to mark the site's point",
    },
    findingAddress: 'finding the address…',
    locateWritten: 'Locate the typed address',
    removePoint: 'Remove point',
  },
  map: {
    label: 'Map: tap to mark the point',
    pin: 'Marked point',
    loading: 'Loading the map…',
    failed: "The map isn't available. Type the address manually.",
  },
  search: {
    label: 'Search for a place or an address',
    clear: 'Clear search',
    results: 'Places found',
    credit: 'Results from Google',
    creditNearest: 'Nearest first · Results from Google',
    failed: {
      title: "Couldn't search",
      hint: 'Check your connection or mark the point on the map.',
    },
    unavailable: {
      title: 'No results',
      hint: 'Type the address and mark the point on the map.',
    },
    none: {
      title: 'No results',
      hint: 'Try another address or mark the point on the map.',
    },
  },
} satisfies Translation<typeof es>;
