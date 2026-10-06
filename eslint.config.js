import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import i18n from './eslint-rules/i18n.js';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules', 'public', 'scripts/**/*.mjs'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh, i18n },
    rules: {
      // Reglas clásicas de hooks. Las reglas del React Compiler (set-state-in-effect, refs,
      // immutability...) se omiten: el proyecto no usa el compilador y marcarían patrones válidos.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      // Solo afecta al hot-reload en desarrollo (contextos y helpers junto a componentes).
      'react-refresh/only-export-components': 'off',
      // Handlers async en atributos JSX (onClick={save}) son válidos en React.
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],
      // Código sin tipar: prohibido `any` explícito y operaciones inseguras sobre `any`.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-deprecated': 'error', // APIs obsoletas
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Nada en Web Storage (texto plano, síncrono, legible por cualquier script): BD, cookie HttpOnly,
      // IndexedDB (utils/deviceStore, utils/deviceKey), memoria o history.state. Ver utils/legacyStorage.
      'no-restricted-globals': [
        'error',
        { name: 'localStorage', message: 'Prohibido: usa la BD, deviceStore (IndexedDB), memoria o history.state.' },
        { name: 'sessionStorage', message: 'Prohibido: usa memoria o history.state (o deviceStore si es del dispositivo).' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'window', property: 'localStorage', message: 'Prohibido: usa la BD, deviceStore (IndexedDB), memoria o history.state.' },
        { object: 'window', property: 'sessionStorage', message: 'Prohibido: usa memoria o history.state (o deviceStore si es del dispositivo).' },
      ],
      complexity: ['warn', 20],
      'max-lines': ['warn', { max: 450, skipBlankLines: true, skipComments: true }],
      // Regla 16: todo texto visible sale de los diccionarios es-MX y en-US (eslint-rules/i18n.js).
      // `allow`: nombres propios que se escriben igual en todo idioma (navegadores, sistemas y marcas).
      'i18n/no-hardcoded-text': [
        'error',
        // 'IP Geolocation by DB-IP': la atribución que exige la licencia CC BY 4.0 de la base local de IP (decisión D8).
        { allow: ['Android', 'Chrome', 'Chromium', 'Edge', 'Firefox', 'Google', 'Google Maps', 'iPad', 'iPhone', 'IP Geolocation by DB-IP', 'Linux', 'macOS', 'Opera', 'Safari', 'Samsung Internet', 'Windows'] },
      ],
      'i18n/no-module-level-t': 'error',
    },
  },
  {
    // Sin textos de la interfaz: pruebas (verifican los textos), utilidades de prueba y los
    // diccionarios mismos.
    files: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/**/testData.ts', 'src/i18n/locales/**'],
    rules: { 'i18n/no-hardcoded-text': 'off' },
  },
  {
    // Único lugar con Web Storage: borra lo que dejaron versiones anteriores. Las pruebas lo verifican
    // (y su preparación lo limpia entre pruebas).
    files: ['src/utils/legacyStorage.ts', 'src/**/*.test.{ts,tsx}', 'src/test/**'],
    rules: { 'no-restricted-globals': 'off', 'no-restricted-properties': 'off' },
  },
  {
    files: ['src/**/*.test.{ts,tsx}', 'src/test/**'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/unbound-method': 'off',
    },
  },
);
