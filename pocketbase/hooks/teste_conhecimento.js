/// <reference path="../pb_data/types.d.ts" />

/**
 * Endpoints pb_hooks para o Teste de Conhecimento da Etapa 3.
 * Suporta questionários independentes vinculados ao onboarding e
 * Banco de Questões com Sorteio de Objetivas (persistência na tentativa/onboarding).
 */

// 1. GET /backend/v1/teste-conhecimento/publico
routerAdd('GET', '/backend/v1/teste-conhecimento/publico', (e) => {
  try {
    const app = e.app || $app
    const token = (e.request.url.query().get('token') || '').trim()

    if (!token) {
      return e.json(400, { error: 'Token de acesso do colaborador é obrigatório.' })
    }

    let onboarding = null
    try {
      onboarding = app.findFirstRecordByData('onboardings', 'token_acesso_colaborador', token)
    } catch (_) {}

    if (!onboarding) {
      return e.json(404, { error: 'Onboarding não encontrado para o token fornecido.' })
    }

    const etapa2Concluida = onboarding.getBool('etapa2_concluida')
    if (!etapa2Concluida) {
      return e.json(200, {
        liberado: false,
        motivo: 'Aguardando conclusão da Etapa 2 (Vivência Técnica) pelo gestor.',
        onboardingNome: onboarding.getString('colaborador_nome'),
      })
    }

    // Buscar tentativas existentes para este onboarding
    let tentativas = []
    try {
      tentativas = app.findRecordsByFilter(
        'teste_tentativas',
        `onboarding_id = '${onboarding.id}'`,
        '-tentativa_numero',
        50,
        0,
      )
    } catch (_) {}

    const ultimaTentativa = tentativas && tentativas.length > 0 ? tentativas[0] : null
    const statusTeste = onboarding.getString('teste_conhecimento_status') || 'liberado'
    const retesteLiberado = statusTeste === 'reteste_liberado'

    // Se já respondeu e não tem reteste liberado: bloqueia exibição de novas respostas
    if (ultimaTentativa && !retesteLiberado) {
      return e.json(200, {
        liberado: false,
        jaSubmetido: true,
        dataSubmissao: ultimaTentativa.getString('data_submissao'),
        tentativaNumero: ultimaTentativa.getInt('tentativa_numero'),
        mensagem:
          'Seu teste de conhecimento já foi enviado com sucesso. Aguarde o retorno e parecer do seu Gestor Responsável para a avaliação final.',
        onboardingNome: onboarding.getString('colaborador_nome'),
      })
    }

    // Resolver o questionário vinculado (inline)
    let questRecord = null
    if (ultimaTentativa) {
      const qid = ultimaTentativa.getString('questionario_id')
      if (qid) {
        try {
          questRecord = app.findRecordById('questionarios', qid)
        } catch (_) {}
      }
    }

    if (!questRecord) {
      const directId = onboarding.getString('questionario_id')
      if (directId) {
        try {
          questRecord = app.findRecordById('questionarios', directId)
        } catch (_) {}
      }
    }

    if (!questRecord) {
      try {
        const rawVinculados = onboarding.getString('questionarios_vinculados')
        let ids = []
        if (rawVinculados) {
          try {
            ids = JSON.parse(rawVinculados)
          } catch (_) {}
        }
        if (Array.isArray(ids) && ids.length > 0) {
          const firstId = typeof ids[0] === 'string' ? ids[0] : ids[0]?.id
          if (firstId) {
            questRecord = app.findRecordById('questionarios', firstId)
          }
        }
      } catch (_) {}
    }

    if (!questRecord) {
      const setorOnb = onboarding.getString('setor') || ''
      if (setorOnb) {
        try {
          const qs = app.findRecordsByFilter(
            'questionarios',
            `ativo = true && tipo_de_uso = 'onboarding' && setor ~ '${setorOnb}'`,
            '-created',
            1,
            0,
          )
          if (qs && qs.length > 0) questRecord = qs[0]
        } catch (_) {}
      }
    }

    if (!questRecord) {
      try {
        questRecord = app.findFirstRecordByFilter(
          'questionarios',
          "nome ~ 'Windows' && tipo_de_uso = 'onboarding'",
        )
      } catch (_) {}
    }

    if (!questRecord) {
      try {
        const anyQ = app.findRecordsByFilter('questionarios', 'ativo = true', '-created', 1, 0)
        if (anyQ && anyQ.length > 0) questRecord = anyQ[0]
      } catch (_) {}
    }

    let todasQuestoes = []
    if (questRecord) {
      todasQuestoes = app.findRecordsByFilter(
        'teste_questoes',
        `ativo = true && questionario_id = '${questRecord.id}'`,
        'ordem',
        500,
        0,
      )
    }

    if (!todasQuestoes || todasQuestoes.length === 0) {
      todasQuestoes = app.findRecordsByFilter('teste_questoes', 'ativo = true', 'ordem', 500, 0)
    }

    // Separar objetivas e dissertativas
    const objetivas = todasQuestoes.filter(
      (q) => (q.getString('tipo') || 'objetiva') !== 'dissertativa',
    )
    const dissertativas = todasQuestoes.filter(
      (q) => (q.getString('tipo') || 'objetiva') === 'dissertativa',
    )

    // Quantidade configurável por questionário (padrão 20, mínimo 1)
    let questoesPorProva = questRecord ? questRecord.getInt('questoes_por_prova') : 20
    if (!questoesPorProva || questoesPorProva < 1) questoesPorProva = 20

    // MOTOR DE SORTEIO NO SERVIDOR:
    // Se a tentativa em andamento já tiver questões sorteadas persistidas no onboarding
    // E não for um novo reteste liberado (reteste resorteia entre todas), usar as persistidas!
    let idsSorteadasPersistidas = []
    try {
      const rawPersist = onboarding.getString('questoes_sorteadas')
      if (rawPersist) {
        const parsed = JSON.parse(rawPersist)
        if (Array.isArray(parsed) && parsed.length > 0) {
          idsSorteadasPersistidas = parsed
        }
      }
    } catch (_) {}

    let objetivasFinais = []

    if (idsSorteadasPersistidas.length > 0 && !retesteLiberado) {
      // Reconstitui na mesma ordem persistida
      const mapaObjetivas = {}
      for (const obj of objetivas) {
        mapaObjetivas[obj.id] = obj
      }
      for (const id of idsSorteadasPersistidas) {
        if (mapaObjetivas[id]) {
          objetivasFinais.push(mapaObjetivas[id])
        }
      }
      // Se por algum motivo alguma não foi encontrada, fallback
      if (objetivasFinais.length === 0) {
        objetivasFinais = objetivas.slice(0, questoesPorProva)
      }
    } else {
      // Realizar sorteio aleatório sem repetição (Fisher-Yates shuffle)
      const shuffled = objetivas.slice()
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const temp = shuffled[i]
        shuffled[i] = shuffled[j]
        shuffled[j] = temp
      }
      const qtdParaSortear = Math.min(questoesPorProva, shuffled.length)
      objetivasFinais = shuffled.slice(0, qtdParaSortear)

      // Persistir imediatamente os IDs sorteados no onboarding para retomadas consistentes
      const idsSorteadas = objetivasFinais.map((q) => q.id)
      try {
        onboarding.set('questoes_sorteadas', idsSorteadas)
        app.save(onboarding)
      } catch (errSaveSort) {
        console.warn(
          '[Teste Hook] Aviso ao persistir questoes_sorteadas no onboarding:',
          errSaveSort,
        )
      }
    }

    // As questões entregues na prova são as objetivas sorteadas + dissertativas (se houver, fora do sorteio)
    const questoesEntregues = [...objetivasFinais, ...dissertativas]

    // Sanitizar questões para o portal público: NUNCA enviar correta_index nem gabarito_comentario
    const questoesSanitizadas = questoesEntregues.map((q, index) => {
      let alternativas = []
      try {
        const raw = q.getString('alternativas')
        if (raw) alternativas = JSON.parse(raw)
      } catch (_) {
        alternativas = q.get('alternativas') || []
      }

      const tipoQ = q.getString('tipo') || 'objetiva'

      return {
        id: q.id,
        tipo: tipoQ,
        ordem: index + 1,
        tema: q.getString('tema'),
        enunciado: q.getString('enunciado'),
        alternativas: tipoQ === 'dissertativa' ? [] : alternativas,
      }
    })

    return e.json(200, {
      liberado: true,
      jaSubmetido: false,
      reteste: retesteLiberado,
      tentativaNumero: (tentativas.length || 0) + 1,
      totalQuestoes: questoesSanitizadas.length,
      totalObjetivas: objetivasFinais.length,
      totalDissertativas: dissertativas.length,
      questoes: questoesSanitizadas,
      colaboradorNome: onboarding.getString('colaborador_nome'),
      cargo: onboarding.getString('cargo'),
      questionarioNome: questRecord ? questRecord.getString('nome') : 'Teste de Conhecimento',
      questionarioId: questRecord ? questRecord.id : null,
      percentualAprovacao: questRecord ? questRecord.getFloat('percentual_aprovacao') || 95 : 95,
      bancoTotalObjetivas: objetivas.length,
      questoesPorProvaConfigurada: questoesPorProva,
    })
  } catch (err) {
    console.error('[Teste Hook /publico] Erro:', err)
    return e.json(500, { error: 'Erro interno ao carregar o teste de conhecimento.' })
  }
})

