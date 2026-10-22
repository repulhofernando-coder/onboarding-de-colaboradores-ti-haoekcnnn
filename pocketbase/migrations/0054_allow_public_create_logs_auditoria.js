/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const logsCol = app.findCollectionByNameOrId('logs_auditoria')
    // Permitir criação pública (para registro de falhas de login anônimas)
    // Leitura, atualização e exclusão continuam restritas a usuários autenticados / admin
    logsCol.createRule = ''
    app.save(logsCol)
  },
  (app) => {
    const logsCol = app.findCollectionByNameOrId('logs_auditoria')
    logsCol.createRule = "@request.auth.id != ''"
    app.save(logsCol)
  },
)
