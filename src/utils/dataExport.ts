/**
 * Reglas puras de la exportación de los datos de una persona (RGPD arts. 15 y 20, derechos ARCO, CCPA): el nombre
 * del archivo, lo que se entregó y lo RETENIDO con su motivo. Sin React ni peticiones.
 *
 * El servidor no envía ningún texto explicativo dentro de `data`: cada sección y cada motivo llegan como CÓDIGO y
 * se nombran aquí en el idioma de la persona (regla 16). Un código que esta versión no conoce se dibuja con su
 * código y un texto genérico: lo retenido JAMÁS se oculta (lo exige el art. 15.4).
 */
import { t } from '../i18n';
import type { DataExport, ExportSection, WithheldItem, WithheldReason } from '../types/dataExport';
import { formatDateTime } from './format';

/** Motivos que esta versión sabe nombrar; cualquier otro usa el texto genérico con su código. */
const KNOWN_REASONS: readonly WithheldReason[] = ['BIOMETRIC', 'SECURITY', 'OTHER_PEOPLE', 'TECHNICAL'];

const isKnownReason = (reason: string): reason is WithheldReason => (KNOWN_REASONS as readonly string[]).includes(reason);

/** Secciones que esta versión sabe nombrar (las llaves estables del servidor). */
const KNOWN_SECTIONS = [
  'account',
  'sessions',
  'passkeys',
  'profile_photo',
  'remembered_devices',
  'password_changes',
  'employment',
  'consents',
  'devices',
  'identity_documents',
  'qr_credentials',
  'employment_status_history',
  'verification_log',
  'biometric_templates',
  'face_enrollment',
  'validator',
  'validator_devices',
  'validator_status_history',
] as const;

type KnownSection = (typeof KNOWN_SECTIONS)[number];

/** `profile_photo` → `profilePhoto`: la llave del diccionario de una sección (las del servidor son estables). */
type CamelCase<S extends string> = S extends `${infer Head}_${infer Tail}` ? `${Head}${Capitalize<CamelCase<Tail>>}` : S;

const isKnownSection = (name: string): name is KnownSection => (KNOWN_SECTIONS as readonly string[]).includes(name);

/** La llave estable del servidor (`profile_photo`) como llave del diccionario (`profilePhoto`). */
const dictionaryKey = (name: KnownSection) => name.replace(/_(.)/g, (_, letter: string) => letter.toUpperCase()) as CamelCase<KnownSection>;

/** El nombre de una sección en el idioma de la persona; una que esta versión no conoce, su llave tal cual. */
export function sectionName(section: ExportSection): string {
  return isKnownSection(section.name) ? t(`dataExport.sections.${dictionaryKey(section.name)}`) : section.name;
}

/** El motivo por el que algo no se entrega, con su texto; uno desconocido, el genérico con su código. */
export function withheldReasonText(item: WithheldItem): string {
  return isKnownReason(item.reason) ? t(`dataExport.withheld.${item.reason}`) : t('dataExport.withheld.other', { code: item.reason });
}

/** Nombre del archivo: el correo del titular, sin lo que no sirve en un nombre de archivo, y la fecha. */
export function exportFileName(data: DataExport): string {
  const who = data.subject_email.replace(/[^a-zA-Z0-9.@_-]/g, '-');
  return `datos-${who}-${data.generated_at.slice(0, 10)}.json`;
}

/** Cuántas filas se entregaron y si alguna sección quedó cortada (se DICE: nunca se calla). */
export function deliveredText(data: DataExport): string {
  const rows = t('dataExport.rows', { count: data.row_count });
  const sections = t('dataExport.sectionsCount', { count: data.sections.length });
  return `${rows} · ${sections}`;
}

/** Las secciones que quedaron cortadas por el tope del servidor (hay más historia que la entregada). */
export function truncatedSections(data: DataExport): string[] {
  return data.sections.filter((section) => section.truncated).map(sectionName);
}

/** Los plazos de retención como líneas legibles: lo exige el art. 15.1.d (hay que decirlos, no solo entregar). */
export function retentionRows(data: DataExport): Array<{ key: string; label: string; value: string }> {
  const days = (count: number) => t('dataExport.days', { count });
  const { retention } = data;
  return [
    { key: 'biometrics', label: t('dataExport.retention.biometrics'), value: days(retention.biometrics_days) },
    { key: 'verificationMetadata', label: t('dataExport.retention.verificationMetadata'), value: days(retention.attendance_metadata_days) },
    { key: 'verificationLog', label: t('dataExport.retention.verificationLog'), value: days(retention.verification_log_days) },
    { key: 'deletedRecords', label: t('dataExport.retention.deletedRecords'), value: days(retention.deleted_records_days) },
  ];
}

/** Cuándo podrá pedirla de nuevo (el servidor limita una por titular cada tantas horas). */
export function nextExportText(data: DataExport): string {
  return t('dataExport.nextAt', { date: formatDateTime(data.next_export_at) });
}

/** Cuántas filas tiene cada sección, en una línea (lo que la persona ve antes de abrir el archivo). */
export function sectionSummary(section: ExportSection): string {
  const rows = t('dataExport.rows', { count: section.rows.length });
  return section.truncated ? `${rows} · ${t('dataExport.truncatedSection')}` : rows;
}

/** El JSON que se descarga, con sangría: tiene que ser legible por una persona y por una máquina. */
export function exportJson(data: DataExport): string {
  return JSON.stringify(data, null, 2);
}
