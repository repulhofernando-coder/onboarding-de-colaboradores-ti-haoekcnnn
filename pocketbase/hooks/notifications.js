/**
 * Hook de notificações automáticas por e-mail nos pontos de transição de etapa do Onboarding de TI.
 * Executa no servidor PocketBase (Skip Cloud) em background.
 *
 * Transições atendidas:
 * 1. Conclusão da Etapa 1 -> E-mail para o Gestor responsável (Etapa 2 liberada)
 * 2. Conclusão da Etapa 2 -> E-mail para o Gestor responsável (Avaliação Final pendente)
 * 3. Registro da Avaliação Final -> E-mail para os usuários de RH e Admin com o resultado
 *
 * Tratamento de falhas:
 * Qualquer erro no envio de e-mail é capturado e registrado em log (console.error/console.warn),
 * garantindo que a transição de etapa ou registro de avaliação nunca falhe.
 *
 * Prevenção de duplicidade:
 * Utiliza flags booleanas no onboarding (email_etapa1_enviado, email_etapa2_enviado, email_avaliacao_enviado).
 */

// -------------------------------------------------------------
// 1. Hook ao atualizar onboarding (Etapa 1 concluída ou Etapa 2 concluída)
// -------------------------------------------------------------
onRecordUpdate((e) => {
  e.next()

  try {
    const app = e.app
    const record = e.record
    const appUrl = 'https://onboarding-de-colaboradores-ti-8af12.goskip.app'

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
        console.warn('[Email Hook] Destinatário vazio. Disparo abortado.')
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
        console.log('[Email Hook] E-mail enviado com sucesso para:', toEmail, '| Assunto:', subject)
        return true
      } catch (err) {
        console.error('[Email Hook] Falha ao enviar e-mail para:', toEmail, '| Erro:', err)
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
        '<tr><td style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 24px 30px; text-align: left;">' +
        '<span style="display: inline-block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #60a5fa; margin-bottom: 4px;">Sistema de Onboarding de TI</span>' +
        '<h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff; line-height: 1.3;">' +
        title +
        '</h1>' +
        (subtitle
          ? '<p style="margin: 6px 0 0; font-size: 13px; color: #94a3b8;">' + subtitle + '</p>'
          : '') +
        '</td></tr>' +
        '<tr><td style="padding: 28px 30px 20px 30px; line-height: 1.6; font-size: 14px; color: #374151;">' +
        contentHtml +
        (ctaUrl
          ? '<div style="margin: 28px 0 10px; text-align: center;"><a href="' +
            ctaUrl +
            '" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 28px; border-radius: 6px;">' +
            (ctaText || 'Acessar no Sistema') +
            '</a></div><p style="margin: 16px 0 0; font-size: 11px; text-align: center; color: #9ca3af;">Link direto: <a href="' +
            ctaUrl +
            '" style="color: #2563eb;">' +
            ctaUrl +
            '</a></p>'
          : '') +
        '</td></tr>' +
        '<tr><td style="background-color: #f8fafc; padding: 16px 30px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #64748b;">' +
        'Notificação automática gerada pelo sistema de Gestão de Onboarding TI.<br>Por favor, não responda diretamente a este e-mail.' +
        '</td></tr></table></td></tr></table></body></html>'
      )
    }

    function formatBrDate(isoStr) {
      if (!isoStr) return '-'
      try {
        const d = new Date(isoStr)
        if (isNaN(d.getTime())) return isoStr
        const dia = String(d.getUTCDate()).padStart(2, '0')
        const mes = String(d.getUTCMonth() + 1).padStart(2, '0')
        const ano = d.getUTCFullYear()
        return `${dia}/${mes}/${ano}`
      } catch (_) {
        return isoStr
      }
    }

    function getSetorLabel(pbApp, r) {
      try {
        const setorRefId = r.getString('setor_ref')
        if (setorRefId) {
          const s = pbApp.findRecordById('setores', setorRefId)
          if (s) {
            const sn = s.getString('nome')
            if (sn) return sn
          }
        }
      } catch (_) {}
      const val = r.getString('setor')
      const m = {
        windows: 'Windows',
        linux_rede: 'Linux / Rede',
        datacenter: 'Datacenter',
        campo: 'Campo',
        infraestrutura: 'Infraestrutura',
        rh: 'RH',
        comercial: 'Comercial',
        laboratorio: 'Laboratório',
      }
      return m[val] || m[val.toLowerCase()] || val || 'TI'
    }

    const etapa1Concluida = record.getBool('etapa1_concluida')
    const etapa2Concluida = record.getBool('etapa2_concluida')
    const emailEtapa1Enviado = record.getBool('email_etapa1_enviado')
    const emailEtapa2Enviado = record.getBool('email_etapa2_enviado')

    const gestorId = record.getString('gestor_id')
    const colaboradorNome = record.getString('colaborador_nome') || 'Novo Colaborador'
    const cargo = record.getString('cargo') || 'Não informado'
    const setorNome = getSetorLabel(app, record)
    const dataFim = formatBrDate(record.getString('data_fim'))
    const onboardingId = record.id
    const onboardingUrl = `${appUrl}/colaboradores/${onboardingId}`
    const tokenColaborador = record.getString('token_acesso_colaborador')
    const colaboradorPublicUrl = tokenColaborador ? `${appUrl}/colaborador/${tokenColaborador}` : ''

    let gestor = null
    if (gestorId) {
      try {
        gestor = app.findRecordById('users', gestorId)
      } catch (errGestor) {
        console.warn('[Email Hook] Gestor não encontrado id:', gestorId, errGestor)
      }
    }

    // Cenário 1: RH concluiu Etapa 1 -> Gestor responsável notificado
    if (etapa1Concluida && !emailEtapa1Enviado && gestor) {
      const gestorEmail = gestor.getString('email')
      const gestorNome = gestor.getString('name') || 'Gestor'

      const subject = `[Onboarding TI] Etapa 1 concluída: ${colaboradorNome} liberado(a) para Vivência Técnica`
      const content = `
        <p style="margin: 0 0 16px;">Olá, <strong>${gestorNome}</strong>!</p>
        <p style="margin: 0 0 16px;">
          Informamos que o <strong>RH concluiu a Etapa 1 (Apresentação da Empresa)</strong> do onboarding de <strong>${colaboradorNome}</strong>.
        </p>
        <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; border-radius: 4px; padding: 14px 18px; margin: 18px 0;">
          <p style="margin: 0 0 6px;"><strong>Colaborador:</strong> ${colaboradorNome}</p>
          <p style="margin: 0 0 6px;"><strong>Cargo:</strong> ${cargo}</p>
          <p style="margin: 0 0 6px;"><strong>Área/Setor:</strong> ${setorNome}</p>
          <p style="margin: 0;"><strong>Prazo final do onboarding:</strong> ${dataFim}</p>
        </div>
        <p style="margin: 16px 0 8px;">
          A <strong>Etapa 2 (Vivência Técnica)</strong> agora está sob sua responsabilidade. Você pode acessar os materiais de apoio e registrar o progresso das atividades diretamente no sistema.
        </p>
        ${
          colaboradorPublicUrl
            ? `
        <div style="background-color: #eff6ff; border: 1px dashed #3b82f6; border-radius: 6px; padding: 12px 16px; margin: 16px 0;">
          <p style="margin: 0 0 4px; font-weight: 600; font-size: 13px; color: #1e40af;">
            🔗 Link Público de Acesso do Colaborador:
          </p>
          <p style="margin: 0; font-size: 12px; color: #1d4ed8; word-break: break-all;">
            <a href="${colaboradorPublicUrl}" style="color: #2563eb; font-weight: 600;">${colaboradorPublicUrl}</a>
          </p>
          <p style="margin: 4px 0 0; font-size: 11px; color: #6b7280;">
            O colaborador utiliza este link público para assistir vídeos/manuais e confirmar a visualização diretamente da tela dele.
          </p>
        </div>
        `
            : ''
        }
      `

      const html = wrapHtml(
        'Etapa 1 Concluída - Vivência Técnica Liberada',
        `Colaborador: ${colaboradorNome} | Setor: ${setorNome}`,
        content,
        'Conduzir Etapa 2 no Sistema',
        onboardingUrl,
      )

      sendMail(app, gestorEmail, gestorNome, subject, html)

      try {
        app
          .db()
          .newQuery('UPDATE onboardings SET email_etapa1_enviado = 1 WHERE id = {:id}')
          .bind({ id: onboardingId })
          .execute()
      } catch (errFlag) {
        console.warn('[Email Hook] Falha ao marcar email_etapa1_enviado:', errFlag)
      }
    }

    // Cenário 2: Conclusão da Etapa 2 -> Gestor notificado para Avaliação Final (Etapa 3)
    if (etapa2Concluida && !emailEtapa2Enviado && gestor) {
      const gestorEmail = gestor.getString('email')
      const gestorNome = gestor.getString('name') || 'Gestor'

      const subject = `[Onboarding TI] Vivência Técnica concluída: realize a Avaliação Final de ${colaboradorNome}`
      const content = `
        <p style="margin: 0 0 16px;">Olá, <strong>${gestorNome}</strong>!</p>
        <p style="margin: 0 0 16px;">
          A <strong>Etapa 2 (Vivência Técnica)</strong> de <strong>${colaboradorNome}</strong> foi concluída com sucesso.
        </p>
        <div style="background-color: #f8fafc; border-left: 4px solid #f59e0b; border-radius: 4px; padding: 14px 18px; margin: 18px 0;">
          <p style="margin: 0 0 6px;"><strong>Colaborador:</strong> ${colaboradorNome}</p>
          <p style="margin: 0 0 6px;"><strong>Cargo:</strong> ${cargo}</p>
          <p style="margin: 0 0 6px;"><strong>Área/Setor:</strong> ${setorNome}</p>
          <p style="margin: 0;"><strong>Prazo final do onboarding:</strong> ${dataFim}</p>
        </div>
        <p style="margin: 16px 0 8px;">
          É hora de realizar a <strong>Etapa 3 (Avaliação Final)</strong>: avalie as competências desenvolvidas e registre a decisão final (<strong>Apto</strong> ou <strong>Não apto</strong>) juntamente com suas observações.
        </p>
      `

      const html = wrapHtml(
        'Etapa 2 Concluída - Hora da Avaliação Final',
        `Colaborador: ${colaboradorNome} | Setor: ${setorNome}`,
        content,
        'Realizar Avaliação Final',
        onboardingUrl,
      )

      sendMail(app, gestorEmail, gestorNome, subject, html)

      try {
        app
          .db()
          .newQuery('UPDATE onboardings SET email_etapa2_enviado = 1 WHERE id = {:id}')
          .bind({ id: onboardingId })
          .execute()
      } catch (errFlag) {
        console.warn('[Email Hook] Falha ao marcar email_etapa2_enviado:', errFlag)
      }
    }
  } catch (errGlobal) {
    console.error('[Email Hook] Erro no processamento do hook de onboarding:', errGlobal)
  }
}, 'onboardings')

