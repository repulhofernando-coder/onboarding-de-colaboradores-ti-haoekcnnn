migrate(
  (app) => {
    // 1. Tornar o campo onboarding_id da coleção teste_tentativas opcional (nullable),
    // pois a prova de candidatos pré-selecionados reutiliza esta coleção e candidatos
    // ainda não possuem onboarding associado.
    const col = app.findCollectionByNameOrId('teste_tentativas')
    const onboardingField = col.fields.getByName('onboarding_id')

    if (onboardingField && onboardingField.required) {
      onboardingField.required = false
      app.save(col)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('teste_tentativas')
      const onboardingField = col.fields.getByName('onboarding_id')
      if (onboardingField) {
        onboardingField.required = true
        app.save(col)
      }
    } catch (_) {}
  },
)
