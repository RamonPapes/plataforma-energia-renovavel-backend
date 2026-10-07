import { FAIXAS_VULNERABILIDADE } from "../domain/faixasVulnerabilidade";

// RNF06: documentação da API no formato OpenAPI 3.0, exibida pelo Swagger UI em /api/docs.
// Escrita em TypeScript (e não em YAML) para ser compilada junto com o código e chegar ao dist/ e à imagem Docker.
// Ao criar ou alterar uma rota em routes.ts, atualize também este arquivo.

const ref = (nome: string) => ({ $ref: `#/components/schemas/${nome}` });
const resposta = (nome: string) => ({ $ref: `#/components/responses/${nome}` });
const parametro = (nome: string) => ({ $ref: `#/components/parameters/${nome}` });

const json = (schema: object, example?: unknown) => ({
    content: { "application/json": { schema, ...(example === undefined ? {} : { example }) } },
});

const corpo = (schema: object, example?: unknown) => ({ required: true, ...json(schema, example) });

const ok = (description: string, schema: object) => ({ description, ...json(schema) });

const geojson = (description: string) => ({
    description,
    content: { "application/geo+json": { schema: ref("FeatureCollection") } },
});

// lista paginada no formato { data, total, page, limit }
const paginado = (item: string) => ({
    type: "object",
    properties: {
        data: { type: "array", items: ref(item) },
        total: { type: "integer", description: "Total de registros com os filtros aplicados", example: 417 },
        page: { type: "integer", example: 1 },
        limit: { type: "integer", example: 50 },
    },
});

const perfis = (...lista: string[]) => `\n\n**Perfis:** ${lista.join(", ")}.`;
const QUALQUER_PERFIL = perfis("qualquer usuário autenticado");
const SOMENTE_ADMIN = perfis("ADMINISTRADOR");
const ADMIN_E_PESQUISADOR = perfis("ADMINISTRADOR", "PESQUISADOR");

