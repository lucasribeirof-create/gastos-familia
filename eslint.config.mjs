import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginReactConfig from "eslint-plugin-react/configs/recommended.js";
import nextPlugin from "@next/eslint-plugin-next";

export default [
  // Configuração global para todos os arquivos
  {
    files: ["**/*.{js,mjs,cjs,ts,jsx,tsx}"],
    plugins: {
      react: pluginReactConfig.plugins.react,
      next: nextPlugin,
    },
    languageOptions: {
      ...pluginReactConfig.languageOptions,
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      // Regras que desligamos porque não são mais necessárias ou são muito rígidas para nós agora
      "react/react-in-jsx-scope": "off", // Desliga a regra antiga do React
      "react/prop-types": "off", // Desliga a validação de propriedades por enquanto
      "react/no-unescaped-entities": "off", // Desliga a regra das aspas
    },
  },

  // Configuração específica para os arquivos de API (servidor)
  {
    files: ["src/app/api/**/*.{js,mjs,cjs,ts,jsx,tsx}"],
    languageOptions: {
      globals: {
        ...globals.node, // Diz ao inspetor que estes arquivos rodam no servidor (Node.js)
      },
    },
  },

  // Configurações padrão que o Next.js recomenda
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
];

