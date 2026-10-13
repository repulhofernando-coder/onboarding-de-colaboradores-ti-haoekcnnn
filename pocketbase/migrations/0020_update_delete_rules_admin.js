migrate(
  (app) => {
    // 1. Garantir que as coleções permitam delete a usuários autenticados (Admin/RH)
    // users: permitir delete para admin
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    usersCol.deleteRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || id = @request.auth.id)"
    app.save(usersCol)

    // onboardings
    const onbCol = app.findCollectionByNameOrId('onboardings')
    onbCol.deleteRule = "@request.auth.id != ''"
    app.save(onbCol)

    // tarefas_onboarding
    const tarefasCol = app.findCollectionByNameOrId('tarefas_onboarding')
    tarefasCol.deleteRule = "@request.auth.id != ''"
    app.save(tarefasCol)

    // avaliacoes
    const avaliacoesCol = app.findCollectionByNameOrId('avaliacoes')
    avaliacoesCol.deleteRule = "@request.auth.id != ''"
    app.save(avaliacoesCol)

    // confirmacoes_colaborador
    const confCol = app.findCollectionByNameOrId('confirmacoes_colaborador')
    confCol.deleteRule = "@request.auth.id != ''"
    app.save(confCol)

    // logs_auditoria
    const logsCol = app.findCollectionByNameOrId('logs_auditoria')
    logsCol.deleteRule = "@request.auth.role = 'admin'"
    app.save(logsCol)

    // materiais
    const materiaisCol = app.findCollectionByNameOrId('materiais')
    materiaisCol.deleteRule = "@request.auth.id != ''"
    app.save(materiaisCol)

    // modelo_tarefas
    const modeloCol = app.findCollectionByNameOrId('modelo_tarefas')
    modeloCol.deleteRule = "@request.auth.id != ''"
    app.save(modeloCol)
  },
  (app) => {
    // Reverter regras se necessário
  },
)
