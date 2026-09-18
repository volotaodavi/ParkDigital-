import rateLimit from 'express-rate-limit';

const JANELA_MS = 15 * 60 * 1000;
const MAX_TENTATIVAS = 5;

/**
 * Limita tentativas de login por IP para dificultar ataques de força bruta
 * contra as credenciais de motoristas, fiscais, gestores e administradores.
 */
export const loginRateLimiter = rateLimit({
  windowMs: JANELA_MS,
  limit: MAX_TENTATIVAS,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`[rateLimit] Muitas tentativas de login a partir do IP ${req.ip}.`);
    res.status(429).json({
      status: 'ERRO',
      codigo: 'MUITAS_TENTATIVAS',
      mensagem: 'Muitas tentativas de login. Aguarde alguns minutos antes de tentar novamente.',
    });
  },
});
