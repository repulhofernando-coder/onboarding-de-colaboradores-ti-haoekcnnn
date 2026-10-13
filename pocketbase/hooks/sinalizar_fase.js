/// <reference path="../pb_data/types.d.ts" />

/**
 * Endpoint interno para sinalização segura de conclusão de fase pelo colaborador.
 * Rota: POST /api/sinalizar-fase
 *
 * O colaborador não possui login na plataforma (link público exclusivo com token_acesso_colaborador).
 * Este endpoint:
 * 1. Valida o token exclusivo ou ID do onboarding.
 * 2. Atualiza o campo `fases_sinalizadas` no onboarding com privilégio de sistema.
 * 3. Cria o registro de auditoria na coleção `logs_auditoria` com acao "Sinalização de conclusão pelo colaborador".
 * 4. Dispara o e-mail de notificação ao responsável correspondente (RH na Etapa 1, Gestor na Etapa 2).
 * 5. Garante que NÃO altera status do onboarding nem da fase (conclusão formal é ato exclusivo do RH/Gestor).
 */
routerAdd('POST', '/backend/v1/sinalizar-fase', (e) => {
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
    const onboardingId = (data.onboardingId || '').trim()
    const faseId = (data.faseId || '').trim()
    const faseTitulo = (data.faseTitulo || 'Fase').trim()
    const etapa = Number(data.etapa) || (faseId === 'etapa1' ? 1 : 2)
    const colaboradorNomeParam = (data.colaboradorNome || '').trim()
    const colaboradorEmailParam = (data.colaboradorEmail || '').trim()

    if (!faseId) {
      return e.json(400, { error: 'Identificador da fase (faseId) é obrigatório.' })
    }

    if (!token && !onboardingId) {
      return e.json(400, {
        error: 'Token de acesso do colaborador ou ID do onboarding é obrigatório.',
      })
    }

    // Localizar onboarding
    let onboarding = null
    if (token) {
      try {
        onboarding = app.findFirstRecordByData('onboardings', 'token_acesso_colaborador', token)
      } catch (_) {}
    }

    if (!onboarding && onboardingId) {
      try {
        onboarding = app.findRecordById('onboardings', onboardingId)
      } catch (_) {}
    }

    if (!onboarding) {
      return e.json(404, { error: 'Onboarding não encontrado para o token ou ID fornecido.' })
    }

    // Se foi fornecido token, validar correspondência se onboardingId também veio
    if (token && onboarding.getString('token_acesso_colaborador') !== token) {
      return e.json(403, { error: 'Token de acesso inválido para este onboarding.' })
    }

    const agoraIso = new Date().toISOString()
    const colabNome =
      colaboradorNomeParam || onboarding.getString('colaborador_nome') || 'Colaborador'
    const colabEmail = colaboradorEmailParam || onboarding.getString('colaborador_email') || ''

    // Ler fases_sinalizadas existentes de forma segura (campo json)
    let sinalizadas = []
    try {
      const rawJson = onboarding.getString('fases_sinalizadas')
      if (rawJson && rawJson.trim()) {
        sinalizadas = JSON.parse(rawJson)
      } else {
        const rawGet = onboarding.get('fases_sinalizadas')
        if (Array.isArray(rawGet)) sinalizadas = rawGet
      }
    } catch (_) {
      const rawGet = onboarding.get('fases_sinalizadas')
      if (Array.isArray(rawGet)) sinalizadas = rawGet
    }
    if (!Array.isArray(sinalizadas)) {
      sinalizadas = []
    }

    const sinalInfo = {
      fase_id: faseId,
      titulo: faseTitulo,
      etapa: etapa,
      sinalizado_em: agoraIso,
      colaborador_nome: colabNome,
      colaborador_email: colabEmail,
    }

    const idx = sinalizadas.findIndex((s) => s && s.fase_id === faseId)
    if (idx >= 0) {
      sinalizadas[idx] = sinalInfo
    } else {
      sinalizadas.push(sinalInfo)
    }

    // Atualizar onboarding via app.save (com privilégio de sistema)
    onboarding.set('fases_sinalizadas', sinalizadas)
    app.save(onboarding)

    // Buscar gestor para auditoria / notificações
    let gestorNome = ''
    let gestorEmail = ''
    const gestorId = onboarding.getString('gestor_id')
    let gestorRecord = null
    if (gestorId) {
      try {
        gestorRecord = app.findRecordById('users', gestorId)
        if (gestorRecord) {
          gestorNome = gestorRecord.getString('name') || ''
          gestorEmail = gestorRecord.getString('email') || ''
        }
      } catch (_) {}
    }

    // Criar log de auditoria na coleção logs_auditoria com privilégio de sistema
    const rotuloEtapa = etapa === 1 ? 'Etapa 1' : `Etapa 2 — ${faseTitulo}`
    try {
      const logsCol = app.findCollectionByNameOrId('logs_auditoria')
      const logRecord = new Record(logsCol)
      logRecord.set('onboarding_id', onboarding.id)
      logRecord.set('colaborador_nome', colabNome)
      logRecord.set('usuario_id', null)
      logRecord.set('usuario_nome', colabNome)
      logRecord.set('usuario_role', 'colaborador')
      logRecord.set('gestor_nome', gestorNome)
      logRecord.set('acao', 'Sinalização de conclusão pelo colaborador')
      logRecord.set(
        'detalhes',
        `Colaborador sinalizou conclusão das atividades de "${faseTitulo}" (${rotuloEtapa}). Aguardando validação do responsável.`,
      )
      logRecord.set('fora_prazo', false)
      logRecord.set('destaque_prazo', '')
      logRecord.set('metadata', {
        fase_id: faseId,
        fase_titulo: faseTitulo,
        etapa: etapa,
        sinalizado_em: agoraIso,
      })
      app.save(logRecord)
      console.log(
        `[Sinalizacao Endpoint] Log de auditoria registrado para onboarding ${onboarding.id}, fase ${faseId}`,
      )
    } catch (errLog) {
      console.error('[Sinalizacao Endpoint] Falha ao registrar log de auditoria:', errLog)
    }

    // Disparo direto de e-mail ao responsável caso necessário
    try {
      const appUrl = 'https://onboarding-de-colaboradores-ti-8af12.goskip.app'
      const onboardingUrl = `${appUrl}/colaboradores/${onboarding.id}`

      function getSender(pbApp) {
        try {
          const s = pbApp.settings()
          const addr = (s && s.meta && s.meta.senderAddress) || 'no-reply@onboarding-ti.goskip.app'
          const name = (s && s.meta && s.meta.senderName) || 'Onboarding TI'
          return { address: addr, name: name }
        } catch (_) {
          return { address: 'no-reply@onboarding-ti.goskip.app', name: 'Onboarding TI' }
        }
      }

      function sendMail(pbApp, toEmail, toName, subject, htmlBody) {
        if (!toEmail || typeof toEmail !== 'string' || toEmail.trim() === '') {
          return false
        }
        try {
          const sender = getSender(pbApp)
          const msg = new MailerMessage({
            from: { address: sender.address, name: sender.name },
            to: [{ address: toEmail.trim(), name: toName || '' }],
            subject: subject,
            html: htmlBody,
          })
          pbApp.newMailClient().send(msg)
          console.log('[Sinalizacao Endpoint] E-mail enviado para:', toEmail, '| Assunto:', subject)
          return true
        } catch (err) {
          console.error('[Sinalizacao Endpoint] Erro ao enviar e-mail:', err)
          return false
        }
      }

      function wrapHtml(title, subtitle, contentHtml, ctaText, ctaUrl) {
        return (
          '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>' +
          title +
          '</title></head><body style="margin: 0; padding: 0; background-color: #f4f6f8; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif; color: #1f2937;">' +
          '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f6f8; padding: 30px 15px;"><tr><td align="center">' +
          '<table role="presentation" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">' +
          '<tr><td style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); padding: 24px 30px; text-align: left;">' +
          '<span style="display: inline-block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #bae6fd; margin-bottom: 4px;">Sistema de Onboarding de TI</span>' +
          '<h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff; line-height: 1.3;">' +
          title +
          '</h1>' +
          (subtitle
            ? '<p style="margin: 6px 0 0; font-size: 13px; color: #e0f2fe;">' + subtitle + '</p>'
            : '') +
          '</td></tr>' +
          '<tr><td style="padding: 28px 30px 20px 30px; line-height: 1.6; font-size: 14px; color: #374151;">' +
          contentHtml +
          (ctaUrl
            ? '<div style="margin: 28px 0 10px; text-align: center;"><a href="' +
              ctaUrl +
              '" style="display: inline-block; background-color: #0284c7; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 28px; border-radius: 6px;">' +
              (ctaText || 'Acessar no Sistema') +
              '</a></div><p style="margin: 16px 0 0; font-size: 11px; text-align: center; color: #9ca3af;">Link direto: <a href="' +
              ctaUrl +
              '" style="color: #0284c7;">' +
              ctaUrl +
              '</a></p>'
            : '') +
          '</td></tr>' +
          '<tr><td style="background-color: #f8fafc; padding: 16px 30px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #64748b;">' +
          'Notificação automática gerada pelo sistema de Gestão de Onboarding TI.<br>Por favor, não responda diretamente a este e-mail.' +
          '</td></tr></table></td></tr></table></body></html>'
        )
      }

      const sinalizadoEmBr = new Date(agoraIso).toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
      })
      const subject = `Onboarding ${colabNome} — sinalizou conclusão da fase ${faseTitulo}`

      if (etapa === 1) {
        // Enviar para RH e Admin
        let destinatarios = []
        try {
          destinatarios = app.findRecordsByFilter(
            'users',
            "(role = 'rh' || role = 'admin' || (role = null && setor = 'RH')) && ativo != false",
            'name',
            50,
            0,
          )
        } catch (_) {}

        if (destinatarios && destinatarios.length > 0) {
          const content = `
            <p style="margin: 0 0 16px;">Prezada equipe de <strong>Recursos Humanos</strong>,</p>
            <p style="margin: 0 0 16px;">
              O colaborador <strong>${colabNome}</strong> sinalizou no Portal Público que finalizou todas as atividades e leituras da <strong>Etapa 1 — ${faseTitulo}</strong>.
            </p>
            <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; border-radius: 4px; padding: 14px 18px; margin: 18px 0;">
              <p style="margin: 0 0 6px;"><strong>Colaborador:</strong> ${colabNome}</p>
              <p style="margin: 0 0 6px;"><strong>Etapa:</strong> Etapa 1 — ${faseTitulo}</p>
              <p style="margin: 0 0 6px;"><strong>Data/Hora do sinal:</strong> ${sinalizadoEmBr}</p>
              <p style="margin: 0;"><strong>Status:</strong> Aguardando validação institucional do RH</p>
            </div>
            <p style="margin: 16px 0 8px; font-size: 13px; color: #475569;">
              <em>Lembre-se:</em> O colaborador apenas <strong>sinalizou</strong> o cumprimento das atividades. Cabe ao RH conferir os itens, o checklist de integração e efetuar a <strong>conclusão formal da etapa</strong> no sistema para liberar a Etapa 2 ao Gestor.
            </p>
          `
          const html = wrapHtml(
            'Sinalização de Conclusão: Etapa 1',
            `Colaborador: ${colabNome} | ${faseTitulo}`,
            content,
            'Acessar e Concluir Etapa 1',
            onboardingUrl,
          )

          const sent = {}
          for (const u of destinatarios) {
            const em = u.getString('email')
            const nm = u.getString('name')
            if (em && !sent[em.toLowerCase()]) {
              sent[em.toLowerCase()] = true
              sendMail(app, em, nm, subject, html)
            }
          }
        }
      } else {
        // Enviar para Gestor Responsável
        if (gestorEmail) {
          const content = `
            <p style="margin: 0 0 16px;">Olá, <strong>${gestorNome || 'Gestor'}</strong>,</p>
            <p style="margin: 0 0 16px;">
              O colaborador <strong>${colabNome}</strong> sinalizou no Portal Público que finalizou todas as atividades da fase <strong>${faseTitulo}</strong> (Etapa 2 — Vivência Técnica).
            </p>
            <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; border-radius: 4px; padding: 14px 18px; margin: 18px 0;">
              <p style="margin: 0 0 6px;"><strong>Colaborador:</strong> ${colabNome}</p>
              <p style="margin: 0 0 6px;"><strong>Fase:</strong> ${faseTitulo}</p>
              <p style="margin: 0 0 6px;"><strong>Data/Hora do sinal:</strong> ${sinalizadoEmBr}</p>
              <p style="margin: 0;"><strong>Ação requerida:</strong> Validação prática e conclusão da fase pelo gestor</p>
            </div>
            <p style="margin: 16px 0 8px; font-size: 13px; color: #475569;">
              <em>Importante:</em> O botão clicado pelo colaborador <strong>sinaliza, mas não conclui</strong> a fase. Como Gestor Responsável, acesse o sistema para validar o aprendizado prático e clique em <strong>&quot;Concluir Fase&quot;</strong> para desbloquear a fase seguinte.
            </p>
          `
          const html = wrapHtml(
            `Sinalização de Conclusão: ${faseTitulo}`,
            `Colaborador: ${colabNome} | Gestor: ${gestorNome}`,
            content,
            'Acessar Onboarding e Concluir Fase',
            onboardingUrl,
          )
          sendMail(app, gestorEmail, gestorNome, subject, html)
        }
      }
    } catch (errMail) {
      console.error('[Sinalizacao Endpoint] Erro ao disparar e-mail de notificação:', errMail)
    }

    return e.json(200, {
      success: true,
      onboarding: onboarding,
      sinalInfo: sinalInfo,
      fases_sinalizadas: sinalizadas,
    })
  } catch (err) {
    console.error('[Sinalizacao Endpoint] Erro geral:', err)
    return e.json(500, { error: 'Erro interno ao registrar sinalização de fase.' })
  }
})
