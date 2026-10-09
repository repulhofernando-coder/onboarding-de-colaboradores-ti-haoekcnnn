migrate(
  (app) => {
    // 1. Atualizar coleção users existente para adicionar o campo setor (RH, Gestão)
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    if (!usersCol.fields.getByName('setor')) {
      usersCol.fields.add(
        new SelectField({
          name: 'setor',
          required: false,
          values: ['RH', 'Gestão'],
          maxSelect: 1,
        }),
      )
      usersCol.addIndex('idx_users_setor', false, 'setor', '')
      app.save(usersCol)
    }

    // 2. modelo_tarefas
    const modeloTarefas = new Collection({
      name: 'modelo_tarefas',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'setor',
          type: 'select',
          required: true,
          values: ['windows', 'linux_rede', 'datacenter', 'campo', 'infraestrutura'],
          maxSelect: 1,
        },
        { name: 'titulo', type: 'text', required: true },
        {
          name: 'tipo',
          type: 'select',
          required: true,
          values: ['video', 'manual'],
          maxSelect: 1,
        },
        {
          name: 'conteudo_url',
          type: 'file',
          maxSelect: 1,
          maxSize: 52428800, // 50MB
          mimeTypes: [
            'video/mp4',
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/msword',
            'application/vnd.ms-powerpoint',
          ],
        },
        { name: 'conteudo_link', type: 'text', required: false },
        { name: 'obrigatorio', type: 'bool', required: false },
        { name: 'ordem', type: 'number', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_modelo_tarefas_setor ON modelo_tarefas (setor)'],
    })
    app.save(modeloTarefas)

    // 3. onboardings
    const usersId = usersCol.id
    const onboardings = new Collection({
      name: 'onboardings',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'colaborador_nome', type: 'text', required: true },
        { name: 'colaborador_email', type: 'text', required: true },
        { name: 'cargo', type: 'text', required: false },
        {
          name: 'setor',
          type: 'select',
          required: true,
          values: ['windows', 'linux_rede', 'datacenter', 'campo', 'infraestrutura'],
          maxSelect: 1,
        },
        {
          name: 'gestor_id',
          type: 'relation',
          required: true,
          collectionId: usersId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'data_inicio', type: 'date', required: true },
        { name: 'data_fim', type: 'date', required: true },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['novo', 'em_andamento', 'avaliacao_pendente', 'concluido', 'nao_apto'],
          maxSelect: 1,
        },
        { name: 'etapa_atual', type: 'number', required: false },
        { name: 'etapa1_concluida', type: 'bool', required: false },
        { name: 'data_conclusao_etapa1', type: 'date', required: false },
        {
          name: 'etapa1_concluida_por',
          type: 'relation',
          required: false,
          collectionId: usersId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'etapa2_concluida', type: 'bool', required: false },
        { name: 'data_conclusao_etapa2', type: 'date', required: false },
        {
          name: 'etapa2_concluida_por',
          type: 'relation',
          required: false,
          collectionId: usersId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'etapa3_concluida', type: 'bool', required: false },
        { name: 'data_conclusao_etapa3', type: 'date', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_onboardings_setor ON onboardings (setor)',
        'CREATE INDEX idx_onboardings_status ON onboardings (status)',
        'CREATE INDEX idx_onboardings_gestor ON onboardings (gestor_id)',
        'CREATE INDEX idx_onboardings_data_fim ON onboardings (data_fim)',
      ],
    })
    app.save(onboardings)

    // 4. tarefas_onboarding
    const onboardingsCol = app.findCollectionByNameOrId('onboardings')
    const onboardingsId = onboardingsCol.id
    const tarefasOnboarding = new Collection({
      name: 'tarefas_onboarding',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'onboarding_id',
          type: 'relation',
          required: true,
          collectionId: onboardingsId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'titulo', type: 'text', required: true },
        {
          name: 'tipo',
          type: 'select',
          required: true,
          values: ['video', 'manual'],
          maxSelect: 1,
        },
        {
          name: 'conteudo_url',
          type: 'file',
          maxSelect: 1,
          maxSize: 52428800, // 50MB
          mimeTypes: [
            'video/mp4',
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/msword',
            'application/vnd.ms-powerpoint',
          ],
        },
        { name: 'conteudo_link', type: 'text', required: false },
        { name: 'concluida', type: 'bool', required: false },
        { name: 'concluida_em', type: 'date', required: false },
        { name: 'criado_automaticamente', type: 'bool', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_tarefas_onboarding_id ON tarefas_onboarding (onboarding_id)'],
    })
    app.save(tarefasOnboarding)

    // 5. avaliacoes
    const avaliacoes = new Collection({
      name: 'avaliacoes',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'onboarding_id',
          type: 'relation',
          required: true,
          collectionId: onboardingsId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'avaliador_id',
          type: 'relation',
          required: true,
          collectionId: usersId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'decisao',
          type: 'select',
          required: true,
          values: ['apto', 'nao_apto'],
          maxSelect: 1,
        },
        { name: 'observacoes', type: 'text', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_avaliacoes_onboarding_id ON avaliacoes (onboarding_id)',
        'CREATE INDEX idx_avaliacoes_avaliador_id ON avaliacoes (avaliador_id)',
      ],
    })
    app.save(avaliacoes)
  },
  (app) => {
    try {
      const avaliacoes = app.findCollectionByNameOrId('avaliacoes')
      app.delete(avaliacoes)
    } catch (_) {}
    try {
      const tarefas = app.findCollectionByNameOrId('tarefas_onboarding')
      app.delete(tarefas)
    } catch (_) {}
    try {
      const onboardings = app.findCollectionByNameOrId('onboardings')
      app.delete(onboardings)
    } catch (_) {}
    try {
      const modelos = app.findCollectionByNameOrId('modelo_tarefas')
      app.delete(modelos)
    } catch (_) {}
    try {
      const users = app.findCollectionByNameOrId('_pb_users_auth_')
      const field = users.fields.getByName('setor')
      if (field) {
        users.fields.removeByName('setor')
        users.removeIndex('idx_users_setor')
        app.save(users)
      }
    } catch (_) {}
  },
)
