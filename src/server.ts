import { app } from "./app";
import { AppDataSource } from "./database/data-source";

const PORT = Number(process.env.PORT ?? 3000);

if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET não definido. Configure o .env (veja o .env.example).");
    process.exit(1);
}

AppDataSource.initialize()
    .then(() => {
        console.log("Data Source has been initialized!");

        app.listen(PORT, () => {
            console.log(`Server is running in port ${PORT}`);
        })
    })
    .catch((err) => {
        console.error("Failed to initialize the Data Source and start the server:", err);
        process.exit(1);
    })
