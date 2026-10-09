migrate(
  (app) => {
    // 1. Adicionar campo token_acesso_colaborador na coleção onboardings
    const onboardingsCol = app.findCollectionByNameOrId('onboardings')
    if (!onboardingsCol.fields.getByName('token_acesso_colaborador')) {
      onboardingsCol.fields.add(
        new TextField({
          name: 'token_acesso_colaborador',
          required: false,
        }),
      )
    }

    // Permitir listagem e visualização públicas para que o colaborador consiga consultar seu onboarding por token
    onboardingsCol.listRule = ''
    onboardingsCol.viewRule = ''
    app.save(onboardingsCol)

    // Criar índice se não existir
    try {
      onboardingsCol.addIndex('idx_onboardings_token_acesso', false, 'token_acesso_colaborador', '')
      app.save(onboardingsCol)
    } catch (_) {}

    // Backfill de token para onboardings existentes que não possuem
    const onboardingsSemToken = app.findRecordsByFilter(
      'onboardings',
      "token_acesso_colaborador = null || token_acesso_colaborador = ''",
      'created',
      500,
      0,
    )

    for (const ob of onboardingsSemToken) {
      const token = $security.randomString(32)
      ob.set('token_acesso_colaborador', token)
      app.save(ob)
    }

    // 2. Permitir que tarefas_onboarding e materiais sejam lidos publicamente para que o colaborador consiga ver os itens e arquivos
    const tarefasCol = app.findCollectionByNameOrId('tarefas_onboarding')
    tarefasCol.listRule = ''
    tarefasCol.viewRule = ''
    app.save(tarefasCol)

    try {
      const materiaisCol = app.findCollectionByNameOrId('materiais')
      materiaisCol.listRule = ''
      materiaisCol.viewRule = ''
      app.save(materiaisCol)
    } catch (_) {}

    try {
      const setoresCol = app.findCollectionByNameOrId('setores')
      setoresCol.listRule = ''
      setoresCol.viewRule = ''
      app.save(setoresCol)
    } catch (_) {}

    // 3. Criar coleção confirmacoes_colaborador
    const onboardingsId = onboardingsCol.id
    const tarefasId = tarefasCol.id

    let confirmacoesCol
    try {
      confirmacoesCol = app.findCollectionByNameOrId('confirmacoes_colaborador')
    } catch (_) {
      confirmacoesCol = new Collection({
        name: 'confirmacoes_colaborador',
        type: 'base',
        listRule: '',
        viewRule: '',
        createRule: '',
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          {
            name: 'onboarding',
            type: 'relation',
            required: true,
            collectionId: onboardingsId,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'tarefa',
            type: 'relation',
            required: true,
            collectionId: tarefasId,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'confirmado_em',
            type: 'date',
            required: false,
          },
          {
            name: 'ip',
            type: 'text',
            required: false,
          },
          {
            name: 'observacao',
            type: 'text',
            required: false,
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_conf_onboarding ON confirmacoes_colaborador (onboarding)',
          'CREATE INDEX idx_conf_tarefa ON confirmacoes_colaborador (tarefa)',
          'CREATE UNIQUE INDEX idx_conf_onb_tarefa ON confirmacoes_colaborador (onboarding, tarefa)',
        ],
      })
      app.save(confirmacoesCol)
    }
  },
  (app) => {
    try {
      const confirmacoesCol = app.findCollectionByNameOrId('confirmacoes_colaborador')
      app.delete(confirmacoesCol)
    } catch (_) {}

    try {
      const onboardingsCol = app.findCollectionByNameOrId('onboardings')
      if (onboardingsCol.fields.getByName('token_acesso_colaborador')) {
        onboardingsCol.fields.removeByName('token_acesso_colaborador')
        onboardingsCol.removeIndex('idx_onboardings_token_acesso')
        onboardingsCol.listRule = "@request.auth.id != ''"
        onboardingsCol.viewRule = "@request.auth.id != ''"
        app.save(onboardingsCol)
      }
    } catch (_) {}
  },
)
