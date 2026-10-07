/** @type {import('jest').Config} */
module.exports = {
    testEnvironment: "node",
    roots: ["<rootDir>/tests"],
    testMatch: ["**/*.test.ts"],
    // variáveis de teste (banco *_test) e criação/migração do banco antes da suíte
    setupFiles: ["<rootDir>/tests/setup/env.ts"],
    globalSetup: "<rootDir>/tests/setup/globalSetup.ts",
    // os testes de integração compartilham o mesmo banco: um arquivo por vez
    maxWorkers: 1,
    testTimeout: 30000,
    // ts-jest não suporta TypeScript 7, por isso os .ts são transpilados com o SWC
    transform: {
        "^.+\\.ts$": ["@swc/jest", {
            jsc: {
                parser: { syntax: "typescript", decorators: true },
                transform: { legacyDecorator: true, decoratorMetadata: true, useDefineForClassFields: false },
                target: "es2022",
            },
            module: { type: "commonjs" },
        }],
    },
    collectCoverageFrom: [
        "src/**/*.ts",
        "!src/server.ts",
        "!src/database/migrations/**",
        "!src/@types/**",
    ],
    // RNF05: cobertura mínima de 80%
    coverageThreshold: {
        global: { branches: 80, functions: 80, lines: 80, statements: 80 },
    },
};
