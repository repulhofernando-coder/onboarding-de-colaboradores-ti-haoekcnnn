migrate(
  (app) => {
    // 1. Atualizar teste_questoes com campo tipo ('objetiva' | 'dissertativa')
    const questoesCol = app.findCollectionByNameOrId('teste_questoes')
    if (!questoesCol.fields.getByName('tipo')) {
      questoesCol.fields.add(
        new SelectField({
          name: 'tipo',
          required: false,
          values: ['objetiva', 'dissertativa'],
          maxSelect: 1,
        }),
      )
    }

    // Permitir correta_index e alternativas opcionais (para dissertativas)
    const corretaIndexField = questoesCol.fields.getByName('correta_index')
    if (corretaIndexField && corretaIndexField.required) {
      corretaIndexField.required = false
    }

    const alternativasField = questoesCol.fields.getByName('alternativas')
    if (alternativasField && alternativasField.required) {
      alternativasField.required = false
    }

    app.save(questoesCol)

    // 2. Atualizar candidatos com campo data_inicio_prova (para contagem do cronômetro de 60 min no servidor)
    const candidatosCol = app.findCollectionByNameOrId('candidatos')
    if (!candidatosCol.fields.getByName('data_inicio_prova')) {
      candidatosCol.fields.add(
        new TextField({
          name: 'data_inicio_prova',
          required: false,
        }),
      )
    }
    app.save(candidatosCol)

    // 3. Atualizar collection teste_tentativas: garantir que role gestao e rh também possam ler via API rule
    // RLS atual já é @request.auth.id != '' (ou seja, qualquer usuário logado já pode ver)
  },
  (app) => {
    try {
      const questoesCol = app.findCollectionByNameOrId('teste_questoes')
      const tipoF = questoesCol.fields.getByName('tipo')
      if (tipoF) {
        questoesCol.fields.removeByName('tipo')
        app.save(questoesCol)
      }
    } catch (_) {}

    try {
      const candCol = app.findCollectionByNameOrId('candidatos')
      const dtF = candCol.fields.getByName('data_inicio_prova')
      if (dtF) {
        candCol.fields.removeByName('data_inicio_prova')
        app.save(candCol)
      }
    } catch (_) {}
  },
)
