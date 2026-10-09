migrate(
  (app) => {
    // 1. Criar coleção 'setores' se ainda não existir
    let setoresCol
    try {
      setoresCol = app.findCollectionByNameOrId('setores')
    } catch (_) {
      setoresCol = new Collection({
        name: 'setores',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          { name: 'nome', type: 'text', required: true },
          { name: 'chave', type: 'text', required: false },
          { name: 'descricao', type: 'text', required: false },
          { name: 'cor', type: 'text', required: false },
          { name: 'ativo', type: 'bool', required: false },
          { name: 'ordem', type: 'number', required: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_setores_nome ON setores (nome)',
          'CREATE INDEX idx_setores_chave ON setores (chave)',
          'CREATE INDEX idx_setores_ativo_ordem ON setores (ativo, ordem)',
        ],
      })
      app.save(setoresCol)
    }

    const setoresId = setoresCol.id

    // 2. Seed idempotente dos setores
    // 5 áreas técnicas existentes + 3 áreas administrativas citadas pelo usuário
    const initialSetores = [
      {
        chave: 'windows',
        nome: 'Windows',
        descricao: 'Suporte helpdesk geral e estações Windows',
        cor: '#2563EB',
        ativo: true,
        ordem: 1,
      },
      {
        chave: 'linux_rede',
        nome: 'Linux / Rede',
        descricao: 'Firewall, hospedagens, e-mails cPanel/Postfix',
        cor: '#16A34A',
        ativo: true,
        ordem: 2,
      },
      {
        chave: 'datacenter',
        nome: 'Datacenter',
        descricao: 'Virtualização de máquinas e serviços',
        cor: '#7C3AED',
        ativo: true,
        ordem: 3,
      },
      {
        chave: 'campo',
        nome: 'Campo',
        descricao: 'Helpdesk presencial N1',
        cor: '#D97706',
        ativo: true,
        ordem: 4,
      },
      {
        chave: 'infraestrutura',
        nome: 'Infraestrutura',
        descricao: 'Cabeamento e infra em clientes',
        cor: '#0891B2',
        ativo: true,
        ordem: 5,
      },
      {
        chave: 'rh',
        nome: 'RH',
        descricao: 'Recursos Humanos, departamento pessoal e gestão de pessoas',
        cor: '#059669',
        ativo: true,
        ordem: 6,
      },
      {
        chave: 'comercial',
        nome: 'Comercial',
        descricao: 'Vendas, relacionamento com clientes e prospecção',
        cor: '#EA580C',
        ativo: true,
        ordem: 7,
      },
      {
        chave: 'laboratorio',
        nome: 'Laboratório',
        descricao: 'Bancada técnica, testes de hardware e reparos',
        cor: '#4F46E5',
        ativo: true,
        ordem: 8,
      },
    ]

    for (const item of initialSetores) {
      let record
      try {
        record = app.findFirstRecordByData('setores', 'nome', item.nome)
      } catch (_) {
        record = new Record(setoresCol)
      }
      record.set('nome', item.nome)
      record.set('chave', item.chave)
      record.set('descricao', item.descricao)
      record.set('cor', item.cor)
      record.set('ativo', item.ativo)
      record.set('ordem', item.ordem)
      app.save(record)
    }

    // 3. Adicionar campo relation 'setor_ref' em modelo_tarefas, onboardings e materiais
    // mantendo o campo text/select antigo 'setor' para compatibilidade total
    const modeloCol = app.findCollectionByNameOrId('modelo_tarefas')
    if (!modeloCol.fields.getByName('setor_ref')) {
      modeloCol.fields.add(
        new RelationField({
          name: 'setor_ref',
          required: false,
          collectionId: setoresId,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
      modeloCol.addIndex('idx_modelo_tarefas_setor_ref', false, 'setor_ref', '')
      app.save(modeloCol)
    }

    const onboardingsCol = app.findCollectionByNameOrId('onboardings')
    if (!onboardingsCol.fields.getByName('setor_ref')) {
      onboardingsCol.fields.add(
        new RelationField({
          name: 'setor_ref',
          required: false,
          collectionId: setoresId,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
      onboardingsCol.addIndex('idx_onboardings_setor_ref', false, 'setor_ref', '')
      app.save(onboardingsCol)
    }

    const materiaisCol = app.findCollectionByNameOrId('materiais')
    if (!materiaisCol.fields.getByName('setor_ref')) {
      materiaisCol.fields.add(
        new RelationField({
          name: 'setor_ref',
          required: false,
          collectionId: setoresId,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
      materiaisCol.addIndex('idx_materiais_setor_ref', false, 'setor_ref', '')
      app.save(materiaisCol)
    }

    // 4. Backfill idempotente: associar setor_ref baseado no valor de chave/nome de setor existente
    const allSetores = app.findRecordsByFilter('setores', '', 'ordem', 100, 0)
    const mapChaveToId = {}
    for (const s of allSetores) {
      const c = s.getString('chave')
      const n = s.getString('nome').toLowerCase()
      if (c) mapChaveToId[c] = s.id
      mapChaveToId[n] = s.id
    }

    // Backfill modelo_tarefas
    const modelos = app.findRecordsByFilter('modelo_tarefas', "setor != ''", '', 1000, 0)
    for (const m of modelos) {
      if (!m.getString('setor_ref')) {
        const val = m.getString('setor')
        const targetId = mapChaveToId[val] || mapChaveToId[val.toLowerCase()]
        if (targetId) {
          m.set('setor_ref', targetId)
          app.save(m)
        }
      }
    }

    // Backfill onboardings
    const onboardings = app.findRecordsByFilter('onboardings', "setor != ''", '', 1000, 0)
    for (const o of onboardings) {
      if (!o.getString('setor_ref')) {
        const val = o.getString('setor')
        const targetId = mapChaveToId[val] || mapChaveToId[val.toLowerCase()]
        if (targetId) {
          o.set('setor_ref', targetId)
          app.save(o)
        }
      }
    }

    // Backfill materiais
    const materiais = app.findRecordsByFilter('materiais', "setor_origem != ''", '', 1000, 0)
    for (const mat of materiais) {
      if (!mat.getString('setor_ref')) {
        const val = mat.getString('setor_origem')
        const targetId = mapChaveToId[val] || mapChaveToId[val.toLowerCase()]
        if (targetId) {
          mat.set('setor_ref', targetId)
          app.save(mat)
        }
      }
    }
  },
  (app) => {
    try {
      const materiaisCol = app.findCollectionByNameOrId('materiais')
      if (materiaisCol.fields.getByName('setor_ref')) {
        materiaisCol.fields.removeByName('setor_ref')
        materiaisCol.removeIndex('idx_materiais_setor_ref')
        app.save(materiaisCol)
      }
    } catch (_) {}

    try {
      const onboardingsCol = app.findCollectionByNameOrId('onboardings')
      if (onboardingsCol.fields.getByName('setor_ref')) {
        onboardingsCol.fields.removeByName('setor_ref')
        onboardingsCol.removeIndex('idx_onboardings_setor_ref')
        app.save(onboardingsCol)
      }
    } catch (_) {}

    try {
      const modeloCol = app.findCollectionByNameOrId('modelo_tarefas')
      if (modeloCol.fields.getByName('setor_ref')) {
        modeloCol.fields.removeByName('setor_ref')
        modeloCol.removeIndex('idx_modelo_tarefas_setor_ref')
        app.save(modeloCol)
      }
    } catch (_) {}

    try {
      const setoresCol = app.findCollectionByNameOrId('setores')
      app.delete(setoresCol)
    } catch (_) {}
  },
)
