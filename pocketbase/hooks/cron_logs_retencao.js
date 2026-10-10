/// <reference path="../pb_data/types.d.ts" />

// Job cron diário para limpeza de logs de auditoria com retenção de 6 meses (180 dias)
// Registros são mantidos por 6 meses conforme política oficial de auditoria.
cronAdd('limpar_logs_auditoria_6meses', '0 3 * * *', (app) => {
  try {
    const dataLimite = new Date()
    dataLimite.setDate(dataLimite.getDate() - 180)
    const dataIso = dataLimite.toISOString().replace('T', ' ').slice(0, 19)

    // Buscar logs criados antes de dataIso
    const logsAntigos = app.findRecordsByFilter(
      'logs_auditoria',
      `created < '${dataIso}'`,
      'created',
      500,
    )

    let totalApagados = 0
    for (const log of logsAntigos) {
      try {
        app.delete(log)
        totalApagados++
      } catch (err) {
        console.error('Erro ao deletar log antigo:', err)
      }
    }

    if (totalApagados > 0) {
      console.log(
        `[Cron Auditoria] Limpeza realizada: ${totalApagados} logs antigos com mais de 6 meses foram removidos.`,
      )
    }
  } catch (err) {
    console.error('[Cron Auditoria] Falha ao executar job de retenção:', err)
  }
})
