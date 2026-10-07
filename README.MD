# Plataforma Energia Renovável: Backend

API REST para **mensurar a vulnerabilidade social energética de municípios** com o método multicritério **TOPSIS**. A plataforma cadastra municípios e indicadores (acesso à eletricidade, renda, tarifa, irradiação solar etc.), monta a matriz de decisão, executa o TOPSIS e gera o ranking de vulnerabilidade, com histórico de simulações, relatórios em PDF/CSV e dados georreferenciados para o mapa.

Projeto da disciplina de Desenvolvimento Fullstack, baseado no *Roteiro de Desenvolvimento: Plataforma de Energia Renovável com TOPSIS* (Prof. Me. Celso Barreto), alinhado ao ODS 7 da ONU (energia limpa e acessível).

---

## Sumário

- [Funcionalidades](#funcionalidades)
- [Tecnologias](#tecnologias)
- [Como executar](#como-executar)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Primeiro acesso e documentação da API](#primeiro-acesso-e-documentação-da-api)
- [Perfis de acesso](#perfis-de-acesso)
- [Fluxo de uso](#fluxo-de-uso)
- [Rotas da API](#rotas-da-api)
- [O método TOPSIS](#o-método-topsis)
- [Banco de dados](#banco-de-dados)
- [Testes](#testes)
- [Arquitetura e estrutura de pastas](#arquitetura-e-estrutura-de-pastas)
- [Scripts npm](#scripts-npm)
- [Fluxo de trabalho com Git](#fluxo-de-trabalho-com-git)
- [Limitações conhecidas e trabalhos futuros](#limitações-conhecidas-e-trabalhos-futuros)

---

## Funcionalidades

Requisitos do roteiro e situação no backend:

| Requisito | Descrição | Situação |
|---|---|---|
| RF01 / UC01 | Cadastrar municípios com dados socioeconômicos e localização | ✅ |
| RF02 / UC02 | Cadastrar indicadores e critérios de vulnerabilidade | ✅ |
| RF03 | Configurar os pesos dos critérios (soma = 1) | ✅ |
| RF04 / UC03 | Executar o TOPSIS e gerar o ranking | ✅ |
| RF05 | Dados para o dashboard (Ci médio, mais e menos vulnerável, faixas) | ✅ |
| RF06 / UC04 | Exportar relatórios em PDF e CSV | ✅ |
| RF07 | Dados georreferenciados para o mapa (GeoJSON) | ✅ |
| RF08 | Gerenciar usuários e perfis de acesso | ✅ |
| RF09 | Importar dados de fontes externas (IBGE, ANEEL) | ... implementações futuras |
| RF10 | Histórico de simulações TOPSIS | ✅ |
| RNF01 | TOPSIS em menos de 3 s para 500 municípios | ✅ cerca de 50 ms pela API (500 municípios × 7 critérios) |
| RNF04 | Autenticação JWT e senhas com bcrypt | ✅ |
| RNF05 | Cobertura de testes ≥ 80% | ✅ 99,5% das instruções e 93,6% dos branches |
| RNF06 | Documentação Swagger/OpenAPI | ✅ em `/api/docs` |

RNF02 (interface responsiva) é responsabilidade do frontend. RNF03 (disponibilidade) depende do ambiente de implantação.

---

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Linguagem | TypeScript 7 |
| Servidor | Node.js 24 + Express 5 |
| Banco de dados | MySQL 8.4 |
| ORM e migrations | TypeORM |
| Autenticação | JWT (`jsonwebtoken`) + `bcryptjs` |
| Relatórios | `pdfkit` (PDF) e CSV gerado na aplicação |
| Documentação | OpenAPI 3.0 + Swagger UI (`swagger-ui-express`) |
| Testes | Jest + Supertest |
| Infraestrutura | Docker e Docker Compose |

**Por que Jest** O `ts-jest` não suporta TypeScript 7, então os testes são transpilados com o `@swc/jest`.

---

## Como executar

### Pré-requisitos

- [Docker](https://docs.docker.com/get-docker/) e Docker Compose
- [Node.js](https://nodejs.org/) 24 (mínimo 22.9) e npm, apenas para desenvolvimento local e testes

### Opção 1: tudo com Docker (um comando)

```bash
cp .env.example .env    # depois preencha DB_PASSWORD, JWT_SECRET, ADMIN_EMAIL e ADMIN_SENHA
docker compose up --build
```

Ao subir, o container da API **aplica as migrations automaticamente**: cria as tabelas, o usuário administrador (com `ADMIN_EMAIL`/`ADMIN_SENHA`), os 7 critérios do roteiro e a [base de exemplo](#dados-de-exemplo) (10 municípios com todos os indicadores, um pesquisador e um gestor público). A API fica em **http://localhost:3000/api** e a documentação em **http://localhost:3000/api/docs**.

### Opção 2: desenvolvimento local (com recarga automática)

O MySQL roda no Docker e a API roda na sua máquina:

```bash
cp .env.example .env          # DB_HOST=localhost
docker compose up -d db       # só o banco
npm install
npm run migration:run         # cria as tabelas, o admin e os critérios
npm run dev                   # API em http://localhost:3000/api, recarrega ao salvar
```

> Não rode a opção 1 e a opção 2 ao mesmo tempo: as duas usam a porta 3000.

---

## Variáveis de ambiente

Configure no arquivo `.env` (modelo em [.env.example](.env.example)). O `.env` não é versionado.

| Variável | Obrigatória | Descrição |
|---|---|---|
| `PORT` | não (padrão 3000) | Porta da API |
| `DB_HOST` | não (padrão `localhost`) | Host do MySQL. No Docker Compose é sempre `db` |
| `DB_PORT` | não (padrão 3306) | Porta do MySQL |
| `DB_USER` | não (padrão `root`) | Usuário do MySQL |
| `DB_PASSWORD` | **sim** | Senha do MySQL (também define a senha de `root` no container) |
| `DB_NAME` | **sim** | Nome do banco |
| `JWT_SECRET` | **sim** | Segredo para assinar os tokens. Sem ele a API não inicia |
| `JWT_EXPIRES_IN` | não (padrão `1d`) | Validade do token (ex.: `1h`, `1d`) |
| `ADMIN_NOME` | não (padrão `Administrador`) | Nome do administrador criado pelo seed |
| `ADMIN_EMAIL` | **sim, na 1ª execução** | E-mail do administrador inicial |
| `ADMIN_SENHA` | **sim, na 1ª execução** | Senha do administrador inicial |
| `PESQUISADOR_NOME` / `GESTOR_NOME` | não | Nomes dos usuários de exemplo (padrão `Pesquisador` / `Gestor Público`) |
| `PESQUISADOR_EMAIL` / `PESQUISADOR_SENHA` | não | Pesquisador de exemplo. Sem eles, o usuário não é criado |
| `GESTOR_EMAIL` / `GESTOR_SENHA` | não | Gestor público de exemplo. Sem eles, o usuário não é criado |

Para gerar um `JWT_SECRET` aleatório:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Primeiro acesso e documentação da API

1. Abra **http://localhost:3000/api/docs** (Swagger UI).
2. Em `POST /login`, clique em *Try it out* e envie o `ADMIN_EMAIL` e a `ADMIN_SENHA` do `.env`.
3. Copie o `token` da resposta, clique em **Authorize** e cole o token.
4. Pronto: todas as rotas podem ser testadas pela própria página.

A especificação OpenAPI em JSON fica em **http://localhost:3000/api/docs.json** (para importar no Postman/Insomnia ou gerar o cliente do frontend).

**Convenções da API:**

- Todas as rotas começam com `/api`.
- Rotas protegidas exigem o header `Authorization: Bearer <token>`.
- Erros sempre no formato `{ "error": "mensagem" }`.
- Listagens paginadas devolvem `{ data, total, page, limit }` e aceitam `?page=` e `?limit=`.
- Datas em UTC (ISO 8601): converta para o horário local na exibição.
- Coordenadas: a API recebe e devolve `latitude` e `longitude`. No GeoJSON, a ordem é `[longitude, latitude]`.

---

## Perfis de acesso

| Ação | ADMINISTRADOR | PESQUISADOR | GESTOR_PUBLICO |
|---|:---:|:---:|:---:|
| Consultar municípios, critérios, matriz, simulações, dashboard e mapa | ✅ | ✅ | ✅ |
| Executar o TOPSIS e baixar relatórios | ✅ | ✅ | ✅ |
| Trocar a própria senha | ✅ | ✅ | ✅ |
| Cadastrar critérios e configurar pesos | ✅ | ✅ | |
| Lançar valores na matriz de decisão | ✅ | ✅ | |
| Cadastrar, editar e remover municípios | ✅ | | |
| Gerenciar usuários | ✅ | | |

Regras de proteção: o administrador não pode remover a própria conta nem rebaixar o próprio perfil, e o sistema nunca fica sem nenhum administrador.

---

## Fluxo de uso

O caminho para gerar um ranking, do cadastro ao relatório (exemplo com `curl`; o mesmo pode ser feito pelo Swagger):

```bash
API=http://localhost:3000/api

# 1. Login
TOKEN=$(curl -s $API/login -H "Content-Type: application/json" \
  -d '{"email":"admin@exemplo.com","senha":"sua-senha"}' | sed 's/.*"token":"\([^"]*\)".*/\1/')

# 2. Cadastrar os municípios (o retorno traz o id)
curl -s $API/municipios -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"nome":"Salvador","uf":"BA","populacao":2417678,"idh":0.759,"latitude":-12.9714,"longitude":-38.5014}'

# 3. Lançar os valores dos indicadores (matriz de decisão), em lote
curl -s $API/matriz -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"ano":2022,"valores":[{"municipioId":1,"criterioId":1,"valor":15},{"municipioId":1,"criterioId":2,"valor":0.8}]}'

# 4. (Opcional) Ajustar os pesos dos critérios: todos os critérios, somando 1
curl -s -X PUT $API/criterios/pesos -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"pesos":[{"id":1,"peso":0.2},{"id":2,"peso":0.2},{"id":3,"peso":0.15},{"id":4,"peso":0.15},{"id":5,"peso":0.1},{"id":6,"peso":0.1},{"id":7,"peso":0.1}]}'

# 5. Executar o TOPSIS (sem corpo: ano mais recente, todos os municípios e critérios, pesos salvos)
curl -s -X POST $API/topsis/executar -H "Authorization: Bearer $TOKEN"

# 6. Baixar o relatório da simulação 1
curl -s $API/relatorios/1/pdf -H "Authorization: Bearer $TOKEN" -o simulacao-1.pdf
```

---

## Rotas da API

Resumo das 34 rotas. Detalhes de corpo, parâmetros e respostas estão no Swagger (`/api/docs`).

**Autenticação (públicas)**

| Método | Rota | Descrição |
|---|---|---|
| POST | `/login` | Login: devolve o token JWT |
| POST | `/esqueci-senha` | Gera um código de redefinição de senha (válido por 30 min) |
| POST | `/redefinir-senha` | Redefine a senha com o código |

**Usuários (RF08)**

| Método | Rota | Perfil | Descrição |
|---|---|---|---|
| GET | `/usuarios/me` | todos | Dados do usuário logado |
| PATCH | `/usuarios/me/senha` | todos | Trocar a própria senha |
| GET / POST | `/usuarios` | admin | Listar (filtro por perfil) / cadastrar |
| GET / PUT / DELETE | `/usuarios/:id` | admin | Buscar / editar / remover |

**Municípios (UC01)**

| Método | Rota | Perfil | Descrição |
|---|---|---|---|
| GET | `/municipios` | todos | Listar (filtro por UF; `limit` até 500) |
| POST | `/municipios` | admin | Cadastrar |
| GET | `/municipios/:id` | todos | Buscar |
| PUT / DELETE | `/municipios/:id` | admin | Editar (substitui o registro) / remover |
| GET | `/municipios/:id/indicadores` | todos | Valores dos indicadores do município |

**Critérios (UC02, RF02 e RF03)**

| Método | Rota | Perfil | Descrição |
|---|---|---|---|
| GET | `/criterios` | todos | Listar (filtro por tipo) |
| POST | `/criterios` | admin, pesquisador | Cadastrar (pesos redistribuídos automaticamente) |
| PUT | `/criterios/pesos` | admin, pesquisador | Configurar os pesos de todos os critérios |
| GET | `/criterios/:id` | todos | Buscar |
| PUT / DELETE | `/criterios/:id` | admin, pesquisador | Editar / remover (pesos redistribuídos) |

**Matriz de decisão**

| Método | Rota | Perfil | Descrição |
|---|---|---|---|
| GET | `/matriz` | todos | Tabela município × critério de um ano |
| POST | `/matriz` | admin, pesquisador | Gravar valores em lote (até 5.000; `valor: null` remove) |
| GET | `/matriz/anos` | todos | Anos com dados |

**TOPSIS e simulações (UC03, RF04 e RF10)**

| Método | Rota | Perfil | Descrição |
|---|---|---|---|
| POST | `/topsis/executar` | todos | Executar o TOPSIS e salvar a simulação |
| GET | `/simulacoes` | todos | Histórico (filtros por usuário e ano) |
| GET | `/simulacoes/:id` | todos | Parâmetros e ranking de uma simulação |

**Relatórios (UC04, RF06)**

| Método | Rota | Perfil | Descrição |
|---|---|---|---|
| GET | `/relatorios/:id/pdf` | todos | Relatório completo em PDF |
| GET | `/relatorios/:id/csv` | todos | Ranking em CSV (formato do Excel em português) |

**Dashboard e mapa (RF05 e RF07)**

| Método | Rota | Perfil | Descrição |
|---|---|---|---|
| GET | `/dashboard/resumo` | todos | Números dos cards do dashboard |
| GET | `/simulacoes/:id/geojson` | todos | Ranking em GeoJSON, com a faixa de vulnerabilidade |
| GET | `/municipios/geojson` | todos | Mapa base com os municípios |
| GET | `/matriz/geojson?criterio=` | todos | Camada de um indicador por município |

Como os relatórios exigem o token, o frontend deve baixá-los com `fetch` (enviando o header `Authorization`) e depois disparar o download. Um link direto não funciona.

---

## O método TOPSIS

O TOPSIS ordena as alternativas (municípios) pela proximidade com a **solução ideal positiva** (o melhor valor de cada critério) e pelo afastamento da **solução ideal negativa** (o pior valor). A implementação fica em [src/domain/topsis.ts](src/domain/topsis.ts), como funções puras (sem banco), seguindo os passos do roteiro:

1. **Normalização vetorial:** `r_ij = x_ij / √(Σ x_ij²)`
2. **Matriz ponderada:** `v_ij = w_j · r_ij`
3. **Solução ideal positiva (A+):** máximo para critérios de *benefício*, mínimo para os de *custo*
4. **Solução ideal negativa (A−):** o inverso de A+
5. **Distâncias euclidianas** de cada município até A+ (`D+`) e até A− (`D−`)
6. **Coeficiente de proximidade:** `Ci = D− / (D+ + D−)`
7. **Ranking** pelo Ci, do maior para o menor

**Interpretação:** o Ci vai de 0 a 1. Quanto **maior** o Ci, **menos vulnerável** o município. A 1ª posição é a menos vulnerável e a última, a mais vulnerável.

**Validação:** o exemplo numérico 7.3 do roteiro (municípios A, B e C com pesos 0,20 / 0,20 / 0,15 / 0,25 / 0,20) produz **B > A > C**, com Ci de A = 0,336058. O valor foi conferido com um cálculo independente e está coberto por testes automatizados.

### Faixas de vulnerabilidade

Usadas no ranking, no dashboard e no mapa ([src/domain/faixasVulnerabilidade.ts](src/domain/faixasVulnerabilidade.ts)):

| Faixa | Ci |
|---|---|
| `MUITO_ALTA` | 0 ≤ Ci < 0,25 |
| `ALTA` | 0,25 ≤ Ci < 0,5 |
| `MEDIA` | 0,5 ≤ Ci < 0,75 |
| `BAIXA` | 0,75 ≤ Ci ≤ 1 |

### Regras da execução

- **Indicadores iniciais:** o seed cadastra os 7 indicadores do capítulo 7.1 do roteiro (C1 a C7), com tipo, unidade, fonte (IBGE, ANEEL, INPE) e pesos iniciais iguais.
- **Pesos:**
  - A soma dos pesos dos critérios é **sempre 1** (no máximo 4 casas decimais).
  - Ao criar ou remover um critério, os pesos são **redistribuídos proporcionalmente** para manter a soma, usando o método do maior resto para não perder precisão.
  - A execução usa os pesos salvos ou pesos enviados na requisição. Se só parte dos critérios for usada, os pesos salvos são reescalados para somar 1.
- **Município incompleto:** um município sem valor em algum dos critérios escolhidos fica **fora do cálculo** e aparece em `parametros.ignorados`. É preciso ter ao menos 2 municípios completos.
- **Histórico preservado:** cada simulação guarda uma **cópia dos parâmetros** (critérios, tipos e pesos). Alterar os critérios depois não muda simulações antigas.

---

## Banco de dados

```
usuarios ──< simulacoes ──< resultados_ranking >── municipios ──< matriz_decisao >── criterios
```

| Tabela | Conteúdo |
|---|---|
| `municipios` | Nome, UF, população, IDH e coordenadas (`POINT`) |
| `criterios` | Indicadores: nome, tipo (`BENEFICIO`/`CUSTO`), peso e unidade |
| `matriz_decisao` | Valor de cada critério para cada município em cada ano (chave única: município + critério + ano) |
| `usuarios` | Usuários, perfis e senha (hash bcrypt) |
| `simulacoes` | Execuções do TOPSIS: quem executou, quando, ano e parâmetros (JSON) |
| `resultados_ranking` | Ci, distâncias e posição de cada município em cada simulação |

**Integridade:** município, critério ou usuário com dados vinculados (valores na matriz ou simulações) **não pode ser removido** (a API retorna `409`), o que preserva o histórico. Os resultados são apagados junto com a sua simulação.

### Dados de exemplo

A migration [SeedDadosExemplo](src/database/migrations/1791382876313-SeedDadosExemplo.ts) deixa o sistema pronto para executar o TOPSIS:

- **10 municípios** com valores em todos os 7 indicadores no ano **2024**:
  - os municípios A, B e C do **exemplo 7.3 do roteiro** (C1 a C5 da tabela; C6 e C7 completados mantendo B > A > C);
  - os 7 municípios do modo de demonstração do frontend (Juazeiro, Uauá, Cametá, Barcelos, Jordão, Araçuaí e Chapecó).
- **Pesquisador e Gestor Público** de exemplo, com as credenciais `PESQUISADOR_*` e `GESTOR_*` do `.env`.

Os valores são ilustrativos, não são dados oficiais. Para reproduzir o exemplo 7.3 pela tela do TOPSIS, selecione só os municípios A, B e C e use os pesos 0,20 / 0,20 / 0,15 / 0,25 / 0,20 em C1 a C5 e 0 em C6 e C7: o resultado é B > A > C, com Ci de A = 0,336058.

### Limpar o banco

Para apagar todos os dados e recriar o banco do zero (tabelas, admin, critérios e dados de exemplo):

```bash
docker compose down -v          # remove os containers e o volume do MySQL
docker compose up --build       # recria o banco e aplica as migrations
```

No desenvolvimento local (opção 2), use `docker compose down -v && docker compose up -d db` e depois `npm run migration:run`.

**Migrations** (em [src/database/migrations](src/database/migrations)):

```bash
npm run migration:run      # aplica as pendentes
npm run migration:revert   # desfaz a última
npm run migration:create -- src/database/migrations/NomeDaMigration   # cria uma nova, vazia
```

> Prefira `migration:create` e escreva a migration à mão. O `migration:generate` acusa diferenças só cosméticas entre as entidades e o banco (nomes de índices e o tipo do `created_at`), então a migration gerada viria com alterações desnecessárias.

As datas são gravadas e lidas em **UTC** (`timezone: "Z"` no data source).

---

## Testes

```bash
docker compose up -d db    # os testes de integração precisam do MySQL
npm test                   # 201 testes (unitários + integração)
npm run test:cov           # com relatório de cobertura (falha abaixo de 80%)
npm run test:types         # checagem de tipos dos testes
```

- **Unitários** ([tests/unit](tests/unit)): motor TOPSIS (incluindo o exemplo 7.3 do roteiro e o RNF01), faixas, pesos, validações, middlewares e um teste que **falha se alguma rota não estiver documentada no Swagger**.
- **Integração** ([tests/integration](tests/integration)): todas as rotas pela API, com Supertest e MySQL real: casos de sucesso, validações (400), permissões (401/403), conflitos (409), relatórios e GeoJSON.
- **Banco de teste:**
  - Os testes usam um banco separado: o `DB_NAME` do `.env` com o sufixo **`_test`**, **criado e migrado automaticamente**.
  - Antes de cada teste ele é esvaziado e recebe os dados iniciais (admin e critérios).
  - Por segurança, a limpeza só roda em bancos cujo nome termina em `_test`, então **o banco de desenvolvimento nunca é tocado**.
  - O usuário do MySQL precisa de permissão para criar bancos (o `root` do Docker tem).

Cobertura atual: **99,5% das instruções, 93,6% dos branches** (meta do RNF05: 80%).

---

## Arquitetura e estrutura de pastas

Arquitetura em camadas, conforme o capítulo 5 do roteiro: **rotas → middlewares → controllers → services → domínio / repositories → banco**.

```
src/
├── server.ts              # inicialização: conecta ao banco e sobe o servidor
├── app.ts                 # configuração do Express (JSON, Swagger, rotas, 404, erros)
├── routes.ts              # todas as rotas, com autenticação e perfis
├── controllers/           # entrada HTTP: valida parâmetros/corpo e define o status da resposta
├── services/              # regras de negócio e acesso aos repositories
├── domain/                # lógica pura, sem banco: TOPSIS e faixas de vulnerabilidade
├── models/                # entidades do TypeORM (tabelas)
├── repository/            # repositories do TypeORM
├── middlewares/           # autenticação JWT, controle de perfil e tratamento de erros
├── errors/                # AppError (erro de negócio com status HTTP)
├── utils/                 # validação de parâmetros, pesos e senha
├── docs/                  # especificação OpenAPI (Swagger)
├── database/
│   ├── data-source.ts     # conexão com o MySQL
│   ├── migrations/        # criação das tabelas e dados iniciais (seeds)
│   ├── transformers.ts    # conversão de DECIMAL e POINT
│   └── errors.ts          # detecção de violação de chave estrangeira
└── @types/                # tipos adicionais do Express (req.usuario)
tests/
├── unit/                  # testes sem banco
├── integration/           # testes das rotas com banco real
├── helpers/               # limpeza do banco, criação de usuários, tokens e dados de exemplo
└── setup/                 # variáveis de teste e criação/migração do banco *_test
```

**Tratamento de erros:**

- Os services lançam `AppError(mensagem, status)` e um único middleware ([errorHandler](src/middlewares/errorHandler.ts)) converte o erro em resposta HTTP.
- No Express 5, erros em funções `async` chegam ao middleware sem `try/catch` nos controllers.
- Erros inesperados viram `500` sem expor detalhes internos.

---

## Scripts npm

| Script | Descrição |
|---|---|
| `npm run dev` | API em modo desenvolvimento, com recarga automática |
| `npm run build` | Compila o TypeScript para `dist/` |
| `npm start` | Executa a versão compilada |
| `npm run migration:run` | Aplica as migrations pendentes |
| `npm run migration:revert` | Desfaz a última migration |
| `npm run migration:create` | Cria uma migration vazia |
| `npm run migration:run:prod` | Aplica as migrations a partir do `dist/` (usado no Docker) |
| `npm test` | Roda os testes |
| `npm run test:cov` | Roda os testes com cobertura |
| `npm run test:types` | Checa os tipos dos testes |

---

## Fluxo de trabalho com Git

- **Branches:**
  - `main`: versão estável.
  - `develop`: integração das funcionalidades.
  - `feature/*`, `fix/*`, `docs/*`, `test/*`, `chore/*`: uma branch por entrega, criada a partir da `develop` atualizada.
- **Entrega:** cada branch entra na `develop` por **Pull Request**; a `develop` vai para a `main` nas entregas de cada sprint.
- **Mensagens de commit:** padrão [Conventional Commits](https://www.conventionalcommits.org/pt-br/), em português. Por exemplo: `feat: implementa o motor TOPSIS`, `fix: lê as datas do MySQL em UTC`, `docs: ...`, `test: ...`, `chore: ...`.
- **Ao alterar rotas:** atualize também [src/docs/openapi.ts](src/docs/openapi.ts). Um teste falha se alguma rota não estiver documentada.

---

## Limitações conhecidas e trabalhos futuros

- ⚠️ **Recuperação de senha sem verificação por e-mail:** hoje o código de redefinição é devolvido na própria resposta de `POST /esqueci-senha`. Então **qualquer pessoa que saiba um e-mail cadastrado consegue trocar a senha dessa conta**. Antes de qualquer implantação pública, o código precisa ser enviado por e-mail e a resposta deve ser a mesma para e-mails existentes ou não. As rotas não mudam (ver comentário em [src/services/AuthService.ts](src/services/AuthService.ts)).
- **RF09 (importação IBGE/ANEEL)** não foi implementado. Os dados entram pela API (`POST /matriz` aceita até 5.000 valores por requisição).
- **CI/CD (GitHub Actions)** ainda não está configurado. Os testes de integração precisam de um MySQL disponível no pipeline (*service container*).
- **Perfis e token JWT:** o perfil vem do token. Um usuário rebaixado ou removido mantém o acesso anterior até o token expirar (`JWT_EXPIRES_IN`). As regras críticas (como "último administrador") consultam o banco.
- **Municípios em simulações** não podem ser removidos, para preservar o histórico. Não há rota para apagar simulações.
- **Gráfico radar por município** (sugerido na tela de resultado do roteiro): as simulações guardam o ranking, mas não os valores dos indicadores usados. O frontend pode usar `GET /municipios/:id/indicadores` (valores atuais da matriz).
