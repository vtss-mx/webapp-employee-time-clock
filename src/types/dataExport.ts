/**
 * Exportación de los datos de una persona (derecho de acceso y de portabilidad, RGPD arts. 15 y 20, derechos ARCO,
 * CCPA; migración 0097 del backend): contrato de `GET /api/me/export` y `GET /api/employees/{id}/export`.
 *
 * Ningún texto explicativo viaja en `data`: lo que NO se entrega llega como un CÓDIGO estable (`WithheldReason`) y
 * la app lo escribe en el idioma de la persona (regla 16). El nombre de cada sección también es una llave estable.
 */

/** Quién pidió la exportación. */
export type DataExportScope = 'SELF' | 'COMPANY';

/**
 * Por qué una tabla con datos de la persona NO se entrega (art. 15.4 del RGPD y LFPDPPP). Un código que esta
 * versión no conozca se dibuja con un texto genérico, nunca se oculta.
 */
export type WithheldReason = 'BIOMETRIC' | 'SECURITY' | 'OTHER_PEOPLE' | 'TECHNICAL';

/** Una tabla que no se entrega, con su motivo en código. */
export interface WithheldItem {
  /** Nombre técnico (`esquema.tabla`): trazabilidad para un regulador. */
  source: string;
  reason: WithheldReason;
}

/** Una sección de la exportación: sus filas tal como están guardadas. */
export interface ExportSection {
  /** Llave estable (`account`, `verification_log`…): la app la nombra en cada idioma. */
  name: string;
  source: string;
  rows: Array<Record<string, unknown>>;
  /** La sección llegó al tope del servidor: hay más historia que la entregada. */
  truncated: boolean;
}

/** Con qué plazos se conserva lo que se exporta (RGPD art. 15.1.d: hay que decirlo). */
export interface RetentionNotice {
  biometrics_days: number;
  /** Días tras los que se borran la ubicación, la IP y el agente de cada verificación (conservando la fila). */
  attendance_metadata_days: number;
  verification_log_days: number;
  deleted_records_days: number;
}

/** Todo lo que la plataforma guarda de una persona en una empresa, con su alcance y sus plazos. */
export interface DataExport {
  generated_at: string;
  scope: DataExportScope;
  subject_email: string;
  subject_employee_id: number | null;
  company_id: number;
  company_name: string;
  previous_export_at: string | null;
  /** Cuándo podrá pedir la siguiente (el servidor limita una por titular cada tantas horas). */
  next_export_at: string;
  sections: ExportSection[];
  withheld: WithheldItem[];
  retention: RetentionNotice;
  row_count: number;
  truncated: boolean;
}
