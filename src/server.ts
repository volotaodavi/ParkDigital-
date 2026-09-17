import express, { Express, NextFunction, Request, Response } from 'express';
import cors from 'cors';
import { env } from './config/env';
import { iniciarTarefasCron } from './config/cronTasks';
import { authMiddleware, checkRole } from './config/authMiddleware';
import authManagerRouter from './modules/auth/authManager';
import ticketManagerRouter from './modules/driver/ticketManager';
import webhookPaymentRouter from './modules/driver/webhookPayment';
import plateScannerRouter from './modules/fiscal/plateScanner';
import infractionManagerRouter from './modules/fiscal/infractionManager';
import dashboardFinanceiroRouter from './modules/governo/dashboardFinanceiro';

const app: Express = express();

// Necessário para o frontend Next.js (rodando em outra origem/porta) poder
// chamar esta API diretamente do navegador.
app.use(cors({ origin: env.corsOrigin }));
app.use(express.json());

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ONLINE', servico: 'ParkDigital API' });
});

// Autenticação: gera o token JWT usado pelas rotas protegidas (público)
app.use('/api/v1/auth', authManagerRouter);

// Motorista: ativação de vaga e confirmação de pagamento Pix (público)
app.use('/api/v1/motorista', ticketManagerRouter);
app.use('/api/v1/payment', webhookPaymentRouter);

// Fiscal: consulta de placa é pública (uso em campo); emissão de infração
// exige token JWT com role FISCAL
app.use('/api/v1/fiscal', plateScannerRouter);
app.use('/api/v1/fiscal/infracao', authMiddleware, checkRole(['FISCAL']), infractionManagerRouter);

// Governo: auditoria financeira exige token JWT com role GESTOR_PUBLICO
app.use('/api/v1/governo/auditoria', authMiddleware, checkRole(['GESTOR_PUBLICO']), dashboardFinanceiroRouter);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ status: 'ERRO', mensagem: 'Rota não encontrada.' });
});

app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[server] Erro não tratado:', error);
  res.status(500).json({ status: 'ERRO', mensagem: 'Erro interno do servidor.' });
});

app.listen(env.port, () => {
  console.log(`ParkDigital API rodando na porta ${env.port}`);
  iniciarTarefasCron();
});

export default app;
