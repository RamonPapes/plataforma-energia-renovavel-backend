import { Router } from "express";
import { MunicipioController } from "./controllers/MunicipioController";

const router = Router();

const municipioController = new MunicipioController();

router.post("/municipios", municipioController.createMunicipioHandle);
router.get("/municipios", municipioController.getMunicipiosHandle);

export { router }
