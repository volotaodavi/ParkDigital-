import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from './env';

export type PapelUsuario = 'MOTORISTA' | 'FISCAL' | 'GESTOR_PUBLICO';

export interface UsuarioAutenticado {
  sub: string;
  role: PapelUsuario;
}

declare global {
  namespace Express {
    interface Request {
      usuario?: UsuarioAutenticado;
    }
  }
}

const PAPEIS_VALIDOS: readonly PapelUsuario[] = ['MOTORISTA', 'FISCAL', 'GESTOR_PUBLICO'];

function ehPapelValido(valor: unknown): valor is PapelUsuario {
  return typeof valor === 'string' && (PAPEIS_VALIDOS as readonly string[]).includes(valor);
}

/**
 * Valida o token JWT enviado em "Authorization: Bearer <token>" e extrai a
 * role do usuário autenticado. Assume que o token foi emitido por um serviço
 * de identidade externo (fora do escopo deste backend) com o payload
 * `{ sub: string; role: "MOTORISTA" | "FISCAL" | "GESTOR_PUBLICO" }`.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ status: 'ERRO', mensagem: 'Token de autenticação não informado.' });
      return;
    }

    const token = authHeader.slice('Bearer '.length).trim();
    const payload = jwt.verify(token, env.jwtSecret);

    if (typeof payload === 'string' || typeof payload.sub !== 'string' || !ehPapelValido(payload.role)) {
      res.status(403).json({ status: 'ERRO', mensagem: 'Token não contém uma role válida.' });
      return;
    }

    req.usuario = { sub: payload.sub, role: payload.role };
    next();
  } catch (error) {
    console.error('[authMiddleware] Token inválido ou expirado:', error);
    res.status(401).json({ status: 'ERRO', mensagem: 'Token inválido ou expirado.' });
  }
}

/**
 * Restringe o acesso à rota aos papéis informados. Deve ser usado sempre
 * depois do `authMiddleware` na cadeia de middlewares.
 */
export function checkRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const usuario = req.usuario;

    if (!usuario) {
      res.status(401).json({ status: 'ERRO', mensagem: 'Usuário não autenticado.' });
      return;
    }

    if (!allowedRoles.includes(usuario.role)) {
      console.warn(
        `[checkRole] Acesso negado: usuário "${usuario.sub}" (role ${usuario.role}) tentou acessar rota restrita a [${allowedRoles.join(', ')}].`,
      );
      res.status(403).json({ status: 'ERRO', mensagem: 'Você não tem permissão para acessar este recurso.' });
      return;
    }

    next();
  };
}
