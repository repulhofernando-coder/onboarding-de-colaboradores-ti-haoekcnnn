/// <reference path="../pb_data/types.d.ts" />

// Job cron diário para limpeza de logs de auditoria com retenção de 6 meses (180 dias)
// Registros são mantidos por 6 meses conforme política oficial de auditoria.
cronAdd('limpar_logs_auditoria_6meses', '0 3 * * *', (e) => {
  try {
    const pbApp =
      (typeof $app !== 'undefined' && $app) ||
      (e && e.app) ||
      (typeof app !== 'undefined' && app) ||
      null

    if (!pbApp) {
      console.error('[Cron Auditoria] pbApp não disponível no contexto do cron.')
      return
    }

    const dataLimite = new Date()
    dataLimite.setDate(dataLimite.getDate() - 180)
    const dataIso = dataLimite.toISOString().replace('T', ' ').slice(0, 19)

    // Buscar logs criados antes de dataIso na coleção logs_auditoria
    const logsAntigos = pbApp.findRecordsByFilter(
      'logs_auditoria',
      `created < '${dataIso}'`,
      'created',
      500,
      0,
    )

    let totalApagados = 0
    for (const log of logsAntigos) {
      try {
        pbApp.delete(log)
        totalApagados++
      } catch (err) {
        console.error('Erro ao deletar log antigo:', err)
      }
    }

    if (totalApagados > 0) {
      console.log(
        `[Cron Auditoria] Limpeza realizada: ${totalApagados} logs antigos com mais de 6 meses foram removidos.`,
      )
    } else {
      console.log('[Cron Auditoria] Nenhum log com mais de 6 meses para remover.')
    }
  } catch (err) {
    console.error('[Cron Auditoria] Falha ao executar job de retenção:', err)
  }
})
