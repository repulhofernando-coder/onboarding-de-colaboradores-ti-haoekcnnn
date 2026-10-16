migrate(
  (app) => {
    // Questionário de contratação
    const qid = 'vmtgh0y3nik89vo'
    const questoesCol = app.findCollectionByNameOrId('teste_questoes')

    // Verificar se já existem questões dissertativas
    const existentes = app.findRecordsByFilter(
      'teste_questoes',
      `questionario_id = '${qid}' && tipo = 'dissertativa'`,
      'ordem',
      10,
      0,
    )

    if (!existentes || existentes.length === 0) {
      // 1ª Questão Dissertativa: Resolução de Conflito e Comunicação com Cliente
      const q1 = new Record(questoesCol)
      q1.set('questionario_id', qid)
      q1.set('tipo', 'dissertativa')
      q1.set('ordem', 11)
      q1.set('tema', 'Comunicação e Resolução de Conflito com Cliente')
      q1.set(
        'enunciado',
        'Um usuário de nível executivo liga exaltado afirmando que perdeu um arquivo importante poucos minutos antes de uma reunião com o conselho da empresa e exige recuperação imediata, culpando a TI pelo ocorrido. Como você conduz esse atendimento, desde a abordagem inicial até a ação técnica de busca/restauração e alinhamento de expectativas?',
      )
      q1.set('alternativas', '[]')
      q1.set('correta_index', null)
      q1.set(
        'gabarito_comentario',
        'Critérios qualitativos esperados pelo Gestor de TI:\n1. Empatia e controle emocional: escuta ativa, sem confrontar ou rebater a exaltação do usuário, mantendo tom calmo e profissional.\n2. Alinhamento de expectativas: coletar detalhes objetivos com agilidade (nome do arquivo, pasta original, última modificação, se estava em nuvem/OneDrive/rede ou local).\n3. Ação técnica ordenada: verificar versões anteriores (Shadow Copy / VSS), histórico de versões do OneDrive/SharePoint, lixeira do sistema ou software de backup central.\n4. Transparência na comunicação: atualizar o usuário sobre o progresso sem prometer prazos irreais, informando os passos executados até a recuperação do arquivo.',
      )
      q1.set('ativo', true)
      app.save(q1)

      // 2ª Questão Dissertativa: Investigação de Incidente e Resolução Metódica
      const q2 = new Record(questoesCol)
      q2.set('questionario_id', qid)
      q2.set('tipo', 'dissertativa')
      q2.set('ordem', 12)
      q2.set('tema', 'Diagnóstico e Resolução Metódica de Incidentes')
      q2.set(
        'enunciado',
        'Descreva o passo a passo metódico que você adota ao investigar uma estação de trabalho com Windows que apresenta travamentos intermitentes e "telas azuis" (BSOD) sem motivo aparente. Quais ferramentas nativas ou de terceiros você utiliza e como documenta o chamado para o próximo nível técnico?',
      )
      q2.set('alternativas', '[]')
      q2.set('correta_index', null)
      q2.set(
        'gabarito_comentario',
        'Critérios qualitativos esperados pelo Gestor de TI:\n1. Coleta de evidências e logs: análise do Visualizador de Eventos do Windows (Event Viewer → Logs do Windows → Sistema/Aplicativo) filtrando por erros críticos; verificação de arquivos de despejo de memória minidump (C:\\Windows\\Minidump) usando BlueScreenView ou WinDbg.\n2. Verificação de hardware e integridade de arquivos: testes de memória RAM (Diagnóstico de Memória do Windows / MemTest), saúde do SSD/HDD (CrystalDiskInfo / SMART), temperatura e integridade do SO via comandos nativos (sfc /scannow e DISM /Online /Cleanup-Image /RestoreHealth).\n3. Checagem de atualizações e drivers: checar drivers recentes atualizados (GPU, rede, chipset) e reversão preventiva se o BSOD coincidir com atualização recente.\n4. Documentação de excelência no chamado: registrar código de parada exato (ex: CRITICAL_PROCESS_DIED, DPC_WATCHDOG_VIOLATION), driver causador identificado, testes executados com seus resultados e orientações claras caso o incidente precise escalar ao N2/N3.',
      )
      q2.set('ativo', true)
      app.save(q2)
    }
  },
  (app) => {
    try {
      const qid = 'vmtgh0y3nik89vo'
      const existentes = app.findRecordsByFilter(
        'teste_questoes',
        `questionario_id = '${qid}' && tipo = 'dissertativa'`,
        'ordem',
        10,
        0,
      )
      for (const rec of existentes) {
        app.delete(rec)
      }
    } catch (_) {}
  },
)
