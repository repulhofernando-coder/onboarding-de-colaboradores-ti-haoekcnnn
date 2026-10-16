/// <reference path="../pb_data/types.d.ts" />

/**
 * Endpoints pb_hooks para o Módulo de Pré-selecionados (Candidatos).
 * Implementa Prova Técnica com Banco de Questões e Sorteio de Objetivas,
 * cronômetro de 60 min, dissertativas fora do sorteio e régua 95% arredondada para cima.
 */

// --------------------------------------------------------------------------------------
// 1. GET /backend/v1/candidato/prova/publico
//    Retorna os dados públicos da prova técnica para o candidato realizar
// --------------------------------------------------------------------------------------
routerAdd('GET', '/backend/v1/candidato/prova/publico', (e) => {
  try {
    const app = e.app || $app
    const token = (e.request.url.query().get('token') || '').trim()

    if (!token) {
      return e.json(400, { error: 'Token de acesso do candidato é obrigatório.' })
    }

    let candidato = null
    try {
      candidato = app.findFirstRecordByData('candidatos', 'token_publico', token)
    } catch (_) {}

    if (!candidato) {
      return e.json(404, { error: 'Candidato não encontrado para o token fornecido.' })
    }

    const candStatus = candidato.getString('status')
    // Link morre se candidato for reprovado ou se desistir
    if (candStatus === 'reprovado' || candStatus === 'desistiu') {
      return e.json(403, {
        error: 'Este link de avaliação não está mais ativo.',
        motivo:
          candStatus === 'desistiu'
            ? 'Processo encerrado por desistência'
            : 'Candidato não aprovado no processo',
      })
    }

    // REGRA DE OURO: SEM RETESTE — o pré-candidato tem APENAS UMA tentativa
    if (
      candidato.getString('data_conclusao_prova') ||
      candStatus === 'prova_concluida' ||
      candStatus === 'aprovado' ||
      candStatus === 'aprovado_aguardando_rh' ||
      candStatus === 'convertido'
    ) {
      return e.json(200, {
        liberado: false,
        jaSubmetido: true,
        dataConclusao: candidato.getString('data_conclusao_prova'),
        mensagem:
          'Sua prova de conhecimento já foi enviada com sucesso. Agradecemos sua participação! A equipe de RH e Gestão entrará em contato.',
        candidatoNome: candidato.getString('nome'),
      })
    }

    // Resolver o questionário vinculado ao candidato
    let questRecord = null
    const qid = candidato.getString('questionario_id')
    if (qid) {
      try {
        questRecord = app.findRecordById('questionarios', qid)
      } catch (_) {}
    }

    // Se o candidato ainda não tiver questionário amarrado, busca o primeiro compatível com o setor
    if (!questRecord) {
      const setorCand = candidato.getString('setor') || ''
      if (setorCand) {
        try {
          const qs = app.findRecordsByFilter(
            'questionarios',
            `ativo = true && setor ~ '${setorCand}'`,
            '-tipo_de_uso,-created',
            1,
            0,
          )
          if (qs && qs.length > 0) questRecord = qs[0]
        } catch (_) {}
      }
    }

    // Fallback global caso ainda não encontre
    if (!questRecord) {
      try {
        const anyQ = app.findRecordsByFilter('questionarios', 'ativo = true', '-created', 1, 0)
        if (anyQ && anyQ.length > 0) questRecord = anyQ[0]
      } catch (_) {}
    }

    if (!questRecord) {
      return e.json(404, { error: 'Nenhuma prova disponível para este candidato no momento.' })
    }

    // Carregar questões do questionário
    let todasQuestoes = app.findRecordsByFilter(
      'teste_questoes',
      `ativo = true && questionario_id = '${questRecord.id}'`,
      'ordem',
      500,
      0,
    )

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
    let questoesPorProva = questRecord.getInt('questoes_por_prova') || 20
    if (questoesPorProva < 1) questoesPorProva = 20

    // MOTOR DE SORTEIO NO SERVIDOR:
    // Persistência em candidato.questoes_sorteadas para manter as mesmas questões ao recarregar a página
    let idsSorteadasPersistidas = []
    try {
      const rawPersist = candidato.getString('questoes_sorteadas')
      if (rawPersist) {
        const parsed = JSON.parse(rawPersist)
        if (Array.isArray(parsed) && parsed.length > 0) {
          idsSorteadasPersistidas = parsed
        }
      }
    } catch (_) {}

    let objetivasFinais = []
    if (idsSorteadasPersistidas.length > 0) {
      // Reconstituir exatamente as questões sorteadas na primeira abertura
      const mapaObjetivas = {}
      for (const obj of objetivas) {
        mapaObjetivas[obj.id] = obj
      }
      for (const id of idsSorteadasPersistidas) {
        if (mapaObjetivas[id]) {
          objetivasFinais.push(mapaObjetivas[id])
        }
      }
      if (objetivasFinais.length === 0) {
        objetivasFinais = objetivas.slice(0, questoesPorProva)
      }
    } else {
      // Sorteio aleatório sem repetição (Fisher-Yates)
      const shuffled = objetivas.slice()
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const temp = shuffled[i]
        shuffled[i] = shuffled[j]
        shuffled[j] = temp
      }
      const qtdParaSortear = Math.min(questoesPorProva, shuffled.length)
      objetivasFinais = shuffled.slice(0, qtdParaSortear)

      // Persistir imediatamente na ficha do candidato
      const idsSorteadas = objetivasFinais.map((q) => q.id)
      try {
        candidato.set('questoes_sorteadas', idsSorteadas)
        app.save(candidato)
      } catch (errSortPersist) {
        console.warn(
          '[Candidatos Hook] Erro ao persistir questoes_sorteadas no candidato:',
          errSortPersist,
        )
      }
    }

    // REGRA DECIDIDA: DISSERTATIVAS SEMPRE PRESENTES FORA DO SORTEIO
    const questoesEntregues = [...objetivasFinais, ...dissertativas]

    // REGRA DE CRONÔMETRO DE 60 MINUTOS (Somente na prova do pré-candidato):
    // O tempo começa a contar no servidor na PRIMEIRA abertura do link público (data_inicio_prova).
    // Se o candidato já abriu antes, mantemos a data gravada.
    const agoraIso = new Date().toISOString()
    let dataInicioProva = candidato.getString('data_inicio_prova')
    if (!dataInicioProva) {
      dataInicioProva = agoraIso
      candidato.set('data_inicio_prova', agoraIso)
      app.save(candidato)
    }

    // Calcular segundos restantes (limite total = 60 minutos = 3600 segundos)
    const duracaoTotalSegundos = 60 * 60
    const inicioMs = new Date(dataInicioProva).getTime()
    const agoraMs = new Date(agoraIso).getTime()
    const decorridoSegundos = Math.max(0, Math.floor((agoraMs - inicioMs) / 1000))
    const segundosRestantes = Math.max(0, duracaoTotalSegundos - decorridoSegundos)

    // Sanitizar questões para o portal público: NUNCA enviar correta_index nem gabarito_comentario
    const questoesSanitizadas = questoesEntregues.map((q, idx) => {
      let alternativas = []
      try {
        const raw = q.getString('alternativas')
        if (raw) alternativas = JSON.parse(raw)
      } catch (_) {
        alternativas = q.get('alternativas') || []
      }

      const tipoQuestao = q.getString('tipo') || 'objetiva'

      return {
        id: q.id,
        tipo: tipoQuestao,
        ordem: idx + 1,
        tema: q.getString('tema'),
        enunciado: q.getString('enunciado'),
        alternativas: tipoQuestao === 'dissertativa' ? [] : alternativas,
      }
    })

    return e.json(200, {
      liberado: true,
      jaSubmetido: false,
      candidatoNome: candidato.getString('nome'),
      cargoPretendido: candidato.getString('cargo_pretendido'),
      setor: candidato.getString('setor'),
      questionarioNome: questRecord.getString('nome'),
      questionarioDescricao: questRecord.getString('descricao'),
      totalQuestoes: questoesSanitizadas.length,
      totalObjetivas: objetivasFinais.length,
      totalDissertativas: dissertativas.length,
      bancoTotalObjetivas: objetivas.length,
      questoesPorProvaConfigurada: questoesPorProva,
      questoes: questoesSanitizadas,
      // Dados do cronômetro de 60 min (servidor)
      duracaoMinutos: 60,
      dataInicioProva: dataInicioProva,
      segundosRestantes: segundosRestantes,
      expirado: segundosRestantes <= 0,
    })
  } catch (err) {
    console.error('[Candidato Hook /prova/publico] Erro:', err)
    return e.json(500, { error: 'Erro ao carregar a prova do candidato.' })
  }
})

