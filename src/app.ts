import "reflect-metadata";
import express from "express";
import { router } from "./routes";
import swaggerUi from "swagger-ui-express";
import { errorHandler } from "./middlewares/errorHandler";
import { openapi } from "./docs/openapi";

const app = express();

// o padrão é 100kb; o lote da matriz de decisão (até 5.000 valores) precisa de mais
app.use(express.json({ limit: "1mb" }));

// RNF06: documentação interativa (Swagger UI) e a especificação OpenAPI em JSON
app.get("/api/docs.json", (req, res) => {
    res.json(openapi);
});
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapi, {
    customSiteTitle: "API - Plataforma Energia Renovável",
    swaggerOptions: { persistAuthorization: true }, // mantém o token ao recarregar a página
}));

app.use("/api", router);

app.use((req, res) => {
    res.status(404).json({ error: "Rota não encontrada." });
});

app.use(errorHandler);

export { app };
