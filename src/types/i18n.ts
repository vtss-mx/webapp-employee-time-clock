/**
 * Tipos de la traducción de la interfaz (`src/i18n`). Las llaves y sus variables salen del
 * diccionario es-MX (el idioma por omisión): una llave que no existe, una variable que falta o un
 * diccionario en-US al que le falta una llave son errores de compilación.
 */
import type esMX from '../i18n/locales/es-MX';

/** Idiomas de la aplicación: español de México (por omisión) e inglés de Estados Unidos. */
export type Locale = 'es-MX' | 'en-US';

/** Forma de los textos: la del diccionario es-MX (fuente de las llaves y de sus variables). */
export type Messages = typeof esMX;

/** El diccionario de otro idioma: las mismas llaves, con sus propios textos. */
export type Translation<T> = { readonly [K in keyof T]: T[K] extends string ? string : Translation<T[K]> };

/** Formas del plural de `Intl.PluralRules` (es y en usan `one` y `other`; `zero` es opcional). */
export type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

type Join<P extends string, K extends string> = P extends '' ? K : `${P}.${K}`;
type Leaves<T, P extends string = ''> = { [K in keyof T & string]: T[K] extends string ? Join<P, K> : Leaves<T[K], Join<P, K>> }[keyof T & string];
type LeafKey = Leaves<Messages>;
/** "días" con `dias_one` y `dias_other`: la llave sin la forma se usa con `count`. */
type PluralKey = LeafKey extends infer K ? (K extends `${infer Base}_${PluralCategory}` ? Base : never) : never;

/** Toda llave de texto: "espacio.grupo.llave" (o la base de un plural). */
export type MessageKey = LeafKey | PluralKey;

type At<T, K extends string> = K extends `${infer Head}.${infer Rest}` ? (Head extends keyof T ? At<T[Head], Rest> : never) : K extends keyof T ? T[K] : never;
type Template<K extends MessageKey> = K extends LeafKey ? At<Messages, K> : At<Messages, `${K}_${PluralCategory}`>;
type Placeholders<S> = S extends `${string}{${infer Name}}${infer Rest}` ? Name | Placeholders<Rest> : never;

/** Variables de un texto (`{nombre}`); un plural además pide `count`. */
export type ParamName<K extends MessageKey> = Placeholders<Template<K>> | (K extends PluralKey ? 'count' : never);
export type Params<K extends MessageKey> = { [P in ParamName<K>]: P extends 'count' ? number : string | number };
/** Sin variables no se pasa nada; con variables, todas son obligatorias. */
export type ParamsArg<K extends MessageKey> = [ParamName<K>] extends [never] ? [] : [params: Params<K>];

/** Traduce una llave con sus variables en el idioma activo. */
export type Translate = <K extends MessageKey>(key: K, ...params: ParamsArg<K>) => string;
