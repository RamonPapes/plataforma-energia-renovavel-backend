import "reflect-metadata";
import express, { NextFunction, Request, Response, response } from "express";
import { initializeDataSource } from "./database/data-source";
import { router } from "./routes";

const PORT = Number(process.env.PORT ?? 3000);

initializeDataSource()
    .then(() =>{
        const app = express();

        app.use(express.json());

        app.use(router);

        app.listen(PORT, () => {
            console.log(`Server is running in port ${PORT}`);
        })
    })
    .catch((err) => {
        console.error("Failed to initialize the Data Source and start the server:", err);
    })