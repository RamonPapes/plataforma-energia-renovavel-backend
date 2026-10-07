import "reflect-metadata";
import express from "express";
import { router } from "./routes";
import { errorHandler } from "./middlewares/errorHandler";

const app = express();

// o padrão é 100kb; o lote da matriz de decisão (até 5.000 valores) precisa de mais
app.use(express.json({ limit: "1mb" }));

app.use("/api", router);

app.use((req, res) => {
    res.status(404).json({ error: "Rota não encontrada." });
});

app.use(errorHandler);

export { app };