// 2. POST /backend/v1/teste-conhecimento/submeter
routerAdd('POST', '/backend/v1/teste-conhecimento/submeter', (e) => {
  try {
    const app = e.app || $app
    const rawBody = toString(e.request.body) || '{}'
    let data = {}
    try {
      data = JSON.parse(rawBody)
    } catch (_) {
      try {
        data = e.requestInfo().body || {}
      } catch (_) {
        data = {}
      }
    }

    const token = (data.token || '').trim()
    const respostasEnviadas = data.respostas || {} // { [questaoId]: number }

    if (!token) {
      return e.json(400, { error: 'Token de acesso do colaborador é obrigatório.' })
    }

    let onboarding = null
    try {
      onboarding = app.findFirstRecordByData('onboardings', 'token_acesso_colaborador', token)
    } catch (_) {}

    if (!onboarding) {
      return e.json(404, { error: 'Onboarding não encontrado para o token fornecido.' })
    }

    const etapa2Concluida = onboarding.getBool('etapa2_concluida')
    if (!etapa2Concluida) {
      return e.json(403, {
        error:
          'O teste de conhecimento só pode ser respondido após a conclusão formal da Etapa 2 pelo gestor.',
      })
    }

    // Verificar se já possui tentativa e se reteste está liberado
    let tentativasAnteriores = []
    try {
      tentativasAnteriores = app.findRecordsByFilter(
        'teste_tentativas',
        `onboarding_id = '${onboarding.id}'`,
        '-tentativa_numero',
        50,
        0,
      )
    } catch (_) {}

    const ultimaTentativa = tentativasAnteriores.length > 0 ? tentativasAnteriores[0] : null
    const statusAtual = onboarding.getString('teste_conhecimento_status') || 'liberado'
    if (tentativasAnteriores.length > 0 && statusAtual !== 'reteste_liberado') {
      return e.json(403, {
        error:
          'Você já enviou o teste de conhecimento. Novas tentativas dependem de liberação do Gestor Responsável.',
      })
    }

    // Resolver questionário
    let questRecord = null
    if (ultimaTentativa) {
      const qid = ultimaTentativa.getString('questionario_id')
      if (qid) {
        try {
          questRecord = app.findRecordById('questionarios', qid)
        } catch (_) {}
      }
    }

    if (!questRecord) {
      const directId = onboarding.getString('questionario_id')
      if (directId) {
        try {
          questRecord = app.findRecordById('questionarios', directId)
        } catch (_) {}
      }
    }

    if (!questRecord) {
      try {
        const rawVinculados = onboarding.getString('questionarios_vinculados')
        let ids = []
        if (rawVinculados) {
          try {
            ids = JSON.parse(rawVinculados)
          } catch (_) {}
        }
        if (Array.isArray(ids) && ids.length > 0) {
          const firstId = typeof ids[0] === 'string' ? ids[0] : ids[0]?.id
          if (firstId) {
            questRecord = app.findRecordById('questionarios', firstId)
          }
        }
      } catch (_) {}
    }

    if (!questRecord) {
      const setorOnb = onboarding.getString('setor') || ''
      if (setorOnb) {
        try {
          const qs = app.findRecordsByFilter(
            'questionarios',
            `ativo = true && tipo_de_uso = 'onboarding' && setor ~ '${setorOnb}'`,
            '-created',
            1,
            0,
          )
          if (qs && qs.length > 0) questRecord = qs[0]
        } catch (_) {}
      }
    }

    if (!questRecord) {
      try {
        questRecord = app.findFirstRecordByFilter(
          'questionarios',
          "nome ~ 'Windows' && tipo_de_uso = 'onboarding'",
        )
      } catch (_) {}
    }

    if (!questRecord) {
      try {
        const anyQ = app.findRecordsByFilter('questionarios', 'ativo = true', '-created', 1, 0)
        if (anyQ && anyQ.length > 0) questRecord = anyQ[0]
      } catch (_) {}
    }

    // Obter as questões sorteadas que foram fixadas no onboarding para esta prova
    let idsSorteadas = []
    try {
      const rawPersist = onboarding.getString('questoes_sorteadas')
      if (rawPersist) {
        const parsed = JSON.parse(rawPersist)
        if (Array.isArray(parsed) && parsed.length > 0) {
          idsSorteadas = parsed
        }
      }
    } catch (_) {}

    // Buscar questões do questionário
    let todasQuestoes = []
    if (questRecord) {
      todasQuestoes = app.findRecordsByFilter(
        'teste_questoes',
        `ativo = true && questionario_id = '${questRecord.id}'`,
        'ordem',
        500,
        0,
      )
    }

    if (!todasQuestoes || todasQuestoes.length === 0) {
      todasQuestoes = app.findRecordsByFilter('teste_questoes', 'ativo = true', 'ordem', 500, 0)
    }

    if (!todasQuestoes || todasQuestoes.length === 0) {
      return e.json(500, { error: 'Nenhuma questão cadastrada para este questionário.' })
    }

    const mapaTodas = {}
    for (const q of todasQuestoes) {
      mapaTodas[q.id] = q
    }

    // Reconstituir exatamente as questões sorteadas + dissertativas
    let questoesDaProva = []
    if (idsSorteadas.length > 0) {
      for (const id of idsSorteadas) {
        if (mapaTodas[id]) questoesDaProva.push(mapaTodas[id])
      }
      // Dissertativas sempre fora do sorteio
      const dissertativas = todasQuestoes.filter(
        (q) => (q.getString('tipo') || 'objetiva') === 'dissertativa',
      )
      for (const d of dissertativas) {
        if (!idsSorteadas.includes(d.id)) {
          questoesDaProva.push(d)
        }
      }
    } else {
      // Fallback de segurança se não havia sorteio persistido
      questoesDaProva = todasQuestoes
    }

    // Validação: todas as questões da prova sorteada devem estar respondidas
    const faltantes = []
    questoesDaProva.forEach((q, idx) => {
      const resp = respostasEnviadas[q.id]
      if (resp === undefined || resp === null || resp === '') {
        faltantes.push(idx + 1)
      }
    })

    if (faltantes.length > 0) {
      return e.json(400, {
        error: `Existem ${faltantes.length} questão(ões) não respondida(s): Questão(ões) ${faltantes.join(', ')}. Responda todas as ${questoesDaProva.length} questões para enviar.`,
        faltantes: faltantes,
      })
    }

    // Correção automática segura no servidor
    let acertos = 0
    let totalObjetivas = 0
    let totalDissertativas = 0
    const totalQuestoes = questoesDaProva.length
    const mapaRespostas = []
    const idsEfetivamenteSorteadas = []

    questoesDaProva.forEach((q, idx) => {
      const tipoQ = q.getString('tipo') || 'objetiva'

      if (tipoQ === 'dissertativa') {
        totalDissertativas++
        mapaRespostas.push({
          questao_id: q.id,
          tipo: 'dissertativa',
          ordem: idx + 1,
          tema: q.getString('tema'),
          enunciado: q.getString('enunciado'),
          texto_respondido: String(respostasEnviadas[q.id] || ''),
          gabarito_comentario: q.getString('gabarito_comentario'),
          correta: null,
        })
      } else {
        totalObjetivas++
        idsEfetivamenteSorteadas.push(q.id)
        const respostaEscolhida = Number(respostasEnviadas[q.id])
        const corretaIndex = q.getInt('correta_index')
        const acertou = respostaEscolhida === corretaIndex
        if (acertou) acertos++

        let alternativas = []
        try {
          const raw = q.getString('alternativas')
          if (raw) alternativas = JSON.parse(raw)
        } catch (_) {
          alternativas = q.get('alternativas') || []
        }

        mapaRespostas.push({
          questao_id: q.id,
          tipo: 'objetiva',
          ordem: idx + 1,
          tema: q.getString('tema'),
          enunciado: q.getString('enunciado'),
          alternativas: alternativas,
          resposta_escolhida: respostaEscolhida,
          correta_index: corretaIndex,
          correta: acertou,
          gabarito_comentario: q.getString('gabarito_comentario'),
        })
      }
    })

    // RÉGUA DE APROVAÇÃO COM ARREDONDAMENTO PARA CIMA:
    // minimo_acertos = ceil(0.95 * total_objetivas_sorteadas)
    // Se a prova tiver 20 questões: ceil(0.95 * 20) = ceil(19) = 19 (1 erro permitido).
    // Se a prova tiver 10 questões: ceil(0.95 * 10) = ceil(9.5) = 10 (nenhum erro permitido).
    const divisor = totalObjetivas > 0 ? totalObjetivas : totalQuestoes
    const percentual = Number(((acertos / divisor) * 100).toFixed(1))
    const reguaConfigurada = questRecord
      ? questRecord.getFloat('percentual_aprovacao') || 95.0
      : 95.0
    const minimoAcertosExigido = Math.ceil((reguaConfigurada / 100.0) * divisor)
    const aprovado = acertos >= minimoAcertosExigido

    const novaTentativaNumero = tentativasAnteriores.length + 1
    const agoraIso = new Date().toISOString()
    let ipOrigem = ''
    try {
      ipOrigem = e.request.header.get('x-forwarded-for') || e.request.remoteAddr || ''
    } catch (_) {}

    // Salvar na coleção teste_tentativas com privilégio de sistema
    const tentativasCol = app.findCollectionByNameOrId('teste_tentativas')
    const tentativaRec = new Record(tentativasCol)
    tentativaRec.set('onboarding_id', onboarding.id)
    tentativaRec.set('tentativa_numero', novaTentativaNumero)
    tentativaRec.set('respostas', mapaRespostas)
    tentativaRec.set('total_questoes', totalQuestoes)
    tentativaRec.set('acertos', acertos)
    tentativaRec.set('percentual', percentual)
    tentativaRec.set('aprovado', aprovado)
    tentativaRec.set('data_submissao', agoraIso)
    tentativaRec.set('ip', ipOrigem)
    tentativaRec.set('reteste_liberado', false)
    tentativaRec.set('questoes_sorteadas', idsEfetivamenteSorteadas)
    if (questRecord) {
      tentativaRec.set('questionario_id', questRecord.id)
    }
    app.save(tentativaRec)

    // Atualizar onboarding
    const novoStatus = aprovado ? 'aprovado' : 'reprovado'
    onboarding.set('teste_conhecimento_status', novoStatus)
    onboarding.set('teste_ultima_nota', acertos)
    onboarding.set('teste_ultimo_percentual', percentual)
    onboarding.set('teste_tentativas_count', novaTentativaNumero)
    if (questRecord && !onboarding.getString('questionario_id')) {
      onboarding.set('questionario_id', questRecord.id)
    }
    app.save(onboarding)

    const colabNome = onboarding.getString('colaborador_nome') || 'Colaborador'
    const qNome = questRecord ? questRecord.getString('nome') : 'Questionário'

    // Registrar log de auditoria oficial
    let gestorNome = ''
    let gestorEmail = ''
    const gestorId = onboarding.getString('gestor_id')
    if (gestorId) {
      try {
        const gestor = app.findRecordById('users', gestorId)
        if (gestor) {
          gestorNome = gestor.getString('name') || ''
          gestorEmail = gestor.getString('email') || ''
        }
      } catch (_) {}
    }

    try {
      const logsCol = app.findCollectionByNameOrId('logs_auditoria')
      const logRecord = new Record(logsCol)
      logRecord.set('onboarding_id', onboarding.id)
      logRecord.set('colaborador_nome', colabNome)
      logRecord.set('usuario_id', null)
      logRecord.set('usuario_nome', colabNome)
      logRecord.set('usuario_role', 'colaborador')
      logRecord.set('gestor_nome', gestorNome)
      logRecord.set(
        'acao',
        `Submissão do Teste de Conhecimento (Tentativa #${novaTentativaNumero})`,
      )
      logRecord.set(
        'detalhes',
        `Colaborador enviou o questionário "${qNome}" (${totalObjetivas} objetivas sorteadas). Resultado: ${acertos}/${totalObjetivas} (${percentual}%). Mínimo exigido pela régua (${reguaConfigurada}%): ${minimoAcertosExigido} acertos. Status: ${aprovado ? 'APROVADO' : 'REPROVADO'}.`,
      )
      logRecord.set('fora_prazo', false)
      logRecord.set('destaque_prazo', '')
      logRecord.set('metadata', {
        questionario_id: questRecord ? questRecord.id : null,
        questionario_nome: qNome,
        tentativa_numero: novaTentativaNumero,
        acertos: acertos,
        total_questoes: totalQuestoes,
        total_objetivas: totalObjetivas,
        minimo_acertos_exigido: minimoAcertosExigido,
        percentual: percentual,
        regua_aprovacao: reguaConfigurada,
        aprovado: aprovado,
        questoes_sorteadas: idsEfetivamenteSorteadas,
        data_submissao: agoraIso,
        ip: ipOrigem,
      })
      app.save(logRecord)
    } catch (errLog) {
      console.error('[Teste Hook] Erro ao registrar log de auditoria:', errLog)
    }

    // Disparar e-mail de notificação ao Gestor Responsável
    if (gestorEmail) {
      try {
        const appUrl = 'https://onboarding-de-colaboradores-ti-8af12.goskip.app'
        const onboardingUrl = `${appUrl}/colaboradores/${onboarding.id}`
        const statusBadge = aprovado
          ? `<span style="color: #16a34a; font-weight: bold;">APROVADO (${acertos}/${divisor} &gt;= ${minimoAcertosExigido})</span>`
          : `<span style="color: #dc2626; font-weight: bold;">REPROVADO (${acertos}/${divisor} &lt; ${minimoAcertosExigido})</span>`

        const emailHtml = `
          <!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 24px;">
            <table role="presentation" width="100%" style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden;">
              <tr><td style="background: #0284c7; padding: 20px 24px; color: #ffffff;">
                <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #bae6fd;">Onboarding de TI — Etapa 3</span>
                <h1 style="margin: 6px 0 0; font-size: 18px; color: #ffffff;">Teste de Conhecimento Concluído</h1>
              </td></tr>
              <tr><td style="padding: 24px; font-size: 14px; line-height: 1.6; color: #334155;">
                <p>Olá, <strong>${gestorNome || 'Gestor'}</strong>,</p>
                <p>O colaborador <strong>${colabNome}</strong> concluiu o questionário <strong>${qNome}</strong> de ${totalQuestoes} questões sobre rotinas de TI.</p>
                <div style="background-color: #f1f5f9; border-left: 4px solid ${aprovado ? '#16a34a' : '#dc2626'}; border-radius: 4px; padding: 14px 18px; margin: 18px 0;">
                  <p style="margin: 0 0 6px;"><strong>Colaborador:</strong> ${colabNome}</p>
                  <p style="margin: 0 0 6px;"><strong>Questionário:</strong> ${qNome}</p>
                  <p style="margin: 0 0 6px;"><strong>Tentativa:</strong> #${novaTentativaNumero}</p>
                  <p style="margin: 0 0 6px;"><strong>Nota:</strong> ${acertos} de ${totalObjetivas} objetivas sorteadas (${percentual}%)</p>
                  <p style="margin: 0 0 6px;"><strong>Resultado:</strong> ${statusBadge}</p>
                  <p style="margin: 0;"><strong>Régua de Aprovação:</strong> ${reguaConfigurada}% (mínimo exigido: ${minimoAcertosExigido} acertos)</p>
                </div>
                ${
                  !aprovado
                    ? '<p style="color: #b91c1c; font-size: 13px;"><em>Atenção:</em> O colaborador obteve aproveitamento abaixo da régua. Acesse a página do onboarding para decidir entre liberar um <strong>Reteste</strong> ou registrar <strong>Não Apto</strong> na Avaliação Final.</p>'
                    : '<p style="color: #15803d; font-size: 13px;">O colaborador atingiu o critério de aprovação e está pronto para a reunião de avaliação final com você.</p>'
                }
                <div style="margin: 24px 0 10px; text-align: center;">
                  <a href="${onboardingUrl}" style="display: inline-block; background-color: #0284c7; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 24px; border-radius: 6px;">Acessar Onboarding</a>
                </div>
              </td></tr>
            </table>
          </body></html>
        `
        try {
          const s = app.settings()
          const senderAddr =
            (s && s.meta && s.meta.senderAddress) || 'no-reply@onboarding-ti.goskip.app'
          const senderName = (s && s.meta && s.meta.senderName) || 'Onboarding TI'
          const mailSubject = `[Onboarding TI] Teste de Conhecimento: ${colabNome} obteve ${percentual}% (${aprovado ? 'Aprovado' : 'Reprovado'})`
          const msg = new MailerMessage({
            from: { address: senderAddr, name: senderName },
            to: [{ address: gestorEmail.trim(), name: gestorNome || '' }],
            subject: mailSubject,
            html: emailHtml,
          })
          app.newMailClient().send(msg)
        } catch (mailSendErr) {
          console.error('[Teste Hook] Falha no envio de e-mail ao gestor:', mailSendErr)
        }
      } catch (errMail) {
        console.error('[Teste Hook] Erro ao enviar e-mail ao gestor:', errMail)
      }
    }

    // Resposta para o colaborador: CONFIRMAÇÃO SEM NOTA E SEM GABARITO
    return e.json(200, {
      success: true,
      mensagem:
        'Teste enviado com sucesso! Suas respostas foram computadas e seu Gestor Responsável foi notificado para prosseguir com a Etapa 3.',
    })
  } catch (err) {
    console.error('[Teste Hook /submeter] Erro geral:', err)
    return e.json(500, { error: 'Erro interno ao submeter o teste de conhecimento.' })
  }
})