// --------------------------------------------------------------------------------------
// 2. POST /backend/v1/candidato/prova/submeter
// --------------------------------------------------------------------------------------
routerAdd('POST', '/backend/v1/candidato/prova/submeter', (e) => {
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
    const dissertativasEnviadas = data.dissertativas || {} // { [questaoId]: string }
    const porExpiracaoTempo = Boolean(data.porExpiracaoTempo) // true se envio automático pelo cronômetro ao zerar

    if (!token) {
      return e.json(400, { error: 'Token de acesso do candidato é obrigatório.' })
    }

    let candidato = null
    try {
      candidato = app.findFirstRecordByData('candidatos', 'token_publico', token)
    } catch (_) {}

    if (!candidato) {
      return e.json(404, { error: 'Candidato não encontrado para o token fornecido.' })
    }

    const candStatus = candidato.getString('status')
    // Link morre para reprovado ou desistência
    if (candStatus === 'reprovado' || candStatus === 'desistiu') {
      return e.json(403, { error: 'Este link de avaliação não está mais ativo.' })
    }

    // REGRA DE OURO: SEM RETESTE — única tentativa
    if (
      candidato.getString('data_conclusao_prova') ||
      candStatus === 'prova_concluida' ||
      candStatus === 'aprovado' ||
      candStatus === 'aprovado_aguardando_rh' ||
      candStatus === 'convertido'
    ) {
      return e.json(403, {
        error: 'Esta prova já foi respondida. Não são permitidas novas tentativas.',
      })
    }

    // Questionário vinculado
    const qid = candidato.getString('questionario_id')
    let questRecord = null
    if (qid) {
      try {
        questRecord = app.findRecordById('questionarios', qid)
      } catch (_) {}
    }

    if (!questRecord) {
      try {
        const anyQ = app.findRecordsByFilter('questionarios', 'ativo = true', '-created', 1, 0)
        if (anyQ && anyQ.length > 0) questRecord = anyQ[0]
      } catch (_) {}
    }

    if (!questRecord) {
      return e.json(500, { error: 'Nenhum questionário cadastrado para esta prova.' })
    }

    // Obter as questões sorteadas persistidas no candidato
    let idsSorteadas = []
    try {
      const rawPersist = candidato.getString('questoes_sorteadas')
      if (rawPersist) {
        const parsed = JSON.parse(rawPersist)
        if (Array.isArray(parsed) && parsed.length > 0) {
          idsSorteadas = parsed
        }
      }
    } catch (_) {}

    // Buscar questões do questionário
    let todasQuestoes = app.findRecordsByFilter(
      'teste_questoes',
      `ativo = true && questionario_id = '${questRecord.id}'`,
      'ordem',
      500,
      0,
    )

    if (!todasQuestoes || todasQuestoes.length === 0) {
      todasQuestoes = app.findRecordsByFilter('teste_questoes', 'ativo = true', 'ordem', 500, 0)
    }

    if (!todasQuestoes || todasQuestoes.length === 0) {
      return e.json(500, { error: 'Nenhuma questão cadastrada para esta prova.' })
    }

    const mapaTodas = {}
    for (const q of todasQuestoes) {
      mapaTodas[q.id] = q
    }

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
      questoesDaProva = todasQuestoes
    }

    // CHECAGEM DO CRONÔMETRO (60 MINUTOS):
    const agoraIso = new Date().toISOString()
    const dataInicioProvaStr = candidato.getString('data_inicio_prova')
    if (dataInicioProvaStr) {
      const inicioMs = new Date(dataInicioProvaStr).getTime()
      const agoraMs = new Date(agoraIso).getTime()
      const decorridoSeg = Math.floor((agoraMs - inicioMs) / 1000)
      const toleranciaSeg = 120 // 2 minutos de tolerância para envio de rede
      if (decorridoSeg > 3600 + toleranciaSeg && !porExpiracaoTempo) {
        return e.json(403, {
          error: 'O tempo limite de 60 minutos para a realização desta prova encerrou.',
          expirado: true,
        })
      }
    }

    // Identificar questões objetivas e dissertativas
    const faltantes = []
    questoesDaProva.forEach((q, idx) => {
      const tipoQ = q.getString('tipo') || 'objetiva'
      if (tipoQ === 'dissertativa') {
        const txt = dissertativasEnviadas[q.id]
        if (!porExpiracaoTempo && (!txt || typeof txt !== 'string' || txt.trim().length === 0)) {
          faltantes.push(idx + 1)
        }
      } else {
        const resp = respostasEnviadas[q.id]
        if (!porExpiracaoTempo && (resp === undefined || resp === null || resp === '')) {
          faltantes.push(idx + 1)
        }
      }
    })

    if (faltantes.length > 0 && !porExpiracaoTempo) {
      return e.json(400, {
        error: `Existem ${faltantes.length} questão(ões) não respondida(s): Questão(ões) ${faltantes.join(', ')}. Responda todas para enviar.`,
        faltantes: faltantes,
      })
    }

    // Correção no servidor:
    // Dissertativas NÃO têm peso na nota automática. A nota vem SOMENTE das objetivas sorteadas.
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
        const textoRespondido = (dissertativasEnviadas[q.id] || '').trim()

        mapaRespostas.push({
          questao_id: q.id,
          tipo: 'dissertativa',
          ordem: idx + 1,
          tema: q.getString('tema'),
          enunciado: q.getString('enunciado'),
          texto_respondido: textoRespondido,
          gabarito_comentario: q.getString('gabarito_comentario'),
          correta: null, // Dissertativa não possui correção automática booleana
        })
      } else {
        totalObjetivas++
        idsEfetivamenteSorteadas.push(q.id)
        const respRaw = respostasEnviadas[q.id]
        const temResposta = respRaw !== undefined && respRaw !== null && respRaw !== ''
        const respostaEscolhida = temResposta ? Number(respRaw) : -1
        const corretaIndex = q.getInt('correta_index')
        const acertou = temResposta && respostaEscolhida === corretaIndex
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

    // RÉGUA 95% ARREDONDADA PARA CIMA:
    // minimo_acertos = ceil(0.95 * total_objetivas_sorteadas)
    const divisor = totalObjetivas > 0 ? totalObjetivas : totalQuestoes
    const percentual = Number(((acertos / divisor) * 100).toFixed(1))
    const reguaAprovacao = questRecord.getFloat('percentual_aprovacao') || 95.0
    const minimoAcertosExigido = Math.ceil((reguaAprovacao / 100.0) * divisor)
    const aprovadoTeste = acertos >= minimoAcertosExigido

    let ipOrigem = ''
    try {
      ipOrigem = e.request.header.get('x-forwarded-for') || e.request.remoteAddr || ''
    } catch (_) {}

    // Validação defensiva: garantir que a coleção teste_tentativas não exija onboarding_id
    const tentativasCol = app.findCollectionByNameOrId('teste_tentativas')
    try {
      const obField = tentativasCol.fields.getByName('onboarding_id')
      if (obField && obField.required) {
        obField.required = false
        app.save(tentativasCol)
      }
    } catch (fieldErr) {
      console.warn('[Candidato Hook /prova/submeter] Aviso ao checar onboarding_id:', fieldErr)
    }

    // Gravar tentativa em teste_tentativas com privilégio de sistema
    const tentativaRec = new Record(tentativasCol)
    tentativaRec.set('candidato_id', candidato.id)
    tentativaRec.set('onboarding_id', null)
    tentativaRec.set('tentativa_numero', 1)
    tentativaRec.set('respostas', mapaRespostas)
    tentativaRec.set('total_questoes', totalQuestoes)
    tentativaRec.set('acertos', acertos)
    tentativaRec.set('percentual', percentual)
    tentativaRec.set('aprovado', aprovadoTeste)
    tentativaRec.set('data_submissao', agoraIso)
    tentativaRec.set('ip', ipOrigem)
    tentativaRec.set('reteste_liberado', false)
    tentativaRec.set('questoes_sorteadas', idsEfetivamenteSorteadas)
    tentativaRec.set('questionario_id', questRecord.id)
    app.save(tentativaRec)

    // Atualizar candidato
    candidato.set('tentativa_id', tentativaRec.id)
    candidato.set('nota_acertos', acertos)
    candidato.set('total_questoes', totalQuestoes)
    candidato.set('percentual_obtido', percentual)
    candidato.set('aprovado_teste', aprovadoTeste)
    candidato.set('data_conclusao_prova', agoraIso)
    candidato.set('status', 'prova_concluida')
    if (!candidato.getString('questionario_id')) {
      candidato.set('questionario_id', questRecord.id)
    }
    app.save(candidato)

    const candNome = candidato.getString('nome') || 'Candidato'
    const cargoCand = candidato.getString('cargo_pretendido') || 'Cargo de TI'
    const setorCand = candidato.getString('setor') || 'TI'
    const qNome = questRecord.getString('nome')

    // Registrar log de auditoria oficial
    try {
      const logsCol = app.findCollectionByNameOrId('logs_auditoria')
      const logRecord = new Record(logsCol)
      logRecord.set('onboarding_id', null)
      logRecord.set('colaborador_nome', candNome)
      logRecord.set('usuario_id', null)
      logRecord.set('usuario_nome', candNome)
      logRecord.set('usuario_role', 'candidato')
      logRecord.set('gestor_nome', '')
      logRecord.set('acao', 'Conclusão de Prova Técnica (Pré-selecionado)')
      logRecord.set(
        'detalhes',
        `Candidato concluiu a prova "${qNome}"${porExpiracaoTempo ? ' (Envio automático por término do tempo de 60 min)' : ''}. Resultado: ${acertos}/${totalObjetivas} objetivas sorteadas (${percentual}%). Mínimo exigido (${reguaAprovacao}%): ${minimoAcertosExigido} acertos. ${totalDissertativas} questão(ões) dissertativa(s) respondida(s) para análise qualitativa do gestor. Status no teste: ${aprovadoTeste ? `Atingiu a régua` : `Abaixo da régua`}. Decisão final do Gestor pendente.`,
      )
      logRecord.set('fora_prazo', false)
      logRecord.set('destaque_prazo', '')
      logRecord.set('metadata', {
        candidato_id: candidato.id,
        candidato_nome: candNome,
        cargo_pretendido: cargoCand,
        setor: setorCand,
        questionario_id: questRecord.id,
        questionario_nome: qNome,
        acertos: acertos,
        total_questoes: totalQuestoes,
        total_objetivas: totalObjetivas,
        minimo_acertos_exigido: minimoAcertosExigido,
        percentual: percentual,
        regua_aprovacao: reguaAprovacao,
        aprovado_teste: aprovadoTeste,
        questoes_sorteadas: idsEfetivamenteSorteadas,
        data_conclusao: agoraIso,
      })
      app.save(logRecord)
    } catch (errLog) {
      console.error('[Candidatos Hook] Erro ao registrar log de auditoria:', errLog)
    }

    // Notificar Gestores e Admin por e-mail via SMTP
    try {
      const destinatarios = app.findRecordsByFilter(
        'users',
        "ativo = true && (role = 'admin' || role = 'gestao')",
        'name',
        50,
        0,
      )

      const appUrl = 'https://onboarding-de-colaboradores-ti-8af12.goskip.app'
      const preSelUrl = `${appUrl}/pre-selecionados`

      const statusBadge = aprovadoTeste
        ? `<span style="color: #16a34a; font-weight: bold;">Acima da régua (${acertos}/${divisor} &gt;= ${minimoAcertosExigido} acertos, ${percentual}%)</span>`
        : `<span style="color: #dc2626; font-weight: bold;">Abaixo da régua (${acertos}/${divisor} &lt; ${minimoAcertosExigido} acertos, ${percentual}%)</span>`

      const emailHtml = `
        <!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 24px;">
          <table role="presentation" width="100%" style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden;">
            <tr><td style="background: #1e293b; padding: 20px 24px; color: #ffffff;">
              <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #38bdf8;">Módulo Pré-selecionados — Avaliação Técnica</span>
              <h1 style="margin: 6px 0 0; font-size: 18px; color: #ffffff;">Prova de Conhecimento Concluída</h1>
            </td></tr>
            <tr><td style="padding: 24px; font-size: 14px; line-height: 1.6; color: #334155;">
              <p>Olá, <strong>Gestor de TI</strong>,</p>
              <p>O candidato pré-selecionado <strong>${candNome}</strong> (${cargoCand} — Área: ${setorCand}) acabou de finalizar a prova técnica.</p>
              <div style="background-color: #f1f5f9; border-left: 4px solid ${aprovadoTeste ? '#16a34a' : '#dc2626'}; border-radius: 4px; padding: 14px 18px; margin: 18px 0;">
                <p style="margin: 0 0 6px;"><strong>Candidato:</strong> ${candNome}</p>
                <p style="margin: 0 0 6px;"><strong>Cargo Pretendido:</strong> ${cargoCand}</p>
                <p style="margin: 0 0 6px;"><strong>Área / Setor:</strong> ${setorCand}</p>
                <p style="margin: 0 0 6px;"><strong>Prova:</strong> ${qNome}</p>
                <p style="margin: 0 0 6px;"><strong>Nota / Desempenho:</strong> ${acertos} de ${totalObjetivas} objetivas sorteadas (${percentual}%)</p>
                <p style="margin: 0 0 6px;"><strong>Resultado do Teste:</strong> ${statusBadge}</p>
                <p style="margin: 0;"><strong>Régua de Referência:</strong> ${reguaAprovacao}% (mínimo exigido: ${minimoAcertosExigido} acertos)</p>
              </div>
              <p style="color: #475569; font-size: 13px;">
                Lembramos que a <strong>decisão final de aprovação ou reprovação para a vaga cabe a você, Gestor da Área</strong>. A nota acima serve como insumo da 2ª etapa.
              </p>
              <div style="margin: 24px 0 10px; text-align: center;">
                <a href="${preSelUrl}" style="display: inline-block; background-color: #0284c7; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 24px; border-radius: 6px;">Acessar Painel de Pré-selecionados</a>
              </div>
            </td></tr>
          </table>
        </body></html>
      `

      let senderAddr = 'no-reply@onboarding-ti.goskip.app'
      let senderName = 'Onboarding TI'
      try {
        const s = app.settings()
        if (s && s.meta && s.meta.senderAddress) senderAddr = s.meta.senderAddress
        if (s && s.meta && s.meta.senderName) senderName = s.meta.senderName
      } catch (_) {}

      for (const dest of destinatarios) {
        const destEmail = dest.getString('email')
        const destNome = dest.getString('name')
        if (destEmail && destEmail.trim() !== '') {
          try {
            const msg = new MailerMessage({
              from: { address: senderAddr, name: senderName },
              to: [{ address: destEmail.trim(), name: destNome || '' }],
              subject: `[Pré-selecionado TI] Prova Concluída: ${candNome} (${cargoCand}) obteve ${percentual}%`,
              html: emailHtml,
            })
            app.newMailClient().send(msg)
          } catch (mErr) {
            console.error('[Candidatos Hook] Falha ao enviar para:', destEmail, mErr)
          }
        }
      }
    } catch (errMail) {
      console.error('[Candidatos Hook] Falha no bloco de e-mails:', errMail)
    }

    // Retorno ao candidato: CONFIRMAÇÃO SEM NOTA E SEM GABARITO
    return e.json(200, {
      success: true,
      mensagem:
        'Sua prova foi enviada com sucesso! Suas respostas foram salvas e a equipe de gestão da área entrará em contato.',
    })
  } catch (err) {
    console.error('[Candidato Hook /prova/submeter] Erro:', err)
    return e.json(500, { error: 'Erro interno ao submeter a prova do candidato.' })
  }
})

