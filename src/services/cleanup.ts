import pb from '@/lib/pocketbase/client'
import type {
  User,
  Onboarding,
  MaterialBiblioteca,
  ModeloTarefa,
  LogAuditoria,
} from '@/types/onboarding'
import { auditoriaService } from '@/services/onboarding'

export interface CleanupStats {
  colaboradoresCount: number // nomes distintos de colaboradores
  onboardingsCount: number
  tarefasCount: number
  avaliacoesCount: number
  confirmacoesCount: number
  logsAuditoriaCount: number
  materiaisCount: number
  modeloTarefasCount: number
  modeloItensAssociadosCount: number // itens de modelo associados a material
  usersCount: number
  usersList: User[]
}

export interface CleanupExecutionResult {
  bloco: string
  sucesso: boolean
  itensRemovidos: number
  erros?: string[]
}

export interface CleanupPayload {
  limparColaboradoresEOnboardings: boolean
  limparLogsAuditoria: boolean
  limparMateriais: boolean
  limparModelosTarefas: 'nenhum' | 'associados_materiais' | 'todos_itens'
  limparUsuarios: boolean
  userIdsParaExcluir: string[] // IDs explícitos escolhidos para exclusão
  adminUsuario: {
    id: string
    nome: string
    email: string
    role: string
  }
}

