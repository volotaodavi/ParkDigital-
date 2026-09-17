import express, { Express, NextFunction, Request, Response } from 'express';
import { env } from './config/env';
import driverRouter from './modules/driver/driver.routes';
import fiscalRouter from './modules/fiscal/fiscal.routes';

const app: Express = express();

app.use(express.json());

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ONLINE', servico: 'ParkDigital API' });
});

app.use('/api/v1/motorista', driverRouter);
app.use('/api/v1/fiscal', fiscalRouter);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ status: 'ERRO', mensagem: 'Rota não encontrada.' });
});

app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[server] Erro não tratado:', error);
  res.status(500).json({ status: 'ERRO', mensagem: 'Erro interno do servidor.' });
});

app.listen(env.port, () => {
  console.log(`ParkDigital API rodando na porta ${env.port}`);
});

export default app;