// --------------------------------------------------------------------------------------
// 3. POST /backend/v1/candidatos/decidir
//    Decisão do Gestor (aprovado -> aprovado_aguardando_rh / reprovado)
// --------------------------------------------------------------------------------------
routerAdd('POST', '/backend/v1/candidatos/decidir', (e) => {
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

    const candidatoId = (data.candidatoId || '').trim()
    const decisao = (data.decisao || '').trim().toLowerCase() // 'aprovado' | 'reprovado'
    const motivo = (data.motivo || '').trim()
    const usuarioId = (data.usuarioId || '').trim()
    const usuarioNome = (data.usuarioNome || '').trim()
    const usuarioRole = (data.usuarioRole || '').trim()

    if (!candidatoId) {
      return e.json(400, { error: 'ID do candidato é obrigatório.' })
    }

    if (decisao !== 'aprovado' && decisao !== 'reprovado') {
      return e.json(400, { error: 'Decisão deve ser "aprovado" ou "reprovado".' })
    }

    let candidato = null
    try {
      candidato = app.findRecordById('candidatos', candidatoId)
    } catch (_) {}

    if (!candidato) {
      return e.json(404, { error: 'Candidato não encontrado.' })
    }

    const agoraIso = new Date().toISOString()
    const novoStatus = decisao === 'aprovado' ? 'aprovado_aguardando_rh' : 'reprovado'
    candidato.set('status', novoStatus)
    candidato.set('decidido_por', usuarioId || null)
    candidato.set('data_decisao', agoraIso)
    if (decisao === 'reprovado' && motivo) {
      candidato.set('motivo_reprovacao', motivo)
    }
    app.save(candidato)

    const candNome = candidato.getString('nome') || 'Candidato'
    const cargoCand = candidato.getString('cargo_pretendido') || 'Cargo de TI'
    const setorCand = candidato.getString('setor') || 'TI'

    // Registrar log de auditoria
    try {
      const logsCol = app.findCollectionByNameOrId('logs_auditoria')
      const logRecord = new Record(logsCol)
      logRecord.set('onboarding_id', null)
      logRecord.set('colaborador_nome', candNome)
      logRecord.set('usuario_id', usuarioId || null)
      logRecord.set('usuario_nome', usuarioNome || 'Gestor')
      logRecord.set('usuario_role', usuarioRole || 'gestao')
      logRecord.set('gestor_nome', usuarioNome || 'Gestor')
      logRecord.set(
        'acao',
        decisao === 'aprovado'
          ? 'Aprovação Técnica do Gestor (Aguardando RH)'
          : 'Reprovação de Candidato pelo Gestor',
      )
      logRecord.set(
        'detalhes',
        `Avaliação técnica registrada por ${usuarioNome} (${usuarioRole}). Candidato: ${candNome} (${cargoCand} - ${setorCand}). Resultado: ${
          decisao === 'aprovado'
            ? 'APROVADO PELO GESTOR (Encaminhado para formalização do RH)'
            : 'REPROVADO'
        }${motivo ? `. Motivo: ${motivo}` : ''}.`,
      )
      logRecord.set('fora_prazo', false)
      logRecord.set('destaque_prazo', '')
      logRecord.set('metadata', {
        candidato_id: candidato.id,
        candidato_nome: candNome,
        decisao: decisao,
        status_novo: novoStatus,
        motivo: motivo,
        data_decisao: agoraIso,
        decidido_por: usuarioNome,
        autor_role: usuarioRole,
      })
      app.save(logRecord)
    } catch (errLog) {
      console.error('[Candidatos Hook /decidir] Erro ao gravar log:', errLog)
    }

    return e.json(200, {
      success: true,
      message:
        decisao === 'aprovado'
          ? 'Candidato aprovado com sucesso! Encaminhado para formalização do RH.'
          : 'Candidato reprovado com sucesso.',
      candidato: candidato,
    })
  } catch (err) {
    console.error('[Candidatos Hook /decidir] Erro:', err)
    return e.json(500, { error: 'Erro ao registrar decisão do candidato.' })
  }
})

