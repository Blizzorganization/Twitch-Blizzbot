import globals from "globals";
import pluginJs from "@eslint/js";
import jsdoc from "eslint-plugin-jsdoc";
import tseslint from "typescript-eslint";
import prettier from "eslint-plugin-prettier/recommended";

export default [
    { languageOptions: { globals: globals.node } },
    pluginJs.configs.recommended,
    jsdoc.configs["flat/recommended"],
    prettier,
    ...tseslint.configs.recommended,
];
