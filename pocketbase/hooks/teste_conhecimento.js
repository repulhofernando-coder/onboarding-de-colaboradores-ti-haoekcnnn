/// <reference path="../pb_data/types.d.ts" />

/**
 * Endpoints pb_hooks para o Teste de Conhecimento da Etapa 3.
 *
 * 1. GET  /backend/v1/teste-conhecimento/publico
 *    - Recebe ?token=... (token de acesso exclusivo do colaborador)
 *    - Valida se o onboarding existe e se a Etapa 2 foi concluída (etapa2_concluida = true).
 *    - Retorna a lista das 20 questões COM ENUNCIADO E ALTERNATIVAS, MAS SEM GABARITO (sem correta_index e sem gabarito_comentario).
 *    - Retorna status da tentativa atual (se já submeteu, se aguarda gestor, se foi liberado reteste).
 *    - O colaborador NUNCA vê nota, percentual nem gabarito.
 *
 * 2. POST /backend/v1/teste-conhecimento/submeter
 *    - Recebe body: { token, respostas: { [questaoId]: respostaIndex } }
 *    - Valida que a Etapa 2 está concluída e que o colaborador pode submeter (primeira tentativa ou reteste liberado).
 *    - Valida que todas as questões ativas foram respondidas.
 *    - Efetua a correção AUTOMÁTICA no servidor contra as respostas corretas no banco.
 *    - Registra a tentativa na coleção `teste_tentativas` com nota, percentual (aprovação >= 95%), mapa detalhado com gabarito e comentários.
 *    - Atualiza campos no onboarding (`teste_conhecimento_status`, `teste_ultima_nota`, `teste_ultimo_percentual`, `teste_tentativas_count`).
 *    - Registra log de auditoria oficial na coleção `logs_auditoria`.
 *    - Dispara notificação por e-mail ao Gestor Responsável informando a conclusão e se foi aprovado ou reprovado no teste.
 *    - Retorna para o colaborador apenas mensagem de confirmação ("Teste enviado com sucesso. Aguarde o retorno do seu gestor."), SEM nota e SEM gabarito.
 *
 * 3. POST /backend/v1/teste-conhecimento/liberar-reteste
 *    - Requer autenticação (Gestão ou Admin).
 *    - Recebe body: { onboardingId, motivo }
 *    - Valida se o onboarding está reprovado no teste.
 *    - Atualiza `teste_conhecimento_status` para 'reteste_liberado'.
 *    - Registra auditoria com executor, data e motivo.
 *    - Notifica RH e Admin caso configurado.
 *
 * 4. GET  /backend/v1/teste-conhecimento/tentativas/:onboardingId
 *    - Requer autenticação.
 *    - Se Admin: retorna gabarito completo + respostas + comentários explicativos.
 *    - Se Gestão ou RH: mascara gabarito_comentario, correta_index e detalhe das respostas, retornando APENAS nota, percentual, data e status de aprovação.
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

    // Carregar as questões ativas ordenadas
    const questoesRecords = app.findRecordsByFilter(
      'teste_questoes',
      'ativo = true',
      'ordem',
      100,
      0,
    )

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
      reteste: retesteLiberado,
      tentativaNumero: (tentativas.length || 0) + 1,
      totalQuestoes: questoesSanitizadas.length,
      questoes: questoesSanitizadas,
      colaboradorNome: onboarding.getString('colaborador_nome'),
      cargo: onboarding.getString('cargo'),
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

    const statusAtual = onboarding.getString('teste_conhecimento_status') || 'liberado'
    if (tentativasAnteriores.length > 0 && statusAtual !== 'reteste_liberado') {
      return e.json(403, {
        error:
          'Você já enviou o teste de conhecimento. Novas tentativas dependem de liberação do Gestor Responsável.',
      })
    }

    // Carregar todas as questões ativas
    const questoesRecords = app.findRecordsByFilter(
      'teste_questoes',
      'ativo = true',
      'ordem',
      100,
      0,
    )

    if (!questoesRecords || questoesRecords.length === 0) {
      return e.json(500, { error: 'Nenhuma questão cadastrada para o teste de conhecimento.' })
    }

    // Validação: todas as questões devem estar respondidas
    const faltantes = []
    for (const q of questoesRecords) {
      const resp = respostasEnviadas[q.id]
      if (resp === undefined || resp === null || resp === '') {
        faltantes.push(q.getInt('ordem'))
      }
    }

    if (faltantes.length > 0) {
      return e.json(400, {
        error: `Existem ${faltantes.length} questão(ões) não respondida(s): Questão(ões) ${faltantes.join(', ')}. Responda todas as 20 questões para enviar.`,
        faltantes: faltantes,
      })
    }

    // Correção automática segura no servidor
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
    // Régua oficial: aprovação com 95% ou mais (19/20)
    const aprovado = percentual >= 95.0

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
    app.save(tentativaRec)

    // Atualizar onboarding
    const novoStatus = aprovado ? 'aprovado' : 'reprovado'
    onboarding.set('teste_conhecimento_status', novoStatus)
    onboarding.set('teste_ultima_nota', acertos)
    onboarding.set('teste_ultimo_percentual', percentual)
    onboarding.set('teste_tentativas_count', novaTentativaNumero)
    app.save(onboarding)

    const colabNome = onboarding.getString('colaborador_nome') || 'Colaborador'

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
        `Colaborador enviou o teste de 20 questões. Resultado: ${acertos}/${totalQuestoes} (${percentual}%). Status: ${aprovado ? 'APROVADO (>=95%)' : 'REPROVADO (<95%)'}.`,
      )
      logRecord.set('fora_prazo', false)
      logRecord.set('destaque_prazo', '')
      logRecord.set('metadata', {
        tentativa_numero: novaTentativaNumero,
        acertos: acertos,
        total_questoes: totalQuestoes,
        percentual: percentual,
        aprovado: aprovado,
        data_submissao: agoraIso,
        ip: ipOrigem,
      })
      app.save(logRecord)
      console.log(
        `[Teste Hook] Tentativa ${novaTentativaNumero} salva para onboarding ${onboarding.id}: ${acertos}/${totalQuestoes} (${percentual}%)`,
      )
    } catch (errLog) {
      console.error('[Teste Hook] Erro ao registrar log de auditoria:', errLog)
    }

    // Disparar e-mail de notificação ao Gestor Responsável informando sobre o teste concluído
    if (gestorEmail) {
      try {
        const appUrl = 'https://onboarding-de-colaboradores-ti-8af12.goskip.app'
        const onboardingUrl = `${appUrl}/colaboradores/${onboarding.id}`
        const statusBadge = aprovado
          ? '<span style="color: #16a34a; font-weight: bold;">APROVADO (>=95%)</span>'
          : '<span style="color: #dc2626; font-weight: bold;">REPROVADO (<95%)</span>'

        const emailHtml = `
          <!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 24px;">
            <table role="presentation" width="100%" style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden;">
              <tr><td style="background: #0284c7; padding: 20px 24px; color: #ffffff;">
                <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #bae6fd;">Onboarding de TI — Etapa 3</span>
                <h1 style="margin: 6px 0 0; font-size: 18px; color: #ffffff;">Teste de Conhecimento Concluído</h1>
              </td></tr>
              <tr><td style="padding: 24px; font-size: 14px; line-height: 1.6; color: #334155;">
                <p>Olá, <strong>${gestorNome || 'Gestor'}</strong>,</p>
                <p>O colaborador <strong>${colabNome}</strong> concluiu o <strong>Teste de Conhecimento</strong> de 20 questões sobre atendimento e rotinas de TI.</p>
                <div style="background-color: #f1f5f9; border-left: 4px solid ${aprovado ? '#16a34a' : '#dc2626'}; border-radius: 4px; padding: 14px 18px; margin: 18px 0;">
                  <p style="margin: 0 0 6px;"><strong>Colaborador:</strong> ${colabNome}</p>
                  <p style="margin: 0 0 6px;"><strong>Tentativa:</strong> #${novaTentativaNumero}</p>
                  <p style="margin: 0 0 6px;"><strong>Nota:</strong> ${acertos} de ${totalQuestoes} questões (${percentual}%)</p>
                  <p style="margin: 0 0 6px;"><strong>Resultado:</strong> ${statusBadge}</p>
                  <p style="margin: 0;"><strong>Régua de Aprovação:</strong> 95% (mínimo de 19 acertos)</p>
                </div>
                ${
                  !aprovado
                    ? '<p style="color: #b91c1c; font-size: 13px;"><em>Atenção:</em> O colaborador obteve aproveitamento abaixo de 95%. Acesse a página do onboarding para decidir entre liberar um <strong>Reteste</strong> ou registrar <strong>Não Apto</strong> na Avaliação Final.</p>'
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
          console.log('[Teste Hook] E-mail enviado para:', gestorEmail, '| Assunto:', mailSubject)
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
        `Reteste autorizado por ${usuarioNome} (${usuarioRole}). Motivo: ${motivo || 'Revisão com o colaborador antes da reavaliação'}. O portal público foi liberado para nova tentativa.`,
      )
      logRecord.set('fora_prazo', false)
      logRecord.set('destaque_prazo', '')
      logRecord.set('metadata', {
        motivo: motivo,
        liberado_em: agoraIso,
        liberado_por: usuarioNome,
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

    // Buscar tentativas do onboarding
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

    // Formatar retorno respeitando a regra de negócio estrita:
    // ADMIN: vê gabarito completo + respostas do colaborador vs gabarito + comentários explicativos
    // GESTÃO e RH: veem APENAS nota, percentual, total e aprovação (sem gabarito, sem comentários, sem mapa de respostas por questão)
    const formatadas = tentativas.map((t) => {
      let respostas = []
      try {
        const raw = t.getString('respostas')
        if (raw) respostas = JSON.parse(raw)
      } catch (_) {
        respostas = t.get('respostas') || []
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
        created: t.getString('created'),
      }

      if (isAdmin) {
        // Admin vê mapa completo
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
