import type { TaxIdTypeItem } from '../types';

/**
 * Tipos de identificador fiscal de las pruebas: los mismos registros que `tax_id_types` del seed del backend
 * (`alembic/seed/catalogs.json`, migración 0074), con sus textos en español. `taxIdTypes.contract.test.ts` verifica que
 * sigan siendo iguales.
 */
/** [código, país, sigla, nombre, formato, regla, largo mínimo, largo máximo, ejemplo] */
const ROWS: Array<[string, string | null, string, string, string, string, number, number, string]> = [
  ['MX_RFC', 'MX', 'RFC', 'Registro Federal de Contribuyentes', '12 caracteres (persona moral) o 13 (persona física)', '^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{2}[0-9A]$', 12, 13, 'PNO120315AB1'],
  ['US_EIN', 'US', 'EIN', 'Número de identificación del empleador', '9 dígitos', '^[0-9]{9}$', 9, 9, '123456789'],
  ['CA_BN', 'CA', 'BN', 'Número de empresa', '9 dígitos, con o sin la cuenta de programa (p. ej. RT0001)', '^[0-9]{9}([A-Z]{2}[0-9]{4})?$', 9, 15, '123456789'],
  ['ES_NIF', 'ES', 'NIF', 'Número de identificación fiscal (antes CIF)', '9 caracteres: letras y dígitos', '^([0-9]{8}[A-Z]|[XYZ][0-9]{7}[A-Z]|[ABCDEFGHJNPQRSUVW][0-9]{7}[0-9A-J]|[KLM][0-9]{7}[A-Z])$', 9, 9, 'B12345678'],
  ['CO_NIT', 'CO', 'NIT', 'Número de identificación tributaria', 'De 7 a 16 dígitos, con el dígito de verificación al final', '^[0-9]{7,16}$', 7, 16, '8001972684'],
  ['AR_CUIT', 'AR', 'CUIT', 'Clave Única de Identificación Tributaria', '11 dígitos, con el dígito verificador al final', '^(20|23|24|25|26|27|30|33|34)[0-9]{9}$', 11, 11, '30500010912'],
  ['CL_RUT', 'CL', 'RUT', 'Rol Único Tributario', 'De 8 a 9 caracteres: el número y su dígito verificador (0 a 9 o K)', '^[0-9]{7,8}[0-9K]$', 8, 9, '60803000K'],
  ['PE_RUC', 'PE', 'RUC', 'Registro Único de Contribuyentes', '11 dígitos; empieza con 10, 15, 16, 17 o 20', '^(10|15|16|17|20)[0-9]{9}$', 11, 11, '20131312955'],
  ['BR_CNPJ', 'BR', 'CNPJ', 'Registro Nacional de Personas Jurídicas', '14 caracteres: 12 letras o dígitos y 2 dígitos verificadores', '^[0-9A-Z]{12}[0-9]{2}$', 14, 14, '11222333000181'],
  ['GB_VAT', 'GB', 'VAT', 'Número de registro del IVA', 'GB y 9 o 12 dígitos', '^GB([0-9]{9}|[0-9]{12})$', 11, 14, 'GB123456789'],
  ['GB_CRN', 'GB', 'CRN', 'Número de registro mercantil', '8 caracteres: 8 dígitos, o 2 letras y 6 dígitos', '^([0-9]{8}|[A-Z]{2}[0-9]{6})$', 8, 8, '01234567'],
  ['DE_VAT', 'DE', 'USt-IdNr.', 'Número de identificación a efectos del IVA', 'DE y 9 dígitos', '^DE[0-9]{9}$', 11, 11, 'DE123456789'],
  ['FR_SIREN', 'FR', 'SIREN', 'Número SIREN de la empresa', '9 dígitos', '^[0-9]{9}$', 9, 9, '732829320'],
  ['FR_SIRET', 'FR', 'SIRET', 'Número SIRET del establecimiento', '14 dígitos: el SIREN y 5 del establecimiento', '^[0-9]{14}$', 14, 14, '73282932000074'],
  ['OTHER', null, 'ID fiscal', 'Otro identificador fiscal', 'De 3 a 30 letras o dígitos', '^[0-9A-Z]{3,30}$', 3, 30, 'ABC123456'],
];

export const TAX_ID_TYPES: TaxIdTypeItem[] = ROWS.map(([code, country_code, short_name, name, description, pattern, min_length, max_length, example], index) => ({
  code,
  name,
  description,
  sort_order: index + 1,
  active: true,
  country_code,
  short_name,
  pattern,
  min_length,
  max_length,
  example,
}));