// --------------------------------------------------------------------------------------
// 3.1 POST /backend/v1/candidatos/desistencia
//     Registro de desistência pelo RH / Admin
// --------------------------------------------------------------------------------------
routerAdd('POST', '/backend/v1/candidatos/desistencia', (e) => {
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

    const candidatoId = (data.candidatoId || '').trim()
    const motivo = (data.motivo || '').trim()
    const usuarioId = (data.usuarioId || '').trim()
    const usuarioNome = (data.usuarioNome || '').trim()
    const usuarioRole = (data.usuarioRole || '').trim().toLowerCase()

    if (!candidatoId) {
      return e.json(400, { error: 'ID do candidato é obrigatório.' })
    }

    if (usuarioRole !== 'rh' && usuarioRole !== 'admin') {
      return e.json(403, { error: 'Apenas RH ou Administrador podem registrar desistência.' })
    }

    let candidato = null
    try {
      candidato = app.findRecordById('candidatos', candidatoId)
    } catch (_) {}

    if (!candidato) {
      return e.json(404, { error: 'Candidato não encontrado.' })
    }

    if (candidato.getString('status') === 'convertido') {
      return e.json(400, { error: 'Candidato já convertido em colaborador.' })
    }

    const agoraIso = new Date().toISOString()
    candidato.set('status', 'desistiu')
    if (motivo) {
      candidato.set('motivo_desistencia', motivo)
    }
    candidato.set('rh_responsavel', usuarioId || null)
    candidato.set('data_formalizacao_rh', agoraIso)
    app.save(candidato)

    const candNome = candidato.getString('nome') || 'Candidato'
    const cargoCand = candidato.getString('cargo_pretendido') || 'Cargo de TI'
    const setorCand = candidato.getString('setor') || 'TI'

    // Registrar log de auditoria
    try {
      const logsCol = app.findCollectionByNameOrId('logs_auditoria')
      const logRecord = new Record(logsCol)
      logRecord.set('onboarding_id', null)
      logRecord.set('colaborador_nome', candNome)
      logRecord.set('usuario_id', usuarioId || null)
      logRecord.set('usuario_nome', usuarioNome || 'RH')
      logRecord.set('usuario_role', usuarioRole || 'rh')
      logRecord.set('gestor_nome', '')
      logRecord.set('acao', 'Registro de Desistência do Candidato (RH)')
      logRecord.set(
        'detalhes',
        `Desistência registrada por ${usuarioNome} (${usuarioRole}). Candidato: ${candNome} (${cargoCand} - ${setorCand})${
          motivo ? `. Motivo: ${motivo}` : ''
        }. O link da prova foi invalidado e o processo encerrado.`,
      )
      logRecord.set('fora_prazo', false)
      logRecord.set('destaque_prazo', '')
      logRecord.set('metadata', {
        candidato_id: candidato.id,
        candidato_nome: candNome,
        motivo_desistencia: motivo,
        registrado_por: usuarioNome,
        autor_role: usuarioRole,
        data: agoraIso,
      })
      app.save(logRecord)
    } catch (errLog) {
      console.error('[Candidatos Hook /desistencia] Erro ao gravar log:', errLog)
    }

    return e.json(200, {
      success: true,
      message: 'Desistência registrada com sucesso. Cartão arquivado no histórico.',
      candidato: candidato,
    })
  } catch (err) {
    console.error('[Candidatos Hook /desistencia] Erro:', err)
    return e.json(500, { error: 'Erro ao registrar desistência do candidato.' })
  }
})

