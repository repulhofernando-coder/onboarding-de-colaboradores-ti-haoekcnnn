/// <reference path="../pb_data/types.d.ts" />

/**
 * Endpoint server-side para exclusão completa em cascata de colaboradores.
 *
 * Rota 1: GET  /backend/v1/colaborador-resumo-exclusao?nome=...&email=...
 * Retorna contagens de onboardings, tarefas, confirmações, avaliações vinculadas ao colaborador.
 *
 * Rota 2: POST /backend/v1/excluir-colaborador
 * Executa exclusão em cascata completa do colaborador e seus registros:
 * - Localiza todos os onboardings do colaborador (por nome / email / ID)
 * - Apaga todas as confirmacoes_colaborador vinculadas
 * - Apaga todas as tarefas_onboarding vinculadas
 * - Apaga todas as avaliacoes vinculadas
 * - Invalida/limpa os tokens e apaga todos os onboardings vinculados
 * - Registra log formal de auditoria em logs_auditoria com quem excluiu, quando, o motivo e o resumo
 * - NUNCA exclui usuários de acesso (coleção users)
 * - Valida permissão estrita: apenas RH ou Admin podem executar (gestor bloqueado)
 */

routerAdd('GET', '/backend/v1/colaborador-resumo-exclusao', (e) => {
  try {
    const app = e.app || $app

    // Verificar autenticação
    const authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { error: 'Usuário não autenticado.' })
    }

    const role = (authRecord.getString('role') || '').toLowerCase()
    const setor = (authRecord.getString('setor') || '').toUpperCase()
    const isAdmin = role === 'admin'
    const isRH = role === 'rh' || setor === 'RH'

    if (!isAdmin && !isRH) {
      return e.json(403, {
        error: 'Permissão negada. Apenas Admin e RH podem consultar resumo para exclusão.',
      })
    }

    const queryNome = (e.request.url.query().get('nome') || '').trim()
    const queryEmail = (e.request.url.query().get('email') || '').trim()
    const onboardingId = (e.request.url.query().get('onboardingId') || '').trim()

    let onboardings = []

    if (onboardingId) {
      try {
        const onb = app.findRecordById('onboardings', onboardingId)
        if (onb) {
          const nomeRef = onb.getString('colaborador_nome').trim()
          const emailRef = onb.getString('colaborador_email').trim()
          // Buscar todos os onboardings desse mesmo colaborador
          if (emailRef) {
            onboardings = app.findRecordsByFilter(
              'onboardings',
              `colaborador_email = '${emailRef.replace(/'/g, "''")}'`,
              '-created',
              100,
              0,
            )
          } else if (nomeRef) {
            onboardings = app.findRecordsByFilter(
              'onboardings',
              `colaborador_nome = '${nomeRef.replace(/'/g, "''")}'`,
              '-created',
              100,
              0,
            )
          } else {
            onboardings = [onb]
          }
        }
      } catch (_) {}
    } else if (queryEmail) {
      try {
        onboardings = app.findRecordsByFilter(
          'onboardings',
          `colaborador_email = '${queryEmail.replace(/'/g, "''")}'`,
          '-created',
          100,
          0,
        )
      } catch (_) {}
    } else if (queryNome) {
      try {
        onboardings = app.findRecordsByFilter(
          'onboardings',
          `colaborador_nome = '${queryNome.replace(/'/g, "''")}'`,
          '-created',
          100,
          0,
        )
      } catch (_) {}
    }

    const onbIds = onboardings.map((o) => o.id)
    let tarefasCount = 0
    let confirmacoesCount = 0
    let avaliacoesCount = 0
    const tokensList = []

    for (const onb of onboardings) {
      const tok = onb.getString('token_acesso_colaborador')
      if (tok) tokensList.push(tok)

      try {
        const tList = app.findRecordsByFilter(
          'tarefas_onboarding',
          `onboarding_id = '${onb.id}'`,
          '',
          500,
          0,
        )
        tarefasCount += tList.length
      } catch (_) {}

      try {
        const cList = app.findRecordsByFilter(
          'confirmacoes_colaborador',
          `onboarding = '${onb.id}'`,
          '',
          500,
          0,
        )
        confirmacoesCount += cList.length
      } catch (_) {}

      try {
        const aList = app.findRecordsByFilter(
          'avaliacoes',
          `onboarding_id = '${onb.id}'`,
          '',
          500,
          0,
        )
        avaliacoesCount += aList.length
      } catch (_) {}
    }

    const colaboradorNomePrincipal = onboardings[0]
      ? onboardings[0].getString('colaborador_nome')
      : queryNome
    const colaboradorEmailPrincipal = onboardings[0]
      ? onboardings[0].getString('colaborador_email')
      : queryEmail

    return e.json(200, {
      colaboradorNome: colaboradorNomePrincipal,
      colaboradorEmail: colaboradorEmailPrincipal,
      totalOnboardings: onboardings.length,
      onboardingIds: onbIds,
      tarefasCount,
      confirmacoesCount,
      avaliacoesCount,
      tokensCount: tokensList.length,
    })
  } catch (err) {
    console.error('[Resumo Exclusao] Erro:', err)
    return e.json(500, { error: 'Erro ao calcular resumo de exclusão do colaborador.' })
  }
})