// -------------------------------------------------------------
// 2. Hook ao criar avaliação (Avaliação Final registrada)
// -------------------------------------------------------------
onRecordCreate((e) => {
  e.next()

  try {
    const app = e.app
    const record = e.record
    const appUrl = 'https://onboarding-de-colaboradores-ti-8af12.goskip.app'

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
        console.warn('[Email Hook] Destinatário vazio. Disparo abortado.')
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
        console.log('[Email Hook] E-mail enviado com sucesso para:', toEmail, '| Assunto:', subject)
        return true
      } catch (err) {
        console.error('[Email Hook] Falha ao enviar e-mail para:', toEmail, '| Erro:', err)
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
        '<tr><td style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 24px 30px; text-align: left;">' +
        '<span style="display: inline-block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #60a5fa; margin-bottom: 4px;">Sistema de Onboarding de TI</span>' +
        '<h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff; line-height: 1.3;">' +
        title +
        '</h1>' +
        (subtitle
          ? '<p style="margin: 6px 0 0; font-size: 13px; color: #94a3b8;">' + subtitle + '</p>'
          : '') +
        '</td></tr>' +
        '<tr><td style="padding: 28px 30px 20px 30px; line-height: 1.6; font-size: 14px; color: #374151;">' +
        contentHtml +
        (ctaUrl
          ? '<div style="margin: 28px 0 10px; text-align: center;"><a href="' +
            ctaUrl +
            '" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 28px; border-radius: 6px;">' +
            (ctaText || 'Acessar no Sistema') +
            '</a></div><p style="margin: 16px 0 0; font-size: 11px; text-align: center; color: #9ca3af;">Link direto: <a href="' +
            ctaUrl +
            '" style="color: #2563eb;">' +
            ctaUrl +
            '</a></p>'
          : '') +
        '</td></tr>' +
        '<tr><td style="background-color: #f8fafc; padding: 16px 30px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #64748b;">' +
        'Notificação automática gerada pelo sistema de Gestão de Onboarding TI.<br>Por favor, não responda diretamente a este e-mail.' +
        '</td></tr></table></td></tr></table></body></html>'
      )
    }

    function getSetorLabel(pbApp, r) {
      try {
        const setorRefId = r.getString('setor_ref')
        if (setorRefId) {
          const s = pbApp.findRecordById('setores', setorRefId)
          if (s) {
            const sn = s.getString('nome')
            if (sn) return sn
          }
        }
      } catch (_) {}
      const val = r.getString('setor')
      const m = {
        windows: 'Windows',
        linux_rede: 'Linux / Rede',
        datacenter: 'Datacenter',
        campo: 'Campo',
        infraestrutura: 'Infraestrutura',
        rh: 'RH',
        comercial: 'Comercial',
        laboratorio: 'Laboratório',
      }
      return m[val] || m[val.toLowerCase()] || val || 'TI'
    }

    const onboardingId = record.getString('onboarding_id')
    const decisao = record.getString('decisao') // 'apto' | 'nao_apto'
    const observacoes = record.getString('observacoes') || 'Nenhuma observação registrada.'
    const avaliadorId = record.getString('avaliador_id')

    if (!onboardingId) return

    let onboarding = null
    try {
      onboarding = app.findRecordById('onboardings', onboardingId)
    } catch (errOb) {
      console.warn('[Email Hook] Onboarding não encontrado para a avaliação:', onboardingId, errOb)
      return
    }

    if (!onboarding) return

    // Evitar disparo duplicado se já foi enviado
    if (onboarding.getBool('email_avaliacao_enviado')) {
      return
    }

    const colaboradorNome = onboarding.getString('colaborador_nome') || 'Colaborador'
    const setorNome = getSetorLabel(app, onboarding)
    const cargo = onboarding.getString('cargo') || 'Não informado'
    const onboardingUrl = `${appUrl}/colaboradores/${onboardingId}`

    let avaliadorNome = 'Gestor Responsável'
    if (avaliadorId) {
      try {
        const u = app.findRecordById('users', avaliadorId)
        if (u) avaliadorNome = u.getString('name') || avaliadorNome
      } catch (_) {}
    }

    const decisaoApto = decisao === 'apto'
    const decisaoTexto = decisaoApto ? 'APTO(A)' : 'NÃO APTO(A)'
    const decisaoCor = decisaoApto ? '#16a34a' : '#dc2626'
    const decisaoBg = decisaoApto ? '#ecfdf5' : '#fef2f2'

    // Buscar destinatários: todos usuários RH e Admin ativos
    let destinatarios = []
    try {
      destinatarios = app.findRecordsByFilter(
        'users',
        "(role = 'rh' || role = 'admin' || (role = null && setor = 'RH')) && ativo != false",
        'name',
        50,
        0,
      )
    } catch (errUsers) {
      console.warn('[Email Hook] Erro ao buscar usuários RH/Admin:', errUsers)
    }

    if (!destinatarios || destinatarios.length === 0) {
      console.warn('[Email Hook] Nenhum usuário RH ou Admin ativo encontrado para notificação.')
      return
    }

    const subject = `[Onboarding TI] Avaliação Final registrada: ${colaboradorNome} foi considerado(a) ${decisaoTexto}`
    const content = `
      <p style="margin: 0 0 16px;">Prezada equipe de <strong>RH e Gestão</strong>,</p>
      <p style="margin: 0 0 16px;">
        A <strong>Avaliação Final (Etapa 3)</strong> do colaborador <strong>${colaboradorNome}</strong> foi concluída pelo avaliador <strong>${avaliadorNome}</strong>.
      </p>

      <div style="background-color: ${decisaoBg}; border: 1px solid ${decisaoCor}; border-radius: 6px; padding: 14px 18px; margin: 18px 0; text-align: center;">
        <span style="font-size: 12px; font-weight: 600; text-transform: uppercase; color: #4b5563; display: block; margin-bottom: 4px;">Resultado da Avaliação</span>
        <span style="font-size: 20px; font-weight: 800; color: ${decisaoCor}; letter-spacing: 0.04em;">
          ${decisaoTexto}
        </span>
      </div>

      <div style="background-color: #f8fafc; border-left: 4px solid #64748b; border-radius: 4px; padding: 14px 18px; margin: 18px 0;">
        <p style="margin: 0 0 6px;"><strong>Colaborador:</strong> ${colaboradorNome}</p>
        <p style="margin: 0 0 6px;"><strong>Cargo:</strong> ${cargo}</p>
        <p style="margin: 0 0 6px;"><strong>Área/Setor:</strong> ${setorNome}</p>
        <p style="margin: 0 0 6px;"><strong>Avaliador:</strong> ${avaliadorNome}</p>
        <p style="margin: 10px 0 0; padding-top: 10px; border-top: 1px dashed #cbd5e1;">
          <strong>Observações do Avaliador:</strong><br>
          <em style="color: #475569;">"${observacoes}"</em>
        </p>
      </div>

      <p style="margin: 16px 0 8px;">
        O histórico completo do processo e os materiais cumpridos continuam disponíveis para consulta no sistema.
      </p>
    `

    const html = wrapHtml(
      `Avaliação Final: ${decisaoTexto}`,
      `Colaborador: ${colaboradorNome} | Avaliador: ${avaliadorNome}`,
      content,
      'Ver Detalhes do Onboarding',
      onboardingUrl,
    )

    // Envia para cada usuário RH e Admin
    const sentEmails = {}
    for (const user of destinatarios) {
      const email = user.getString('email')
      const nome = user.getString('name')
      if (email) {
        const lower = email.toLowerCase()
        if (!sentEmails[lower]) {
          sentEmails[lower] = true
          sendMail(app, email, nome, subject, html)
        }
      }
    }

    try {
      app
        .db()
        .newQuery('UPDATE onboardings SET email_avaliacao_enviado = 1 WHERE id = {:id}')
        .bind({ id: onboardingId })
        .execute()
    } catch (errFlag) {
      console.warn('[Email Hook] Falha ao marcar email_avaliacao_enviado:', errFlag)
    }
  } catch (errGlobal) {
    console.error('[Email Hook] Erro no processamento do hook de avaliação:', errGlobal)
  }
}, 'avaliacoes')
