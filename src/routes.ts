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

//UC01 somente Administrador cadastra, edita e remove municipio
router.post("/municipios", ensureAuthenticated, ensureRole(Perfil.ADMINISTRADOR), municipioController.createMunicipioHandle);
router.put("/municipios/:id", ensureAuthenticated, ensureRole(Perfil.ADMINISTRADOR), municipioController.updateMunicipioHandle);
router.delete("/municipios/:id", ensureAuthenticated, ensureRole(Perfil.ADMINISTRADOR), municipioController.deleteMunicipioHandle);
//Qualquer usuário autenticado pode ler os municipios
router.get("/municipios", ensureAuthenticated, municipioController.getMunicipiosHandle);
router.get("/municipios/:id", ensureAuthenticated, municipioController.getMunicipioByIdHandle);

// Rotas do próprio usuário logado (registradas antes de /usuarios/:id para "me" não ser lido como id)
router.get("/usuarios/me", ensureAuthenticated, usuarioController.getMeHandle);
router.patch("/usuarios/me/senha", ensureAuthenticated, usuarioController.alterarSenhaHandle);
// RF08 somente Administrador gerencia usuários
router.post("/usuarios", ensureAuthenticated, ensureRole(Perfil.ADMINISTRADOR), usuarioController.createUserHandle);
router.get("/usuarios", ensureAuthenticated, ensureRole(Perfil.ADMINISTRADOR), usuarioController.getUsuariosHandle);
router.get("/usuarios/:id", ensureAuthenticated, ensureRole(Perfil.ADMINISTRADOR), usuarioController.getUsuarioByIdHandle);
router.put("/usuarios/:id", ensureAuthenticated, ensureRole(Perfil.ADMINISTRADOR), usuarioController.updateUsuarioHandle);
router.delete("/usuarios/:id", ensureAuthenticated, ensureRole(Perfil.ADMINISTRADOR), usuarioController.deleteUsuarioHandle);

router.post("/login", authController.loginHandle);
// "Esqueci minha senha": rotas públicas, sem token (verificação por e-mail é implementação futura)
router.post("/esqueci-senha", authController.esqueciSenhaHandle);
router.post("/redefinir-senha", authController.redefinirSenhaHandle);

export { router }
