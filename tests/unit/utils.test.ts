import { compare } from "bcryptjs";
import { parseAno, parseInteiroPositivo, parseListaIds, parsePaginacao } from "../../src/utils/parametros";
import { gerarHashSenha, gerarTokenRedefinicao, hashTokenRedefinicao, validarSenha } from "../../src/utils/senha";
import { decimalTransformer, pointTransformer } from "../../src/database/transformers";

describe("parâmetros", () => {
    test("parseInteiroPositivo aceita número ou texto numérico", () => {
        expect(parseInteiroPositivo("7", "id")).toBe(7);
        expect(parseInteiroPositivo(3, "id")).toBe(3);
    });

    test.each([["0"], ["-1"], ["1.5"], ["abc"], [undefined]])("parseInteiroPositivo recusa %p", valor => {
        expect(() => parseInteiroPositivo(valor, "id")).toThrow("O parâmetro id deve ser um número inteiro positivo.");
    });

    test("parsePaginacao usa page 1 e limit 50 por padrão", () => {
        expect(parsePaginacao({})).toEqual({ page: 1, limit: 50 });
        expect(parsePaginacao({ page: "3", limit: "10" })).toEqual({ page: 3, limit: 10 });
    });

    test("parsePaginacao respeita o limite máximo", () => {
        expect(() => parsePaginacao({ limit: "101" })).toThrow("no máximo 100");
        expect(parsePaginacao({ limit: "500" }, 500).limit).toBe(500);
    });

    test("parseAno aceita de 1900 a 2100", () => {
        expect(parseAno("2022")).toBe(2022);
        expect(() => parseAno("1899")).toThrow("entre 1900 e 2100");
        expect(() => parseAno("2022.5")).toThrow("entre 1900 e 2100");
    });

    test("parseListaIds aceita texto separado por vírgula ou array e remove repetidos", () => {
        expect(parseListaIds(undefined, "municipios")).toBeUndefined();
        expect(parseListaIds("1, 2,2", "municipios")).toEqual([1, 2]);
        expect(parseListaIds([3, "4"], "municipios")).toEqual([3, 4]);
        expect(() => parseListaIds([], "municipios")).toThrow("lista de ids");
        expect(() => parseListaIds({}, "municipios")).toThrow("lista de ids");
        expect(() => parseListaIds("1,x", "municipios")).toThrow("inteiro positivo");
    });
});

describe("senha", () => {
    test("gerarHashSenha produz um hash bcrypt verificável", async () => {
        const hash = await gerarHashSenha("minhasenha");

        expect(hash).not.toBe("minhasenha");
        expect(await compare("minhasenha", hash)).toBe(true);
    });

    test("validarSenha exige no mínimo 6 caracteres", () => {
        expect(validarSenha("123456")).toBe("123456");
        expect(() => validarSenha("12345")).toThrow("no mínimo 6");
        expect(() => validarSenha(123456, "A nova senha")).toThrow("A nova senha deve ter no mínimo 6");
    });

    test("validarSenha recusa senhas acima de 72 bytes (limite do bcrypt), mesmo com menos de 72 caracteres", () => {
        expect(() => validarSenha("ç".repeat(40))).toThrow("muito longa");
    });

    test("código de redefinição é aleatório e só o hash SHA-256 vai para o banco", () => {
        const codigo = gerarTokenRedefinicao();

        expect(codigo).toMatch(/^[0-9a-f]{64}$/);
        expect(gerarTokenRedefinicao()).not.toBe(codigo);
        expect(hashTokenRedefinicao(codigo)).toMatch(/^[0-9a-f]{64}$/);
        expect(hashTokenRedefinicao(codigo)).not.toBe(codigo);
        expect(hashTokenRedefinicao(codigo)).toBe(hashTokenRedefinicao(codigo));
    });
});

describe("transformers do banco", () => {
    test("DECIMAL lido como string vira number", () => {
        expect(decimalTransformer.from("0.759")).toBe(0.759);
        expect(decimalTransformer.from(null)).toBeNull();
        expect(decimalTransformer.to(0.5)).toBe(0.5);
    });

    test("POINT é gravado e lido em WKT na ordem longitude latitude", () => {
        expect(pointTransformer.to({ latitude: -12.97, longitude: -38.5 })).toBe("POINT(-38.5 -12.97)");
        expect(pointTransformer.to(null)).toBeNull();
        expect(pointTransformer.from("POINT(-38.5 -12.97)")).toEqual({ latitude: -12.97, longitude: -38.5 });
        expect(pointTransformer.from(null)).toBeNull();
        expect(pointTransformer.from("LINESTRING(0 0, 1 1)")).toBeNull();
    });
});
