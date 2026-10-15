migrate(
  (app) => {
    // Obter IDs das coleções existentes para relacionamentos
    const questionariosCol = app.findCollectionByNameOrId('questionarios')
    const questionariosColId = questionariosCol.id

    let tentativasColId = ''
    try {
      tentativasColId = app.findCollectionByNameOrId('teste_tentativas').id
    } catch (_) {}

    let onboardingsColId = ''
    try {
      onboardingsColId = app.findCollectionByNameOrId('onboardings').id
    } catch (_) {}

    // 1. Criar coleção candidatos
    let candidatosCol
    try {
      candidatosCol = app.findCollectionByNameOrId('candidatos')
    } catch (_) {
      candidatosCol = new Collection({
        name: 'candidatos',
        type: 'base',
        // Listagem e visualização: usuários autenticados (Admin, RH veem tudo; Gestão acompanha seu setor ou todos conforme regra)
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        // Criação: Admin e RH
        createRule: "@request.auth.role = 'admin' || @request.auth.role = 'rh'",
        // Edição: Admin, RH ou Gestão (para aprovação/reprovação)
        updateRule: "@request.auth.id != ''",
        // Exclusão: Admin ou RH
        deleteRule: "@request.auth.role = 'admin' || @request.auth.role = 'rh'",
        fields: [
          { name: 'nome', type: 'text', required: true },
          { name: 'email', type: 'text', required: true },
          { name: 'cargo_pretendido', type: 'text', required: false },
          { name: 'setor', type: 'text', required: false },
          {
            name: 'questionario_id',
            type: 'relation',
            required: false,
            collectionId: questionariosColId,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: [
              'pre_selecionado',
              'prova_enviada',
              'prova_concluida',
              'aprovado',
              'reprovado',
              'convertido',
            ],
            maxSelect: 1,
          },
          { name: 'token_publico', type: 'text', required: false },
          {
            name: 'tentativa_id',
            type: 'relation',
            required: false,
            collectionId: tentativasColId,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'nota_acertos', type: 'number', required: false },
          { name: 'total_questoes', type: 'number', required: false },
          { name: 'percentual_obtido', type: 'number', required: false },
          { name: 'aprovado_teste', type: 'bool', required: false },
          { name: 'data_envio_prova', type: 'date', required: false },
          { name: 'data_conclusao_prova', type: 'date', required: false },
          {
            name: 'decidido_por',
            type: 'relation',
            required: false,
            collectionId: '_pb_users_auth_',
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'data_decisao', type: 'date', required: false },
          { name: 'motivo_reprovacao', type: 'text', required: false },
          {
            name: 'criado_por',
            type: 'relation',
            required: false,
            collectionId: '_pb_users_auth_',
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'colaborador_id',
            type: 'relation',
            required: false,
            collectionId: onboardingsColId,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          "CREATE UNIQUE INDEX idx_candidatos_token ON candidatos (token_publico) WHERE token_publico IS NOT NULL AND token_publico != ''",
          'CREATE INDEX idx_candidatos_status ON candidatos (status)',
          'CREATE INDEX idx_candidatos_setor ON candidatos (setor)',
          'CREATE INDEX idx_candidatos_email ON candidatos (email)',
        ],
      })
      app.save(candidatosCol)
    }

    // 2. Permitir que teste_tentativas referencie candidato (seja via relation candidato_id ou onboarding_id opcional)
    const tentativasCol = app.findCollectionByNameOrId('teste_tentativas')
    if (!tentativasCol.fields.getByName('candidato_id')) {
      tentativasCol.fields.add(
        new RelationField({
          name: 'candidato_id',
          required: false,
          collectionId: candidatosCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
      app.save(tentativasCol)
    }

    // 3. Garantir que questionarios aceite tipo_de_uso "contratacao" e semear um se não houver
    let questContratacao = null
    try {
      questContratacao = app.findFirstRecordByFilter(
        'questionarios',
        "tipo_de_uso = 'contratacao' && setor ~ 'windows'",
      )
    } catch (_) {
      // Criar um questionário de contratação inicial para Windows para testes imediatos
      questContratacao = new Record(questionariosCol)
      questContratacao.set('nome', 'Prova Técnica de TI — Pré-selecionados (Windows)')
      questContratacao.set('setor', 'windows')
      questContratacao.set('tipo_de_uso', 'contratacao')
      questContratacao.set('percentual_aprovacao', 80)
      questContratacao.set('ativo', true)
      questContratacao.set(
        'descricao',
        'Avaliação técnica de conhecimentos em suporte, redes e infraestrutura Windows para candidatos pré-selecionados.',
      )
      app.save(questContratacao)

      // Associar algumas questões de teste a este questionário para ter prova pronta
      try {
        const questoes = app.findRecordsByFilter('teste_questoes', 'ativo = true', 'ordem', 10, 0)
        // Clonar questões para o questionário de contratação
        const questoesCol = app.findCollectionByNameOrId('teste_questoes')
        for (let i = 0; i < questoes.length; i++) {
          const orig = questoes[i]
          const nova = new Record(questoesCol)
          nova.set('questionario_id', questContratacao.id)
          nova.set('enunciado', orig.getString('enunciado'))
          nova.set('alternativas', orig.getString('alternativas') || orig.get('alternativas'))
          nova.set('correta_index', orig.getInt('correta_index'))
          nova.set('gabarito_comentario', orig.getString('gabarito_comentario'))
          nova.set('ordem', i + 1)
          nova.set('ativo', true)
          nova.set('tema', orig.getString('tema') || 'Suporte TI')
          app.save(nova)
        }
      } catch (errQ) {
        console.log('[Migration 0032] Aviso ao semear questoes de contratacao:', errQ)
      }
    }
  },
  (app) => {
    try {
      const candidatosCol = app.findCollectionByNameOrId('candidatos')
      app.delete(candidatosCol)
    } catch (_) {}

    try {
      const tentativasCol = app.findCollectionByNameOrId('teste_tentativas')
      const f = tentativasCol.fields.getByName('candidato_id')
      if (f) tentativasCol.fields.remove(f)
      app.save(tentativasCol)
    } catch (_) {}
  },
)
