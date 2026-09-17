import { Router } from 'express';
import { consultarPlacaController } from './fiscal.controller';

const fiscalRouter = Router();

fiscalRouter.get('/placa/consultar/:placa', consultarPlacaController);

export default fiscalRouter;
