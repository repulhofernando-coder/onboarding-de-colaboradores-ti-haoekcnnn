/// <reference path="../pb_data/types.d.ts" />

/**
 * Endpoints pb_hooks para o Módulo de Avaliações Avulsas do Dossiê do Colaborador.
 * (Reciclagem, Mudança de Área, Avaliação Periódica)
 *
 * Implementa Banco de Questões com Sorteio de Objetivas, persistência na avaliação/tentativa
 * e régua com arredondamento para cima: ceil(0.95 * total_objetivas_sorteadas).
 */

// --------------------------------------------------------------------------------------
// 1. GET /backend/v1/colaborador/avaliacao/publico
//    Retorna os dados públicos da avaliação avulsa (link do colaborador)
// --------------------------------------------------------------------------------------
routerAdd('GET', '/backend/v1/colaborador/avaliacao/publico', (e) => {
  try {
    const app = e.app || $app
    const token = (e.request.url.query().get('token') || '').trim()

    if (!token) {
      return e.json(400, { error: 'Token de avaliação é obrigatório.' })
    }

    let avaliacao = null
    try {
      avaliacao = app.findFirstRecordByData('avaliacoes_colaborador', 'token', token)
    } catch (_) {}

    if (!avaliacao) {
      return e.json(404, { error: 'Avaliação não encontrada para o token fornecido.' })
    }

    const statusAvaliacao = avaliacao.getString('status')
    if (statusAvaliacao === 'cancelada') {
      return e.json(403, {
        error: 'Esta avaliação foi cancelada pela gestão e não está mais disponível.',
        motivo: 'Avaliação cancelada',
      })
    }

    if (statusAvaliacao === 'concluida' || avaliacao.getString('data_conclusao')) {
      return e.json(200, {
        liberado: false,
        jaSubmetido: true,
        dataConclusao: avaliacao.getString('data_conclusao'),
        mensagem:
          'Esta avaliação já foi respondida e enviada com sucesso. Os resultados estão salvos no seu dossiê.',
        colaboradorNome: '',
      })
    }

    // Buscar dados do colaborador
    let colabNome = ''
    let colabCargo = ''
    let colabSetor = ''
    const colabId = avaliacao.getString('colaborador_id')
    if (colabId) {
      try {
        const colab = app.findRecordById('onboardings', colabId)
        if (colab) {
          colabNome = colab.getString('colaborador_nome')
          colabCargo = colab.getString('cargo')
          colabSetor = colab.getString('setor')
        }
      } catch (_) {}
    }

    // Questionário vinculado
    const qid = avaliacao.getString('questionario_id')
    let questRecord = null
    if (qid) {
      try {
        questRecord = app.findRecordById('questionarios', qid)
      } catch (_) {}
    }

    if (!questRecord) {
      return e.json(404, { error: 'Questionário vinculado a esta avaliação não foi encontrado.' })
    }

    // Buscar questões ativas do questionário
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
      return e.json(404, { error: 'Nenhuma questão cadastrada para esta avaliação no momento.' })
    }

    // Separar objetivas e dissertativas (se existirem, dissertativas ficam fora do sorteio)
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
    // Persistência em avaliacao.questoes_sorteadas para manter as mesmas questões ao recarregar a página
    let idsSorteadasPersistidas = []
    try {
      const rawPersist = avaliacao.getString('questoes_sorteadas')
      if (rawPersist) {
        const parsed = JSON.parse(rawPersist)
        if (Array.isArray(parsed) && parsed.length > 0) {
          idsSorteadasPersistidas = parsed
        }
      }
    } catch (_) {}

    let objetivasFinais = []
    if (idsSorteadasPersistidas.length > 0) {
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

      // Persistir na avaliação
      const idsSorteadas = objetivasFinais.map((q) => q.id)
      try {
        avaliacao.set('questoes_sorteadas', idsSorteadas)
        app.save(avaliacao)
      } catch (errSortPersist) {
        console.warn('[Avaliacao Hook] Erro ao persistir questoes_sorteadas:', errSortPersist)
      }
    }

    const questoesEntregues = [...objetivasFinais, ...dissertativas]

    // Sanitizar questões para o link público: NUNCA enviar correta_index nem gabarito_comentario
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
      colaboradorNome: colabNome,
      cargo: colabCargo,
      setor: colabSetor,
      tipoAvaliacao: avaliacao.getString('tipo_avaliacao') || questRecord.getString('tipo_de_uso'),
      questionarioNome: questRecord.getString('nome'),
      questionarioDescricao: questRecord.getString('descricao'),
      totalQuestoes: questoesSanitizadas.length,
      totalObjetivas: objetivasFinais.length,
      totalDissertativas: dissertativas.length,
      bancoTotalObjetivas: objetivas.length,
      questoesPorProvaConfigurada: questoesPorProva,
      questoes: questoesSanitizadas,
    })
  } catch (err) {
    console.error('[Avaliacao Hook /publico] Erro:', err)
    return e.json(500, { error: 'Erro ao carregar a avaliação do colaborador.' })
  }
})

