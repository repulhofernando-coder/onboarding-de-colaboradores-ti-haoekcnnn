migrate(
  (app) => {
    // Adicionar campo questoes_sorteadas (json) também em candidatos e onboardings
    // para permitir persistir as questões sorteadas na primeira abertura da prova pelo token/link público
    const candidatosCol = app.findCollectionByNameOrId('candidatos')
    if (!candidatosCol.fields.getByName('questoes_sorteadas')) {
      candidatosCol.fields.add(
        new JSONField({
          name: 'questoes_sorteadas',
          required: false,
        }),
      )
      app.save(candidatosCol)
    }

    const onboardingsCol = app.findCollectionByNameOrId('onboardings')
    if (!onboardingsCol.fields.getByName('questoes_sorteadas')) {
      onboardingsCol.fields.add(
        new JSONField({
          name: 'questoes_sorteadas',
          required: false,
        }),
      )
      app.save(onboardingsCol)
    }
  },
  (app) => {
    try {
      const cCol = app.findCollectionByNameOrId('candidatos')
      if (cCol.fields.getByName('questoes_sorteadas')) {
        cCol.fields.removeByName('questoes_sorteadas')
        app.save(cCol)
      }
    } catch (_) {}

    try {
      const oCol = app.findCollectionByNameOrId('onboardings')
      if (oCol.fields.getByName('questoes_sorteadas')) {
        oCol.fields.removeByName('questoes_sorteadas')
        app.save(oCol)
      }
    } catch (_) {}
  },
)
