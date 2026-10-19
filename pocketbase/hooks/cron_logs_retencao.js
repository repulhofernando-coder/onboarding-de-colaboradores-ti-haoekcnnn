/// <reference path="../pb_data/types.d.ts" />

// Job cron diário para limpeza de logs de auditoria com retenção de 6 meses (180 dias)
// Registros são mantidos por 6 meses conforme política oficial de auditoria.
// Garantir idempotência e integridade do schema: campos 'setor' e 'setor_origem' devem ser text
// em modelo_tarefas, onboardings, materiais e fases_modelo
cronAdd('assegurar_schema_setor_text', '0 4 * * *', (e) => {
  try {
    const pbApp =
      (typeof $app !== 'undefined' && $app) ||
      (e && e.app) ||
      (typeof app !== 'undefined' && app) ||
      (typeof core !== 'undefined' && core.app) ||
      null

    if (!pbApp) return

    const colModelo = pbApp.findCollectionByNameOrId('modelo_tarefas')
    const fModelo = colModelo.fields.getByName('setor')
    if (fModelo && fModelo.type !== 'text') {
      colModelo.fields.removeByName('setor')
      colModelo.fields.add(new TextField({ name: 'setor', required: false }))
      pbApp.save(colModelo)
    }

    const colOnb = pbApp.findCollectionByNameOrId('onboardings')
    const fOnb = colOnb.fields.getByName('setor')
    if (fOnb && fOnb.type !== 'text') {
      colOnb.fields.removeByName('setor')
      colOnb.fields.add(new TextField({ name: 'setor', required: false }))
      pbApp.save(colOnb)
    }

    const colMat = pbApp.findCollectionByNameOrId('materiais')
    const fMat = colMat.fields.getByName('setor_origem')
    if (fMat && fMat.type !== 'text') {
      colMat.fields.removeByName('setor_origem')
      colMat.fields.add(new TextField({ name: 'setor_origem', required: false }))
      pbApp.save(colMat)
    }

    const colFase = pbApp.findCollectionByNameOrId('fases_modelo')
    const fFase = colFase.fields.getByName('setor')
    if (fFase && fFase.type !== 'text') {
      colFase.fields.removeByName('setor')
      colFase.fields.add(new TextField({ name: 'setor', required: false }))
      pbApp.save(colFase)
    }

    const colUsers = pbApp.findCollectionByNameOrId('_pb_users_auth_')
    const fUsers = colUsers.fields.getByName('setor')
    if (fUsers && fUsers.type !== 'text') {
      colUsers.fields.removeByName('setor')
      colUsers.fields.add(new TextField({ name: 'setor', required: false }))
      pbApp.save(colUsers)
    }
  } catch (err) {
    console.error('[Cron Assegurar Schema Error]', err)
  }
})

cronAdd('limpar_logs_auditoria_6meses', '0 3 * * *', (e) => {
  try {
    const pbApp =
      (typeof $app !== 'undefined' && $app) ||
      (e && e.app) ||
      (typeof app !== 'undefined' && app) ||
      (typeof core !== 'undefined' && core.app) ||
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