// --------------------------------------------------------------------------------------
// 2. POST /backend/v1/colaborador/avaliacao/submeter
// --------------------------------------------------------------------------------------
routerAdd('POST', '/backend/v1/colaborador/avaliacao/submeter', (e) => {
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
      return e.json(400, { error: 'Token de avaliação é obrigatório.' })
    }

    let avaliacao = null
    try {
      avaliacao = app.findFirstRecordByData('avaliacoes_colaborador', 'token', token)
    } catch (_) {}

    if (!avaliacao) {
      return e.json(404, { error: 'Avaliação não encontrada para o token fornecido.' })
    }

    const statusAvaliacao = avaliacao.getString('status')
    if (statusAvaliacao === 'cancelada') {
      return e.json(403, { error: 'Esta avaliação foi cancelada e não pode mais ser respondida.' })
    }

    if (statusAvaliacao === 'concluida' || avaliacao.getString('data_conclusao')) {
      return e.json(403, {
        error:
          'Esta avaliação já foi respondida anteriormente. Novas tentativas não são permitidas.',
      })
    }

    // Buscar colaborador
    let colab = null
    const colabId = avaliacao.getString('colaborador_id')
    if (colabId) {
      try {
        colab = app.findRecordById('onboardings', colabId)
      } catch (_) {}
    }

    // Questionário vinculado
    const qid = avaliacao.getString('questionario_id')
    let questRecord = null
    if (qid) {
      try {
        questRecord = app.findRecordById('questionarios', qid)
      } catch (_) {}
    }

    if (!questRecord) {
      return e.json(500, { error: 'Questionário vinculado a esta avaliação não encontrado.' })
    }

    // Obter as questões sorteadas persistidas na avaliação
    let idsSorteadas = []
    try {
      const rawPersist = avaliacao.getString('questoes_sorteadas')
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
      return e.json(500, { error: 'Nenhuma questão cadastrada para esta avaliação.' })
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

    // Validar se todas as questões sorteadas foram respondidas
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

    // Correção no servidor
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

    // RÉGUA 95% ARREDONDADA PARA CIMA:
    // minimo_acertos = ceil(0.95 * total_objetivas_sorteadas)
    const divisor = totalObjetivas > 0 ? totalObjetivas : totalQuestoes
    const percentual = Number(((acertos / divisor) * 100).toFixed(1))
    const reguaAprovacao = questRecord.getFloat('percentual_aprovacao') || 95.0
    const minimoAcertosExigido = Math.ceil((reguaAprovacao / 100.0) * divisor)
    const aprovado = acertos >= minimoAcertosExigido
    const agoraIso = new Date().toISOString()

    let ipOrigem = ''
    try {
      ipOrigem = e.request.header.get('x-forwarded-for') || e.request.remoteAddr || ''
    } catch (_) {}

    // Gravar tentativa em teste_tentativas com vínculo correto
    const tentativasCol = app.findCollectionByNameOrId('teste_tentativas')
    const tentativaRec = new Record(tentativasCol)
    tentativaRec.set('onboarding_id', colab ? colab.id : null)
    tentativaRec.set('candidato_id', null)
    tentativaRec.set('tentativa_numero', 1)
    tentativaRec.set('respostas', mapaRespostas)
    tentativaRec.set('total_questoes', totalQuestoes)
    tentativaRec.set('acertos', acertos)
    tentativaRec.set('percentual', percentual)
    tentativaRec.set('aprovado', aprovado)
    tentativaRec.set('data_submissao', agoraIso)
    tentativaRec.set('ip', ipOrigem)
    tentativaRec.set('reteste_liberado', false)
    tentativaRec.set('questoes_sorteadas', idsEfetivamenteSorteadas)
    tentativaRec.set('questionario_id', questRecord.id)
    app.save(tentativaRec)

    // Atualizar o registro em avaliacoes_colaborador
    avaliacao.set('status', 'concluida')
    avaliacao.set('nota', acertos)
    avaliacao.set('total_questoes', totalQuestoes)
    avaliacao.set('percentual', percentual)
    avaliacao.set('aprovado', aprovado)
    avaliacao.set('regua_aprovacao', reguaAprovacao)
    avaliacao.set('tentativa_id', tentativaRec.id)
    avaliacao.set('data_conclusao', agoraIso)
    avaliacao.set('questoes_sorteadas', idsEfetivamenteSorteadas)
    app.save(avaliacao)

    const colabNome = colab ? colab.getString('colaborador_nome') : 'Colaborador'
    const qNome = questRecord.getString('nome')
    const tipoUso =
      avaliacao.getString('tipo_avaliacao') || questRecord.getString('tipo_de_uso') || 'Avaliação'

    // Registrar no Histórico & Auditoria (logs_auditoria)
    try {
      const logsCol = app.findCollectionByNameOrId('logs_auditoria')
      const logRecord = new Record(logsCol)
      logRecord.set('onboarding_id', colab ? colab.id : null)
      logRecord.set('colaborador_nome', colabNome)
      logRecord.set('usuario_id', null)
      logRecord.set('usuario_nome', colabNome)
      logRecord.set('usuario_role', 'colaborador')
      logRecord.set('gestor_nome', colab ? colab.getString('gestor_id') : '')
      logRecord.set('acao', `Conclusão de Avaliação do Colaborador (${tipoUso})`)
      logRecord.set(
        'detalhes',
        `Avaliação "${qNome}" concluída. Resultado: ${acertos}/${totalObjetivas} objetivas sorteadas (${percentual}%). Mínimo exigido (${reguaAprovacao}%): ${minimoAcertosExigido} acertos. Situação: ${aprovado ? 'Aprovado' : 'Reprovado'}.`,
      )
      logRecord.set('fora_prazo', false)
      logRecord.set('destaque_prazo', '')
      logRecord.set('metadata', {
        avaliacao_id: avaliacao.id,
        colaborador_id: colab ? colab.id : null,
        colaborador_nome: colabNome,
        questionario_id: questRecord.id,
        questionario_nome: qNome,
        tipo_avaliacao: tipoUso,
        acertos: acertos,
        total_questoes: totalQuestoes,
        total_objetivas: totalObjetivas,
        minimo_acertos_exigido: minimoAcertosExigido,
        percentual: percentual,
        regua_aprovacao: reguaAprovacao,
        aprovado: aprovado,
        tentativa_id: tentativaRec.id,
        questoes_sorteadas: idsEfetivamenteSorteadas,
        data_conclusao: agoraIso,
      })
      app.save(logRecord)
    } catch (errLog) {
      console.error('[Avaliacao Hook] Erro ao gravar log de auditoria:', errLog)
    }

    return e.json(200, {
      sucesso: true,
      mensagem:
        'Sua avaliação foi enviada e registrada com sucesso! A equipe de RH e Gestão já tem acesso aos seus resultados.',
      dataConclusao: agoraIso,
    })
  } catch (err) {
    console.error('[Avaliacao Hook /submeter] Erro:', err)
    return e.json(500, { error: 'Erro ao processar e salvar sua avaliação.' })
  }
})
