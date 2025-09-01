import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginReactConfig from "eslint-plugin-react/configs/recommended.js";
import nextPlugin from "@next/eslint-plugin-next";

export default [
  // Esta é a nossa nova configuração principal e unificada
  {
    files: ["**/*.{js,mjs,cjs,ts,jsx,tsx}"],
    plugins: {
      ...pluginReactConfig.plugins,
      '@next/next': nextPlugin,
    },
    languageOptions: {
      ...pluginReactConfig.languageOptions,
      globals: {
        ...globals.browser,
      },
    },
    // Adicionamos esta configuração para resolver o aviso da "versão do React"
    settings: {
        react: {
            version: "detect"
        }
    },
    rules: {
      // Começamos com as regras recomendadas...
      ...pluginReactConfig.rules,
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      
      // ...e agora desligamos TODAS as que estão nos dando problemas.
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react/no-unescaped-entities": "off",
    },
  },
  
  // Configuração separada para os arquivos do servidor (API)
  {
    files: ["src/app/api/**/*.{js,mjs,cjs,ts,jsx,tsx}"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  // Configurações base que precisam estar aqui
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
];

