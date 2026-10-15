/// <reference path="../pb_data/types.d.ts" />

/**
 * Endpoints pb_hooks para o Módulo de Pré-selecionados e Contratação.
 *
 * NOTA: Cada callback routerAdd encapsula seus próprios helpers inline
 * para evitar "Hook scoping error" do goja/PocketBase.
 */

// --------------------------------------------------------------------------------------
// 1. GET /backend/v1/candidato/prova/publico
// --------------------------------------------------------------------------------------
routerAdd('GET', '/backend/v1/candidato/prova/publico', (e) => {
  try {
    const app = e.app || $app
    const token = (e.request.url.query().get('token') || '').trim()

    if (!token) {
      return e.json(400, { error: 'Token da prova do candidato é obrigatório.' })
    }

    let candidato = null
    try {
      candidato = app.findFirstRecordByData('candidatos', 'token_publico', token)
    } catch (_) {}

    if (!candidato) {
      return e.json(404, { error: 'Link de prova inválido ou candidato não encontrado.' })
    }

    const statusCandidato = candidato.getString('status') || 'pre_selecionado'

    // O link público morre para candidato reprovado
    if (statusCandidato === 'reprovado') {
      return e.json(403, {
        error: 'Este link de avaliação não está mais ativo.',
        reprovado: true,
      })
    }

    // Se já respondeu a prova: rejeitar com mensagem clara e amigável (sem reteste)
    if (
      statusCandidato === 'prova_concluida' ||
      statusCandidato === 'aprovado' ||
      statusCandidato === 'convertido' ||
      candidato.getString('data_conclusao_prova')
    ) {
      return e.json(200, {
        liberado: false,
        jaSubmetido: true,
        candidatoNome: candidato.getString('nome'),
        cargoPretendido: candidato.getString('cargo_pretendido'),
        dataConclusao: candidato.getString('data_conclusao_prova'),
        mensagem:
          'Esta prova já foi respondida. Suas respostas foram salvas com sucesso e a equipe de gestão da área fará a avaliação do seu perfil.',
      })
    }

    // Buscar o questionário vinculado ao candidato
    const qid = candidato.getString('questionario_id')
    let questRecord = null
    if (qid) {
      try {
        questRecord = app.findRecordById('questionarios', qid)
      } catch (_) {}
    }

    // Fallback: se não tiver questionário fixado, buscar um compatível com o setor
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

    // Sanitizar questões para o portal público: NUNCA enviar correta_index nem gabarito_comentario
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
      candidatoNome: candidato.getString('nome'),
      cargoPretendido: candidato.getString('cargo_pretendido'),
      setor: candidato.getString('setor'),
      questionarioNome: questRecord.getString('nome'),
      questionarioDescricao: questRecord.getString('descricao'),
      totalQuestoes: questoesSanitizadas.length,
      questoes: questoesSanitizadas,
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

    // Link morre para reprovado
    if (candidato.getString('status') === 'reprovado') {
      return e.json(403, { error: 'Este link de avaliação não está mais ativo.' })
    }

    // REGRA DE OURO: SEM RETESTE — única tentativa
    if (
      candidato.getString('data_conclusao_prova') ||
      candidato.getString('status') === 'prova_concluida' ||
      candidato.getString('status') === 'aprovado' ||
      candidato.getString('status') === 'convertido'
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
      return e.json(500, { error: 'Nenhuma questão cadastrada para esta prova.' })
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
        error: `Existem ${faltantes.length} questão(ões) não respondida(s): Questão(ões) ${faltantes.join(', ')}. Responda todas para enviar.`,
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
    const reguaAprovacao = questRecord.getFloat('percentual_aprovacao') || 80.0
    const aprovadoTeste = percentual >= reguaAprovacao
    const agoraIso = new Date().toISOString()

    let ipOrigem = ''
    try {
      ipOrigem = e.request.header.get('x-forwarded-for') || e.request.remoteAddr || ''
    } catch (_) {}

    // Gravar tentativa em teste_tentativas com privilégio de sistema
    const tentativasCol = app.findCollectionByNameOrId('teste_tentativas')
    const tentativaRec = new Record(tentativasCol)
    tentativaRec.set('candidato_id', candidato.id)
    tentativaRec.set('tentativa_numero', 1)
    tentativaRec.set('respostas', mapaRespostas)
    tentativaRec.set('total_questoes', totalQuestoes)
    tentativaRec.set('acertos', acertos)
    tentativaRec.set('percentual', percentual)
    tentativaRec.set('aprovado', aprovadoTeste)
    tentativaRec.set('data_submissao', agoraIso)
    tentativaRec.set('ip', ipOrigem)
    tentativaRec.set('reteste_liberado', false)
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
        `Candidato concluiu a prova "${qNome}". Resultado: ${acertos}/${totalQuestoes} (${percentual}%). Status no teste: ${aprovadoTeste ? `Atingiu a régua (>=${reguaAprovacao}%)` : `Abaixo da régua (<${reguaAprovacao}%)`}. Decisão final do Gestor pendente.`,
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
        percentual: percentual,
        regua_aprovacao: reguaAprovacao,
        aprovado_teste: aprovadoTeste,
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
        ? `<span style="color: #16a34a; font-weight: bold;">Acima da régua (${percentual}% &gt;= ${reguaAprovacao}%)</span>`
        : `<span style="color: #dc2626; font-weight: bold;">Abaixo da régua (${percentual}% &lt; ${reguaAprovacao}%)</span>`

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
                <p style="margin: 0 0 6px;"><strong>Nota / Desempenho:</strong> ${acertos} de ${totalQuestoes} acertos (${percentual}%)</p>
                <p style="margin: 0 0 6px;"><strong>Resultado do Teste:</strong> ${statusBadge}</p>
                <p style="margin: 0;"><strong>Régua de Referência:</strong> ${reguaAprovacao}%</p>
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
//    Decisão do Gestor (aprovado / reprovado)
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
    candidato.set('status', decisao)
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
          ? 'Aprovação de Candidato Pré-selecionado'
          : 'Reprovação de Candidato Pré-selecionado',
      )
      logRecord.set(
        'detalhes',
        `Decisão registrada por ${usuarioNome} (${usuarioRole}). Candidato: ${candNome} (${cargoCand} - ${setorCand}). Resultado: ${decisao.toUpperCase()}${motivo ? `. Motivo: ${motivo}` : ''}.`,
      )
      logRecord.set('fora_prazo', false)
      logRecord.set('destaque_prazo', '')
      logRecord.set('metadata', {
        candidato_id: candidato.id,
        candidato_nome: candNome,
        decisao: decisao,
        motivo: motivo,
        data_decisao: agoraIso,
        decidido_por: usuarioNome,
      })
      app.save(logRecord)
    } catch (errLog) {
      console.error('[Candidatos Hook /decidir] Erro ao gravar log:', errLog)
    }

    return e.json(200, {
      success: true,
      message: `Candidato ${decisao === 'aprovado' ? 'aprovado' : 'reprovado'} com sucesso.`,
      candidato: candidato,
    })
  } catch (err) {
    console.error('[Candidatos Hook /decidir] Erro:', err)
    return e.json(500, { error: 'Erro ao registrar decisão do candidato.' })
  }
})

