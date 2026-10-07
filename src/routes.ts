import { Router } from "express";
import { MunicipioController } from "./controllers/MunicipioController";
import { ensureAuthenticated } from "./middlewares/ensureAuthenticated";
import { ensureRole } from "./middlewares/ensureRole";
import { Perfil } from "./models/Usuario";
import { UsuarioController } from "./controllers/UsuarioController";
import { AuthController } from "./controllers/AuthController";

const router = Router();

const municipioController = new MunicipioController();
const usuarioController = new UsuarioController();
const authController = new AuthController();

//UC01 somente Administrador cadastra municipio
router.post("/municipios", ensureAuthenticated, ensureRole(Perfil.ADMINISTRADOR), municipioController.createMunicipioHandle);
//Qualquer usuário autenticado pode ler os municipios
router.get("/municipios", ensureAuthenticated, municipioController.getMunicipiosHandle);

// Somente ADM cadastra usuários
router.post("/usuarios", ensureAuthenticated, ensureRole(Perfil.ADMINISTRADOR), usuarioController.createUserHandle);

// Login
router.post("/login", authController.loginHandle);

export { router }