// --------------------------------------------------------------------------------------
// 3.2 POST /backend/v1/candidatos/reprovar-rh
//     Reprovação com critério próprio pelo RH / Admin (ex.: pretensão salarial, contato)
// --------------------------------------------------------------------------------------
routerAdd('POST', '/backend/v1/candidatos/reprovar-rh', (e) => {
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

    const candidatoId = (data.candidatoId || '').trim()
    const motivo = (data.motivo || '').trim()
    const usuarioId = (data.usuarioId || '').trim()
    const usuarioNome = (data.usuarioNome || '').trim()
    const usuarioRole = (data.usuarioRole || '').trim().toLowerCase()

    if (!candidatoId) {
      return e.json(400, { error: 'ID do candidato é obrigatório.' })
    }

    if (usuarioRole !== 'rh' && usuarioRole !== 'admin') {
      return e.json(403, { error: 'Apenas RH ou Administrador podem reprovar nesta etapa.' })
    }

    let candidato = null
    try {
      candidato = app.findRecordById('candidatos', candidatoId)
    } catch (_) {}

    if (!candidato) {
      return e.json(404, { error: 'Candidato não encontrado.' })
    }

    if (candidato.getString('status') === 'convertido') {
      return e.json(400, { error: 'Candidato já convertido em colaborador.' })
    }

    const agoraIso = new Date().toISOString()
    candidato.set('status', 'reprovado')
    if (motivo) {
      candidato.set('motivo_reprovacao', motivo)
    }
    candidato.set('rh_responsavel', usuarioId || null)
    candidato.set('data_formalizacao_rh', agoraIso)
    app.save(candidato)

    const candNome = candidato.getString('nome') || 'Candidato'
    const cargoCand = candidato.getString('cargo_pretendido') || 'Cargo de TI'
    const setorCand = candidato.getString('setor') || 'TI'

    // Registrar log de auditoria
    try {
      const logsCol = app.findCollectionByNameOrId('logs_auditoria')
      const logRecord = new Record(logsCol)
      logRecord.set('onboarding_id', null)
      logRecord.set('colaborador_nome', candNome)
      logRecord.set('usuario_id', usuarioId || null)
      logRecord.set('usuario_nome', usuarioNome || 'RH')
      logRecord.set('usuario_role', usuarioRole || 'rh')
      logRecord.set('gestor_nome', '')
      logRecord.set('acao', 'Reprovação de Candidato pelo RH')
      logRecord.set(
        'detalhes',
        `Candidato reprovado pelo RH (${usuarioNome}). Motivo do RH: ${
          motivo || 'Critério de formalização'
        }. Candidato: ${candNome} (${cargoCand} - ${setorCand}). O link da prova foi invalidado.`,
      )
      logRecord.set('fora_prazo', false)
      logRecord.set('destaque_prazo', '')
      logRecord.set('metadata', {
        candidato_id: candidato.id,
        candidato_nome: candNome,
        motivo_reprovacao: motivo,
        reprovado_por_rh: usuarioNome,
        autor_role: usuarioRole,
        data: agoraIso,
      })
      app.save(logRecord)
    } catch (errLog) {
      console.error('[Candidatos Hook /reprovar-rh] Erro ao gravar log:', errLog)
    }

    return e.json(200, {
      success: true,
      message: 'Candidato reprovado pelo RH com sucesso. Cartão arquivado no histórico.',
      candidato: candidato,
    })
  } catch (err) {
    console.error('[Candidatos Hook /reprovar-rh] Erro:', err)
    return e.json(500, { error: 'Erro ao registrar reprovação do RH.' })
  }
})

