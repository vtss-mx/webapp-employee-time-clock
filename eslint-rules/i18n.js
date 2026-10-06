/**
 * Reglas propias de la traducción (regla 16 de la raíz: todo existe en es-MX y en-US).
 *
 * - `i18n/no-hardcoded-text`: prohíbe textos visibles escritos en el código. Todo texto sale de los
 *   diccionarios (`src/i18n/locales`) con `t('…')`, `useT()` o `<Trans>`. Revisa:
 *     · texto dentro de JSX (`<p>Hola</p>`, `{'Hola'}`, `{ok ? 'Sí' : 'No'}`, `{`${n} días`}`);
 *     · atributos y props visibles (`aria-label`, `title`, `placeholder`, `alt`, `label`, `hint`...):
 *       todo atributo salvo los que nunca se ven (clases, ids, rutas, tipos, `data-*`...);
 *     · propiedades de objetos con nombre de texto visible (`title`, `message`, `label`, `text`,
 *       `hint`, `placeholder`, `confirmLabel`...) y sus valores por omisión en parámetros;
 *     · el primer argumento de los popups rápidos (`feedback.success('…')`, `warning`, `info`, `error`);
 *     · lo que devuelve una función (`return 'El correo es obligatorio'`, `() => 'Sin turno'`) y las
 *       constantes con texto (`const EMPTY = 'Sin capturar'`), donde nacen las validaciones y avisos.
 *   Opción `allow`: nombres propios que no se traducen (marcas, navegadores, sistemas).
 *   No se marcan códigos (`MXN`, `TURN_LEFT`, `RFC`), identificadores en minúsculas (`primary`,
 *   `current-password`), unidades sueltas (`km`, `ms`) ni símbolos (`—`, `·`, `→`).
 * - `i18n/no-module-level-t`: `t('…')` solo dentro de funciones. Una constante del módulo se calcula
 *   una vez al cargar y se quedaría en ese idioma: un cambio de idioma en caliente no la traduciría.
 */

/** Atributos JSX que nunca se ven: su valor no se traduce. */
const HIDDEN_ATTRIBUTES = new Set([
  'accept', 'action', 'allow', 'align', 'as', 'autoCapitalize', 'autoComplete', 'autoCorrect', 'capture', 'className', 'clipPath',
  'clipRule', 'code', 'color', 'crossOrigin', 'cx', 'cy', 'd', 'decoding', 'describedBy', 'dir', 'enterKeyHint', 'field', 'fill',
  'fillRule', 'filter', 'focusable', 'form', 'gradientTransform', 'height', 'href', 'htmlFor', 'icon', 'id', 'inputMode', 'justify',
  'key', 'kind', 'labelledBy', 'lang', 'loading', 'mask', 'method', 'mode', 'name', 'offset', 'pattern', 'points', 'preserveAspectRatio',
  'r', 'referrerPolicy', 'rel', 'role', 'rx', 'ry', 'sandbox', 'scope', 'size', 'sizes', 'spellCheck', 'src', 'srcSet', 'stopColor',
  'stroke', 'strokeLinecap', 'strokeLinejoin', 'strokeWidth', 'style', 'target', 'testId', 'tone', 'to', 'transform', 'type',
  'variant', 'viewBox', 'width', 'wrap', 'x', 'x1', 'x2', 'xmlns', 'y', 'y1', 'y2',
]);

/** `aria-*` que sí se leen en voz alta (los demás son referencias o estados). */
const SPOKEN_ARIA = new Set(['aria-label', 'aria-description', 'aria-valuetext', 'aria-roledescription', 'aria-placeholder']);

/** Propiedades de objetos (y parámetros) cuyo valor se muestra a la persona. */
const TEXT_PROPERTIES = new Set([
  'ariaLabel', 'cancelLabel', 'caption', 'confirmLabel', 'description', 'detailsTitle', 'empty', 'emptyText', 'emptyTitle',
  'errorTitle', 'eyebrow', 'footnote', 'heading', 'helper', 'hint', 'instruction', 'label', 'legend', 'message', 'note',
  'placeholder', 'retryLabel', 'subtitle', 'summary', 'text', 'title', 'tooltip',
]);

/** Popups rápidos de `useFeedback()`: su primer argumento es el título. */
const FEEDBACK_SHORTCUTS = new Set(['success', 'warning', 'info', 'error']);

