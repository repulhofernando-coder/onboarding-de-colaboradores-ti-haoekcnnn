migrate(
  (app) => {
    // 1. Atualizar coleção modelo_tarefas para permitir setor opcional (pois Etapa 1 é institucional para todos os setores)
    // e adicionar campo etapa (number, 1 ou 2, padrão 2 para os existentes)
    const modeloCol = app.findCollectionByNameOrId('modelo_tarefas')

    // Permitir setor opcional em modelo_tarefas
    const setorField = modeloCol.fields.getByName('setor')
    if (setorField) {
      setorField.required = false
    }

    // Adicionar campo etapa em modelo_tarefas se não existir
    if (!modeloCol.fields.getByName('etapa')) {
      modeloCol.fields.add(
        new NumberField({
          name: 'etapa',
          required: false,
          min: 1,
          max: 2,
          onlyInt: true,
        }),
      )
    }

    // Adicionar campo descricao em modelo_tarefas se não existir (para manter os detalhes institucionais da Etapa 1)
    if (!modeloCol.fields.getByName('descricao')) {
      modeloCol.fields.add(
        new TextField({
          name: 'descricao',
          required: false,
        }),
      )
    }

    app.save(modeloCol)

    // Atualizar registros existentes de modelo_tarefas para etapa = 2 se ainda estiver nulo ou 0
    app
      .db()
      .newQuery('UPDATE modelo_tarefas SET etapa = 2 WHERE etapa IS NULL OR etapa = 0')
      .execute()

    // 2. Atualizar tarefas_onboarding para adicionar campo etapa e descricao
    const tarefasCol = app.findCollectionByNameOrId('tarefas_onboarding')

    if (!tarefasCol.fields.getByName('etapa')) {
      tarefasCol.fields.add(
        new NumberField({
          name: 'etapa',
          required: false,
          min: 1,
          max: 2,
          onlyInt: true,
        }),
      )
    }

    if (!tarefasCol.fields.getByName('descricao')) {
      tarefasCol.fields.add(
        new TextField({
          name: 'descricao',
          required: false,
        }),
      )
    }

    if (!tarefasCol.fields.getByName('ordem')) {
      tarefasCol.fields.add(
        new NumberField({
          name: 'ordem',
          required: false,
          onlyInt: true,
        }),
      )
    }

    app.save(tarefasCol)

    // Atualizar tarefas existentes para etapa = 2 se etapa estiver vazia
    app
      .db()
      .newQuery('UPDATE tarefas_onboarding SET etapa = 2 WHERE etapa IS NULL OR etapa = 0')
      .execute()

    // 3. Cadastrar os 3 itens padrão da Etapa 1 em modelo_tarefas (idempotente)
    const etapa1ItensPadrao = [
      {
        titulo: 'Apresentação Institucional & Cultura da Empresa',
        tipo: 'manual',
        descricao:
          'Visão geral da empresa, valores, conduta ética e estrutura de comunicação interna.',
        ordem: 1,
      },
      {
        titulo: 'Segmentação dos 5 Setores e Fluxo de Atendimento',
        tipo: 'video',
        descricao:
          'Explicação dos setores (Windows, Linux, Datacenter, Campo, Infra), escalonamento e transição de chamados.',
        ordem: 2,
      },
      {
        titulo: 'Regras de Atendimento Remoto (TeamViewer) e Telefone',
        tipo: 'manual',
        descricao:
          'Protocolo de atendimento telefônico, identificação e boas práticas em acessos remotos aos clientes.',
        ordem: 3,
      },
    ]

    for (const item of etapa1ItensPadrao) {
      const existing = app.findRecordsByFilter(
        'modelo_tarefas',
        `etapa = 1 && titulo = '${item.titulo}'`,
        '',
        1,
        0,
      )

      if (existing.length === 0) {
        const record = new Record(modeloCol)
        record.set('titulo', item.titulo)
        record.set('tipo', item.tipo)
        record.set('descricao', item.descricao)
        record.set('etapa', 1)
        record.set('setor', '')
        record.set('conteudo_link', '')
        record.set('obrigatorio', true)
        record.set('ordem', item.ordem)
        app.save(record)
      }
    }

    // 4. Buscar todos os onboardings existentes e popular as tarefas da Etapa 1 a partir dos modelos da Etapa 1
    const onboardings = app.findRecordsByFilter('onboardings', '', 'created', 1000, 0)
    const modelosEtapa1 = app.findRecordsByFilter('modelo_tarefas', 'etapa = 1', 'ordem', 100, 0)

    for (const onb of onboardings) {
      // Verificar se já possui tarefas da Etapa 1
      const tarefasExistentesE1 = app.findRecordsByFilter(
        'tarefas_onboarding',
        `onboarding_id = '${onb.id}' && etapa = 1`,
        'created',
        100,
        0,
      )

      if (tarefasExistentesE1.length === 0) {
        const isEtapa1Concluida = onb.getBool('etapa1_concluida')

        for (const tpl of modelosEtapa1) {
          const tRec = new Record(tarefasCol)
          tRec.set('onboarding_id', onb.id)
          tRec.set('titulo', tpl.getString('titulo'))
          tRec.set('tipo', tpl.getString('tipo'))
          tRec.set('descricao', tpl.getString('descricao'))
          tRec.set('etapa', 1)
          tRec.set('ordem', tpl.getInt('ordem'))
          tRec.set('conteudo_url', tpl.getString('conteudo_url') || '')
          tRec.set('conteudo_link', tpl.getString('conteudo_link') || '')
          tRec.set('concluida', isEtapa1Concluida)
          if (isEtapa1Concluida) {
            tRec.set(
              'concluida_em',
              onb.getString('data_conclusao_etapa1') || new Date().toISOString(),
            )
          }
          tRec.set('criado_automaticamente', true)
          app.save(tRec)
        }
      }
    }
  },
  (app) => {
    // Reverter apenas as tarefas criadas da etapa 1 e remover modelos da etapa 1
    try {
      app.db().newQuery('DELETE FROM tarefas_onboarding WHERE etapa = 1').execute()
      app.db().newQuery('DELETE FROM modelo_tarefas WHERE etapa = 1').execute()
    } catch (_) {}
  },
)
