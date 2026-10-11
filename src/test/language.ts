/**
 * Guardián del idioma (regla 16 de la raíz: «nunca se mezclan idiomas»): revisa textos con cspell, con los MISMOS
 * diccionarios y listas de palabras de `npm run spell` (`cspell.json`), en modo estricto, para los siete idiomas:
 *
 * - Cada idioma solo contra SU diccionario base (es-MX y es-ES el de español; en-US el de inglés de Estados Unidos;
 *   pt-BR, fr-FR, de-DE e it-IT el suyo) + la lista común de nombres propios y siglas (`cspell-words.txt`) + su lista
 *   propia revisada (`cspell-words.<idioma>.txt`). Sin los diccionarios de programación que cspell carga por omisión
 *   (`softwareTerms`, `companies`, `aws`...): con ellos «Save», «Retry» o «Front» pasaban como español.
 * - Una palabra que el idioma no conoce **falla**. Si además la conoce el diccionario de OTRO de los idiomas se señala
 *   como «del otro idioma» (`foreign`: lo más probable es que se coló sin traducir); si ninguno la conoce, como
 *   «desconocida» (`unknown`: una errata o una palabra que falta en la lista propia). Las dos fallan igual.
 * - Las listas propias no esconden palabras de otro idioma: `foreignWordsInList` revisa que ninguna palabra de
 *   `cspell-words.<idioma>.txt` sea una palabra del inglés (la fuente de los préstamos: «spoofing», «token», «app»)
 *   y que la lista del inglés no tenga palabras de los demás idiomas. Con siete idiomas no se exige más que eso: una
 *   palabra legítima del portugués que el español también tiene («validador») no es una mezcla.
 * - La ÚNICA excepción entre idiomas es la marca «Employee Time Clock» (decisión del dueño del producto), además de
 *   los nombres propios y siglas de la lista común. Correos, direcciones web, `{variables}`, códigos con dígitos y
 *   los datos de prueba que escribe una persona (`data`) no son palabras de un idioma y no se revisan.
 *
 * Lo usan las pruebas de los diccionarios, de lo que dibuja cada pantalla en cada idioma y del cambio en caliente.
 */
import { spellCheckDocument, type CSpellUserSettings } from 'cspell-lib';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Locale } from '../i18n/core';

/** La marca: igual en todos los idiomas (la única excepción entre idiomas, decisión del dueño del producto). */
export const BRAND = 'Employee Time Clock';

const ROOT = process.cwd();
/** El diccionario base de cada idioma (el nombre con que lo declara su paquete de cspell). */
const BASE: Record<Locale, string> = { 'es-MX': 'es-es', 'en-US': 'en_us', 'pt-BR': 'pt-br', 'fr-FR': 'fr-fr', 'de-DE': 'de-de', 'it-IT': 'it-it', 'es-ES': 'es-es' };
/** El código de idioma que cspell usa para las reglas de cada diccionario (acentos, mayúsculas). */
const CSPELL_LANGUAGE: Record<Locale, string> = { 'es-MX': 'es', 'en-US': 'en-US', 'pt-BR': 'pt', 'fr-FR': 'fr', 'de-DE': 'de', 'it-IT': 'it', 'es-ES': 'es' };
const ownList = (locale: Locale) => `project-words-${locale}`;
/** La fuente de los préstamos: lo que no se admite en la lista propia de ningún otro idioma. */
const LOAN_SOURCE: Locale = 'en-US';

const DEFINITIONS: CSpellUserSettings['dictionaryDefinitions'] = [
  { name: 'es-es', path: resolve(ROOT, 'node_modules/@cspell/dict-es-es/Spanish.trie.gz') },
  { name: 'en_us', path: resolve(ROOT, 'node_modules/@cspell/dict-en_us/en_US.trie.gz'), repMap: [["'|`|’", "'"]] },
  { name: 'pt-br', path: resolve(ROOT, 'node_modules/@cspell/dict-pt-br/pt_BR.trie.gz') },
  { name: 'fr-fr', path: resolve(ROOT, 'node_modules/@cspell/dict-fr-fr/fr-fr.trie.gz'), repMap: [["'|`|’", "'"]] },
  { name: 'de-de', path: resolve(ROOT, 'node_modules/@cspell/dict-de-de/de_DE.trie.gz') },
  { name: 'it-it', path: resolve(ROOT, 'node_modules/@cspell/dict-it-it/dict/it-it.trie'), repMap: [["'|`|’", "'"]] },
  { name: 'project-words', path: resolve(ROOT, 'cspell-words.txt') },
  ...(Object.keys(BASE) as Locale[]).map((locale) => ({ name: ownList(locale), path: resolve(ROOT, `cspell-words.${locale}.txt`) })),
];

/** Ajustes de cspell con SOLO estos diccionarios (los mismos criterios de `cspell.json`: mayúsculas y acentos). */
function settings(language: string, dictionaries: string[]): CSpellUserSettings {
  // Sin topes de cspell (por omisión repite una palabra solo 5 veces): cada aparición cuenta.
  return {
    language,
    caseSensitive: true,
    minWordLength: 3,
    loadDefaultConfiguration: false,
    dictionaryDefinitions: DEFINITIONS,
    dictionaries,
    maxDuplicateProblems: 1_000_000,
    maxNumberOfProblems: 1_000_000,
  };
}