const LETTER = /\p{L}/u;
const CODE = /^[\p{Lu}\d_]+$/u;
const ACCENTED = /[À-ÖØ-öø-ɏ]/u;
const CAPITALIZED = /^\p{Lu}\p{Ll}/u;
const SPACE_BETWEEN_WORDS = /\p{L}\s+\S/u;
/** Una sola "palabra" con separadores de rutas, zonas, correos o llaves: 'America/Mexico_City', 'a.b'. */
const IDENTIFIER_LIKE = /^[^\s]*[/_.:@#=?&][^\s]*$/u;
/** Teclas y eventos del navegador que se comparan como texto ('ArrowLeft', 'Escape'). */
const KEY_NAMES = /^(Arrow(Up|Down|Left|Right)|Escape|Enter|Tab|Backspace|Delete|Home|End|PageUp|PageDown|Space|Shift|Control|Alt|Meta)$/;

/** Texto de una persona (no un código, un identificador, una unidad, una tecla ni un símbolo). */
function looksLikeText(raw, allowed) {
  const text = raw.trim();
  if (!LETTER.test(text) || CODE.test(text) || IDENTIFIER_LIKE.test(text) || KEY_NAMES.test(text) || allowed.has(text)) return false;
  return SPACE_BETWEEN_WORDS.test(text) || ACCENTED.test(text) || CAPITALIZED.test(text);
}

/** Dentro de JSX todo lo que tiene letras se ve (salvo un código en mayúsculas o un nombre propio permitido). */
function visibleInJsx(raw, allowed) {
  const text = raw.trim();
  return LETTER.test(text) && !CODE.test(text) && !allowed.has(text);
}

/** Textos literales de una expresión (también en las dos ramas de un `?:` o un `&&`/`??`). */
function literalTexts(node) {
  if (!node) return [];
  switch (node.type) {
    case 'Literal':
      return typeof node.value === 'string' ? [{ node, text: node.value }] : [];
    case 'TemplateLiteral':
      return [{ node, text: node.quasis.map((quasi) => quasi.value.cooked ?? '').join(' ') }];
    case 'ConditionalExpression':
      return [...literalTexts(node.consequent), ...literalTexts(node.alternate)];
    case 'LogicalExpression':
      return [...literalTexts(node.left), ...literalTexts(node.right)];
    case 'TSAsExpression':
    case 'TSSatisfiesExpression':
      return literalTexts(node.expression);
    default:
      return [];
  }
}

function attributeName(attribute) {
  return attribute.name.type === 'JSXNamespacedName' ? `${attribute.name.namespace.name}:${attribute.name.name.name}` : attribute.name.name;
}

function isHiddenAttribute(name) {
  if (name.startsWith('data-')) return true;
  if (name.startsWith('aria-')) return !SPOKEN_ARIA.has(name);
  return HIDDEN_ATTRIBUTES.has(name);
}

function propertyName(node) {
  if (node.computed) return null;
  if (node.key.type === 'Identifier') return node.key.name;
  return node.key.type === 'Literal' && typeof node.key.value === 'string' ? node.key.value : null;
}

const MESSAGE = 'Texto visible escrito en el código ("{{text}}"): va en los diccionarios es-MX y en-US y se muestra con t()/useT().';

const noHardcodedText = {
  meta: {
    type: 'problem',
    docs: { description: 'Prohíbe textos visibles escritos en el código: todo texto sale de los diccionarios (es-MX y en-US).' },
    messages: { hardcoded: MESSAGE },
    schema: [{ type: 'object', properties: { allow: { type: 'array', items: { type: 'string' } } }, additionalProperties: false }],
  },
  create(context) {
    const allowed = new Set(context.options[0]?.allow ?? []);
    const report = (node, text) => context.report({ node, messageId: 'hardcoded', data: { text: text.trim().slice(0, 60) } });
    const check = (expression, test) => literalTexts(expression).forEach(({ node, text }) => test(text, allowed) && report(node, text));
    return {
      JSXText(node) {
        if (visibleInJsx(node.value, allowed)) report(node, node.value);
      },
      JSXExpressionContainer(node) {
        if (node.parent.type === 'JSXElement' || node.parent.type === 'JSXFragment') check(node.expression, visibleInJsx);
      },
      JSXAttribute(node) {
        if (!node.value || isHiddenAttribute(attributeName(node))) return;
        check(node.value.type === 'JSXExpressionContainer' ? node.value.expression : node.value, looksLikeText);
      },
      Property(node) {
        const name = propertyName(node);
        if (!name || !TEXT_PROPERTIES.has(name)) return;
        const value = node.value.type === 'AssignmentPattern' ? node.value.right : node.value;
        check(value, looksLikeText);
      },
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type !== 'MemberExpression' || callee.property.type !== 'Identifier' || !FEEDBACK_SHORTCUTS.has(callee.property.name)) return;
        if (callee.object.type === 'Identifier' && callee.object.name === 'console') return;
        check(node.arguments[0], looksLikeText);
      },
      ReturnStatement(node) {
        check(node.argument, looksLikeText);
      },
      ArrowFunctionExpression(node) {
        if (node.body.type !== 'BlockStatement') check(node.body, looksLikeText);
      },
      VariableDeclarator(node) {
        check(node.init, looksLikeText);
      },
    };
  },
};

const FUNCTION_TYPES = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression', 'MethodDefinition', 'PropertyDefinition']);

const noModuleLevelT = {
  meta: {
    type: 'problem',
    docs: { description: 't() solo dentro de funciones: una constante del módulo no cambia de idioma en caliente.' },
    messages: {
      moduleLevel: 't() fuera de una función se calcula una sola vez y no sigue al idioma activo: muévelo a una función (p. ej. `const labels = () => ({ … })`).',
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.type !== 'Identifier' || node.callee.name !== 't') return;
        const inFunction = context.sourceCode.getAncestors(node).some((ancestor) => FUNCTION_TYPES.has(ancestor.type));
        if (!inFunction) context.report({ node, messageId: 'moduleLevel' });
      },
    };
  },
};

export default {
  meta: { name: 'i18n' },
  rules: { 'no-hardcoded-text': noHardcodedText, 'no-module-level-t': noModuleLevelT },
};
