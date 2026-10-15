migrate(
  (app) => {
    // 1. Criar coleção questionarios
    let questionariosCol
    try {
      questionariosCol = app.findCollectionByNameOrId('questionarios')
    } catch (_) {
      questionariosCol = new Collection({
        name: 'questionarios',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.role = 'admin'",
        updateRule: "@request.auth.role = 'admin'",
        deleteRule: "@request.auth.role = 'admin'",
        fields: [
          { name: 'nome', type: 'text', required: true },
          { name: 'setor', type: 'text', required: false },
          { name: 'tipo_de_uso', type: 'text', required: true }, // 'onboarding', 'reciclagem', 'mudanca_area', 'contratacao'
          { name: 'percentual_aprovacao', type: 'number', required: false }, // padrão 95
          { name: 'ativo', type: 'bool', required: false },
          { name: 'descricao', type: 'text', required: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_questionarios_setor ON questionarios (setor)',
          'CREATE INDEX idx_questionarios_tipo ON questionarios (tipo_de_uso)',
          'CREATE INDEX idx_questionarios_ativo ON questionarios (ativo)',
        ],
      })
      app.save(questionariosCol)
    }

    const questionariosColId = questionariosCol.id

    // 2. Adicionar relation questionario_id em teste_questoes
    const questoesCol = app.findCollectionByNameOrId('teste_questoes')
    if (!questoesCol.fields.getByName('questionario_id')) {
      questoesCol.fields.add(
        new RelationField({
          name: 'questionario_id',
          required: false,
          collectionId: questionariosColId,
          cascadeDelete: true,
          maxSelect: 1,
        }),
      )
      app.save(questoesCol)
    }

    // 3. Adicionar campo questionario_id em teste_tentativas (para rastrear qual questionário cada tentativa usou)
    const tentativasCol = app.findCollectionByNameOrId('teste_tentativas')
    if (!tentativasCol.fields.getByName('questionario_id')) {
      tentativasCol.fields.add(
        new RelationField({
          name: 'questionario_id',
          required: false,
          collectionId: questionariosColId,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
      app.save(tentativasCol)
    }

    // 4. Adicionar campo questionarios_vinculados (json array) e questionario_id (relation principal da etapa 3) em onboardings
    const onboardingsCol = app.findCollectionByNameOrId('onboardings')
    if (!onboardingsCol.fields.getByName('questionarios_vinculados')) {
      onboardingsCol.fields.add(
        new JSONField({
          name: 'questionarios_vinculados',
          required: false,
        }),
      )
    }
    if (!onboardingsCol.fields.getByName('questionario_id')) {
      onboardingsCol.fields.add(
        new RelationField({
          name: 'questionario_id',
          required: false,
          collectionId: questionariosColId,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    }
    app.save(onboardingsCol)

    // 5. Semear/Garantir o Questionário "Windows" padrão
    let windowsQuest = null
    try {
      windowsQuest = app.findFirstRecordByFilter(
        'questionarios',
        "nome ~ 'Windows' && tipo_de_uso = 'onboarding'",
      )
    } catch (_) {
      windowsQuest = new Record(questionariosCol)
      windowsQuest.set('nome', 'Windows — Onboarding')
      windowsQuest.set('setor', 'windows')
      windowsQuest.set('tipo_de_uso', 'onboarding')
      windowsQuest.set('percentual_aprovacao', 95)
      windowsQuest.set('ativo', true)
      windowsQuest.set(
        'descricao',
        'Questionário oficial de conhecimento técnico em rotinas de suporte, atendimento e estações Windows.',
      )
      app.save(windowsQuest)
    }

    const windowsQuestId = windowsQuest.id

    // 6. Migrar as 20 questões existentes para dentro do questionário Windows (se ainda não vinculadas)
    try {
      const sqlUpdateQuestoes = `UPDATE teste_questoes SET questionario_id = {:qid} WHERE questionario_id IS NULL OR questionario_id = ''`
      app.db().newQuery(sqlUpdateQuestoes).bind({ qid: windowsQuestId }).execute()
    } catch (e) {
      console.log('[Migration 0030] Erro ao associar questoes existentes:', e)
    }

    // 7. Retrocompatibilidade: associar tentativas existentes e onboardings existentes ao questionário Windows
    try {
      const sqlUpdateTentativas = `UPDATE teste_tentativas SET questionario_id = {:qid} WHERE questionario_id IS NULL OR questionario_id = ''`
      app.db().newQuery(sqlUpdateTentativas).bind({ qid: windowsQuestId }).execute()
    } catch (e) {
      console.log('[Migration 0030] Erro ao associar tentativas existentes:', e)
    }

    try {
      const sqlUpdateOnboardings = `UPDATE onboardings SET questionario_id = {:qid} WHERE questionario_id IS NULL OR questionario_id = ''`
      app.db().newQuery(sqlUpdateOnboardings).bind({ qid: windowsQuestId }).execute()
    } catch (e) {
      console.log('[Migration 0030] Erro ao associar onboardings existentes:', e)
    }
  },
  (app) => {
    try {
      const questoesCol = app.findCollectionByNameOrId('teste_questoes')
      const f1 = questoesCol.fields.getByName('questionario_id')
      if (f1) questoesCol.fields.remove(f1)
      app.save(questoesCol)
    } catch (_) {}

    try {
      const tentativasCol = app.findCollectionByNameOrId('teste_tentativas')
      const f2 = tentativasCol.fields.getByName('questionario_id')
      if (f2) tentativasCol.fields.remove(f2)
      app.save(tentativasCol)
    } catch (_) {}

    try {
      const onboardingsCol = app.findCollectionByNameOrId('onboardings')
      const f3 = onboardingsCol.fields.getByName('questionarios_vinculados')
      if (f3) onboardingsCol.fields.remove(f3)
      const f4 = onboardingsCol.fields.getByName('questionario_id')
      if (f4) onboardingsCol.fields.remove(f4)
      app.save(onboardingsCol)
    } catch (_) {}

    try {
      const questionariosCol = app.findCollectionByNameOrId('questionarios')
      app.delete(questionariosCol)
    } catch (_) {}
  },
)
