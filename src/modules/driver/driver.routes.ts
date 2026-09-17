import { Router } from 'express';
import { ativarVagaController } from './driver.controller';

const driverRouter = Router();

driverRouter.post('/vaga/ativar', ativarVagaController);

export default driverRouter;
