migrate(
  (app) => {
    // Garantir que o questionário padrão tenha exatamente o nome oficial solicitado:
    // "Prova de Windows — Atendimento e Suporte"
    try {
      const q = app.findFirstRecordByFilter(
        'questionarios',
        "tipo_de_uso = 'onboarding' && (setor ~ 'windows' || nome ~ 'Windows')",
      )
      q.set('nome', 'Prova de Windows — Atendimento e Suporte')
      q.set('setor', 'windows')
      q.set('tipo_de_uso', 'onboarding')
      if (!q.getFloat('percentual_aprovacao')) {
        q.set('percentual_aprovacao', 95)
      }
      q.set('ativo', true)
      app.save(q)
    } catch (_) {}
  },
  (app) => {
    // Reversão opcional (não destrutiva)
    try {
      const q = app.findFirstRecordByFilter(
        'questionarios',
        "nome = 'Prova de Windows — Atendimento e Suporte'",
      )
      q.set('nome', 'Windows — Onboarding')
      app.save(q)
    } catch (_) {}
  },
)
