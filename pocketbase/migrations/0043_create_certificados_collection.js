migrate(
  (app) => {
    const onboardingsCol = app.findCollectionByNameOrId('onboardings')
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    // Criar coleção certificados
    // Regras de RLS:
    // Visualizar e gerenciar certificados é exclusivo de RH e Admin (LGPD: dado pessoal comum com acesso restrito; papel Gestão não visualiza nem gerencia)
    // listRule / viewRule: apenas admin e rh
    // createRule / updateRule: apenas admin e rh
    // deleteRule: apenas admin e rh (ou admin) -> admin ou rh
    const collection = new Collection({
      name: 'certificados',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh')",
      viewRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh')",
      createRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh')",
      updateRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh')",
      deleteRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh')",
      fields: [
        {
          name: 'colaborador',
          type: 'relation',
          required: true,
          collectionId: onboardingsCol.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'titulo',
          type: 'text',
          required: true,
        },
        {
          name: 'emissor',
          type: 'text',
          required: true,
        },
        {
          name: 'data_emissao',
          type: 'date',
          required: true,
        },
        {
          name: 'data_validade',
          type: 'date',
          required: false,
        },
        {
          name: 'arquivo',
          type: 'file',
          maxSelect: 1,
          maxSize: 52428800, // 50MB
          mimeTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
        },
        {
          name: 'registrado_por',
          type: 'relation',
          required: false,
          collectionId: usersCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'observacoes',
          type: 'text',
          required: false,
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
        'CREATE INDEX idx_certificados_colaborador ON certificados (colaborador)',
        'CREATE INDEX idx_certificados_data_emissao ON certificados (data_emissao)',
        'CREATE INDEX idx_certificados_data_validade ON certificados (data_validade)',
      ],
    })

    app.save(collection)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('certificados')
      app.delete(col)
    } catch (_) {}
  },
)