/** Lo que no es una palabra de un idioma se borra con espacios del mismo largo (las posiciones no cambian). */
const NEUTRAL: RegExp[] = [
  /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, // correos
  /\bhttps?:\/\/\S+/g, // direcciones web
  /\{\w+\}/g, // variables de un texto
  /\b(?:GET|POST|PUT|PATCH|DELETE)\b(?=\s+\/)/g, // un método HTTP antes de su ruta
  /\bX-[A-Za-z]+(?:-[A-Za-z]+)*\b/g, // el nombre de una cabecera HTTP: X-API-Key
  /(?<![\p{L}\p{N}])\/[\w/{}.-]+/gu, // rutas de la API o de la app: /employees/{id}
  /\b\S*\d\S*\b/g, // códigos y cifras: EMP-7, 2026-10-05, v1.2
];

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Un dato como palabra o frase completa (no dentro de otra palabra: «mar» no toca «marca»). */
const wholeValue = (value: string) => new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(value)}(?![\\p{L}\\p{N}])`, 'gu');

/** Primero la marca, luego los datos (del más largo al más corto: «Operaciones Acme» antes que «Acme») y al final lo que no es lenguaje. */
function neutralize(text: string, data: readonly RegExp[]): string {
  let result = text;
  for (const brand of [BRAND, 'Identity Verification Platform', 'VT Software Solutions']) result = result.replaceAll(brand, ' '.repeat(brand.length));
  for (const value of data) result = result.replace(value, (match) => ' '.repeat(match.length));
  for (const pattern of NEUTRAL) result = result.replace(pattern, (match) => ' '.repeat(match.length));
  return result;
}

export interface LanguageIssue {
  /** El texto donde apareció (como se ve). */
  text: string;
  word: string;
  /** `unknown`: ningún idioma la conoce; `foreign`: no es del idioma pero sí de otro de la app. */
  kind: 'unknown' | 'foreign';
}

/** Palabras con problema de un documento (los textos unidos, uno por renglón), con el texto de cada una. */
async function issuesIn(document: string, ownerOf: (offset: number) => string, language: string, dictionaries: string[]) {
  const result = await spellCheckDocument({ uri: 'file:///language.txt', text: document, languageId: 'plaintext' }, { noConfigSearch: true, generateSuggestions: false }, settings(language, dictionaries));
  if (result.errors?.length) throw result.errors[0];
  return result.issues.map((issue) => ({ word: issue.text, offset: issue.offset, text: ownerOf(issue.offset) }));
}

/** Los diccionarios base de los demás idiomas (sin repetir el propio: es-MX y es-ES comparten el de español). */
const otherBases = (locale: Locale) => [...new Set(Object.values(BASE))].filter((base) => base !== BASE[locale]);

/** Las palabras (únicas) que al menos uno de los diccionarios `bases` conoce. */
async function knownBy(words: readonly string[], language: string, bases: string[]): Promise<Set<string>> {
  if (!words.length) return new Set();
  const unknown = new Set((await issuesIn(words.join('\n'), () => '', language, bases)).map((issue) => issue.word));
  return new Set(words.filter((word) => !unknown.has(word)));
}

/**
 * Las palabras de `texts` que no son del idioma `locale`. `data`: valores que escribió una persona en los datos de
 * prueba (nombres, notas) y que por eso no se revisan.
 */
export async function languageIssues(texts: Iterable<string>, locale: Locale, data: readonly string[] = []): Promise<LanguageIssue[]> {
  const unique = [...new Set([...texts].map((text) => text.trim()).filter(Boolean))];
  if (!unique.length) return [];
  const values = [...new Set(data)].filter((value) => value.trim()).sort((a, b) => b.length - a.length).map(wholeValue);
  const starts: number[] = [];
  let offset = 0;
  const lines = unique.map((text) => {
    starts.push(offset);
    const line = neutralize(text, values);
    offset += line.length + 1;
    return line;
  });
  const document = lines.join('\n');
  const ownerOf = (position: number) => {
    let index = starts.length - 1;
    while (starts[index] > position) index--;
    return unique[index];
  };
  const language = CSPELL_LANGUAGE[locale];
  const unknown = await issuesIn(document, ownerOf, language, [BASE[locale], 'project-words', ownList(locale)]);
  // Solo sobre las desconocidas (pocas o ninguna): ¿alguna la conoce otro idioma de la app?
  const foreign = await knownBy([...new Set(unknown.map((issue) => issue.word))], language, otherBases(locale));
  return unknown.map((issue) => ({ text: issue.text, word: issue.word, kind: foreign.has(issue.word) ? ('foreign' as const) : ('unknown' as const) }));
}

/** Las palabras de una lista de cspell (sin comentarios ni renglones vacíos). */
export function wordList(locale: Locale): string[] {
  return readFileSync(resolve(ROOT, `cspell-words.${locale}.txt`), 'utf-8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

/**
 * Las palabras de la lista propia de `locale` que son de otro idioma y no deberían estar ahí: las que conoce el
 * inglés (de donde vienen los préstamos) o, para la lista del inglés, las que conoce cualquiera de los demás idiomas.
 */
export async function foreignWordsInList(locale: Locale): Promise<string[]> {
  const words = wordList(locale);
  const bases = locale === LOAN_SOURCE ? otherBases(locale) : [BASE[LOAN_SOURCE]];
  const known = await knownBy(words, CSPELL_LANGUAGE[locale], bases);
  return words.filter((word) => known.has(word));
}

/** Resumen legible de los problemas (para el mensaje de la prueba). */
export function describeIssues(issues: readonly LanguageIssue[]): string[] {
  return issues.map((issue) => `${issue.kind === 'foreign' ? 'del otro idioma' : 'desconocida'}: «${issue.word}» en «${issue.text}»`);
}