routerAdd('POST', '/backend/v1/excluir-colaborador', (e) => {
  try {
    const app = e.app || $app

    // 1. Verificar autenticação
    const authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { error: 'Usuário não autenticado.' })
    }

    const role = (authRecord.getString('role') || '').toLowerCase()
    const setor = (authRecord.getString('setor') || '').toUpperCase()
    const isAdmin = role === 'admin'
    const isRH = role === 'rh' || setor === 'RH'

    // 2. Permissões: apenas RH e Admin
    if (!isAdmin && !isRH) {
      return e.json(403, {
        error: 'Permissão negada. Apenas Administrador e RH podem excluir colaboradores.',
      })
    }

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

    const colaboradorNomeParam = (data.colaboradorNome || '').trim()
    const colaboradorEmailParam = (data.colaboradorEmail || '').trim()
    const onboardingIdParam = (data.onboardingId || '').trim()
    const motivo = (data.motivo || '').trim()
    const nomeConfirmacao = (data.nomeConfirmacao || '').trim()

    if (!colaboradorNomeParam && !onboardingIdParam && !colaboradorEmailParam) {
      return e.json(400, { error: 'Identificação do colaborador é obrigatória.' })
    }

    // 3. Localizar os onboardings vinculados
    let onboardings = []
    if (onboardingIdParam) {
      try {
        const onb = app.findRecordById('onboardings', onboardingIdParam)
        if (onb) {
          const nomeRef = onb.getString('colaborador_nome').trim()
          const emailRef = onb.getString('colaborador_email').trim()
          if (emailRef) {
            onboardings = app.findRecordsByFilter(
              'onboardings',
              `colaborador_email = '${emailRef.replace(/'/g, "''")}'`,
              '-created',
              100,
              0,
            )
          } else if (nomeRef) {
            onboardings = app.findRecordsByFilter(
              'onboardings',
              `colaborador_nome = '${nomeRef.replace(/'/g, "''")}'`,
              '-created',
              100,
              0,
            )
          } else {
            onboardings = [onb]
          }
        }
      } catch (_) {}
    } else if (colaboradorEmailParam) {
      try {
        onboardings = app.findRecordsByFilter(
          'onboardings',
          `colaborador_email = '${colaboradorEmailParam.replace(/'/g, "''")}'`,
          '-created',
          100,
          0,
        )
      } catch (_) {}
    } else if (colaboradorNomeParam) {
      try {
        onboardings = app.findRecordsByFilter(
          'onboardings',
          `colaborador_nome = '${colaboradorNomeParam.replace(/'/g, "''")}'`,
          '-created',
          100,
          0,
        )
      } catch (_) {}
    }

    if (onboardings.length === 0) {
      return e.json(404, {
        error: 'Nenhum registro de onboarding encontrado para este colaborador.',
      })
    }

    const colabNomeReal = onboardings[0].getString('colaborador_nome').trim()
    const colabEmailReal = onboardings[0].getString('colaborador_email').trim()

    // 4. Validar nome de confirmação digitado
    if (!nomeConfirmacao) {
      return e.json(400, { error: 'Confirmação com o nome do colaborador é obrigatória.' })
    }

    if (nomeConfirmacao.toLowerCase() !== colabNomeReal.toLowerCase()) {
      return e.json(400, {
        error: `Nome digitado para confirmação ("${nomeConfirmacao}") não confere com o nome do colaborador ("${colabNomeReal}").`,
      })
    }

    // Identificar executor
    const usuarioId = authRecord.id
    const usuarioNome = authRecord.getString('name') || authRecord.getString('email') || 'Usuário'
    const usuarioRole = role || (isRH ? 'rh' : 'admin')

    // 5. Coletar contagens e executar exclusão em cascata dentro de transação atômica
    let totalTarefas = 0
    let totalConfirmacoes = 0
    let totalAvaliacoes = 0
    const totalOnboardings = onboardings.length
    const onbIds = onboardings.map((o) => o.id)
    const gestoresNomes = []

    for (const onb of onboardings) {
      const gId = onb.getString('gestor_id')
      if (gId) {
        try {
          const gRec = app.findRecordById('users', gId)
          if (gRec) {
            const gNome = gRec.getString('name')
            if (gNome && !gestoresNomes.includes(gNome)) gestoresNomes.push(gNome)
          }
        } catch (_) {}
      }
    }

    // Executar a exclusão em cascata
    app.runInTransaction((txApp) => {
      // 5.1 Para cada onboarding, remover confirmações, tarefas e avaliações
      for (const onb of onboardings) {
        // Confirmações do colaborador
        try {
          const confs = txApp.findRecordsByFilter(
            'confirmacoes_colaborador',
            `onboarding = '${onb.id}'`,
            '',
            500,
            0,
          )
          for (const c of confs) {
            txApp.delete(c)
            totalConfirmacoes++
          }
        } catch (e) {
          console.warn('[Excluir Colaborador] Aviso ao apagar confirmacoes:', e)
        }

        // Tarefas do onboarding
        try {
          const tarefas = txApp.findRecordsByFilter(
            'tarefas_onboarding',
            `onboarding_id = '${onb.id}'`,
            '',
            500,
            0,
          )
          for (const t of tarefas) {
            txApp.delete(t)
            totalTarefas++
          }
        } catch (e) {
          console.warn('[Excluir Colaborador] Aviso ao apagar tarefas:', e)
        }

        // Avaliações
        try {
          const avals = txApp.findRecordsByFilter(
            'avaliacoes',
            `onboarding_id = '${onb.id}'`,
            '',
            500,
            0,
          )
          for (const a of avals) {
            txApp.delete(a)
            totalAvaliacoes++
          }
        } catch (e) {
          console.warn('[Excluir Colaborador] Aviso ao apagar avaliacoes:', e)
        }

        // 5.2 Apagar o onboarding em si (o token_acesso_colaborador morre com o registro)
        txApp.delete(onb)
      }

      // 6. Registrar log formal de auditoria permanente na coleção logs_auditoria
      // NOTA: onboarding_id fica null pois os registros foram excluídos, mas colaborador_nome e detalhes mantêm rastreio total
      try {
        const logsCol = txApp.findCollectionByNameOrId('logs_auditoria')
        const logRecord = new Record(logsCol)
        logRecord.set('onboarding_id', null)
        logRecord.set('colaborador_nome', colabNomeReal)
        logRecord.set('usuario_id', usuarioId)
        logRecord.set('usuario_nome', usuarioNome)
        logRecord.set('usuario_role', usuarioRole)
        logRecord.set('gestor_nome', gestoresNomes.join(', ') || '')
        logRecord.set('acao', 'Exclusão de colaborador (Cascata)')

        const motivoStr = motivo ? ` | Motivo informado: "${motivo}"` : ' | Motivo: Não informado'
        const resumoItens = `${totalOnboardings} onboarding(s), ${totalTarefas} tarefa(s), ${totalConfirmacoes} confirmação(ões) do portal e ${totalAvaliacoes} avaliação(ões)`
        logRecord.set(
          'detalhes',
          `Colaborador "${colabNomeReal}" (${colabEmailReal || 'sem e-mail'}) foi excluído permanentemente do sistema por ${usuarioNome} (${usuarioRole}). Cascata removida: ${resumoItens}.${motivoStr}`,
        )
        logRecord.set('fora_prazo', false)
        logRecord.set('destaque_prazo', '')
        logRecord.set('metadata', {
          tipo_operacao: 'exclusao_colaborador_cascata',
          colaborador_nome: colabNomeReal,
          colaborador_email: colabEmailReal,
          onboardings_removidos_ids: onbIds,
          total_onboardings: totalOnboardings,
          total_tarefas: totalTarefas,
          total_confirmacoes: totalConfirmacoes,
          total_avaliacoes: totalAvaliacoes,
          motivo: motivo || null,
          executado_por_id: usuarioId,
          executado_por_nome: usuarioNome,
          executado_por_role: usuarioRole,
          data_hora: new Date().toISOString(),
        })
        txApp.save(logRecord)
      } catch (errLog) {
        console.error('[Excluir Colaborador] Erro ao registrar log de auditoria:', errLog)
      }
    })

    console.log(
      `[Excluir Colaborador] Concluído com sucesso para ${colabNomeReal}. Onboardings: ${totalOnboardings}, Tarefas: ${totalTarefas}, Confirmações: ${totalConfirmacoes}`,
    )

    return e.json(200, {
      success: true,
      colaboradorNome: colabNomeReal,
      totalOnboardings,
      totalTarefas,
      totalConfirmacoes,
      totalAvaliacoes,
      motivo: motivo || null,
      message: `Colaborador ${colabNomeReal} e todos os seus vínculos foram excluídos com sucesso.`,
    })
  } catch (err) {
    console.error('[Excluir Colaborador] Erro fatal:', err)
    return e.json(500, {
      error: `Falha interna ao excluir colaborador: ${err && err.message ? err.message : String(err)}`,
    })
  }
})