// --------------------------------------------------------------------------------------
// 3.5 GET /backend/v1/candidato/tentativa/:candidatoId
//     Retorna a tentativa com gabarito para Admin, Gestor e RH
// --------------------------------------------------------------------------------------
routerAdd('GET', '/backend/v1/candidato/tentativa/{candidatoId}', (e) => {
  try {
    const app = e.app || $app
    const candidatoId = (e.request.pathValue('candidatoId') || '').trim()

    if (!candidatoId) {
      return e.json(400, { error: 'ID do candidato é obrigatório.' })
    }

    let candidato = null
    try {
      candidato = app.findRecordById('candidatos', candidatoId)
    } catch (_) {}

    if (!candidato) {
      return e.json(404, { error: 'Candidato não encontrado.' })
    }

    // Buscar a tentativa associada ao candidato
    let tentativa = null
    const tentativaId = candidato.getString('tentativa_id')
    if (tentativaId) {
      try {
        tentativa = app.findRecordById('teste_tentativas', tentativaId)
      } catch (_) {}
    }

    if (!tentativa) {
      try {
        const list = app.findRecordsByFilter(
          'teste_tentativas',
          `candidato_id = '${candidatoId}'`,
          '-created',
          1,
          0,
        )
        if (list && list.length > 0) tentativa = list[0]
      } catch (_) {}
    }

    if (!tentativa) {
      return e.json(404, { error: 'Nenhuma tentativa submetida encontrada para este candidato.' })
    }

    let respostas = []
    try {
      const raw = tentativa.getString('respostas')
      if (raw) respostas = JSON.parse(raw)
    } catch (_) {
      respostas = tentativa.get('respostas') || []
    }

    let questoesSorteadas = []
    try {
      const rawSort = tentativa.getString('questoes_sorteadas')
      if (rawSort) questoesSorteadas = JSON.parse(rawSort)
    } catch (_) {
      questoesSorteadas = tentativa.get('questoes_sorteadas') || []
    }

    let questionarioNome = ''
    const qid = tentativa.getString('questionario_id') || candidato.getString('questionario_id')
    if (qid) {
      try {
        const qrec = app.findRecordById('questionarios', qid)
        if (qrec) questionarioNome = qrec.getString('nome')
      } catch (_) {}
    }

    return e.json(200, {
      tentativa: {
        id: tentativa.id,
        candidato_id: candidato.id,
        candidato_nome: candidato.getString('nome'),
        cargo_pretendido: candidato.getString('cargo_pretendido'),
        setor: candidato.getString('setor'),
        tentativa_numero: tentativa.getInt('tentativa_numero') || 1,
        total_questoes: tentativa.getInt('total_questoes'),
        acertos: tentativa.getInt('acertos'),
        percentual: tentativa.getFloat('percentual'),
        aprovado: tentativa.getBool('aprovado'),
        data_submissao: tentativa.getString('data_submissao'),
        questionario_id: qid || '',
        questionario_nome: questionarioNome,
        questoes_sorteadas: questoesSorteadas,
        respostas_detalhe: respostas,
      },
    })
  } catch (err) {
    console.error('[Candidato Hook /tentativa] Erro:', err)
    return e.json(500, { error: 'Erro ao carregar gabarito da tentativa do candidato.' })
  }
})

