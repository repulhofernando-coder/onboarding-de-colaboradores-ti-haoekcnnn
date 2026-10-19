/**
 * Utilitários para filtragem e visibilidade por departamento do papel Gestão.
 *
 * Decisões de negócio aprovadas:
 * 1. Admin e RH visualizam todos os setores irrestritamente.
 * 2. Gestão visualiza APENAS o seu próprio setor em todas as telas.
 * 3. A base do filtro é o campo `setor` do cadastro do usuário, NÃO o campo `gestor_id`.
 * 4. Se o usuário com papel Gestão não tiver setor definido, nenhum dado de setor deve ser exibido,
 *    e um alerta informativo orienta a solicitar ao Admin/RH a definição do setor.
 */

import type { User, SetorModel } from '@/types/onboarding'

/**
 * Normaliza uma string de setor para comparação sem case / espaços / acentos.
 */
export function normalizarSetor(val?: string | null): string {
  if (!val) return ''
  return val
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/**
 * Verifica se dois setores coincidem considerando texto, chave, nome ou id.
 */
export function setoresCoincidem(
  setorAlvo?: string | null,
  setorRefId?: string | null,
  setorUsuario?: string | null,
  setoresCadastrados?: SetorModel[],
): boolean {
  if (!setorUsuario) return false

  const uNorm = normalizarSetor(setorUsuario)
  if (!uNorm) return false

  // Se setorUsuario corresponder diretamente ao setorAlvo (ex: "windows", "Windows")
  if (setorAlvo && normalizarSetor(setorAlvo) === uNorm) {
    return true
  }

  // Se tivermos lista de setores cadastrados, podemos expandir chave, nome e id do setor do usuário
  if (setoresCadastrados && setoresCadastrados.length > 0) {
    const setorModelUsuario = setoresCadastrados.find(
      (s) =>
        normalizarSetor(s.id) === uNorm ||
        normalizarSetor(s.chave) === uNorm ||
        normalizarSetor(s.nome) === uNorm,
    )

    if (setorModelUsuario) {
      // Comparar contra setorRefId
      if (
        setorRefId &&
        (setorRefId === setorModelUsuario.id ||
          normalizarSetor(setorRefId) === normalizarSetor(setorModelUsuario.chave))
      ) {
        return true
      }
      // Comparar contra setorAlvo
      if (setorAlvo) {
        const aNorm = normalizarSetor(setorAlvo)
        if (
          aNorm === normalizarSetor(setorModelUsuario.id) ||
          aNorm === normalizarSetor(setorModelUsuario.chave) ||
          aNorm === normalizarSetor(setorModelUsuario.nome)
        ) {
          return true
        }
      }
    }
  }

  // Checagem de substring ou contenção se um contiver o outro
  if (setorAlvo) {
    const aNorm = normalizarSetor(setorAlvo)
    if (aNorm === uNorm || aNorm.includes(uNorm) || uNorm.includes(aNorm)) {
      return true
    }
  }

  return false
}

/**
 * Retorna true se o usuário autenticado pode visualizar dados do setor em questão.
 * - Admin e RH: true para qualquer setor.
 * - Gestão: true somente se tiver setor configurado e coincidir com o setor alvo.
 */
export function podeVisualizarSetor(params: {
  role?: string | null
  userSetor?: string | null
  itemSetor?: string | null
  itemSetorRef?: string | null
  setoresCadastrados?: SetorModel[]
}): boolean {
  const { role, userSetor, itemSetor, itemSetorRef, setoresCadastrados } = params

  if (!role || role === 'admin' || role === 'rh') {
    return true
  }

  if (role === 'gestao') {
    if (!userSetor || !userSetor.trim()) {
      return false // Usuário sem setor cadastrado não vê nenhum departamento
    }

    return setoresCoincidem(itemSetor, itemSetorRef, userSetor, setoresCadastrados)
  }

  return true
}

/**
 * Obtém o nome amigável do setor do usuário para exibição no Header ou avisos.
 */
export function getSetorUsuarioNome(user?: User | null, setoresList?: SetorModel[]): string {
  if (!user || !user.setor) return ''
  const uNorm = normalizarSetor(user.setor)

  if (setoresList && setoresList.length > 0) {
    const found = setoresList.find(
      (s) =>
        normalizarSetor(s.id) === uNorm ||
        normalizarSetor(s.chave) === uNorm ||
        normalizarSetor(s.nome) === uNorm,
    )
    if (found) return found.nome
  }

  // Capitalização simples como fallback
  return user.setor
}
