migrate(
  (app) => {
    // 1. Criar coleção 'fases_modelo' se ainda não existir
    let fasesCol
    const setoresCol = app.findCollectionByNameOrId('setores')
    const setoresId = setoresCol.id

    try {
      fasesCol = app.findCollectionByNameOrId('fases_modelo')
    } catch (_) {
      fasesCol = new Collection({
        name: 'fases_modelo',
        type: 'base',
        listRule: '',
        viewRule: '',
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          { name: 'titulo', type: 'text', required: true },
          { name: 'descricao', type: 'text', required: false },
          { name: 'ordem', type: 'number', required: false },
          {
            name: 'setor_ref',
            type: 'relation',
            collectionId: setoresId,
            cascadeDelete: false,
            maxSelect: 1,
            required: false,
          },
          { name: 'setor', type: 'text', required: false },
          { name: 'etapa', type: 'number', required: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_fases_modelo_setor_ref ON fases_modelo (setor_ref)',
          'CREATE INDEX idx_fases_modelo_ordem ON fases_modelo (ordem)',
        ],
      })
      app.save(fasesCol)
    }

    const fasesId = fasesCol.id

    // 2. Adicionar relation 'fase' em modelo_tarefas
    const modeloCol = app.findCollectionByNameOrId('modelo_tarefas')
    if (!modeloCol.fields.getByName('fase')) {
      modeloCol.fields.add(
        new RelationField({
          name: 'fase',
          required: false,
          collectionId: fasesId,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
      modeloCol.addIndex('idx_modelo_tarefas_fase', false, 'fase', '')
      app.save(modeloCol)
    }

    // 3. Adicionar relation 'fase' em tarefas_onboarding
    const tarefasCol = app.findCollectionByNameOrId('tarefas_onboarding')
    if (!tarefasCol.fields.getByName('fase')) {
      tarefasCol.fields.add(
        new RelationField({
          name: 'fase',
          required: false,
          collectionId: fasesId,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
      tarefasCol.addIndex('idx_tarefas_onboarding_fase', false, 'fase', '')
      app.save(tarefasCol)
    }

    // 4. Seed das 5 Fases para as 5 Áreas Técnicas (Windows, Linux / Rede, Datacenter, Campo, Infraestrutura)
    const fasesSeedData = [
      {
        ordem: 1,
        titulo: 'Mapeamento de Ambientes',
        descricao:
          'Estudo aprofundado da documentação de 3 clientes de referência no Passportal. Identificação de topologia de rede, faixas de IP e particularidades de sistemas legados.',
      },
      {
        ordem: 2,
        titulo: 'Shadowing Ativo',
        descricao:
          'Acompanhamento em tempo real da tela de um técnico sênior. Observação prática do fluxo de triagem, realização mandatória do contato telefônico inicial com o cliente, consulta de credenciais no Passportal, abertura de sessão no TeamViewer e preenchimento minucioso de apontamentos no Movidesk.',
      },
      {
        ordem: 3,
        titulo: 'Atendimento Invertido',
        descricao:
          'O técnico em formação assume o teclado para conduzir os chamados reais, executando obrigatoriamente a etapa de contato telefônico prévio com o usuário antes de conectar via TeamViewer, enquanto o sênior acompanha a sessão em chamada simultânea. Nenhuma mensagem ou finalização de chamado ocorre sem validação.',
      },
      {
        ordem: 4,
        titulo: 'Atendimento Solo N1',
        descricao:
          'Execução individual de chamados de Nível 1 (baixa complexidade: redefinição de acessos, impressoras, softwares padrão), cumprindo rigorosamente a realização do contato telefônico inicial de alinhamento em cada ticket antes do acesso remoto. Dúvidas operacionais são direcionadas diretamente ao padrinho designado.',
      },
      {
        ordem: 5,
        titulo: 'Consolidação Prática',
        descricao:
          'Aumento de volumetria de atendimento de chamados N1 e início de contato com demandas de complexidade média sob supervisão sob demanda.',
      },
    ]

    const technicalSetoresChaves = [
      'windows',
      'linux_rede',
      'datacenter',
      'campo',
      'infraestrutura',
    ]

    // Mapa para guardar as fases criadas por setor: { [setorChave]: { [ordem]: faseRecordId } }
    const fasesCriadasPorSetor = {}

    for (const chave of technicalSetoresChaves) {
      let setorRecord = null
      try {
        setorRecord = app.findFirstRecordByData('setores', 'chave', chave)
      } catch (_) {
        try {
          // fallback busca por nome case-insensitive
          const all = app.findRecordsByFilter('setores', '', 'ordem', 100, 0)
          for (const s of all) {
            const ch = s.getString('chave').toLowerCase()
            const nm = s.getString('nome').toLowerCase()
            if (ch === chave || nm.includes(chave.replace('_', ' '))) {
              setorRecord = s
              break
            }
          }
        } catch (_) {}
      }

      if (!setorRecord) continue

      fasesCriadasPorSetor[chave] = {}

      for (const faseItem of fasesSeedData) {
        let faseRec = null
        try {
          const filter = `setor_ref = '${setorRecord.id}' && ordem = ${faseItem.ordem}`
          const matches = app.findRecordsByFilter('fases_modelo', filter, '', 1, 0)
          if (matches.length > 0) {
            faseRec = matches[0]
          }
        } catch (_) {}

        if (!faseRec) {
          faseRec = new Record(fasesCol)
        }

        faseRec.set('titulo', faseItem.titulo)
        faseRec.set('descricao', faseItem.descricao)
        faseRec.set('ordem', faseItem.ordem)
        faseRec.set('setor_ref', setorRecord.id)
        faseRec.set('setor', chave)
        faseRec.set('etapa', 2)
        app.save(faseRec)

        fasesCriadasPorSetor[chave][faseItem.ordem] = faseRec.id
      }
    }

    // 5. Mapear sensiblemente os itens existentes de modelo_tarefas das áreas técnicas para as fases
    // Windows, Linux/Rede, Datacenter, Campo, Infraestrutura:
    // Passportal -> Fase 1 ("Mapeamento de Ambientes")
    // Chamados / Movidesk / Fluxo / Protocolos -> Fase 2 ("Shadowing Ativo")
    // Regras de atendimento -> Fase 2 ("Shadowing Ativo")
    for (const chave of technicalSetoresChaves) {
      const fasesMap = fasesCriadasPorSetor[chave]
      if (!fasesMap) continue

      const fase1Id = fasesMap[1]
      const fase2Id = fasesMap[2]

      const modelosSetor = app.findRecordsByFilter(
        'modelo_tarefas',
        `etapa = 2 && (setor = '${chave}' || setor ~ '${chave}')`,
        'ordem',
        100,
        0,
      )

      for (const mod of modelosSetor) {
        if (!mod.getString('fase')) {
          const titulo = mod.getString('titulo').toLowerCase()
          if (titulo.includes('passportal') || titulo.includes('document')) {
            if (fase1Id) {
              mod.set('fase', fase1Id)
              app.save(mod)
            }
          } else {
            // Chamados, Fluxo, Regras, Protocolos, Introdução
            if (fase2Id) {
              mod.set('fase', fase2Id)
              app.save(mod)
            }
          }
        }
      }
    }

    // 6. Também associar tarefas_onboarding já existentes dos onboardings em andamento/abertos nas áreas técnicas
    for (const chave of technicalSetoresChaves) {
      const fasesMap = fasesCriadasPorSetor[chave]
      if (!fasesMap) continue
      const fase1Id = fasesMap[1]
      const fase2Id = fasesMap[2]

      // Encontrar onboardings deste setor
      const onbs = app.findRecordsByFilter(
        'onboardings',
        `setor = '${chave}' || setor ~ '${chave}'`,
        '',
        100,
        0,
      )
      for (const onb of onbs) {
        const tarefas = app.findRecordsByFilter(
          'tarefas_onboarding',
          `onboarding_id = '${onb.id}' && (etapa = 2 || etapa = null || etapa = 0)`,
          '',
          100,
          0,
        )
        for (const t of tarefas) {
          if (!t.getString('fase')) {
            const tit = t.getString('titulo').toLowerCase()
            if (tit.includes('passportal') || tit.includes('document')) {
              if (fase1Id) {
                t.set('fase', fase1Id)
                app.save(t)
              }
            } else {
              if (fase2Id) {
                t.set('fase', fase2Id)
                app.save(t)
              }
            }
          }
        }
      }
    }
  },
  (app) => {
    try {
      const tarefasCol = app.findCollectionByNameOrId('tarefas_onboarding')
      if (tarefasCol.fields.getByName('fase')) {
        tarefasCol.fields.removeByName('fase')
        tarefasCol.removeIndex('idx_tarefas_onboarding_fase')
        app.save(tarefasCol)
      }
    } catch (_) {}

    try {
      const modeloCol = app.findCollectionByNameOrId('modelo_tarefas')
      if (modeloCol.fields.getByName('fase')) {
        modeloCol.fields.removeByName('fase')
        modeloCol.removeIndex('idx_modelo_tarefas_fase')
        app.save(modeloCol)
      }
    } catch (_) {}

    try {
      const fasesCol = app.findCollectionByNameOrId('fases_modelo')
      app.delete(fasesCol)
    } catch (_) {}
  },
)
