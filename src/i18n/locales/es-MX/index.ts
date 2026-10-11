import accessReview from './accessReview';
import admin from './admin';
import apiKeys from './apiKeys';
import app from './app';
import audit from './audit';
import auth from './auth';
import avatar from './avatar';
import billing from './billing';
import checkpoint from './checkpoint';
import common from './common';
import companyHome from './companyHome';
import consents from './consents';
import continuity from './continuity';
import dataExport from './dataExport';
import devices from './devices';
import dialogs from './dialogs';
import docScan from './docScan';
import documents from './documents';
import drift from './drift';
import employee from './employee';
import employeeDocuments from './employeeDocuments';
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
import passkeys from './passkeys';
import performance from './performance';
import policy from './policy';
import profile from './profile';
import qr from './qr';
import services from './services';
import signingKeys from './signingKeys';
import sites from './sites';
import system from './system';
import systemErrors from './systemErrors';
import ui from './ui';
import usage from './usage';
import validators from './validators';
import verification from './verification';
import voice from './voice';

/**
 * Textos de la interfaz en español de México: el idioma por omisión y la fuente de las llaves
 * (`MessageKey`) y de sus variables. Un espacio por área; cada uno en su archivo (≤ 450 líneas: si
 * crece, se parte en subarchivos que su archivo importa). Las mismas llaves existen en `../en-US`.
 */
const esMX = {
  accessReview,
  admin,
  apiKeys,
  app,
  audit,
  auth,
  avatar,
  billing,
  checkpoint,
  common,
  companyHome,
  consents,
  continuity,
  dataExport,
  devices,
  dialogs,
  docScan,
  documents,
  drift,
  employee,
  employeeDocuments,
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
  passkeys,
  performance,
  policy,
  profile,
  qr,
  services,
  signingKeys,
  sites,
  system,
  systemErrors,
  ui,
  usage,
  validators,
  verification,
  voice,
} as const;

export default esMX;
