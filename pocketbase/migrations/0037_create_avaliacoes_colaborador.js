migrate(
  (app) => {
    const onboardingsCol = app.findCollectionByNameOrId('onboardings')
    const questionariosCol = app.findCollectionByNameOrId('questionarios')
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    // Criar coleção avaliacoes_colaborador
    // Regras de RLS:
    // list/view: qualquer usuário autenticado (Admin, RH e Gestão podem ver resultados)
    // create/update/delete: Admin ou RH (Gestão é somente leitura)
    const collection = new Collection({
      name: 'avaliacoes_colaborador',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh')",
      updateRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh')",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        {
          name: 'colaborador_id',
          type: 'relation',
          required: true,
          collectionId: onboardingsCol.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'questionario_id',
          type: 'relation',
          required: true,
          collectionId: questionariosCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'token',
          type: 'text',
          required: true,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['pendente', 'concluida', 'cancelada'],
          maxSelect: 1,
        },
        {
          name: 'tipo_avaliacao',
          type: 'text',
        },
        {
          name: 'nota',
          type: 'number',
        },
        {
          name: 'total_questoes',
          type: 'number',
        },
        {
          name: 'percentual',
          type: 'number',
        },
        {
          name: 'aprovado',
          type: 'bool',
        },
        {
          name: 'regua_aprovacao',
          type: 'number',
        },
        {
          name: 'tentativa_id',
          type: 'text',
        },
        {
          name: 'aplicada_por',
          type: 'relation',
          collectionId: usersCol.id,
          maxSelect: 1,
        },
        {
          name: 'data_aplicacao',
          type: 'date',
        },
        {
          name: 'data_conclusao',
          type: 'date',
        },
        {
          name: 'observacoes',
          type: 'text',
        },
        {
          name: 'created',
          type: 'autodate',
          onCreate: true,
          onUpdate: false,
        },
        {
          name: 'updated',
          type: 'autodate',
          onCreate: true,
          onUpdate: true,
        },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_avaliacoes_colab_token ON avaliacoes_colaborador (token)',
        'CREATE INDEX idx_avaliacoes_colab_colaborador ON avaliacoes_colaborador (colaborador_id)',
        'CREATE INDEX idx_avaliacoes_colab_questionario ON avaliacoes_colaborador (questionario_id)',
        'CREATE INDEX idx_avaliacoes_colab_status ON avaliacoes_colaborador (status)',
      ],
    })

    app.save(collection)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('avaliacoes_colaborador')
      app.delete(col)
    } catch (_) {}
  },
)
