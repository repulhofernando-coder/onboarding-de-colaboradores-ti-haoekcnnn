migrate(
  (app) => {
    // Backfill do checklist_integracao e tarefas para onboardings que estejam com checklist vazio,
    // com foco primordial no onboarding de homologação do candidato "Tancredo" (ou qualquer outro
    // onboarding criado que não tenha recebido a lista de itens de integração).

    // 1. Carregar itens ativos de itens_integracao_modelo
    let itensModelo = []
    try {
      itensModelo = app.findRecordsByFilter(
        'itens_integracao_modelo',
        'ativo = true',
        'ordem,created',
        100,
        0,
      )
    } catch (err) {
      console.log('[Migration 0041] Erro ao buscar itens_integracao_modelo:', err)
    }

    const checklistSnapshot = itensModelo.map((item) => ({
      id: item.id,
      titulo: item.getString('titulo'),
      entregue: false,
    }))

    // 2. Localizar onboardings que tenham checklist_integracao vazio ou nulo
    let onboardings = []
    try {
      onboardings = app.findRecordsByFilter('onboardings', '', '-created', 200, 0)
    } catch (err) {
      console.log('[Migration 0041] Erro ao buscar onboardings:', err)
    }

    const tarefasCol = app.findCollectionByNameOrId('tarefas_onboarding')

    // Carregar templates da Etapa 1
    let templatesEtapa1 = []
    try {
      templatesEtapa1 = app.findRecordsByFilter(
        'modelo_tarefas',
        'etapa = 1',
        'ordem,titulo',
        100,
        0,
      )
    } catch (_) {}

    for (const onb of onboardings) {
      let checklistAtual = []
      try {
        const raw = onb.getString('checklist_integracao')
        if (raw && raw !== 'null') {
          checklistAtual = JSON.parse(raw)
        }
      } catch (_) {
        checklistAtual = onb.get('checklist_integracao') || []
      }

      const precisaChecklist = !Array.isArray(checklistAtual) || checklistAtual.length === 0

      if (precisaChecklist && checklistSnapshot.length > 0) {
        onb.set('checklist_integracao', checklistSnapshot)
        app.save(onb)
        console.log(
          `[Migration 0041] Checklist semeado para onboarding ${onb.id} (${onb.getString('colaborador_nome')})`,
        )
      }

      // Checar se possui tarefas de onboarding cadastradas
      const countTarefas = app.findRecordsByFilter(
        'tarefas_onboarding',
        `onboarding_id = '${onb.id}'`,
        'created',
        1,
        0,
      )

      if (countTarefas.length === 0) {
        // Semear Etapa 1
        for (const tpl of templatesEtapa1) {
          const novaT = new Record(tarefasCol)
          novaT.set('onboarding_id', onb.id)
          novaT.set('titulo', tpl.getString('titulo'))
          novaT.set('tipo', tpl.getString('tipo') || 'manual')
          novaT.set('descricao', tpl.getString('descricao'))
          novaT.set('etapa', 1)
          novaT.set('ordem', tpl.getInt('ordem') || 1)
          novaT.set('conteudo_url', tpl.getString('conteudo_url') || null)
          novaT.set('conteudo_link', tpl.getString('conteudo_link') || '')
          novaT.set('material', tpl.getString('material') || null)
          novaT.set('concluida', false)
          novaT.set('criado_automaticamente', true)
          app.save(novaT)
        }

        // Semear Etapa 2 de acordo com o setor
        const candSetor = onb.getString('setor') || ''
        const setorRefId = onb.getString('setor_ref') || ''
        const candSetorLower = candSetor.toLowerCase()

        let filterEtapa2 = `(setor = '${candSetorLower}' || setor = '${candSetor}' || setor ~ '${candSetor}'`
        if (setorRefId) {
          filterEtapa2 += ` || setor_ref = '${setorRefId}'`
        }
        filterEtapa2 += `) && (etapa = 2 || etapa = null || etapa = 0)`

        try {
          const templatesEtapa2 = app.findRecordsByFilter(
            'modelo_tarefas',
            filterEtapa2,
            'ordem,titulo',
            100,
            0,
          )
          for (const tpl of templatesEtapa2) {
            const novaT = new Record(tarefasCol)
            novaT.set('onboarding_id', onb.id)
            novaT.set('titulo', tpl.getString('titulo'))
            novaT.set('tipo', tpl.getString('tipo') || 'manual')
            novaT.set('descricao', tpl.getString('descricao'))
            novaT.set('etapa', 2)
            novaT.set('ordem', tpl.getInt('ordem') || 1)
            novaT.set('conteudo_url', tpl.getString('conteudo_url') || null)
            novaT.set('conteudo_link', tpl.getString('conteudo_link') || '')
            novaT.set('material', tpl.getString('material') || null)
            novaT.set('fase', tpl.getString('fase') || null)
            novaT.set('concluida', false)
            novaT.set('criado_automaticamente', true)
            app.save(novaT)
          }
        } catch (errEt2) {
          console.log(`[Migration 0041] Erro ao semear Etapa 2 para onboarding ${onb.id}:`, errEt2)
        }
      }
    }
  },
  (app) => {
    // Down migration no-op (dados de backfill não requerem deleção)
  },
)
