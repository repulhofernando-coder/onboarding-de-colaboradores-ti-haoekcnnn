migrate(
  (app) => {
    // 1. Obter coleção de users para relacionar criado_por
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const usersId = usersCol.id

    // 2. Criar coleção materiais se não existir
    let materiaisCol
    try {
      materiaisCol = app.findCollectionByNameOrId('materiais')
    } catch (_) {
      materiaisCol = new Collection({
        name: 'materiais',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          { name: 'titulo', type: 'text', required: true },
          {
            name: 'tipo',
            type: 'select',
            required: true,
            values: ['video', 'manual'],
            maxSelect: 1,
          },
          { name: 'descricao', type: 'text', required: false },
          {
            name: 'arquivo',
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
          {
            name: 'setor_origem',
            type: 'select',
            required: false,
            values: ['windows', 'linux_rede', 'datacenter', 'campo', 'infraestrutura'],
            maxSelect: 1,
          },
          {
            name: 'criado_por',
            type: 'relation',
            required: false,
            collectionId: usersId,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_materiais_tipo ON materiais (tipo)',
          'CREATE INDEX idx_materiais_titulo ON materiais (titulo)',
        ],
      })
      app.save(materiaisCol)
    }

    const materiaisId = materiaisCol.id

    // 3. Atualizar modelo_tarefas para adicionar campo relation "material"
    const modeloCol = app.findCollectionByNameOrId('modelo_tarefas')
    if (!modeloCol.fields.getByName('material')) {
      modeloCol.fields.add(
        new RelationField({
          name: 'material',
          required: false,
          collectionId: materiaisId,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
      app.save(modeloCol)
    }

    // 4. Atualizar tarefas_onboarding para adicionar campo relation "material"
    const tarefasCol = app.findCollectionByNameOrId('tarefas_onboarding')
    if (!tarefasCol.fields.getByName('material')) {
      tarefasCol.fields.add(
        new RelationField({
          name: 'material',
          required: false,
          collectionId: materiaisId,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
      app.save(tarefasCol)
    }

    // 5. Backfill idempotente:
    // Para cada modelo_tarefas que já tenha conteudo_url preenchido e material ainda vazio,
    // criar um registro na biblioteca 'materiais' e associar o modelo a ele.
    // Também podemos criar materiais para os modelos padrão essenciais se existirem.
    const modelosComArquivo = app.findRecordsByFilter(
      'modelo_tarefas',
      "conteudo_url != '' && (material = null || material = '')",
      'created',
      500,
      0,
    )

    for (const m of modelosComArquivo) {
      const mat = new Record(materiaisCol)
      mat.set('titulo', m.getString('titulo'))
      mat.set('tipo', m.getString('tipo'))
      mat.set('descricao', m.getString('descricao') || '')
      mat.set('setor_origem', m.getString('setor') || '')
      mat.set('arquivo', m.getString('conteudo_url'))
      app.save(mat)

      m.set('material', mat.id)
      app.save(m)
    }
  },
  (app) => {
    try {
      const tarefasCol = app.findCollectionByNameOrId('tarefas_onboarding')
      if (tarefasCol.fields.getByName('material')) {
        tarefasCol.fields.removeByName('material')
        app.save(tarefasCol)
      }
    } catch (_) {}

    try {
      const modeloCol = app.findCollectionByNameOrId('modelo_tarefas')
      if (modeloCol.fields.getByName('material')) {
        modeloCol.fields.removeByName('material')
        app.save(modeloCol)
      }
    } catch (_) {}

    try {
      const materiaisCol = app.findCollectionByNameOrId('materiais')
      app.delete(materiaisCol)
    } catch (_) {}
  },
)
