/// <reference path="../pb_data/types.d.ts" />

/**
 * Endpoints pb_hooks para Avaliações do Colaborador (Reciclagem, Mudança de Área, Avaliação Periódica).
 *
 * 1. GET /backend/v1/colaborador/avaliacao/publico?token=...
 *    Retorna dados da avaliação e questões sanitizadas (sem correta_index, sem gabarito_comentario).
 *    Sem cronômetro.
 *
 * 2. POST /backend/v1/colaborador/avaliacao/submeter
 *    Corrige no servidor, grava tentativa em teste_tentativas e atualiza avaliacoes_colaborador.
 *    Grava log de auditoria oficial. Colaborador NUNCA vê nota nem gabarito.
 */

// --------------------------------------------------------------------------------------
// 1. GET /backend/v1/colaborador/avaliacao/publico
// --------------------------------------------------------------------------------------
routerAdd('GET', '/backend/v1/colaborador/avaliacao/publico', (e) => {
  try {
    const app = e.app || $app
    const token = (e.request.url.query().get('token') || '').trim()

    if (!token) {
      return e.json(400, { error: 'Token da avaliação é obrigatório.' })
    }

    let avaliacao = null
    try {
      avaliacao = app.findFirstRecordByData('avaliacoes_colaborador', 'token', token)
    } catch (_) {}

    if (!avaliacao) {
      return e.json(404, { error: 'Avaliação não encontrada ou link inválido.' })
    }

    const statusAvaliacao = avaliacao.getString('status') || 'pendente'

    if (statusAvaliacao === 'cancelada') {
      return e.json(403, {
        error: 'Esta avaliação foi cancelada pela equipe de RH/Gestão. Link não está mais ativo.',
        cancelada: true,
      })
    }

    // Buscar colaborador (onboardings)
    let colab = null
    const colabId = avaliacao.getString('colaborador_id')
    if (colabId) {
      try {
        colab = app.findRecordById('onboardings', colabId)
      } catch (_) {}
    }

    const colabNome = colab ? colab.getString('colaborador_nome') : 'Colaborador'
    const colabCargo = colab ? colab.getString('cargo') : ''
    const colabSetor = colab ? colab.getString('setor') : ''

    // Se já foi concluída: bloqueia e avisa
    if (statusAvaliacao === 'concluida' || avaliacao.getString('data_conclusao')) {
      return e.json(200, {
        liberado: false,
        jaSubmetido: true,
        colaboradorNome: colabNome,
        cargo: colabCargo,
        dataConclusao: avaliacao.getString('data_conclusao'),
        mensagem:
          'Esta avaliação já foi respondida com sucesso. Suas respostas foram computadas e estão registradas em seu dossiê.',
      })
    }

    // Buscar questionário vinculado
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
    let questoesRecords = app.findRecordsByFilter(
      'teste_questoes',
      `ativo = true && questionario_id = '${questRecord.id}'`,
      'ordem',
      100,
      0,
    )

    if (!questoesRecords || questoesRecords.length === 0) {
      questoesRecords = app.findRecordsByFilter('teste_questoes', 'ativo = true', 'ordem', 100, 0)
    }

    if (!questoesRecords || questoesRecords.length === 0) {
      return e.json(404, { error: 'Nenhuma questão cadastrada para esta avaliação no momento.' })
    }

    // Sanitizar questões para o link público: NUNCA enviar correta_index nem gabarito_comentario
    const questoesSanitizadas = questoesRecords.map((q) => {
      let alternativas = []
      try {
        const raw = q.getString('alternativas')
        if (raw) alternativas = JSON.parse(raw)
      } catch (_) {
        alternativas = q.get('alternativas') || []
      }

      return {
        id: q.id,
        ordem: q.getInt('ordem'),
        tema: q.getString('tema'),
        enunciado: q.getString('enunciado'),
        alternativas: alternativas,
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

    // Buscar questões
    let questoesRecords = app.findRecordsByFilter(
      'teste_questoes',
      `ativo = true && questionario_id = '${questRecord.id}'`,
      'ordem',
      100,
      0,
    )

    if (!questoesRecords || questoesRecords.length === 0) {
      questoesRecords = app.findRecordsByFilter('teste_questoes', 'ativo = true', 'ordem', 100, 0)
    }

    if (!questoesRecords || questoesRecords.length === 0) {
      return e.json(500, { error: 'Nenhuma questão cadastrada para esta avaliação.' })
    }

    // Validar se todas as questões foram respondidas
    const faltantes = []
    for (const q of questoesRecords) {
      const resp = respostasEnviadas[q.id]
      if (resp === undefined || resp === null || resp === '') {
        faltantes.push(q.getInt('ordem'))
      }
    }

    if (faltantes.length > 0) {
      return e.json(400, {
        error: `Existem ${faltantes.length} questão(ões) não respondida(s): Questão(ões) ${faltantes.join(', ')}. Responda todas as ${questoesRecords.length} questões para enviar.`,
        faltantes: faltantes,
      })
    }

    // Correção no servidor
    let acertos = 0
    const totalQuestoes = questoesRecords.length
    const mapaRespostas = []

    for (const q of questoesRecords) {
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
        ordem: q.getInt('ordem'),
        tema: q.getString('tema'),
        enunciado: q.getString('enunciado'),
        alternativas: alternativas,
        resposta_escolhida: respostaEscolhida,
        correta_index: corretaIndex,
        correta: acertou,
        gabarito_comentario: q.getString('gabarito_comentario'),
      })
    }

    const percentual = Number(((acertos / totalQuestoes) * 100).toFixed(1))
    // Régua de aprovação DAQUELE questionário específico
    const reguaAprovacao = questRecord.getFloat('percentual_aprovacao') || 80.0
    const aprovado = percentual >= reguaAprovacao
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
        `Avaliação "${qNome}" concluída. Resultado registrado no dossiê: ${acertos}/${totalQuestoes} (${percentual}%). Régua do questionário: ${reguaAprovacao}%. Situação: ${aprovado ? 'Aprovado' : 'Reprovado'}.`,
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
        percentual: percentual,
        regua_aprovacao: reguaAprovacao,
        aprovado: aprovado,
        tentativa_id: tentativaRec.id,
        data_conclusao: agoraIso,
      })
      app.save(logRecord)
    } catch (errLog) {
      console.error('[Avaliacao Hook] Erro ao gravar log de auditoria:', errLog)
    }

    // REGRA DE OURO: O colaborador NUNCA vê nota nem gabarito, apenas confirmação de envio
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
