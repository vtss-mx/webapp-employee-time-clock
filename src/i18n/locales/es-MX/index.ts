import admin from './admin';
import apiKeys from './apiKeys';
import app from './app';
import attendance from './attendance';
import auth from './auth';
import avatar from './avatar';
import billing from './billing';
import calendar from './calendar';
import checkpoint from './checkpoint';
import common from './common';
import companyHome from './companyHome';
import departments from './departments';
import devices from './devices';
import dialogs from './dialogs';
import documents from './documents';
import employee from './employee';
import employees from './employees';
import enrollments from './enrollments';
import errors from './errors';
import face from './face';
import faceSecurity from './faceSecurity';
import feedback from './feedback';
import format from './format';
import fraud from './fraud';
import forms from './forms';
import kiosk from './kiosk';
import language from './language';
import layout from './layout';
import location from './location';
import myAttendance from './myAttendance';
import performance from './performance';
import policy from './policy';
import profile from './profile';
import qr from './qr';
import services from './services';
import shifts from './shifts';
import sites from './sites';
import system from './system';
import systemErrors from './systemErrors';
import ui from './ui';
import usage from './usage';
import validators from './validators';
import verification from './verification';

/**
 * Textos de la interfaz en español de México: el idioma por omisión y la fuente de las llaves
 * (`MessageKey`) y de sus variables. Un espacio por área; cada uno en su archivo (≤ 450 líneas: si
 * crece, se parte en subarchivos que su archivo importa). Las mismas llaves existen en `../en-US`.
 */
const esMX = {
  admin,
  apiKeys,
  app,
  attendance,
  auth,
  avatar,
  billing,
  calendar,
  checkpoint,
  common,
  companyHome,
  departments,
  devices,
  dialogs,
  documents,
  employee,
  employees,
  enrollments,
  errors,
  face,
  faceSecurity,
  feedback,
  format,
  fraud,
  forms,
  kiosk,
  language,
  layout,
  location,
  myAttendance,
  performance,
  policy,
  profile,
  qr,
  services,
  shifts,
  sites,
  system,
  systemErrors,
  ui,
  usage,
  validators,
  verification,
} as const;

export default esMX;
