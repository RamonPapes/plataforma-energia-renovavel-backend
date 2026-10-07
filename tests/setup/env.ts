// Variáveis de ambiente dos testes. As credenciais do MySQL vêm do .env (ou do ambiente, no CI);
// o banco é sempre o de teste: o nome do .env com o sufixo _test.
try {
    process.loadEnvFile(".env");
} catch {
    // sem .env (ex.: CI), as variáveis já estão no ambiente
}

const bancoBase = process.env.DB_NAME ?? "plataforma-energia-renovavel";
process.env.DB_NAME = bancoBase.endsWith("_test") ? bancoBase : `${bancoBase}_test`;

process.env.JWT_SECRET = "segredo-dos-testes";
process.env.JWT_EXPIRES_IN = "1h";
process.env.ADMIN_NOME = "Admin Teste";
process.env.ADMIN_EMAIL = "admin@teste.local";
process.env.ADMIN_SENHA = "admin123";