// 3. POST /backend/v1/teste-conhecimento/liberar-reteste
routerAdd('POST', '/backend/v1/teste-conhecimento/liberar-reteste', (e) => {
  try {
    const app = e.app || $app
    const rawBody = toString(e.request.body) || '{}'
    let data = {}
    try {
      data = JSON.parse(rawBody)
    } catch (_) {
      try {
        data = e.requestInfo().body || {}
      } catch (_) {
        data = {}
      }
    }

    const onboardingId = (data.onboardingId || '').trim()
    const motivo = (data.motivo || '').trim()
    const usuarioId = (data.usuarioId || '').trim()
    const usuarioNome = (data.usuarioNome || '').trim()
    const usuarioRole = (data.usuarioRole || '').trim()

    if (!onboardingId) {
      return e.json(400, { error: 'ID do onboarding é obrigatório.' })
    }

    let onboarding = null
    try {
      onboarding = app.findRecordById('onboardings', onboardingId)
    } catch (_) {}

    if (!onboarding) {
      return e.json(404, { error: 'Onboarding não encontrado.' })
    }

    // Verificar se o status atual permite reteste
    const statusAtual = onboarding.getString('teste_conhecimento_status')
    if (statusAtual === 'reteste_liberado') {
      return e.json(400, {
        error: 'O reteste já está liberado para o colaborador no portal público.',
      })
    }

    const agoraIso = new Date().toISOString()
    onboarding.set('teste_conhecimento_status', 'reteste_liberado')
    // DECISÃO 3: RETESTE SORTEIA NOVAMENTE ENTRE TODAS (sem excluir vistas).
    // Limpamos o campo questoes_sorteadas para forçar novo sorteio ao abrir o teste
    onboarding.set('questoes_sorteadas', [])
    app.save(onboarding)

    const colabNome = onboarding.getString('colaborador_nome') || 'Colaborador'
    let gestorNome = ''
    const gestorId = onboarding.getString('gestor_id')
    if (gestorId) {
      try {
        const gestor = app.findRecordById('users', gestorId)
        if (gestor) gestorNome = gestor.getString('name') || ''
      } catch (_) {}
    }

    // Atualizar última tentativa se houver
    let questionarioIdReteste = onboarding.getString('questionario_id')
    try {
      const tentativas = app.findRecordsByFilter(
        'teste_tentativas',
        `onboarding_id = '${onboarding.id}'`,
        '-tentativa_numero',
        1,
        0,
      )
      if (tentativas && tentativas.length > 0) {
        tentativas[0].set('reteste_liberado', true)
        tentativas[0].set('reteste_liberado_em', agoraIso)
        tentativas[0].set('reteste_liberado_por', usuarioNome || 'Gestor')
        app.save(tentativas[0])
        if (!questionarioIdReteste && tentativas[0].getString('questionario_id')) {
          questionarioIdReteste = tentativas[0].getString('questionario_id')
        }
      }
    } catch (_) {}

    // Registrar log de auditoria oficial
    try {
      const logsCol = app.findCollectionByNameOrId('logs_auditoria')
      const logRecord = new Record(logsCol)
      logRecord.set('onboarding_id', onboarding.id)
      logRecord.set('colaborador_nome', colabNome)
      logRecord.set('usuario_id', usuarioId || null)
      logRecord.set('usuario_nome', usuarioNome || 'Gestor')
      logRecord.set('usuario_role', usuarioRole || 'gestao')
      logRecord.set('gestor_nome', gestorNome)
      logRecord.set('acao', 'Liberação de Reteste do Teste de Conhecimento')
      logRecord.set(
        'detalhes',
        `Reteste autorizado por ${usuarioNome} (${usuarioRole}). Motivo: ${motivo || 'Revisão com o colaborador antes da reavaliação'}. O portal público foi liberado para nova tentativa com novo sorteio aleatório de questões objetivas do banco.`,
      )
      logRecord.set('fora_prazo', false)
      logRecord.set('destaque_prazo', '')
      logRecord.set('metadata', {
        motivo: motivo,
        liberado_em: agoraIso,
        liberado_por: usuarioNome,
        questionario_id: questionarioIdReteste,
      })
      app.save(logRecord)
    } catch (errLog) {
      console.error('[Teste Hook] Erro ao registrar log de reteste:', errLog)
    }

    return e.json(200, {
      success: true,
      message: 'Reteste liberado com sucesso. O colaborador já pode refazer o teste no portal.',
      onboarding: onboarding,
    })
  } catch (err) {
    console.error('[Teste Hook /liberar-reteste] Erro:', err)
    return e.json(500, { error: 'Erro interno ao liberar reteste.' })
  }
})