// --------------------------------------------------------------------------------------
// 4. POST /backend/v1/candidatos/converter
//    Conversão Aprovado -> Colaborador (Cria Onboarding em transação atômica)
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
    const usuarioRole = (data.usuarioRole || '').trim()

    if (!candidatoId) {
      return e.json(400, { error: 'ID do candidato é obrigatório.' })
    }
    if (!dataInicio) {
      return e.json(400, { error: 'Data de início é obrigatória.' })
    }
    if (!gestorId) {
      return e.json(400, { error: 'Gestor responsável é obrigatório.' })
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

    // Buscar setor_ref se existir na tabela setores
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

    // Buscar questionário de onboarding compatível para vincular ao novo onboarding
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

    // Calcular data_fim padrão (15 dias a partir da dataInicio)
    let dataFimIso = ''
    try {
      const [ano, mes, dia] = dataInicio.split('-').map(Number)
      const d = new Date(Date.UTC(ano, mes - 1, dia))
      d.setUTCDate(d.getUTCDate() + 14) // 15 dias corridos
      dataFimIso = d.toISOString().split('T')[0]
    } catch (_) {
      dataFimIso = dataInicio
    }

    const tokenColaborador = $security.randomString(32)

    // Criar o registro de onboarding em transação atômica
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
      rec.set('token_acesso_colaborador', tokenColaborador)
      if (questionarioOnboardingId) {
        rec.set('questionario_id', questionarioOnboardingId)
        rec.set('questionarios_vinculados', [questionarioOnboardingId])
      }
      rec.set('teste_conhecimento_status', 'bloqueado')
      txApp.save(rec)
      novoOnboarding = rec

      // Atualizar status do candidato para 'convertido' e amarrar colaborador_id
      candidato.set('status', 'convertido')
      candidato.set('colaborador_id', rec.id)
      txApp.save(candidato)
    })

    // Semear tarefas modelo para o novo onboarding (se houver modelos)
    try {
      const tarefasModelos = app.findRecordsByFilter(
        'modelo_tarefas',
        `setor = '${candSetor}' || setor = '' || setor IS NULL`,
        'ordem',
        100,
        0,
      )
      const tarefasCol = app.findCollectionByNameOrId('tarefas_onboarding')
      for (const mod of tarefasModelos) {
        const novaT = new Record(tarefasCol)
        novaT.set('onboarding_id', novoOnboarding.id)
        novaT.set('titulo', mod.getString('titulo'))
        novaT.set('tipo', mod.getString('tipo') || 'manual')
        novaT.set('descricao', mod.getString('descricao'))
        novaT.set('etapa', mod.getInt('etapa') || 1)
        novaT.set('ordem', mod.getInt('ordem') || 1)
        novaT.set('material', mod.getString('material'))
        novaT.set('fase', mod.getString('fase'))
        novaT.set('conteudo_link', mod.getString('conteudo_link'))
        novaT.set('criado_automaticamente', true)
        novaT.set('concluida', false)
        app.save(novaT)
      }
    } catch (errMod) {
      console.log('[Candidatos Hook] Aviso ao semear tarefas modelo:', errMod)
    }

    // Registrar auditoria
    try {
      const logsCol = app.findCollectionByNameOrId('logs_auditoria')
      const logRecord = new Record(logsCol)
      logRecord.set('onboarding_id', novoOnboarding.id)
      logRecord.set('colaborador_nome', candNome)
      logRecord.set('usuario_id', usuarioId || null)
      logRecord.set('usuario_nome', usuarioNome || 'Gestor')
      logRecord.set('usuario_role', usuarioRole || 'gestao')
      logRecord.set('gestor_nome', '')
      logRecord.set('acao', 'Conversão de Pré-selecionado em Colaborador')
      logRecord.set(
        'detalhes',
        `Candidato ${candNome} aprovado na pré-seleção foi formalmente convertido em colaborador. Onboarding #${novoOnboarding.id} criado com sucesso (início em ${dataInicio}).`,
      )
      logRecord.set('fora_prazo', false)
      logRecord.set('destaque_prazo', '')
      logRecord.set('metadata', {
        candidato_id: candidato.id,
        onboarding_id: novoOnboarding.id,
        convertido_por: usuarioNome,
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
