/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // 1. Criar colecao 'itens_integracao_modelo'
    let itensCol
    try {
      itensCol = app.findCollectionByNameOrId('itens_integracao_modelo')
    } catch (_) {
      itensCol = null
    }

    if (!itensCol) {
      itensCol = new Collection({
        name: 'itens_integracao_modelo',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.role = 'admin' || @request.auth.role = 'rh'",
        updateRule: "@request.auth.role = 'admin' || @request.auth.role = 'rh'",
        deleteRule: "@request.auth.role = 'admin' || @request.auth.role = 'rh'",
        fields: [
          {
            name: 'titulo',
            type: 'text',
            required: true,
          },
          {
            name: 'ordem',
            type: 'number',
            required: false,
          },
          {
            name: 'ativo',
            type: 'bool',
            required: false,
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_itens_integracao_ordem ON itens_integracao_modelo (ordem)'],
      })
      app.save(itensCol)
    }

    // 2. Semear os 7 itens padrao
    const itensPadrao = [
      'Notebook corporativo',
      'Teclado',
      'Mouse/Mousepad',
      'Headset',
      'Cartao Flash (VR)',
      'Apresentacao ao gestor da area',
      'Apresentacao aos demais gestores da empresa',
    ]

    for (let i = 0; i < itensPadrao.length; i++) {
      const titulo = itensPadrao[i]
      try {
        const existente = app.findFirstRecordByFilter(
          'itens_integracao_modelo',
          `titulo = '${titulo}'`,
        )
        if (!existente) {
          const rec = new Record(itensCol)
          rec.set('titulo', titulo)
          rec.set('ordem', i + 1)
          rec.set('ativo', true)
          app.save(rec)
        }
      } catch (_) {
        const rec = new Record(itensCol)
        rec.set('titulo', titulo)
        rec.set('ordem', i + 1)
        rec.set('ativo', true)
        app.save(rec)
      }
    }

    // 3. Atualizar campos em onboardings
    try {
      const onboardingsCol = app.findCollectionByNameOrId('onboardings')

      if (!onboardingsCol.fields.getByName('tecnico_responsavel_nome')) {
        onboardingsCol.fields.add(
          new Field({
            name: 'tecnico_responsavel_nome',
            type: 'text',
            required: false,
          }),
        )
      }

      if (!onboardingsCol.fields.getByName('tecnico_responsavel_email')) {
        onboardingsCol.fields.add(
          new Field({
            name: 'tecnico_responsavel_email',
            type: 'text',
            required: false,
          }),
        )
      }

      if (!onboardingsCol.fields.getByName('checklist_integracao')) {
        onboardingsCol.fields.add(
          new Field({
            name: 'checklist_integracao',
            type: 'json',
            required: false,
          }),
        )
      }

      app.save(onboardingsCol)
    } catch (err) {
      console.log('Erro ao atualizar campos em onboardings:', err)
      throw err
    }
  },
  (app) => {
    try {
      const onboardingsCol = app.findCollectionByNameOrId('onboardings')
      if (onboardingsCol.fields.getByName('tecnico_responsavel_nome')) {
        onboardingsCol.fields.removeByName('tecnico_responsavel_nome')
      }
      if (onboardingsCol.fields.getByName('tecnico_responsavel_email')) {
        onboardingsCol.fields.removeByName('tecnico_responsavel_email')
      }
      if (onboardingsCol.fields.getByName('checklist_integracao')) {
        onboardingsCol.fields.removeByName('checklist_integracao')
      }
      app.save(onboardingsCol)
    } catch (_) {}

    try {
      const itensCol = app.findCollectionByNameOrId('itens_integracao_modelo')
      app.delete(itensCol)
    } catch (_) {}
  },
)