// --------------------------------------------------------------------------------------
// 4. POST /backend/v1/candidatos/converter
//    Conversão Formalizada pelo RH/Admin -> Colaborador (Cria Onboarding em transação atômica)
// --------------------------------------------------------------------------------------
routerAdd('POST', '/backend/v1/candidatos/converter', (e) => {
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

    const candidatoId = (data.candidatoId || '').trim()
    const dataInicio = (data.dataInicio || '').trim() // YYYY-MM-DD
    const gestorId = (data.gestorId || '').trim()
    const usuarioId = (data.usuarioId || '').trim()
    const usuarioNome = (data.usuarioNome || '').trim()
    const usuarioRole = (data.usuarioRole || '').trim().toLowerCase()

    if (!candidatoId) {
      return e.json(400, { error: 'ID do candidato é obrigatório.' })
    }
    if (!dataInicio) {
      return e.json(400, { error: 'Data de início é obrigatória.' })
    }
    if (!gestorId) {
      return e.json(400, { error: 'Gestor responsável é obrigatório.' })
    }

    if (usuarioRole !== 'rh' && usuarioRole !== 'admin') {
      return e.json(403, {
        error: 'Apenas o RH ou Administrador podem formalizar a contratação de candidatos.',
      })
    }

    let candidato = null
    try {
      candidato = app.findRecordById('candidatos', candidatoId)
    } catch (_) {}

    if (!candidato) {
      return e.json(404, { error: 'Candidato não encontrado.' })
    }

    if (candidato.getString('status') === 'convertido') {
      return e.json(400, { error: 'Este candidato já foi convertido em colaborador.' })
    }

    const candNome = candidato.getString('nome') || ''
    const candEmail = candidato.getString('email') || ''
    const candCargo = candidato.getString('cargo_pretendido') || ''
    const candSetor = candidato.getString('setor') || 'windows'

    let setorRefId = ''
    try {
      const setoresRecords = app.findRecordsByFilter(
        'setores',
        `ativo = true && (chave = '${candSetor}' || nome = '${candSetor}')`,
        '-created',
        1,
        0,
      )
      if (setoresRecords && setoresRecords.length > 0) {
        setorRefId = setoresRecords[0].id
      }
    } catch (_) {}

    let questionarioOnboardingId = ''
    try {
      const qs = app.findRecordsByFilter(
        'questionarios',
        `ativo = true && tipo_de_uso = 'onboarding' && setor ~ '${candSetor}'`,
        '-created',
        1,
        0,
      )
      if (qs && qs.length > 0) {
        questionarioOnboardingId = qs[0].id
      } else {
        const anyOnb = app.findRecordsByFilter(
          'questionarios',
          "ativo = true && tipo_de_uso = 'onboarding'",
          '-created',
          1,
          0,
        )
        if (anyOnb && anyOnb.length > 0) questionarioOnboardingId = anyOnb[0].id
      }
    } catch (_) {}

    let dataFimIso = ''
    try {
      const [ano, mes, dia] = dataInicio.split('-').map(Number)
      const d = new Date(Date.UTC(ano, mes - 1, dia))
      d.setUTCDate(d.getUTCDate() + 15)
      dataFimIso = d.toISOString().split('T')[0]
    } catch (_) {
      dataFimIso = dataInicio
    }

    const checklistSnapshot = []
    try {
      const itensModelo = app.findRecordsByFilter(
        'itens_integracao_modelo',
        'ativo = true',
        'ordem,created',
        100,
        0,
      )
      for (const item of itensModelo) {
        checklistSnapshot.push({
          id: item.id,
          titulo: item.getString('titulo'),
          entregue: false,
        })
      }
    } catch (errItens) {
      console.warn('[Candidatos Hook] Aviso ao carregar itens_integracao_modelo:', errItens)
    }

    const tokenColaborador = $security.randomString(32)
    const agoraIso = new Date().toISOString()

    let novoOnboarding = null
    app.runInTransaction((txApp) => {
      const onboardingsCol = txApp.findCollectionByNameOrId('onboardings')
      const rec = new Record(onboardingsCol)
      rec.set('colaborador_nome', candNome)
      rec.set('colaborador_email', candEmail)
      rec.set('cargo', candCargo)
      rec.set('setor', candSetor)
      if (setorRefId) rec.set('setor_ref', setorRefId)
      rec.set('gestor_id', gestorId)
      rec.set('data_inicio', dataInicio)
      rec.set('data_fim', dataFimIso)
      rec.set('status', 'novo')
      rec.set('etapa_atual', 1)
      rec.set('etapa1_concluida', false)
      rec.set('etapa2_concluida', false)
      rec.set('etapa3_concluida', false)
      rec.set('token_acesso_colaborador', tokenColaborador)
      rec.set('fases_concluidas', [])
      rec.set('fases_sinalizadas', [])
      rec.set('reavaliacoes_count', 0)
      rec.set('prazo_suplementar_dias', 0)
      rec.set('checklist_integracao', checklistSnapshot)
      if (questionarioOnboardingId) {
        rec.set('questionario_id', questionarioOnboardingId)
        rec.set('questionarios_vinculados', [questionarioOnboardingId])
      }
      rec.set('teste_conhecimento_status', 'bloqueado')
      txApp.save(rec)
      novoOnboarding = rec

      candidato.set('status', 'convertido')
      candidato.set('colaborador_id', rec.id)
      candidato.set('rh_responsavel', usuarioId || null)
      candidato.set('data_formalizacao_rh', agoraIso)
      txApp.save(candidato)
    })

    const tarefasCol = app.findCollectionByNameOrId('tarefas_onboarding')

    // 1. Etapa 1
    try {
      const templatesEtapa1 = app.findRecordsByFilter(
        'modelo_tarefas',
        'etapa = 1',
        'ordem,titulo',
        100,
        0,
      )
      for (const tpl of templatesEtapa1) {
        const novaT = new Record(tarefasCol)
        novaT.set('onboarding_id', novoOnboarding.id)
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
    } catch (errEtapa1) {
      console.error('[Candidatos Hook] Erro ao semear tarefas modelo Etapa 1:', errEtapa1)
    }

    // 2. Etapa 2
    try {
      const candSetorLower = candSetor.toLowerCase()
      let filterEtapa2 = `(setor = '${candSetorLower}' || setor = '${candSetor}' || setor ~ '${candSetor}'`
      if (setorRefId) {
        filterEtapa2 += ` || setor_ref = '${setorRefId}'`
      }
      filterEtapa2 += `) && (etapa = 2 || etapa = null || etapa = 0)`

      const templatesEtapa2 = app.findRecordsByFilter(
        'modelo_tarefas',
        filterEtapa2,
        'ordem,titulo',
        100,
        0,
      )
      for (const tpl of templatesEtapa2) {
        const novaT = new Record(tarefasCol)
        novaT.set('onboarding_id', novoOnboarding.id)
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
    } catch (errEtapa2) {
      console.error('[Candidatos Hook] Erro ao semear tarefas modelo Etapa 2:', errEtapa2)
    }

    try {
      const logsCol = app.findCollectionByNameOrId('logs_auditoria')
      const logRecord = new Record(logsCol)
      logRecord.set('onboarding_id', novoOnboarding.id)
      logRecord.set('colaborador_nome', candNome)
      logRecord.set('usuario_id', usuarioId || null)
      logRecord.set('usuario_nome', usuarioNome || 'Gestor')
      logRecord.set('usuario_role', usuarioRole || 'rh')
      logRecord.set('gestor_nome', '')
      logRecord.set('acao', 'Formalização e Conversão de Candidato em Colaborador (RH)')
      logRecord.set(
        'detalhes',
        `Contratação formalizada pelo RH (${usuarioNome}). Candidato ${candNome} convertido em colaborador oficial. Onboarding #${novoOnboarding.id} criado com sucesso (início em ${dataInicio}, gestor responsável definido).`,
      )
      logRecord.set('fora_prazo', false)
      logRecord.set('destaque_prazo', '')
      logRecord.set('metadata', {
        candidato_id: candidato.id,
        onboarding_id: novoOnboarding.id,
        formalizado_por: usuarioNome,
        autor_role: usuarioRole,
        data_inicio: dataInicio,
      })
      app.save(logRecord)
    } catch (errLog) {
      console.error('[Candidatos Hook] Erro ao gravar log de conversão:', errLog)
    }

    return e.json(200, {
      success: true,
      message: 'Candidato convertido em colaborador e onboarding criado com sucesso!',
      onboarding: novoOnboarding,
      candidato: candidato,
    })
  } catch (err) {
    console.error('[Candidatos Hook /converter] Erro:', err)
    return e.json(500, { error: 'Erro ao converter candidato em colaborador.' })
  }
})
