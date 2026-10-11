import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/sites';

/** Textos de los puntos de verificación en inglés (en-US): las mismas llaves que es-MX. */
export default {
  list: {
    title: 'Verification sites',
    loadError: "Couldn't load the sites",
    subtitle_one: '{count} site · where identity is verified and within what radius',
    subtitle_other: '{count} sites · where identity is verified and within what radius',
    new: 'New site',
    searchPlaceholder: 'Search by name',
    searchLabel: 'Search sites',
    noun: { one: 'site', other: 'sites' },
    columns: {
      site: 'Site',
      address: 'Address',
      radius: 'Radius',
      code: 'Code',
    },
    kiosksOf_one: '{count} kiosk at {name}',
    kiosksOf_other: '{count} kiosks at {name}',
    noMatch: {
      title: 'No results',
      description: 'Try another search or filter.',
    },
    empty: {
      title: 'No verification sites',
      description: 'Create a site to limit where identity is verified.',
    },
  },
  form: {
    loadError: "Couldn't load the site",
    newTitle: 'New site',
    editTitle: 'Edit site',
    newSubtitle: 'A place where identity is verified: plant, branch, office…',
    create: 'Create site',
    createError: "Couldn't create the site",
    saveError: "Couldn't save the site",
    rule: 'Verification radius: {distance}.',
    created: {
      title: 'Site created',
      text: '{name} can now be used when verifying. {rule}',
    },
    updated: {
      title: 'Site updated',
      text: '{name} · {rule}',
    },
    sections: {
      site: 'Site',
      location: 'Location',
    },
    name: 'Site name',
    nameExample: 'Hermosillo Plant',
    nameHint: 'Unique in your company: e.g., “Hermosillo Plant”',
    radius: 'Verification radius (meters)',
    radiusHint: 'Between {min} and {max} m: the size of the place plus the GPS margin.',
    suggestedRadii: 'Suggested radii',
    onSiteNote: 'On site, identity is verified with the face and phone location, within this radius.',
    locationIntro: 'Search for the place or tap the map. The circle shows the verification radius.',
    pointRequired: "Mark the site's point on the map",
  },
  fields: {
    address: 'Address',
    references: 'Reference notes',
    point: 'Point on the map',
    radius: 'Verification radius',
  },
  confirm: {
    createTitle: 'Create site {name}?',
    createMessage: 'It can be used to limit where identity is verified.',
    willCreate: 'Will be created',
    editTitle: 'Save changes to site {name}?',
  },
  status: {
    title: 'Site status',
    activeMeaning: 'It accepts identity verifications at this place.',
    inactiveMeaning: "It doesn't accept identity verifications at this place.",
    deactivateWarning: "It won't accept verifications here until you activate it. Existing records don't change.",
    removeWarning: 'It can only be deleted if nobody has been verified there. If there are verifications, deactivate it.',
    activateQuestion: 'Activate site {name}?',
    deactivateQuestion: 'Deactivate site {name}?',
    removeQuestion: 'Delete site {name}?',
    activated: 'Site activated',
    deactivated: 'Site deactivated',
    removed: 'Site deleted',
    inUse: 'The site is in use: deactivate it',
  },
  recordStatus: {
    activateError: "Couldn't activate {name}",
    deactivateError: "Couldn't deactivate {name}",
    removeError: "Couldn't delete {name}",
  },
  validation: {
    nameRequired: 'Enter the site name, e.g., “{example}”',
    nameMax: 'At most {max} characters',
  },
  trash: {
    restoreTitle: 'Restore site {name}?',
    banner: 'Site deleted',
  },
  presence: {
    label: 'Site code',
    hint: 'Asks for the code shown by the site kiosk when verifying.',
    on: 'Code required',
    off: 'No code',
  },
} satisfies Translation<typeof es>;
