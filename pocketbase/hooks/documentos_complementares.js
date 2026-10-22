/// <reference path="../pb_data/types.d.ts" />

/**
 * Endpoints pb_hooks para Documentos Complementares do Colaborador.
 * Permite que o colaborador acesse o material via link público (sem login)
 * e registre a confirmação de leitura ("Confirmo que li/assisti") com carimbo de data e hora.
 */

// 1. GET /backend/v1/colaborador/documento/publico?token=...
routerAdd('GET', '/backend/v1/colaborador/documento/publico', (e) => {
  try {
    const app = e.app || $app
    const token = (e.request.url.query().get('token') || '').trim()

    if (!token) {
      return e.json(400, { error: 'Token do documento é obrigatório.' })
    }

    let docRecord = null
    try {
      docRecord = app.findFirstRecordByData('colaborador_documentos', 'token', token)
    } catch (_) {}

    if (!docRecord) {
      return e.json(404, { error: 'Documento não encontrado para o token fornecido.' })
    }

    // Carregar colaborador
    let colabNome = ''
    let colabCargo = ''
    let colabSetor = ''
    const colabId = docRecord.getString('colaborador')
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

    // Carregar material do acervo central
    let materialData = null
    const matId = docRecord.getString('material')
    if (matId) {
      try {
        const mat = app.findRecordById('materiais', matId)
        if (mat) {
          const arquivoNome = mat.getString('arquivo')
          materialData = {
            id: mat.id,
            titulo: mat.getString('titulo'),
            descricao: mat.getString('descricao'),
            tipo: mat.getString('tipo'),
            url: mat.getString('url'),
            arquivo: arquivoNome,
            fileUrl: arquivoNome ? `/api/files/materiais/${mat.id}/${arquivoNome}` : null,
            ordem: mat.getInt('ordem'),
            obrigatorio: mat.getBool('obrigatorio'),
            duracao_estimada: mat.getInt('duracao_estimada'),
          }
        }
      } catch (_) {}
    }

    if (!materialData) {
      return e.json(404, { error: 'Material associado ao documento não foi localizado.' })
    }

    return e.json(200, {
      id: docRecord.id,
      token: docRecord.getString('token'),
      status: docRecord.getString('status') || 'pendente',
      confirmado_em: docRecord.getString('confirmado_em') || null,
      observacao: docRecord.getString('observacao') || '',
      atribuido_em: docRecord.getString('atribuido_em') || docRecord.getString('created'),
      atribuido_por: docRecord.getString('atribuido_por') || '',
      colaborador: {
        id: colabId,
        nome: colabNome,
        cargo: colabCargo,
        setor: colabSetor,
      },
      material: materialData,
    })
  } catch (err) {
    console.error('[Documentos Complementares Hook /publico] Erro:', err)
    return e.json(500, { error: 'Erro ao carregar o documento complementar.' })
  }
})

// 2. POST /backend/v1/colaborador/documento/confirmar
routerAdd('POST', '/backend/v1/colaborador/documento/confirmar', (e) => {
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
    if (!token) {
      return e.json(400, { error: 'Token do documento é obrigatório.' })
    }

    let docRecord = null
    try {
      docRecord = app.findFirstRecordByData('colaborador_documentos', 'token', token)
    } catch (_) {}

    if (!docRecord) {
      return e.json(404, { error: 'Documento não encontrado para o token fornecido.' })
    }

    if (docRecord.getString('status') === 'confirmado') {
      return e.json(200, {
        success: true,
        alreadyConfirmed: true,
        confirmado_em: docRecord.getString('confirmado_em'),
        message: 'Documento já havia sido confirmado anteriormente.',
      })
    }

    const agoraIso = new Date().toISOString().replace('T', ' ').slice(0, 19)
    let clientIp = ''
    try {
      clientIp = e.realIP() || e.request.remoteAddr || ''
    } catch (_) {}

    docRecord.set('status', 'confirmado')
    docRecord.set('confirmado_em', agoraIso)
    if (clientIp) {
      docRecord.set('confirmado_ip', clientIp)
    }
    app.save(docRecord)

    // Buscar título do material e nome do colaborador para o log de auditoria
    let colabNome = 'Colaborador'
    let colabId = docRecord.getString('colaborador')
    try {
      const colab = app.findRecordById('onboardings', colabId)
      if (colab) colabNome = colab.getString('colaborador_nome') || 'Colaborador'
    } catch (_) {}

    let matTitulo = 'Documento'
    try {
      const mat = app.findRecordById('materiais', docRecord.getString('material'))
      if (mat) matTitulo = mat.getString('titulo') || 'Documento'
    } catch (_) {}

    // Registrar auditoria
    try {
      const logsCol = app.findCollectionByNameOrId('logs_auditoria')
      const auditRecord = new Record(logsCol)
      auditRecord.set('acao', 'confirmar_documento_complementar')
      auditRecord.set('usuario_id', colabId || 'link_publico')
      auditRecord.set('usuario_nome', `${colabNome} (Link Público)`)
      auditRecord.set('colaborador_id', colabId)
      auditRecord.set('entidade_tipo', 'colaborador_documentos')
      auditRecord.set('entidade_id', docRecord.id)
      auditRecord.set(
        'detalhes',
        JSON.stringify({
          documento_id: docRecord.id,
          material_titulo: matTitulo,
          confirmado_em: agoraIso,
          ip: clientIp,
        }),
      )
      auditRecord.set('ip', clientIp)
      app.save(auditRecord)
    } catch (auditErr) {
      console.warn('[Documento Confirmar] Falha ao registrar log de auditoria:', auditErr)
    }

    return e.json(200, {
      success: true,
      confirmado_em: agoraIso,
      message: 'Confirmação de leitura registrada com sucesso.',
    })
  } catch (err) {
    console.error('[Documentos Complementares Hook /confirmar] Erro:', err)
    return e.json(500, { error: 'Erro ao confirmar leitura do documento complementar.' })
  }
})
