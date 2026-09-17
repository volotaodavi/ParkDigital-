import axios, { AxiosInstance, isAxiosError } from 'axios';
import { env } from './env';

export interface WhatsAppTemplateComponent {
  type: 'header' | 'body' | 'button';
  sub_type?: string;
  index?: string;
  parameters?: Array<Record<string, unknown>>;
}

const MAX_TENTATIVAS = 3;
const ATRASO_BASE_MS = 1000;
const TIMEOUT_REQUISICAO_MS = 10_000;

function aguardar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizarTelefone(telefone: string): string {
  return telefone.replace(/\D/g, '');
}

function descreverErro(error: unknown): string {
  if (isAxiosError(error)) {
    return JSON.stringify(error.response?.data ?? { mensagem: error.message });
  }

  return error instanceof Error ? error.message : String(error);
}

/**
 * Cliente para a API Oficial do WhatsApp (Meta Cloud API).
 *
 * Endpoint real da Meta: https://graph.facebook.com/{versao}/{phone_number_id}/messages
 * (não "facebook.com" direto — é sempre pelo subdomínio "graph.", versionado).
 *
 * Só envia mensagens de template pré-aprovadas pela Meta Business Manager:
 * a API Cloud não permite texto livre fora da janela de atendimento de 24h.
 * Os nomes de template usados neste backend (ver ticketManager.ts e
 * cronTasks.ts) precisam existir e estar aprovados na conta Meta antes de
 * funcionarem em produção.
 */
export class WhatsAppService {
  private readonly cliente: AxiosInstance | null;

  constructor() {
    if (!env.whatsappAccessToken || !env.whatsappPhoneNumberId) {
      console.warn(
        '[WhatsAppService] WHATSAPP_ACCESS_TOKEN/WHATSAPP_PHONE_NUMBER_ID não configurados — envios serão ignorados.',
      );
      this.cliente = null;
      return;
    }

    this.cliente = axios.create({
      baseURL: `https://graph.facebook.com/${env.whatsappApiVersion}/${env.whatsappPhoneNumberId}`,
      timeout: TIMEOUT_REQUISICAO_MS,
      headers: {
        Authorization: `Bearer ${env.whatsappAccessToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Envia uma mensagem de template para o número informado, com até
   * MAX_TENTATIVAS tentativas (com espera crescente) em caso de falha de
   * rede, para reduzir a chance de o alerta ao cidadão se perder por
   * instabilidade momentânea. Nunca lança exceção: retorna `false` e
   * registra o erro em log quando não consegue entregar.
   */
  async sendTemplateMessage(
    to: string,
    templateName: string,
    components: WhatsAppTemplateComponent[],
  ): Promise<boolean> {
    if (!this.cliente) {
      console.warn(
        `[WhatsAppService] Envio de "${templateName}" para ${to} ignorado: serviço não configurado.`,
      );
      return false;
    }

    const destinatario = normalizarTelefone(to);

    for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa += 1) {
      try {
        await this.cliente.post('/messages', {
          messaging_product: 'whatsapp',
          to: destinatario,
          type: 'template',
          template: {
            name: templateName,
            language: { code: 'pt_BR' },
            components,
          },
        });

        console.log(`[WhatsAppService] Template "${templateName}" enviado para ${destinatario}.`);
        return true;
      } catch (error) {
        const ultimaTentativa = tentativa === MAX_TENTATIVAS;

        console.error(
          `[WhatsAppService] Tentativa ${tentativa}/${MAX_TENTATIVAS} falhou ao enviar template "${templateName}" para ${destinatario}: ${descreverErro(error)}`,
        );

        if (ultimaTentativa) {
          console.error(
            `[WhatsAppService] Mensagem "${templateName}" para ${destinatario} NÃO foi entregue após ${MAX_TENTATIVAS} tentativas.`,
          );
          return false;
        }

        await aguardar(ATRASO_BASE_MS * tentativa);
      }
    }

    return false;
  }
}

export const whatsAppService = new WhatsAppService();
