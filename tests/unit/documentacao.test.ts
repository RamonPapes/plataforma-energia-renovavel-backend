import { router } from "../../src/routes";
import { openapi } from "../../src/docs/openapi";

// Garante que toda rota do Express está documentada no Swagger (e que o Swagger não documenta rotas inexistentes)
describe("Documentação OpenAPI", () => {
    const rotasExpress = (router.stack as { route?: { path: string; methods: Record<string, boolean> } }[])
        .filter(camada => camada.route)
        .flatMap(({ route }) => Object.keys(route!.methods).map(metodo =>
            `${metodo.toUpperCase()} ${route!.path.replace(/:(\w+)/g, "{$1}")}`
        ))
        .sort();

    const rotasDocumentadas = Object.entries(openapi.paths)
        .flatMap(([caminho, operacoes]) => Object.keys(operacoes)
            .filter(chave => chave !== "parameters")
            .map(metodo => `${metodo.toUpperCase()} ${caminho}`))
        .sort();

    test("todas as rotas estão documentadas e nenhuma rota documentada falta no Express", () => {
        expect(rotasDocumentadas).toEqual(rotasExpress);
    });
});
