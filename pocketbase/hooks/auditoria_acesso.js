/// <reference path="../pb_data/types.d.ts" />

/**
 * Endpoints e hooks de auditoria de ACESSO (Login, Falha de Login, Logout).
 *
 * Rota 1: GET /backend/v1/client-ip
 * Retorna o IP público/real do cliente detectado pelo servidor PocketBase.
 *
 * Rota 2: POST /backend/v1/auditoria/acesso
 * Permite registrar formalmente eventos de acesso com captura automática de IP no servidor:
 * - tipo: 'login' | 'falha_login' | 'logout'
 * - email: string
 * - usuario_id?: string
 * - usuario_nome?: string
 * - usuario_role?: string
 * - motivo?: string
 * - detalhes?: string
 */

routerAdd('GET', '/backend/v1/client-ip', (e) => {
  let clientIp = ''
  try {
    clientIp =
      (e.realIP && e.realIP()) ||
      (e.request &&
        e.request.header &&
        (e.request.header.get('x-forwarded-for') || e.request.header.get('x-real-ip'))) ||
      (e.request && e.request.remoteAddr) ||
      ''
    // Se vierem múltiplos IPs em x-forwarded-for (ex: "client, proxy1, proxy2"), pega o primeiro
    if (clientIp.indexOf(',') !== -1) {
      clientIp = clientIp.split(',')[0].trim()
    }
    // Remover porta se vier no formato IP:port
    if (clientIp.indexOf(':') !== -1 && clientIp.indexOf('.') !== -1) {
      clientIp = clientIp.split(':')[0].trim()
    }
  } catch (_) {}

  return e.json(200, {
    ip: clientIp,
  })
})

routerAdd('POST', '/backend/v1/auditoria/acesso', (e) => {
  try {
    const app = e.app || (typeof $app !== 'undefined' ? $app : null)
    if (!app) {
      return e.json(500, { error: 'Contexto do banco não disponível.' })
    }

    const data = e.requestInfo().body || {}
    const tipo = (data.tipo || '').toString().trim()
    const email = (data.email || '').toString().trim()
    const usuarioId = (data.usuario_id || '').toString().trim()
    const usuarioNome = (data.usuario_nome || '').toString().trim()
    const usuarioRole = (data.usuario_role || '').toString().trim()
    const motivo = (data.motivo || '').toString().trim()
    const detalhesExtras = (data.detalhes || '').toString().trim()

    if (!tipo) {
      return e.json(400, { error: 'O tipo do evento de acesso é obrigatório.' })
    }

    // Identificar IP real da requisição
    let clientIp = ''
    try {
      clientIp =
        (e.realIP && e.realIP()) ||
        (e.request &&
          e.request.header &&
          (e.request.header.get('x-forwarded-for') || e.request.header.get('x-real-ip'))) ||
        (e.request && e.request.remoteAddr) ||
        ''
      if (clientIp.indexOf(',') !== -1) {
        clientIp = clientIp.split(',')[0].trim()
      }
      if (clientIp.indexOf(':') !== -1 && clientIp.indexOf('.') !== -1) {
        clientIp = clientIp.split(':')[0].trim()
      }
    } catch (_) {}

    const logsCol = app.findCollectionByNameOrId('logs_auditoria')
    const record = new Record(logsCol)

    let acao = 'Acesso ao Sistema'
    let detalhes = ''
    let metadata = {
      tipo_evento_acesso: tipo,
      email: email,
      ip: clientIp || 'Não identificado',
      data_hora: new Date().toISOString(),
    }

    if (tipo === 'login') {
      acao = 'Login realizado'
      const roleStr = usuarioRole ? ` (${usuarioRole.toUpperCase()})` : ''
      const ipStr = clientIp ? ` a partir do IP ${clientIp}` : ''
      detalhes = `Autenticação bem-sucedida do usuário ${usuarioNome || email}${roleStr}${ipStr}.${detalhesExtras ? ` ${detalhesExtras}` : ''}`
      record.set('usuario_id', usuarioId || null)
      record.set('usuario_nome', usuarioNome || email)
      record.set('usuario_role', usuarioRole || 'usuário')
    } else if (tipo === 'falha_login') {
      acao = 'Falha de login'
      const ipStr = clientIp ? ` (IP: ${clientIp})` : ''
      const motivoStr = motivo ? ` Motivo: ${motivo}.` : ' Credenciais inválidas.'
      detalhes = `Tentativa de login com o e-mail "${email || 'não informado'}" foi recusada${ipStr}.${motivoStr}${detalhesExtras ? ` ${detalhesExtras}` : ''}`
      record.set('usuario_id', null)
      record.set('usuario_nome', email ? `${email} (Tentativa)` : 'Tentativa de Acesso')
      record.set('usuario_role', 'anônimo')
      metadata.motivo = motivo
    } else if (tipo === 'logout') {
      acao = 'Logout'
      const roleStr = usuarioRole ? ` (${usuarioRole.toUpperCase()})` : ''
      const ipStr = clientIp ? ` (IP: ${clientIp})` : ''
      detalhes = `Encerramento de sessão realizado pelo usuário ${usuarioNome || email}${roleStr}${ipStr}.${detalhesExtras ? ` ${detalhesExtras}` : ''}`
      record.set('usuario_id', usuarioId || null)
      record.set('usuario_nome', usuarioNome || email)
      record.set('usuario_role', usuarioRole || 'usuário')
    } else {
      acao = `Acesso: ${tipo}`
      detalhes = detalhesExtras || `Evento de acesso do tipo ${tipo} registrado.`
      record.set('usuario_id', usuarioId || null)
      record.set('usuario_nome', usuarioNome || email)
      record.set('usuario_role', usuarioRole || '')
    }

    record.set('acao', acao)
    record.set('detalhes', detalhes)
    record.set('fora_prazo', false)
    record.set('metadata', JSON.stringify(metadata))

    app.save(record)

    return e.json(200, {
      success: true,
      log_id: record.id,
      acao: acao,
      ip: clientIp,
    })
  } catch (err) {
    console.error('[Auditoria Acesso Hook] Erro ao registrar:', err)
    return e.json(500, { error: 'Erro interno ao registrar evento de auditoria de acesso.' })
  }
})