// 4. GET /backend/v1/teste-conhecimento/tentativas/:onboardingId
routerAdd('GET', '/backend/v1/teste-conhecimento/tentativas/{onboardingId}', (e) => {
  try {
    const app = e.app || $app
    const onboardingId = e.request.pathValue('onboardingId')
    const roleParam = (e.request.url.query().get('role') || '').trim().toLowerCase()

    if (!onboardingId) {
      return e.json(400, { error: 'ID do onboarding é obrigatório.' })
    }

    let tentativas = []
    try {
      tentativas = app.findRecordsByFilter(
        'teste_tentativas',
        `onboarding_id = '${onboardingId}'`,
        '-tentativa_numero',
        50,
        0,
      )
    } catch (_) {}

    const isAdmin = roleParam === 'admin'

    const formatadas = tentativas.map((t) => {
      let respostas = []
      try {
        const raw = t.getString('respostas')
        if (raw) respostas = JSON.parse(raw)
      } catch (_) {
        respostas = t.get('respostas') || []
      }

      let questoesSorteadas = []
      try {
        const rawSort = t.getString('questoes_sorteadas')
        if (rawSort) questoesSorteadas = JSON.parse(rawSort)
      } catch (_) {
        questoesSorteadas = t.get('questoes_sorteadas') || []
      }

      let questionarioNome = ''
      const qid = t.getString('questionario_id')
      if (qid) {
        try {
          const qrec = app.findRecordById('questionarios', qid)
          if (qrec) questionarioNome = qrec.getString('nome')
        } catch (_) {}
      }

      const base = {
        id: t.id,
        tentativa_numero: t.getInt('tentativa_numero'),
        total_questoes: t.getInt('total_questoes'),
        acertos: t.getInt('acertos'),
        percentual: t.getFloat('percentual'),
        aprovado: t.getBool('aprovado'),
        data_submissao: t.getString('data_submissao'),
        reteste_liberado: t.getBool('reteste_liberado'),
        questionario_id: qid || '',
        questionario_nome: questionarioNome,
        questoes_sorteadas: questoesSorteadas,
        created: t.getString('created'),
      }

      if (isAdmin) {
        // Admin vê mapa completo das questões sorteadas e respondidas na tentativa
        base.respostas_detalhe = respostas
      }

      return base
    })

    return e.json(200, {
      tentativas: formatadas,
      totalTentativas: formatadas.length,
      isAdmin: isAdmin,
    })
  } catch (err) {
    console.error('[Teste Hook /tentativas] Erro:', err)
    return e.json(500, { error: 'Erro interno ao consultar tentativas.' })
  }
})