export const openapi = {
    openapi: "3.0.3",
    info: {
        title: "Plataforma Energia Renovável - API",
        version: "1.0.0",
        description:
            "API para mensurar a vulnerabilidade social energética de municípios com o método multicritério **TOPSIS**.\n\n" +
            "**Como autenticar:** faça `POST /login`, copie o `token` da resposta, clique em **Authorize** e cole o token. " +
            "As demais rotas exigem o header `Authorization: Bearer <token>`.\n\n" +
            "**Erros:** todas as respostas de erro têm o formato `{ \"error\": \"mensagem\" }`.\n\n" +
            "**Datas:** devolvidas em UTC (ISO 8601). Converta para o horário local na exibição.\n\n" +
            "**Interpretação do ranking:** Ci (coeficiente de proximidade) vai de 0 a 1. " +
            "Quanto **maior** o Ci, **menos** vulnerável o município.",
    },
    servers: [{ url: "/api", description: "Servidor atual" }],
    tags: [
        { name: "Autenticação", description: "Login e recuperação de senha (rotas públicas)" },
        { name: "Usuários", description: "RF08: gestão de usuários e perfis de acesso" },
        { name: "Municípios", description: "UC01 / RF01: cadastro de municípios" },
        { name: "Critérios", description: "UC02 / RF02 e RF03: critérios (indicadores) e pesos do TOPSIS" },
        { name: "Matriz de decisão", description: "Valores dos indicadores por município e ano" },
        { name: "TOPSIS e simulações", description: "UC03 / RF04 e RF10: execução do TOPSIS e histórico" },
        { name: "Relatórios", description: "UC04 / RF06: exportação em PDF e CSV" },
        { name: "Dashboard e mapa", description: "RF05 e RF07: indicadores do dashboard e GeoJSON para o mapa" },
    ],
    security: [{ bearerAuth: [] }],
    paths: {
        // ---------------------------------------------------------------- Autenticação
        "/login": {
            post: {
                tags: ["Autenticação"],
                summary: "Login",
                description: "Devolve o token JWT usado nas demais rotas. O e-mail não diferencia maiúsculas de minúsculas.",
                security: [],
                requestBody: corpo(
                    { type: "object", required: ["email", "senha"], properties: { email: { type: "string", format: "email" }, senha: { type: "string" } } },
                    { email: "admin@exemplo.com", senha: "minhasenha" }
                ),
                responses: {
                    200: ok("Login realizado", {
                        type: "object",
                        properties: { token: { type: "string" }, usuario: ref("UsuarioResumo") },
                    }),
                    400: resposta("ErroValidacao"),
                    401: { description: "E-mail ou senha inválidos", ...json(ref("Erro")) },
                },
            },
        },
        "/esqueci-senha": {
            post: {
                tags: ["Autenticação"],
                summary: "Solicitar código para redefinir a senha",
                description:
                    "Gera um código de uso único, válido por 30 minutos. Um novo pedido invalida o código anterior.\n\n" +
                    "⚠️ **Atenção:** a verificação por e-mail é uma implementação futura. Por enquanto o código é devolvido " +
                    "na própria resposta, então qualquer pessoa que saiba um e-mail cadastrado consegue redefinir a senha dessa conta.",
                security: [],
                requestBody: corpo({ type: "object", required: ["email"], properties: { email: { type: "string", format: "email" } } }),
                responses: {
                    200: ok("Código gerado", {
                        type: "object",
                        properties: {
                            mensagem: { type: "string" },
                            token: { type: "string", description: "Código de redefinição (no futuro será enviado por e-mail)" },
                            expiraEm: { type: "string", format: "date-time" },
                        },
                    }),
                    400: resposta("ErroValidacao"),
                    404: { description: "E-mail não cadastrado", ...json(ref("Erro")) },
                },
            },
        },
        "/redefinir-senha": {
            post: {
                tags: ["Autenticação"],
                summary: "Redefinir a senha com o código",
                security: [],
                requestBody: corpo({
                    type: "object",
                    required: ["token", "novaSenha"],
                    properties: { token: { type: "string" }, novaSenha: ref("Senha") },
                }),
                responses: {
                    204: { description: "Senha redefinida" },
                    400: { description: "Dados inválidos ou código inválido, já usado ou expirado", ...json(ref("Erro")) },
                },
            },
        },

        // ---------------------------------------------------------------- Usuários
        "/usuarios/me": {
            get: {
                tags: ["Usuários"],
                summary: "Dados do usuário logado",
                description: QUALQUER_PERFIL,
                responses: { 200: ok("Usuário logado", ref("Usuario")), 401: resposta("NaoAutenticado"), 404: resposta("NaoEncontrado") },
            },
        },
        "/usuarios/me/senha": {
            patch: {
                tags: ["Usuários"],
                summary: "Trocar a própria senha",
                description: "Exige a senha atual. Senha atual incorreta retorna 400 (e não 401, para o front não deslogar o usuário)." + QUALQUER_PERFIL,
                requestBody: corpo({
                    type: "object",
                    required: ["senhaAtual", "novaSenha"],
                    properties: { senhaAtual: { type: "string" }, novaSenha: ref("Senha") },
                }),
                responses: { 204: { description: "Senha alterada" }, 400: resposta("ErroValidacao"), 401: resposta("NaoAutenticado") },
            },
        },
        "/usuarios": {
            get: {
                tags: ["Usuários"],
                summary: "Listar usuários",
                description: "Ordenados por nome." + SOMENTE_ADMIN,
                parameters: [
                    { name: "perfil", in: "query", schema: ref("Perfil") },
                    parametro("page"),
                    parametro("limit"),
                ],
                responses: {
                    200: ok("Lista paginada", paginado("Usuario")),
                    400: resposta("ErroValidacao"),
                    401: resposta("NaoAutenticado"),
                    403: resposta("SemPermissao"),
                },
            },
            post: {
                tags: ["Usuários"],
                summary: "Cadastrar usuário",
                description: "O e-mail é gravado em minúsculas. Sem `perfil`, o usuário é criado como PESQUISADOR." + SOMENTE_ADMIN,
                requestBody: corpo(ref("UsuarioInput"), { nome: "Maria Souza", email: "maria@exemplo.com", senha: "senha123", perfil: "PESQUISADOR" }),
                responses: {
                    201: ok("Usuário criado", ref("Usuario")),
                    400: resposta("ErroValidacao"),
                    401: resposta("NaoAutenticado"),
                    403: resposta("SemPermissao"),
                    409: { description: "E-mail já cadastrado", ...json(ref("Erro")) },
                },
            },
        },
        "/usuarios/{id}": {
            parameters: [parametro("id")],
            get: {
                tags: ["Usuários"],
                summary: "Buscar usuário",
                description: SOMENTE_ADMIN,
                responses: { 200: ok("Usuário", ref("Usuario")), 401: resposta("NaoAutenticado"), 403: resposta("SemPermissao"), 404: resposta("NaoEncontrado") },
            },
            put: {
                tags: ["Usuários"],
                summary: "Editar usuário",
                description:
                    "Substitui nome, e-mail e perfil (a senha não é alterada aqui). " +
                    "O administrador não pode rebaixar o próprio perfil, e o sistema não pode ficar sem nenhum ADMINISTRADOR." + SOMENTE_ADMIN,
                requestBody: corpo({
                    type: "object",
                    required: ["nome", "email", "perfil"],
                    properties: { nome: { type: "string", maxLength: 150 }, email: { type: "string", format: "email", maxLength: 150 }, perfil: ref("Perfil") },
                }),
                responses: {
                    200: ok("Usuário atualizado", ref("Usuario")),
                    400: resposta("ErroValidacao"),
                    401: resposta("NaoAutenticado"),
                    403: { description: "Sem permissão ou tentativa de rebaixar o próprio perfil", ...json(ref("Erro")) },
                    404: resposta("NaoEncontrado"),
                    409: { description: "E-mail em uso ou o sistema ficaria sem administrador", ...json(ref("Erro")) },
                },
            },
            delete: {
                tags: ["Usuários"],
                summary: "Remover usuário",
                description: "O administrador não pode remover a própria conta." + SOMENTE_ADMIN,
                responses: {
                    204: { description: "Usuário removido" },
                    401: resposta("NaoAutenticado"),
                    403: { description: "Sem permissão ou tentativa de remover a própria conta", ...json(ref("Erro")) },
                    404: resposta("NaoEncontrado"),
                    409: { description: "Usuário com simulações ou último administrador do sistema", ...json(ref("Erro")) },
                },
            },
        },

        // ---------------------------------------------------------------- Municípios
        "/municipios": {
            get: {
                tags: ["Municípios"],
                summary: "Listar municípios",
                description: "Ordenados por nome. Aceita `limit` de até 500, para buscar todos de uma vez na seleção do TOPSIS." + QUALQUER_PERFIL,
                parameters: [
                    { name: "uf", in: "query", schema: { type: "string", example: "BA" } },
                    parametro("page"),
                    { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 500, default: 50 } },
                ],
                responses: { 200: ok("Lista paginada", paginado("Municipio")), 400: resposta("ErroValidacao"), 401: resposta("NaoAutenticado") },
            },
            post: {
                tags: ["Municípios"],
                summary: "Cadastrar município",
                description: "Nome e UF formam uma chave única. A UF é gravada em maiúsculas." + SOMENTE_ADMIN,
                requestBody: corpo(ref("MunicipioInput"), { nome: "Salvador", uf: "BA", populacao: 2417678, idh: 0.759, latitude: -12.9714, longitude: -38.5014 }),
                responses: {
                    201: ok("Município criado", ref("Municipio")),
                    400: resposta("ErroValidacao"),
                    401: resposta("NaoAutenticado"),
                    403: resposta("SemPermissao"),
                    409: { description: "Município já cadastrado para a UF", ...json(ref("Erro")) },
                },
            },
        },
        "/municipios/geojson": {
            get: {
                tags: ["Dashboard e mapa"],
                summary: "Mapa base: municípios em GeoJSON",
                description: "Municípios sem latitude/longitude ficam em `metadados.semCoordenadas`." + QUALQUER_PERFIL,
                responses: { 200: geojson("FeatureCollection com população e IDH em properties"), 401: resposta("NaoAutenticado") },
            },
        },
        "/municipios/{id}": {
            parameters: [parametro("id")],
            get: {
                tags: ["Municípios"],
                summary: "Buscar município",
                description: QUALQUER_PERFIL,
                responses: { 200: ok("Município", ref("Municipio")), 400: resposta("ErroValidacao"), 401: resposta("NaoAutenticado"), 404: resposta("NaoEncontrado") },
            },
            put: {
                tags: ["Municípios"],
                summary: "Editar município",
                description: "Substitui o registro inteiro: campo omitido vira `null`." + SOMENTE_ADMIN,
                requestBody: corpo(ref("MunicipioInput")),
                responses: {
                    200: ok("Município atualizado", ref("Municipio")),
                    400: resposta("ErroValidacao"),
                    401: resposta("NaoAutenticado"),
                    403: resposta("SemPermissao"),
                    404: resposta("NaoEncontrado"),
                    409: { description: "Já existe outro município com o mesmo nome e UF", ...json(ref("Erro")) },
                },
            },
            delete: {
                tags: ["Municípios"],
                summary: "Remover município",
                description: "Bloqueado se o município tiver valores na matriz de decisão ou aparecer em alguma simulação." + SOMENTE_ADMIN,
                responses: {
                    204: { description: "Município removido" },
                    401: resposta("NaoAutenticado"),
                    403: resposta("SemPermissao"),
                    404: resposta("NaoEncontrado"),
                    409: { description: "Município com dados vinculados", ...json(ref("Erro")) },
                },
            },
        },
        "/municipios/{id}/indicadores": {
            get: {
                tags: ["Matriz de decisão"],
                summary: "Valores dos indicadores de um município",
                description: "Ordenados do ano mais recente para o mais antigo." + QUALQUER_PERFIL,
                parameters: [parametro("id"), parametro("ano")],
                responses: {
                    200: ok("Valores", {
                        type: "array",
                        items: {
                            type: "object",
                            properties: { ano: { type: "integer" }, criterio: ref("CriterioResumo"), valor: { type: "number" } },
                        },
                    }),
                    401: resposta("NaoAutenticado"),
                    404: resposta("NaoEncontrado"),
                },
            },
        },

        // ---------------------------------------------------------------- Critérios
        "/criterios": {
            get: {
                tags: ["Critérios"],
                summary: "Listar critérios",
                description: "Ordenados por id (C1, C2, ...)." + QUALQUER_PERFIL,
                parameters: [{ name: "tipo", in: "query", schema: ref("TipoCriterio") }, parametro("page"), parametro("limit")],
                responses: { 200: ok("Lista paginada", paginado("Criterio")), 400: resposta("ErroValidacao"), 401: resposta("NaoAutenticado") },
            },
            post: {
                tags: ["Critérios"],
                summary: "Cadastrar critério",
                description:
                    "O novo critério recebe peso 1/n, e os pesos dos demais são reduzidos na mesma proporção, mantendo a soma igual a 1. " +
                    "Enviar `peso` aqui retorna 400: use `PUT /criterios/pesos`." + ADMIN_E_PESQUISADOR,
                requestBody: corpo(ref("CriterioInput"), { nome: "Acesso a internet", descricao: "Fonte: IBGE", tipo: "BENEFICIO", unidade: "%" }),
                responses: {
                    201: ok("Critério criado", ref("Criterio")),
                    400: resposta("ErroValidacao"),
                    401: resposta("NaoAutenticado"),
                    403: resposta("SemPermissao"),
                    409: { description: "Já existe um critério com o mesmo nome", ...json(ref("Erro")) },
                },
            },
        },
        "/criterios/pesos": {
            put: {
                tags: ["Critérios"],
                summary: "Configurar os pesos de todos os critérios (RF03)",
                description:
                    "Informe o peso de **todos** os critérios. Cada peso fica entre 0 e 1, com no máximo 4 casas decimais, " +
                    "e a soma deve ser exatamente 1. A atualização é feita em uma transação." + ADMIN_E_PESQUISADOR,
                requestBody: corpo(
                    { type: "object", required: ["pesos"], properties: { pesos: { type: "array", items: ref("Peso") } } },
                    { pesos: [{ id: 1, peso: 0.3333 }, { id: 2, peso: 0.3333 }, { id: 3, peso: 0.3334 }] }
                ),
                responses: {
                    200: ok("Critérios com os pesos atualizados", { type: "array", items: ref("Criterio") }),
                    400: resposta("ErroValidacao"),
                    401: resposta("NaoAutenticado"),
                    403: resposta("SemPermissao"),
                    404: { description: "Algum id de critério não existe", ...json(ref("Erro")) },
                },
            },
        },
        "/criterios/{id}": {
            parameters: [parametro("id")],
            get: {
                tags: ["Critérios"],
                summary: "Buscar critério",
                description: QUALQUER_PERFIL,
                responses: { 200: ok("Critério", ref("Criterio")), 401: resposta("NaoAutenticado"), 404: resposta("NaoEncontrado") },
            },
            put: {
                tags: ["Critérios"],
                summary: "Editar critério",
                description: "Substitui nome, descrição, tipo e unidade. O peso não muda aqui." + ADMIN_E_PESQUISADOR,
                requestBody: corpo(ref("CriterioInput")),
                responses: {
                    200: ok("Critério atualizado", ref("Criterio")),
                    400: resposta("ErroValidacao"),
                    401: resposta("NaoAutenticado"),
                    403: resposta("SemPermissao"),
                    404: resposta("NaoEncontrado"),
                    409: { description: "Já existe outro critério com o mesmo nome", ...json(ref("Erro")) },
                },
            },
            delete: {
                tags: ["Critérios"],
                summary: "Remover critério",
                description:
                    "O peso do critério removido é redistribuído entre os restantes, na proporção de cada um. " +
                    "Bloqueado se o critério tiver valores na matriz de decisão." + ADMIN_E_PESQUISADOR,
                responses: {
                    204: { description: "Critério removido e pesos redistribuídos" },
                    401: resposta("NaoAutenticado"),
                    403: resposta("SemPermissao"),
                    404: resposta("NaoEncontrado"),
                    409: { description: "Critério com valores na matriz de decisão", ...json(ref("Erro")) },
                },
            },
        },

        // ---------------------------------------------------------------- Matriz de decisão
        "/matriz": {
            get: {
                tags: ["Matriz de decisão"],
                summary: "Consultar a matriz de um ano",
                description:
                    "Tabela município × critério: `linhas[i].valores[j]` é o valor do município no `criterios[j]` (`null` se não informado). " +
                    "Sem `ano`, usa o mais recente; sem `municipios`, traz os que têm algum valor no ano." + QUALQUER_PERFIL,
                parameters: [
                    parametro("ano"),
                    { name: "municipios", in: "query", description: "Ids separados por vírgula", schema: { type: "string", example: "1,2,3" } },
                    { name: "criterios", in: "query", description: "Ids separados por vírgula", schema: { type: "string", example: "1,2,3,4,5" } },
                ],
                responses: { 200: ok("Matriz", ref("Matriz")), 400: resposta("ErroValidacao"), 401: resposta("NaoAutenticado"), 404: resposta("NaoEncontrado") },
            },
            post: {
                tags: ["Matriz de decisão"],
                summary: "Gravar valores em lote",
                description:
                    "Insere ou atualiza (a chave é município + critério + ano) até 5.000 valores em uma transação. " +
                    "O `ano` pode vir em cada item ou uma vez só no corpo. `valor: null` remove a célula." + ADMIN_E_PESQUISADOR,
                requestBody: corpo(
                    {
                        type: "object",
                        required: ["valores"],
                        properties: {
                            ano: { type: "integer", description: "Ano aplicado aos itens que não informarem o próprio" },
                            valores: { type: "array", maxItems: 5000, items: ref("ValorMatrizInput") },
                        },
                    },
                    { ano: 2022, valores: [{ municipioId: 1, criterioId: 1, valor: 12.5 }, { municipioId: 1, criterioId: 2, valor: 0.8 }] }
                ),
                responses: {
                    200: ok("Resultado", {
                        type: "object",
                        properties: { gravados: { type: "integer" }, removidos: { type: "integer" } },
                    }),
                    400: resposta("ErroValidacao"),
                    401: resposta("NaoAutenticado"),
                    403: resposta("SemPermissao"),
                    404: { description: "Município ou critério inexistente", ...json(ref("Erro")) },
                    413: { description: "Corpo da requisição maior que 1 MB", ...json(ref("Erro")) },
                },
            },
        },
        "/matriz/anos": {
            get: {
                tags: ["Matriz de decisão"],
                summary: "Anos com valores cadastrados",
                description: "Do mais recente para o mais antigo." + QUALQUER_PERFIL,
                responses: { 200: ok("Anos", { type: "array", items: { type: "integer" }, example: [2022, 2021] }), 401: resposta("NaoAutenticado") },
            },
        },
        "/matriz/geojson": {
            get: {
                tags: ["Dashboard e mapa"],
                summary: "Camada de um indicador em GeoJSON",
                description:
                    "Valor de um critério em cada município, para as camadas por indicador do mapa. " +
                    "`metadados` traz o critério, `valorMinimo` e `valorMaximo` (para a escala de cores) e `semCoordenadas`." + QUALQUER_PERFIL,
                parameters: [
                    { name: "criterio", in: "query", required: true, schema: { type: "integer", minimum: 1 } },
                    parametro("ano"),
                ],
                responses: {
                    200: geojson("FeatureCollection com `valor` em properties"),
                    400: resposta("ErroValidacao"),
                    401: resposta("NaoAutenticado"),
                    404: resposta("NaoEncontrado"),
                    422: { description: "Matriz de decisão vazia", ...json(ref("Erro")) },
                },
            },
        },

        // ---------------------------------------------------------------- TOPSIS e simulações
        "/topsis/executar": {
            post: {
                tags: ["TOPSIS e simulações"],
                summary: "Executar o TOPSIS (UC03)",
                description:
                    "Monta a matriz de decisão do banco, executa o TOPSIS e salva a simulação com o ranking. Todos os campos são opcionais:\n\n" +
                    "- `ano`: sem ele, usa o ano mais recente da matriz;\n" +
                    "- `municipios`: sem ele, usa todos os que têm valores no ano;\n" +
                    "- `criterios`: sem ele, usa todos;\n" +
                    "- `pesos`: sem ele, usa os pesos salvos dos critérios (reescalados para somar 1 se só parte deles for usada). " +
                    "Se enviado, deve ter um peso para cada critério da simulação, somando 1.\n\n" +
                    "Municípios sem valor em algum critério ficam fora do cálculo e aparecem em `parametros.ignorados`." + QUALQUER_PERFIL,
                requestBody: {
                    required: false,
                    ...json(
                        {
                            type: "object",
                            properties: {
                                ano: { type: "integer" },
                                municipios: { type: "array", items: { type: "integer" } },
                                criterios: { type: "array", items: { type: "integer" } },
                                pesos: { type: "array", items: ref("Peso") },
                            },
                        },
                        { ano: 2022, criterios: [1, 2, 3, 4, 5], pesos: [{ id: 1, peso: 0.2 }, { id: 2, peso: 0.2 }, { id: 3, peso: 0.15 }, { id: 4, peso: 0.25 }, { id: 5, peso: 0.2 }] }
                    ),
                },
                responses: {
                    201: ok("Simulação executada", ref("SimulacaoDetalhada")),
                    400: resposta("ErroValidacao"),
                    401: resposta("NaoAutenticado"),
                    404: { description: "Município ou critério inexistente", ...json(ref("Erro")) },
                    422: { description: "Matriz vazia, menos de 2 municípios com todos os valores ou critérios com peso 0", ...json(ref("Erro")) },
                },
            },
        },
        "/simulacoes": {
            get: {
                tags: ["TOPSIS e simulações"],
                summary: "Histórico de simulações (RF10)",
                description: "Da mais recente para a mais antiga." + QUALQUER_PERFIL,
                parameters: [
                    { name: "usuarioId", in: "query", schema: { type: "integer", minimum: 1 } },
                    parametro("ano"),
                    parametro("page"),
                    parametro("limit"),
                ],
                responses: { 200: ok("Lista paginada", paginado("SimulacaoResumo")), 400: resposta("ErroValidacao"), 401: resposta("NaoAutenticado") },
            },
        },
        "/simulacoes/{id}": {
            get: {
                tags: ["TOPSIS e simulações"],
                summary: "Detalhes e ranking de uma simulação",
                description: QUALQUER_PERFIL,
                parameters: [parametro("id")],
                responses: { 200: ok("Simulação", ref("SimulacaoDetalhada")), 401: resposta("NaoAutenticado"), 404: resposta("NaoEncontrado") },
            },
        },
        "/simulacoes/{id}/geojson": {
            get: {
                tags: ["Dashboard e mapa"],
                summary: "Resultado da simulação em GeoJSON",
                description: "Um ponto por município do ranking, com `posicao`, `ci`, `faixa` e `rotuloFaixa` em properties, para colorir o mapa." + QUALQUER_PERFIL,
                parameters: [parametro("id")],
                responses: { 200: geojson("FeatureCollection do ranking"), 401: resposta("NaoAutenticado"), 404: resposta("NaoEncontrado") },
            },
        },

        // ---------------------------------------------------------------- Dashboard
        "/dashboard/resumo": {
            get: {
                tags: ["Dashboard e mapa"],
                summary: "Números dos cards do dashboard (RF05)",
                description: "Sem `simulacaoId`, resume a simulação mais recente. Sem nenhuma simulação, `simulacao` vem `null`." + QUALQUER_PERFIL,
                parameters: [{ name: "simulacaoId", in: "query", schema: { type: "integer", minimum: 1 } }],
                responses: { 200: ok("Resumo", ref("ResumoDashboard")), 401: resposta("NaoAutenticado"), 404: resposta("NaoEncontrado") },
            },
        },

        // ---------------------------------------------------------------- Relatórios
        "/relatorios/{id}/pdf": {
            get: {
                tags: ["Relatórios"],
                summary: "Relatório da simulação em PDF",
                description: "Dados da simulação, critérios e pesos, ranking e municípios fora do ranking." + QUALQUER_PERFIL,
                parameters: [parametro("id")],
                responses: {
                    200: { description: "Arquivo simulacao-{id}.pdf", content: { "application/pdf": { schema: { type: "string", format: "binary" } } } },
                    401: resposta("NaoAutenticado"),
                    404: resposta("NaoEncontrado"),
                },
            },
        },
        "/relatorios/{id}/csv": {
            get: {
                tags: ["Relatórios"],
                summary: "Ranking da simulação em CSV",
                description: "Formato do Excel em português: separador `;`, vírgula decimal e BOM UTF-8." + QUALQUER_PERFIL,
                parameters: [parametro("id")],
                responses: {
                    200: { description: "Arquivo simulacao-{id}.csv", content: { "text/csv": { schema: { type: "string" } } } },
                    401: resposta("NaoAutenticado"),
                    404: resposta("NaoEncontrado"),
                },
            },
        },
    },
    components: {
        securitySchemes: {
            bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT", description: "Token devolvido por POST /login" },
        },
        parameters: {
            id: { name: "id", in: "path", required: true, schema: { type: "integer", minimum: 1 } },
            page: { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
            limit: { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 50 } },
            ano: { name: "ano", in: "query", description: "Ano de referência dos dados", schema: { type: "integer", minimum: 1900, maximum: 2100 } },
        },
        responses: {
            ErroValidacao: { description: "Dados inválidos", ...json(ref("Erro"), { error: "UF inválida." }) },
            NaoAutenticado: { description: "Token ausente, inválido ou expirado", ...json(ref("Erro"), { error: "Token não informado" }) },
            SemPermissao: { description: "O perfil do usuário não tem acesso a esta rota", ...json(ref("Erro"), { error: "Acesso negado." }) },
            NaoEncontrado: { description: "Registro não encontrado", ...json(ref("Erro"), { error: "Município não encontrado." }) },
        },
        schemas: {
            Erro: { type: "object", properties: { error: { type: "string" } } },
            Perfil: { type: "string", enum: ["ADMINISTRADOR", "PESQUISADOR", "GESTOR_PUBLICO"] },
            TipoCriterio: {
                type: "string",
                enum: ["BENEFICIO", "CUSTO"],
                description: "BENEFICIO: quanto maior o valor, melhor. CUSTO: quanto menor, melhor. Também aceita minúsculas na entrada.",
            },
            FaixaVulnerabilidade: {
                type: "string",
                enum: FAIXAS_VULNERABILIDADE.map(f => f.faixa),
                description: FAIXAS_VULNERABILIDADE.map(f => `${f.faixa}: ${f.ciMinimo} ≤ Ci < ${f.ciMaximo}`).join("; ") + " (a última inclui Ci = 1).",
            },
            Senha: {
                type: "string",
                minLength: 6,
                description: "Mínimo de 6 caracteres e no máximo 72 bytes (limite do bcrypt; letras acentuadas ocupam 2 bytes).",
            },
            UsuarioResumo: {
                type: "object",
                properties: { id: { type: "integer" }, nome: { type: "string" }, email: { type: "string" }, perfil: ref("Perfil") },
            },
            Usuario: {
                type: "object",
                properties: {
                    id: { type: "integer" },
                    nome: { type: "string" },
                    email: { type: "string" },
                    perfil: ref("Perfil"),
                    created_at: { type: "string", format: "date-time" },
                },
            },
            UsuarioInput: {
                type: "object",
                required: ["nome", "email", "senha"],
                properties: {
                    nome: { type: "string", maxLength: 150 },
                    email: { type: "string", format: "email", maxLength: 150 },
                    senha: ref("Senha"),
                    perfil: { ...ref("Perfil"), description: "Padrão: PESQUISADOR" },
                },
            },
            Municipio: {
                type: "object",
                properties: {
                    id: { type: "integer" },
                    nome: { type: "string" },
                    uf: { type: "string", example: "BA" },
                    populacao: { type: "integer", nullable: true },
                    idh: { type: "number", nullable: true },
                    latitude: { type: "number", nullable: true },
                    longitude: { type: "number", nullable: true },
                    created_at: { type: "string", format: "date-time" },
                },
            },
            MunicipioInput: {
                type: "object",
                required: ["nome", "uf"],
                properties: {
                    nome: { type: "string", maxLength: 200 },
                    uf: { type: "string", description: "Uma das 27 UFs; aceita minúsculas", example: "BA" },
                    populacao: { type: "integer", minimum: 0, nullable: true },
                    idh: { type: "number", minimum: 0, maximum: 1, nullable: true },
                    latitude: { type: "number", minimum: -90, maximum: 90, nullable: true, description: "Informe junto com a longitude" },
                    longitude: { type: "number", minimum: -180, maximum: 180, nullable: true, description: "Informe junto com a latitude" },
                },
            },
            MunicipioResumo: {
                type: "object",
                properties: { id: { type: "integer" }, nome: { type: "string" }, uf: { type: "string" } },
            },
            Criterio: {
                type: "object",
                properties: {
                    id: { type: "integer" },
                    nome: { type: "string" },
                    descricao: { type: "string", nullable: true },
                    tipo: ref("TipoCriterio"),
                    peso: { type: "number", description: "A soma dos pesos de todos os critérios é 1" },
                    unidade: { type: "string", nullable: true },
                    created_at: { type: "string", format: "date-time" },
                },
            },
            CriterioInput: {
                type: "object",
                required: ["nome", "tipo"],
                properties: {
                    nome: { type: "string", maxLength: 150 },
                    descricao: { type: "string", nullable: true },
                    tipo: ref("TipoCriterio"),
                    unidade: { type: "string", maxLength: 50, nullable: true },
                },
            },
            CriterioResumo: {
                type: "object",
                properties: { id: { type: "integer" }, nome: { type: "string" }, tipo: ref("TipoCriterio"), unidade: { type: "string", nullable: true } },
            },
            Peso: {
                type: "object",
                required: ["id", "peso"],
                properties: {
                    id: { type: "integer", description: "Id do critério" },
                    peso: { type: "number", minimum: 0, maximum: 1, description: "No máximo 4 casas decimais" },
                },
            },
            ValorMatrizInput: {
                type: "object",
                required: ["municipioId", "criterioId", "valor"],
                properties: {
                    municipioId: { type: "integer" },
                    criterioId: { type: "integer" },
                    ano: { type: "integer", minimum: 1900, maximum: 2100, description: "Opcional se informado no corpo" },
                    valor: { type: "number", nullable: true, description: "null remove o valor" },
                },
            },
            Matriz: {
                type: "object",
                properties: {
                    ano: { type: "integer", nullable: true, description: "null quando a matriz está vazia" },
                    criterios: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: { id: { type: "integer" }, nome: { type: "string" }, tipo: ref("TipoCriterio"), peso: { type: "number" }, unidade: { type: "string", nullable: true } },
                        },
                    },
                    linhas: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                municipio: ref("MunicipioResumo"),
                                valores: { type: "array", items: { type: "number", nullable: true }, description: "Um valor por critério, na ordem de `criterios`" },
                            },
                        },
                    },
                },
            },
            ResultadoRanking: {
                type: "object",
                properties: {
                    posicao: { type: "integer", description: "1 = menos vulnerável" },
                    municipio: ref("MunicipioResumo"),
                    ci: { type: "number", description: "Coeficiente de proximidade (0 a 1): quanto maior, menos vulnerável" },
                    distanciaPositiva: { type: "number", description: "D+: distância até a solução ideal positiva" },
                    distanciaNegativa: { type: "number", description: "D-: distância até a solução ideal negativa" },
                    faixa: ref("FaixaVulnerabilidade"),
                },
            },
            ParametrosSimulacao: {
                type: "object",
                description: "Cópia dos parâmetros usados: alterar critérios ou pesos depois não muda simulações antigas",
                properties: {
                    ano: { type: "integer" },
                    municipiosSelecionados: { type: "array", items: { type: "integer" }, nullable: true, description: "null = todos com dados no ano" },
                    pesosPersonalizados: { type: "boolean", description: "true = pesos enviados na execução" },
                    criterios: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                id: { type: "integer" },
                                nome: { type: "string" },
                                tipo: ref("TipoCriterio"),
                                unidade: { type: "string", nullable: true },
                                peso: { type: "number", description: "Peso efetivamente usado" },
                            },
                        },
                    },
                    ignorados: {
                        type: "array",
                        description: "Municípios fora do cálculo por falta de valores",
                        items: {
                            type: "object",
                            properties: {
                                id: { type: "integer" },
                                nome: { type: "string" },
                                uf: { type: "string" },
                                criteriosFaltando: { type: "array", items: { type: "integer" } },
                            },
                        },
                    },
                },
            },
            SimulacaoResumo: {
                type: "object",
                properties: {
                    id: { type: "integer" },
                    data_execucao: { type: "string", format: "date-time" },
                    ano_referencia: { type: "integer" },
                    status: { type: "string", example: "CONCLUIDA" },
                    usuario: { type: "object", properties: { id: { type: "integer" }, nome: { type: "string" } } },
                    totalMunicipios: { type: "integer" },
                },
            },
            SimulacaoDetalhada: {
                type: "object",
                properties: {
                    id: { type: "integer" },
                    data_execucao: { type: "string", format: "date-time" },
                    ano_referencia: { type: "integer" },
                    status: { type: "string", example: "CONCLUIDA" },
                    usuario: { type: "object", properties: { id: { type: "integer" }, nome: { type: "string" } } },
                    parametros: ref("ParametrosSimulacao"),
                    ranking: { type: "array", items: ref("ResultadoRanking"), description: "Ordenado da 1ª (menos vulnerável) à última posição" },
                },
            },
            ResumoDashboard: {
                type: "object",
                properties: {
                    totais: {
                        type: "object",
                        properties: {
                            municipios: { type: "integer" },
                            criterios: { type: "integer" },
                            simulacoes: { type: "integer" },
                            anosComDados: { type: "array", items: { type: "integer" } },
                        },
                    },
                    simulacao: {
                        type: "object",
                        nullable: true,
                        properties: {
                            id: { type: "integer" },
                            data_execucao: { type: "string", format: "date-time" },
                            ano_referencia: { type: "integer" },
                            usuario: { type: "object", properties: { id: { type: "integer" }, nome: { type: "string" } } },
                            totalMunicipios: { type: "integer" },
                            municipiosIgnorados: { type: "integer" },
                            ciMedio: { type: "number" },
                            maisVulneravel: ref("DestaqueMunicipio"),
                            menosVulneravel: ref("DestaqueMunicipio"),
                            faixas: {
                                type: "array",
                                description: "Todas as faixas, inclusive as vazias (servem de legenda do mapa)",
                                items: {
                                    type: "object",
                                    properties: {
                                        faixa: ref("FaixaVulnerabilidade"),
                                        rotulo: { type: "string" },
                                        ciMinimo: { type: "number" },
                                        ciMaximo: { type: "number" },
                                        quantidade: { type: "integer" },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            DestaqueMunicipio: {
                type: "object",
                properties: { municipio: ref("MunicipioResumo"), posicao: { type: "integer" }, ci: { type: "number" }, faixa: ref("FaixaVulnerabilidade") },
            },
            FeatureCollection: {
                type: "object",
                description: "GeoJSON (RFC 7946), compatível com L.geoJSON do Leaflet. Coordenadas na ordem [longitude, latitude].",
                properties: {
                    type: { type: "string", enum: ["FeatureCollection"] },
                    features: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                type: { type: "string", enum: ["Feature"] },
                                geometry: {
                                    type: "object",
                                    properties: {
                                        type: { type: "string", enum: ["Point"] },
                                        coordinates: { type: "array", items: { type: "number" }, minItems: 2, maxItems: 2, example: [-38.5014, -12.9714] },
                                    },
                                },
                                properties: { type: "object", additionalProperties: true },
                            },
                        },
                    },
                    metadados: {
                        type: "object",
                        additionalProperties: true,
                        properties: {
                            semCoordenadas: { type: "array", items: ref("MunicipioResumo"), description: "Municípios fora do mapa por não terem latitude/longitude" },
                        },
                    },
                },
            },
        },
    },
};