export const cleanupService = {
  /**
   * Obtém as contagens em tempo real de cada bloco do sistema
   */
  async getStats(): Promise<CleanupStats> {
    const [
      onboardings,
      tarefas,
      avaliacoes,
      confirmacoes,
      logsAuditoria,
      materiais,
      modelos,
      users,
    ] = await Promise.all([
      pb
        .collection('onboardings')
        .getFullList<Onboarding>({ fields: 'id,colaborador_nome' })
        .catch(() => []),
      pb
        .collection('tarefas_onboarding')
        .getFullList({ fields: 'id' })
        .catch(() => []),
      pb
        .collection('avaliacoes')
        .getFullList({ fields: 'id' })
        .catch(() => []),
      pb
        .collection('confirmacoes_colaborador')
        .getFullList({ fields: 'id' })
        .catch(() => []),
      pb
        .collection('logs_auditoria')
        .getFullList<LogAuditoria>({ fields: 'id' })
        .catch(() => []),
      pb
        .collection('materiais')
        .getFullList<MaterialBiblioteca>({ fields: 'id,titulo,arquivo' })
        .catch(() => []),
      pb
        .collection('modelo_tarefas')
        .getFullList<ModeloTarefa>({ fields: 'id,titulo,material,etapa' })
        .catch(() => []),
      pb
        .collection('users')
        .getFullList<User>({ sort: 'name,email' })
        .catch(() => []),
    ])

    const nomesColaboradores = new Set(
      onboardings.map((o) => (o.colaborador_nome || '').trim().toLowerCase()).filter(Boolean),
    )

    const itensAssociados = modelos.filter((m) => Boolean(m.material)).length

    return {
      colaboradoresCount: nomesColaboradores.size,
      onboardingsCount: onboardings.length,
      tarefasCount: tarefas.length,
      avaliacoesCount: avaliacoes.length,
      confirmacoesCount: confirmacoes.length,
      logsAuditoriaCount: logsAuditoria.length,
      materiaisCount: materiais.length,
      modeloTarefasCount: modelos.length,
      modeloItensAssociadosCount: itensAssociados,
      usersCount: users.length,
      usersList: users,
    }
  },

  /**
   * Executa a limpeza em lotes por bloco, respeitando o payload selecionado pelo Admin.
   * Retorna o resumo de cada bloco executado.
   */
  async executeCleanup(payload: CleanupPayload): Promise<CleanupExecutionResult[]> {
    const results: CleanupExecutionResult[] = []

    // 1. Registro prévio na auditoria ANTES de qualquer exclusão
    try {
      const descricaoBlocos = [
        payload.limparColaboradoresEOnboardings ? 'Colaboradores/Onboardings' : null,
        payload.limparMateriais ? 'Materiais da Biblioteca' : null,
        payload.limparModelosTarefas !== 'nenhum'
          ? `Modelos de Tarefas (${payload.limparModelosTarefas})`
          : null,
        payload.limparUsuarios
          ? `Usuários (${payload.userIdsParaExcluir.length} selecionados)`
          : null,
        payload.limparLogsAuditoria ? 'Logs de Auditoria' : null,
      ]
        .filter(Boolean)
        .join(', ')

      await auditoriaService.registrar({
        usuarioId: payload.adminUsuario.id,
        usuarioNome: payload.adminUsuario.nome,
        usuarioRole: payload.adminUsuario.role,
        acao: 'Limpeza de Ambiente Executada',
        detalhes: `Admin ${payload.adminUsuario.nome} (${payload.adminUsuario.email}) iniciou limpeza de dados de teste nos blocos: ${descricaoBlocos}`,
        metadata: {
          timestamp: new Date().toISOString(),
          blocosSelecionados: {
            colaboradoresOnboardings: payload.limparColaboradoresEOnboardings,
            logsAuditoria: payload.limparLogsAuditoria,
            materiais: payload.limparMateriais,
            modelosTarefas: payload.limparModelosTarefas,
            usuarios: payload.userIdsParaExcluir,
          },
        },
      })
    } catch (err) {
      console.warn('Não foi possível registrar o log inicial da limpeza:', err)
    }

    // 2. BLOCO 1: Colaboradores + Onboardings (incluindo tarefas, confirmações, avaliações)
    if (payload.limparColaboradoresEOnboardings) {
      let totalRemovidos = 0
      const erros: string[] = []

      // 2.1 Apagar confirmações do colaborador
      try {
        const confs = await pb.collection('confirmacoes_colaborador').getFullList({ fields: 'id' })
        for (const c of confs) {
          try {
            await pb.collection('confirmacoes_colaborador').delete(c.id)
            totalRemovidos++
          } catch (e: unknown) {
            erros.push(
              `Falha ao excluir confirmação ${c.id}: ${e instanceof Error ? e.message : String(e)}`,
            )
          }
        }
      } catch (e) {
        console.warn('Erro ao listar confirmações:', e)
      }

      // 2.2 Apagar tarefas dos onboardings
      try {
        const tarefas = await pb.collection('tarefas_onboarding').getFullList({ fields: 'id' })
        for (const t of tarefas) {
          try {
            await pb.collection('tarefas_onboarding').delete(t.id)
            totalRemovidos++
          } catch (e: unknown) {
            erros.push(
              `Falha ao excluir tarefa ${t.id}: ${e instanceof Error ? e.message : String(e)}`,
            )
          }
        }
      } catch (e) {
        console.warn('Erro ao listar tarefas:', e)
      }

      // 2.3 Apagar avaliações dos onboardings
      try {
        const avals = await pb.collection('avaliacoes').getFullList({ fields: 'id' })
        for (const a of avals) {
          try {
            await pb.collection('avaliacoes').delete(a.id)
            totalRemovidos++
          } catch (e: unknown) {
            erros.push(
              `Falha ao excluir avaliação ${a.id}: ${e instanceof Error ? e.message : String(e)}`,
            )
          }
        }
      } catch (e) {
        console.warn('Erro ao listar avaliações:', e)
      }

      // 2.4 Apagar os onboardings
      try {
        const onbs = await pb.collection('onboardings').getFullList({ fields: 'id' })
        for (const o of onbs) {
          try {
            await pb.collection('onboardings').delete(o.id)
            totalRemovidos++
          } catch (e: unknown) {
            erros.push(
              `Falha ao excluir onboarding ${o.id}: ${e instanceof Error ? e.message : String(e)}`,
            )
          }
        }
      } catch (e) {
        console.warn('Erro ao listar onboardings:', e)
      }

      results.push({
        bloco: 'Colaboradores & Onboardings',
        sucesso: erros.length === 0,
        itensRemovidos: totalRemovidos,
        erros: erros.length > 0 ? erros.slice(0, 5) : undefined,
      })
    }

    // 3. BLOCO 2: Materiais da biblioteca
    if (payload.limparMateriais) {
      let totalRemovidos = 0
      const erros: string[] = []

      try {
        // Desvincular material de modelo_tarefas antes de excluir, para evitar erro de integridade
        const modelosComMaterial = await pb
          .collection('modelo_tarefas')
          .getFullList<ModeloTarefa>({
            filter: "material != '' && material != null",
            fields: 'id',
          })
          .catch(() => [])

        for (const m of modelosComMaterial) {
          try {
            await pb.collection('modelo_tarefas').update(m.id, { material: null })
          } catch {
            /* intentionally ignored */
          }
        }

        const materiais = await pb.collection('materiais').getFullList({ fields: 'id' })
        for (const mat of materiais) {
          try {
            await pb.collection('materiais').delete(mat.id)
            totalRemovidos++
          } catch (e: unknown) {
            erros.push(
              `Falha ao excluir material ${mat.id}: ${e instanceof Error ? e.message : String(e)}`,
            )
          }
        }
      } catch (e: unknown) {
        erros.push(
          `Erro geral ao processar materiais: ${e instanceof Error ? e.message : String(e)}`,
        )
      }

      results.push({
        bloco: 'Materiais da Biblioteca',
        sucesso: erros.length === 0,
        itensRemovidos: totalRemovidos,
        erros: erros.length > 0 ? erros.slice(0, 5) : undefined,
      })
    }

    // 4. BLOCO 3: Modelos de Tarefas
    if (payload.limparModelosTarefas !== 'nenhum') {
      let totalRemovidos = 0
      const erros: string[] = []

      try {
        let modelosParaExcluir: { id: string }[] = []
        if (payload.limparModelosTarefas === 'associados_materiais') {
          // Apenas itens que apontam para material
          modelosParaExcluir = await pb.collection('modelo_tarefas').getFullList({
            filter: "material != '' && material != null",
            fields: 'id',
          })
        } else if (payload.limparModelosTarefas === 'todos_itens') {
          // Todos os itens de modelos de tarefas
          modelosParaExcluir = await pb.collection('modelo_tarefas').getFullList({
            fields: 'id',
          })
        }

        for (const mod of modelosParaExcluir) {
          try {
            await pb.collection('modelo_tarefas').delete(mod.id)
            totalRemovidos++
          } catch (e: unknown) {
            erros.push(
              `Falha ao excluir item de modelo ${mod.id}: ${e instanceof Error ? e.message : String(e)}`,
            )
          }
        }
      } catch (e: unknown) {
        erros.push(`Erro geral ao processar modelos: ${e instanceof Error ? e.message : String(e)}`)
      }

      results.push({
        bloco: 'Itens dos Modelos de Tarefas',
        sucesso: erros.length === 0,
        itensRemovidos: totalRemovidos,
        erros: erros.length > 0 ? erros.slice(0, 5) : undefined,
      })
    }

    // 5. BLOCO 4: Usuários selecionados (com proteção estrita ao Admin logado)
    if (payload.limparUsuarios && payload.userIdsParaExcluir.length > 0) {
      let totalRemovidos = 0
      const erros: string[] = []

      // Garantir categoricamente que o admin logado NUNCA seja apagado
      const safeIds = payload.userIdsParaExcluir.filter((id) => id !== payload.adminUsuario.id)

      for (const uid of safeIds) {
        try {
          await pb.collection('users').delete(uid)
          totalRemovidos++
        } catch (e: unknown) {
          erros.push(
            `Falha ao excluir usuário ${uid}: ${e instanceof Error ? e.message : String(e)}`,
          )
        }
      }

      results.push({
        bloco: 'Usuários de Teste',
        sucesso: erros.length === 0,
        itensRemovidos: totalRemovidos,
        erros: erros.length > 0 ? erros.slice(0, 5) : undefined,
      })
    }

    // 6. BLOCO 5: Logs de auditoria (executado por último para preservar rastreio até o fim)
    if (payload.limparLogsAuditoria) {
      let totalRemovidos = 0
      const erros: string[] = []

      try {
        const logs = await pb.collection('logs_auditoria').getFullList({ fields: 'id' })
        for (const log of logs) {
          try {
            await pb.collection('logs_auditoria').delete(log.id)
            totalRemovidos++
          } catch (e: unknown) {
            erros.push(
              `Falha ao excluir log ${log.id}: ${e instanceof Error ? e.message : String(e)}`,
            )
          }
        }
      } catch (e: unknown) {
        erros.push(`Erro geral ao excluir logs: ${e instanceof Error ? e.message : String(e)}`)
      }

      results.push({
        bloco: 'Logs de Auditoria',
        sucesso: erros.length === 0,
        itensRemovidos: totalRemovidos,
        erros: erros.length > 0 ? erros.slice(0, 5) : undefined,
      })
    }

    return results
  },
}
