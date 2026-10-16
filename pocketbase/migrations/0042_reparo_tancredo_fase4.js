migrate(
  (app) => {
    // Migration de reparo pontual de dados para homologação do Tancredo (id: tixph86fk07xpi1)
    // Remove a conclusão prematura da Fase 4 (8zvpwk2dutir91k), que ocorreu sem o colaborador
    // ter conseguido sinalizar com relato no portal devido ao botão oculto em fase sem tarefas.
    try {
      const onboarding = app.findRecordById('onboardings', 'tixph86fk07xpi1')
      if (!onboarding) return

      let fasesConcluidas = []
      try {
        const raw = onboarding.getString('fases_concluidas')
        if (raw) {
          fasesConcluidas = JSON.parse(raw) || []
        }
      } catch (_) {
        fasesConcluidas = []
      }

      // Filtra removendo qualquer conclusão de fase 4 (8zvpwk2dutir91k)
      // Mantém as fases 1 (dpmxnvnk4hhsl06), 2 (2laib7g9f4botiy) e 3 (frfzta6flikarv3)
      const filtered = fasesConcluidas.filter((fc) => fc.fase_id !== '8zvpwk2dutir91k')

      onboarding.set('fases_concluidas', JSON.stringify(filtered))
      app.save(onboarding)
    } catch (err) {
      // Se o registro não existir no ambiente de replicação, ignora graciosamente
      console.log(
        '[0042_reparo_tancredo_fase4] Registro tixph86fk07xpi1 não encontrado ou já tratado: ' +
          err,
      )
    }
  },
  (app) => {
    // Reversão não é necessária
  },
)
