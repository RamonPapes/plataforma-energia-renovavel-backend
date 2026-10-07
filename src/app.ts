import "reflect-metadata";
import express from "express";
import { router } from "./routes";
import { errorHandler } from "./middlewares/errorHandler";

const app = express();

app.use(express.json());

app.use("/api", router);

app.use((req, res) => {
    res.status(404).json({ error: "Rota não encontrada." });
});

app.use(errorHandler);

export { app };
