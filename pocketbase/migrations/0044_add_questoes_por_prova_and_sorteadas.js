migrate(
  (app) => {
    // 1. Adicionar campo questoes_por_prova (integer, min 1) na coleção questionarios
    const questionariosCol = app.findCollectionByNameOrId('questionarios')
    if (!questionariosCol.fields.getByName('questoes_por_prova')) {
      questionariosCol.fields.add(
        new NumberField({
          name: 'questoes_por_prova',
          required: false,
          onlyInt: true,
          min: 1,
        }),
      )
      app.save(questionariosCol)
    }

    // Backfill: questionários existentes recebem questoes_por_prova = 20
    app
      .db()
      .newQuery(`
      UPDATE questionarios
      SET questoes_por_prova = 20
      WHERE questoes_por_prova IS NULL OR questoes_por_prova <= 0
    `)
      .execute()

    // 2. Adicionar campo questoes_sorteadas (json) na coleção teste_tentativas
    const tentativasCol = app.findCollectionByNameOrId('teste_tentativas')
    if (!tentativasCol.fields.getByName('questoes_sorteadas')) {
      tentativasCol.fields.add(
        new JSONField({
          name: 'questoes_sorteadas',
          required: false,
        }),
      )
      app.save(tentativasCol)
    }

    // 3. Adicionar campo questoes_sorteadas (json) na coleção avaliacoes_colaborador (para persistir o sorteio antes da submissão da avaliação avulsa)
    const avaliacoesCol = app.findCollectionByNameOrId('avaliacoes_colaborador')
    if (!avaliacoesCol.fields.getByName('questoes_sorteadas')) {
      avaliacoesCol.fields.add(
        new JSONField({
          name: 'questoes_sorteadas',
          required: false,
        }),
      )
      app.save(avaliacoesCol)
    }
  },
  (app) => {
    try {
      const qCol = app.findCollectionByNameOrId('questionarios')
      if (qCol.fields.getByName('questoes_por_prova')) {
        qCol.fields.removeByName('questoes_por_prova')
        app.save(qCol)
      }
    } catch (_) {}

    try {
      const tCol = app.findCollectionByNameOrId('teste_tentativas')
      if (tCol.fields.getByName('questoes_sorteadas')) {
        tCol.fields.removeByName('questoes_sorteadas')
        app.save(tCol)
      }
    } catch (_) {}

    try {
      const aCol = app.findCollectionByNameOrId('avaliacoes_colaborador')
      if (aCol.fields.getByName('questoes_sorteadas')) {
        aCol.fields.removeByName('questoes_sorteadas')
        app.save(aCol)
      }
    } catch (_) {}
  },
)
