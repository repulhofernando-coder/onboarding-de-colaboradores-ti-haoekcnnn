migrate(
  (app) => {
    // 1. Coleção: teste_questoes
    // Armazena as questões do teste de conhecimento
    // gabarito_comentario: visível apenas ao Admin pelo sistema / endpoints
    // API rules: autenticados podem ler para telas internas (com Admin tendo acesso aos comentários)
    let questoesCol
    try {
      questoesCol = app.findCollectionByNameOrId('teste_questoes')
    } catch (_) {
      questoesCol = new Collection({
        name: 'teste_questoes',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.role = 'admin'",
        updateRule: "@request.auth.role = 'admin'",
        deleteRule: "@request.auth.role = 'admin'",
        fields: [
          { name: 'enunciado', type: 'text', required: true },
          { name: 'alternativas', type: 'json', required: true }, // array de 4 strings [A, B, C, D]
          { name: 'correta_index', type: 'number', required: false }, // 0=A, 1=B, 2=C, 3=D (evitar required para permitir 0)
          { name: 'gabarito_comentario', type: 'text', required: false },
          { name: 'ordem', type: 'number', required: false },
          { name: 'ativo', type: 'bool', required: false },
          { name: 'tema', type: 'text', required: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_teste_questoes_ordem ON teste_questoes (ordem)',
          'CREATE INDEX idx_teste_questoes_ativo ON teste_questoes (ativo)',
        ],
      })
      app.save(questoesCol)
    }

    // 2. Coleção: teste_tentativas
    // Armazena as tentativas realizadas pelo colaborador
    // listRule / viewRule: autenticados do sistema podem visualizar
    // createRule: null (exclusivo via pb_hooks server-side para proteção do gabarito e auditoria)
    // updateRule: null
    // deleteRule: "@request.auth.role = 'admin'"
    const onboardingsCol = app.findCollectionByNameOrId('onboardings')
    const onboardingsId = onboardingsCol.id

    let tentativasCol
    try {
      tentativasCol = app.findCollectionByNameOrId('teste_tentativas')
    } catch (_) {
      tentativasCol = new Collection({
        name: 'teste_tentativas',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: null, // superuser/hook apenas
        updateRule: null, // imutável após submissão
        deleteRule: "@request.auth.role = 'admin'",
        fields: [
          {
            name: 'onboarding_id',
            type: 'relation',
            required: true,
            collectionId: onboardingsId,
            cascadeDelete: true,
            maxSelect: 1,
          },
          { name: 'tentativa_numero', type: 'number', required: true },
          { name: 'respostas', type: 'json', required: true }, // array [{ questao_id, resposta_index, correta, correta_index, enunciado, alternativas, gabarito_comentario }]
          { name: 'total_questoes', type: 'number', required: true },
          { name: 'acertos', type: 'number', required: true },
          { name: 'percentual', type: 'number', required: true }, // ex: 95.0
          { name: 'aprovado', type: 'bool', required: false }, // true se percentual >= 95 (19/20)
          { name: 'data_submissao', type: 'date', required: true },
          { name: 'ip', type: 'text', required: false },
          { name: 'reteste_liberado', type: 'bool', required: false },
          { name: 'reteste_liberado_em', type: 'date', required: false },
          { name: 'reteste_liberado_por', type: 'text', required: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_teste_tentativas_onboarding ON teste_tentativas (onboarding_id)',
          'CREATE INDEX idx_teste_tentativas_submissao ON teste_tentativas (data_submissao DESC)',
        ],
      })
      app.save(tentativasCol)
    }

    // 3. Adicionar campos auxiliares no onboarding para controle rápido do teste
    if (!onboardingsCol.fields.getByName('teste_conhecimento_status')) {
      onboardingsCol.fields.add(
        new SelectField({
          name: 'teste_conhecimento_status',
          required: false,
          values: ['bloqueado', 'liberado', 'aprovado', 'reprovado', 'reteste_liberado'],
          maxSelect: 1,
        }),
      )
    }
    if (!onboardingsCol.fields.getByName('teste_ultima_nota')) {
      onboardingsCol.fields.add(
        new NumberField({
          name: 'teste_ultima_nota',
          required: false,
        }),
      )
    }
    if (!onboardingsCol.fields.getByName('teste_ultimo_percentual')) {
      onboardingsCol.fields.add(
        new NumberField({
          name: 'teste_ultimo_percentual',
          required: false,
        }),
      )
    }
    if (!onboardingsCol.fields.getByName('teste_tentativas_count')) {
      onboardingsCol.fields.add(
        new NumberField({
          name: 'teste_tentativas_count',
          required: false,
        }),
      )
    }
    app.save(onboardingsCol)
  },
  (app) => {
    try {
      const tentativasCol = app.findCollectionByNameOrId('teste_tentativas')
      app.delete(tentativasCol)
    } catch (_) {}
    try {
      const questoesCol = app.findCollectionByNameOrId('teste_questoes')
      app.delete(questoesCol)
    } catch (_) {}
  },
)
