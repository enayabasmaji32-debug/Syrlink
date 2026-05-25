import js from '@eslint/js';
export default [
  js.configs.recommended,
  {
    files: ['**/*.jsx', '**/*.js'],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true
        }
      }
    },
    rules: {}
  }
];
