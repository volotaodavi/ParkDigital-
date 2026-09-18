import { iniciarTarefasCron } from './config/cronTasks';

// Processo dedicado ao sistema de alertas anti-multa. Fica separado da API
// HTTP de propósito: se o serviço web escalar para múltiplas réplicas, ter o
// node-cron embutido em cada uma delas dispararia o mesmo alerta várias
// vezes. Com o worker isolado, o agendamento roda uma única vez.
iniciarTarefasCron();
