/// <reference path="../pb_data/types.d.ts" />

/**
 * Endpoint público para visualização de Feedback ao Colaborador via Token.
 * Rota: GET /backend/v1/colaborador/feedback-avaliacao/publico?token=...
 *
 * Privacidade Estrita:
 * - Retorna SOMENTE dados essenciais do colaborador e do feedback oficial (decisão, data, texto do gestor e autor).
 * - NUNCA expõe anotações internas (colaborador_anotacoes) ou detalhes confidenciais de reuniões 1:1.
 * - Registra carimbo de leitura (data/hora e IP) na primeira visualização, incrementa contador de acessos e gera log de auditoria.
 */
routerAdd('GET', '/backend/v1/colaborador/feedback-avaliacao/publico', (e) => {
  try {
    const app = e.app || $app
    const token = (e.request.url.query().get('token') || '').trim()

    if (!token) {
      return e.json(400, { error: 'Token de feedback não fornecido.' })
    }

    let avaliacaoRecord = null
    try {
      avaliacaoRecord = app.findFirstRecordByData('avaliacoes', 'feedback_token', token)
    } catch (_) {}

    if (!avaliacaoRecord) {
      return e.json(404, { error: 'Feedback não encontrado ou link desativado.' })
    }

    const textoFeedback = (avaliacaoRecord.getString('feedback_colaborador') || '').trim()
    if (!textoFeedback) {
      return e.json(404, { error: 'Nenhum feedback público disponível para esta avaliação.' })
    }

    // Carregar colaborador / onboarding
    let colabNome = 'Colaborador'
    let colabCargo = 'TI'
    let colabSetor = 'Operações'
    const onboardingId = avaliacaoRecord.getString('onboarding_id')
    if (onboardingId) {
      try {
        const onb = app.findRecordById('onboardings', onboardingId)
        if (onb) {
          colabNome = onb.getString('colaborador_nome') || 'Colaborador'
          colabCargo = onb.getString('cargo') || 'TI'
          colabSetor = onb.getString('setor') || 'Operações'
        }
      } catch (_) {}
    }

    // Carregar gestor avaliador
    let gestorNome = 'Gestão de TI'
    const avaliadorId = avaliacaoRecord.getString('avaliador_id')
    if (avaliadorId) {
      try {
        const gestor = app.findRecordById('_pb_users_auth_', avaliadorId)
        if (gestor) {
          gestorNome = gestor.getString('name') || gestor.getString('email') || 'Gestão de TI'
        }
      } catch (_) {}
    }

    // Carimbo de leitura: gravar data/hora e IP no primeiro acesso
    const agoraIso = new Date().toISOString().replace('T', ' ').slice(0, 19)
    let clientIp = ''
    try {
      clientIp = e.realIP() || e.request.remoteAddr || ''
    } catch (_) {}

    const jaLidoEm = avaliacaoRecord.getString('feedback_lido_em')
    const acessosAtuais = avaliacaoRecord.getInt('feedback_acessos_count') || 0

    let foiPrimeiraLeitura = false
    if (!jaLidoEm) {
      foiPrimeiraLeitura = true
      avaliacaoRecord.set('feedback_lido_em', agoraIso)
      if (clientIp) {
        avaliacaoRecord.set('feedback_lido_ip', clientIp)
      }
    }
    avaliacaoRecord.set('feedback_acessos_count', acessosAtuais + 1)
    app.save(avaliacaoRecord)

    // Log de auditoria apenas na primeira leitura para não poluir
    if (foiPrimeiraLeitura) {
      try {
        const logsCol = app.findCollectionByNameOrId('logs_auditoria')
        const auditRecord = new Record(logsCol)
        auditRecord.set('acao', 'leitura_feedback_colaborador')
        auditRecord.set('usuario_id', onboardingId || 'link_publico')
        auditRecord.set('usuario_nome', `${colabNome} (Link Público)`)
        auditRecord.set('colaborador_id', onboardingId)
        auditRecord.set('entidade_tipo', 'avaliacoes')
        auditRecord.set('entidade_id', avaliacaoRecord.id)
        auditRecord.set(
          'detalhes',
          JSON.stringify({
            avaliacao_id: avaliacaoRecord.id,
            colaborador_nome: colabNome,
            gestor_autor: gestorNome,
            lido_em: agoraIso,
            ip: clientIp,
            decisao: avaliacaoRecord.getString('decisao'),
          }),
        )
        auditRecord.set('ip', clientIp)
        app.save(auditRecord)
      } catch (auditErr) {
        console.warn('[Feedback Publico] Falha ao registrar log de auditoria:', auditErr)
      }
    }

    return e.json(200, {
      id: avaliacaoRecord.id,
      colaboradorNome: colabNome,
      cargo: colabCargo,
      setor: colabSetor,
      decisao: avaliacaoRecord.getString('decisao'), // 'apto' | 'nao_apto'
      dataAvaliacao: avaliacaoRecord.getString('created'),
      gestorNome: gestorNome,
      feedbackTexto: textoFeedback,
      lidoEm: jaLidoEm || agoraIso,
      primeiraLeitura: foiPrimeiraLeitura,
      totalAcessos: acessosAtuais + 1,
    })
  } catch (err) {
    console.error('[Feedback Publico Hook] Erro:', err)
    return e.json(500, { error: 'Erro ao carregar feedback da avaliação.' })
  }
})
