import React, { useState, useEffect, useMemo } from 'react'
import { userService, setorService, auditoriaService } from '@/services/onboarding'
import { useAuth } from '@/contexts/AuthContext'
import type { User, UserRole, SetorModel } from '@/types/onboarding'
import { ROLES_INFO } from '@/types/onboarding'
import { getSetorUsuarioNome } from '@/lib/gestaoVisibility'
import {
  Users,
  Search,
  Plus,
  Mail,
  Calendar,
  Shield,
  ShieldCheck,
  UserCheck,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  KeyRound,
  AlertTriangle,
  Lock,
  Layers,
  Info,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'

export default function Usuarios() {
  const {
    user: currentUser,
    role: currentRole,
    isAdmin: isCurrentAdmin,
    isRH: isCurrentRH,
  } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [setores, setSetores] = useState<SetorModel[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState<'todos' | UserRole>('todos')

  // Modais de Criação e Edição
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [saving, setSaving] = useState(false)

  // Campos do formulário
  const [formNome, setFormNome] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formRole, setFormRole] = useState<UserRole>('gestao')
  const [formSetor, setFormSetor] = useState<string>('')
  const [formPodeEditarQuestionarios, setFormPodeEditarQuestionarios] = useState(false)
  const [formSenha, setFormSenha] = useState('')
  const [formSenhaAtual, setFormSenhaAtual] = useState('')
  const [formAtivo, setFormAtivo] = useState(true)

  // Modal de Exclusão
  const [deleteUser, setDeleteUser] = useState<User | null>(null)
  const [deleting, setDeleting] = useState(false)

  const canEditUsers = isCurrentAdmin || isCurrentRH

  const fetchUsers = async () => {
    try {
      const [userList, setorList] = await Promise.all([
        userService.getAllUsers(),
        setorService.listAtivos(),
      ])
      setUsers(userList)
      setSetores(setorList)
    } catch (err) {
      console.error(err)
      toast.error('Erro ao carregar lista de usuários ou setores.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  // Determina o papel do usuário (com fallback para setor se role não preenchido)
  const getUserRole = (u: User): UserRole => {
    if (u.role === 'admin' || u.role === 'rh' || u.role === 'gestao') return u.role
    if (u.setor === 'RH') return 'rh'
    return 'gestao'
  }

  const handleOpenCreate = () => {
    if (!canEditUsers) {
      toast.error('Apenas Administrador e RH podem cadastrar usuários.')
      return
    }
    setEditingUser(null)
    setFormNome('')
    setFormEmail('')
    setFormRole('gestao')
    setFormSetor('')
    setFormPodeEditarQuestionarios(false)
    setFormSenha('')
    setFormSenhaAtual('')
    setFormAtivo(true)
    setModalOpen(true)
  }

  const handleOpenEdit = (u: User) => {
    if (!canEditUsers) {
      toast.error('Apenas Administrador e RH podem editar usuários.')
      return
    }
    const targetRole = getUserRole(u)
    // Se o usuário atual for RH e o alvo for Admin, RH não pode editar o Admin
    if (!isCurrentAdmin && targetRole === 'admin') {
      toast.error('Você não tem permissão para editar um usuário Administrador.')
      return
    }

    setEditingUser(u)
    setFormNome(u.name || '')
    setFormEmail(u.email || '')
    setFormRole(targetRole)
    // Setor atual: usar o nome/chave cadastrado
    setFormSetor(u.setor || '')
    setFormPodeEditarQuestionarios(Boolean(u.pode_editar_questionarios))
    setFormSenha('')
    setFormSenhaAtual('')
    setFormAtivo(u.ativo !== false)
    setModalOpen(true)
  }

  const { refreshUser } = useAuth()

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formNome.trim()) {
      toast.error('Preencha o nome do usuário.')
      return
    }

    if (!formEmail.trim()) {
      toast.error('Preencha o e-mail corporativo.')
      return
    }

    // Validação de senha
    if (!editingUser) {
      if (!formSenha || formSenha.length < 8) {
        toast.error('A senha inicial deve ter no mínimo 8 caracteres.')
        return
      }
    } else if (formSenha && formSenha.length < 8) {
      toast.error('A nova senha deve ter no mínimo 8 caracteres.')
      return
    }

    setSaving(true)
    try {
      const valorPermissao = formRole === 'gestao' ? formPodeEditarQuestionarios : false

      if (!editingUser) {
        // Criar usuário
        const novoUsuario = await userService.create({
          name: formNome,
          email: formEmail,
          password: formSenha,
          role: formRole,
          setor: formSetor,
          ativo: formAtivo,
          pode_editar_questionarios: valorPermissao,
        })

        if (formRole === 'gestao' && valorPermissao) {
          await auditoriaService.registrar({
            usuarioId: currentUser?.id || '',
            usuarioNome: currentUser?.name || currentUser?.email || 'Administrador',
            usuarioRole: currentRole,
            acao: 'Concessão de Permissão de Questionários',
            detalhes: `${currentUser?.name || 'Administrador'} cadastrou o gestor ${formNome} com a permissão 'Pode editar questionários do seu setor' ativada.`,
            metadata: {
              alvo_usuario_id: novoUsuario.id,
              alvo_usuario_nome: formNome,
              pode_editar_questionarios: true,
            },
          })
        }

        toast.success(`Usuário ${formNome} criado com sucesso!`)
      } else {
        // Editar usuário
        const emailAlterado =
          formEmail.trim().toLowerCase() !== (editingUser.email || '').trim().toLowerCase()
        const permissaoAnterior = Boolean(editingUser.pode_editar_questionarios)
        const permissaoAlterada = formRole === 'gestao' && valorPermissao !== permissaoAnterior

        // PocketBase não permite alteração direta de e-mail em auth records sem confirmação de senha.
        // Se o e-mail foi alterado no formulário:
        // NÃO enviamos o novo e-mail no PATCH (evitando HTTP 400 validation_values_mismatch),
        // salvamos os demais campos (nome, papel, setor, ativo, senha se informada),
        // e alertamos o administrador de forma clara sobre a restrição de alteração de e-mail.
        const temNovaSenha = formSenha.trim() !== ''
        try {
          await userService.update(
            editingUser.id,
            {
              name: formNome,
              // Nunca envia e-mail diferente no update para evitar rejeição do PocketBase
              email: undefined,
              role: formRole,
              setor: formSetor,
              ativo: formAtivo,
              pode_editar_questionarios: valorPermissao,
              password: temNovaSenha ? formSenha : undefined,
              oldPassword:
                temNovaSenha && formSenhaAtual.trim() !== '' ? formSenhaAtual : undefined,
            },
            editingUser.email,
          )

          if (permissaoAlterada) {
            await auditoriaService.registrar({
              usuarioId: currentUser?.id || '',
              usuarioNome: currentUser?.name || currentUser?.email || 'Administrador',
              usuarioRole: currentRole,
              acao: valorPermissao
                ? 'Concessão de Permissão de Questionários'
                : 'Revogação de Permissão de Questionários',
              detalhes: `${currentUser?.name || 'Administrador'} ${
                valorPermissao ? 'concedeu' : 'revogou'
              } a permissão 'Pode editar questionários do seu setor' para o usuário ${editingUser.name}.`,
              metadata: {
                alvo_usuario_id: editingUser.id,
                alvo_usuario_nome: editingUser.name,
                pode_editar_questionarios_anterior: permissaoAnterior,
                pode_editar_questionarios_novo: valorPermissao,
              },
            })
          }
        } catch (updateErr: unknown) {
          const updateErrObj = updateErr as {
            status?: number
            data?: {
              data?: Record<string, { code?: string; message?: string }>
              message?: string
            }
            message?: string
          }

          const oldPasswordError = updateErrObj?.data?.data?.oldPassword
          const isOldPasswordError =
            oldPasswordError?.code === 'validation_required' ||
            oldPasswordError?.code === 'validation_values_mismatch' ||
            (oldPasswordError?.message &&
              (oldPasswordError.message.toLowerCase().includes('blank') ||
                oldPasswordError.message.toLowerCase().includes('match')))

          if (temNovaSenha && isOldPasswordError) {
            // Salva os demais dados (nome, papel, setor, status) normalmente
            await userService.update(
              editingUser.id,
              {
                name: formNome,
                email: undefined,
                role: formRole,
                setor: formSetor,
                ativo: formAtivo,
                pode_editar_questionarios: valorPermissao,
              },
              editingUser.email,
            )

            if (permissaoAlterada) {
              await auditoriaService.registrar({
                usuarioId: currentUser?.id || '',
                usuarioNome: currentUser?.name || currentUser?.email || 'Administrador',
                usuarioRole: currentRole,
                acao: valorPermissao
                  ? 'Concessão de Permissão de Questionários'
                  : 'Revogação de Permissão de Questionários',
                detalhes: `${currentUser?.name || 'Administrador'} ${
                  valorPermissao ? 'concedeu' : 'revogou'
                } a permissão 'Pode editar questionários do seu setor' para o usuário ${editingUser.name}.`,
                metadata: {
                  alvo_usuario_id: editingUser.id,
                  alvo_usuario_nome: editingUser.name,
                  pode_editar_questionarios_anterior: permissaoAnterior,
                  pode_editar_questionarios_novo: valorPermissao,
                },
              })
            }

            toast.error(
              "Não foi possível alterar a senha: informe a senha atual do usuário ou oriente-o a usar 'Esqueci minha senha'.",
              { duration: 7000 },
            )

            if (emailAlterado) {
              toast.warning(
                'Dados do usuário atualizados, exceto o e-mail: alterar o e-mail de um usuário existente requer confirmação por senha — recrie o usuário ou contate o administrador.',
                { duration: 7000 },
              )
            } else {
              toast.success(
                `Dados cadastrais de ${formNome} atualizados com sucesso (senha não alterada).`,
              )
            }

            setModalOpen(false)
            await fetchUsers()
            return
          }

          throw updateErr
        }

        if (emailAlterado) {
          toast.warning(
            'Dados do usuário atualizados, exceto o e-mail: alterar o e-mail de um usuário existente requer confirmação por senha — recrie o usuário ou contate o administrador.',
            { duration: 7000 },
          )
        } else {
          toast.success(`Usuário ${formNome} atualizado com sucesso!`)
        }
      }

      setModalOpen(false)
      await fetchUsers()
      if (editingUser && currentUser?.id === editingUser.id) {
        try {
          await refreshUser()
        } catch {
          /* intentionally ignored */
        }
      }
    } catch (err: unknown) {
      console.error(err)
      const errorObj = err as {
        status?: number
        response?: {
          data?: Record<string, { code?: string; message?: string }>
          message?: string
        }
        data?: {
          data?: Record<string, { code?: string; message?: string }>
          message?: string
        }
        message?: string
      }

      const validationData =
        errorObj?.response?.data ||
        errorObj?.data?.data ||
        (errorObj?.data as unknown as Record<string, { code?: string; message?: string }>)

      const emailError = validationData?.email
      const isMismatchOrEmailAuthError =
        emailError?.code === 'validation_values_mismatch' ||
        (emailError?.message && emailError.message.toLowerCase().includes("values don't match"))

      const oldPasswordError = validationData?.oldPassword
      const isOldPasswordError =
        oldPasswordError?.code === 'validation_required' ||
        oldPasswordError?.code === 'validation_values_mismatch' ||
        (oldPasswordError?.message &&
          (oldPasswordError.message.toLowerCase().includes('blank') ||
            oldPasswordError.message.toLowerCase().includes('match')))

      const verifiedError = validationData?.verified
      const passwordError = validationData?.password || validationData?.passwordConfirm
      const nameError = validationData?.name
      const roleError = validationData?.role

      if (isOldPasswordError) {
        toast.error(
          "Não foi possível alterar a senha: informe a senha atual do usuário ou oriente-o a usar 'Esqueci minha senha'.",
          { duration: 7000 },
        )
      } else if (isMismatchOrEmailAuthError) {
        toast.error(
          'Não foi possível salvar: a alteração de e-mail requer confirmação por senha — recrie o usuário ou contate o administrador.',
          { duration: 6000 },
        )
      } else if (
        emailError?.code === 'validation_not_unique' ||
        (emailError?.message &&
          (emailError.message.toLowerCase().includes('unique') ||
            emailError.message.toLowerCase().includes('already')))
      ) {
        toast.error('Este e-mail já está cadastrado no sistema.')
      } else if (
        emailError?.code === 'validation_is_email' ||
        (emailError?.message && emailError.message.toLowerCase().includes('valid email'))
      ) {
        toast.error('Informe um endereço de e-mail válido.')
      } else if (passwordError) {
        toast.error('A senha deve conter no mínimo 8 caracteres e coincidir com a confirmação.')
      } else if (verifiedError) {
        toast.error('Erro de validação do status do usuário no servidor.')
      } else if (nameError) {
        toast.error('Preencha o nome completo do usuário.')
      } else if (roleError) {
        toast.error('Selecione um papel de acesso válido.')
      } else if (
        emailError ||
        (errorObj?.message && errorObj.message.toLowerCase().includes('email'))
      ) {
        toast.error('Este e-mail já está cadastrado no sistema.')
      } else {
        toast.error(
          editingUser
            ? 'Não foi possível atualizar o usuário. Verifique os dados informados.'
            : 'Não foi possível criar o usuário. Verifique os dados informados.',
        )
      }
    } finally {
      setSaving(false)
    }
  }

  const handleToggleAtivo = async (u: User, novoStatus: boolean) => {
    if (currentUser && currentUser.id === u.id && !novoStatus) {
      toast.error('Você não pode desativar seu próprio usuário.')
      return
    }

    const targetRole = getUserRole(u)
    // RH NÃO pode desativar Admin
    if (!isCurrentAdmin && targetRole === 'admin') {
      toast.error('Você não tem permissão para desativar um usuário Administrador.')
      return
    }

    try {
      await userService.toggleAtivo(u.id, novoStatus)
      setUsers((prev) =>
        prev.map((item) => (item.id === u.id ? { ...item, ativo: novoStatus } : item)),
      )
      toast.success(novoStatus ? `Usuário ${u.name} ativado!` : `Usuário ${u.name} desativado!`)
    } catch (err) {
      console.error(err)
      toast.error('Erro ao alterar status do usuário.')
    }
  }

  const handleDelete = async () => {
    if (!deleteUser) return

    if (currentUser && currentUser.id === deleteUser.id) {
      toast.error('Você não pode excluir o seu próprio usuário logado.')
      setDeleteUser(null)
      return
    }

    const targetRole = getUserRole(deleteUser)
    // RH NÃO pode excluir Admin
    if (!isCurrentAdmin && targetRole === 'admin') {
      toast.error('Você não tem permissão para excluir um usuário Administrador.')
      setDeleteUser(null)
      return
    }

    setDeleting(true)
    try {
      await userService.delete(deleteUser.id)
      setUsers((prev) => prev.filter((item) => item.id !== deleteUser.id))
      toast.success(`Usuário ${deleteUser.name} excluído com sucesso!`)
      setDeleteUser(null)
    } catch (err) {
      console.error(err)
      toast.error('Erro ao excluir usuário. Verifique se ele não possui registros vinculados.')
    } finally {
      setDeleting(false)
    }
  }

  const usuariosFiltrados = useMemo(() => {
    return users.filter((u) => {
      const q = search.toLowerCase()
      const matchText =
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q))
      const uRole = getUserRole(u)
      const matchRole = filterRole === 'todos' || uRole === filterRole

      return matchText && matchRole
    })
  }, [users, search, filterRole])

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  // Nome amigável do setor para exibição no card
  const getDisplaySetorNome = (u: User): string => {
    if (!u.setor || !u.setor.trim()) return 'Não atribuído'
    return getSetorUsuarioNome(u, setores) || u.setor
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-gray-200/90 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-[#1A2233]">Gestão de Usuários</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Cadastre e gerencie os gestores de área e responsáveis de RH com acesso à plataforma
          </p>
        </div>

        {canEditUsers ? (
          <Button
            onClick={handleOpenCreate}
            className="bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg shadow-sm shrink-0"
          >
            <Plus className="w-4 h-4 mr-2" />
            <span>Novo Usuário</span>
          </Button>
        ) : (
          <div className="text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
            Apenas Administrador e RH podem gerenciar usuários
          </div>
        )}
      </div>

      {/* Filtros e Busca */}
      <div className="bg-white p-4 rounded-xl border border-gray-200/90 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Buscar por nome ou e-mail..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 border-gray-300 text-sm focus-visible:ring-brand-500"
            />
          </div>

          <div className="w-full sm:w-48">
            <Select
              value={filterRole}
              onValueChange={(val) => setFilterRole(val as 'todos' | UserRole)}
            >
              <SelectTrigger className="h-10 border-gray-300 text-sm">
                <SelectValue placeholder="Filtrar por papel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os papéis</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
                <SelectItem value="rh">RH</SelectItem>
                <SelectItem value="gestao">Gestão</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <span className="text-xs text-gray-500 font-medium shrink-0 text-right sm:text-left">
          Total: {usuariosFiltrados.length}{' '}
          {usuariosFiltrados.length === 1 ? 'usuário' : 'usuários'}
        </span>
      </div>

      {/* Grid de Cards de Usuários */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {usuariosFiltrados.length === 0 ? (
          <div className="col-span-full py-16 text-center text-gray-400 text-sm bg-white rounded-xl border border-gray-200">
            {loading ? 'Carregando usuários...' : 'Nenhum usuário encontrado.'}
          </div>
        ) : (
          usuariosFiltrados.map((u) => {
            const isSelf = currentUser?.id === u.id
            const isAtivo = u.ativo !== false
            const role = getUserRole(u)
            const roleInfo = ROLES_INFO[role]
            const isTargetAdmin = role === 'admin'
            // RH não pode excluir nem desativar Admin
            const canModifyAdmin = isCurrentAdmin || !isTargetAdmin

            return (
              <div
                key={u.id}
                className={`bg-white rounded-xl border shadow-sm p-5 flex flex-col justify-between transition-shadow hover:shadow-md ${
                  isAtivo ? 'border-gray-200/90' : 'border-gray-200 bg-gray-50/50 opacity-80'
                }`}
              >
                <div className="space-y-3">
                  {/* Top do card: nome, avatar e papel */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-brand-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                        {(u.name || u.email || 'U')
                          .split(' ')
                          .filter(Boolean)
                          .slice(0, 2)
                          .map((n) => n[0].toUpperCase())
                          .join('')}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-bold text-base text-gray-900 leading-snug">
                            {u.name || 'Sem nome'}
                          </h3>
                          {isSelf && (
                            <Badge
                              variant="outline"
                              className="text-[10px] py-0 px-1.5 text-brand-700 bg-brand-50 border-brand-200"
                            >
                              Você
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                          <Mail className="w-3 h-3 text-gray-400 shrink-0" />
                          <span className="truncate max-w-[180px]">{u.email}</span>
                        </span>
                      </div>
                    </div>

                    <span
                      className={`text-[11px] px-2.5 py-0.5 rounded-full border font-semibold shrink-0 inline-flex items-center gap-1 ${roleInfo.badgeClass}`}
                    >
                      {role === 'admin' ? (
                        <Shield className="w-3 h-3" />
                      ) : role === 'rh' ? (
                        <UserCheck className="w-3 h-3" />
                      ) : (
                        <ShieldCheck className="w-3 h-3" />
                      )}
                      <span>{roleInfo.nome}</span>
                    </span>
                  </div>

                  {/* Informações complementares */}
                  <div className="pt-2 border-t border-gray-100 text-xs text-gray-600 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 flex items-center gap-1">
                        <Layers className="w-3 h-3 text-gray-400" />
                        <span>Departamento / Setor:</span>
                      </span>
                      {u.setor && u.setor.trim() ? (
                        <span className="font-semibold text-gray-800 bg-gray-100 px-2 py-0.5 rounded text-[11px] border border-gray-200">
                          {getDisplaySetorNome(u)}
                        </span>
                      ) : (
                        <span
                          className={`font-medium text-[11px] italic ${
                            role === 'gestao' ? 'text-amber-600 font-semibold' : 'text-gray-400'
                          }`}
                        >
                          {role === 'gestao' ? 'Sem setor (bloqueado)' : 'Livre / Global'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Status da Conta:</span>
                      <span
                        className={`inline-flex items-center gap-1 font-semibold text-[11px] px-2 py-0.5 rounded-full ${
                          isAtivo
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}
                      >
                        {isAtivo ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Ativo</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3" />
                            <span>Desativado</span>
                          </>
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">E-mail verificado:</span>
                      <span className="font-medium text-gray-700">
                        {u.verified ? 'Sim' : 'Pendente'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Cadastrado em:</span>
                      <span className="font-medium text-gray-700">{formatDate(u.created)}</span>
                    </div>

                    {role === 'gestao' && (
                      <div className="flex items-center justify-between pt-1 border-t border-gray-50">
                        <span className="text-gray-500">Questionários:</span>
                        {u.pode_editar_questionarios ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            <span>Pode editar questionários</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-medium text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                            <span>Somente leitura</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Ações do Card */}
                <div className="pt-4 mt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Switch
                      id={`ativo-${u.id}`}
                      checked={isAtivo}
                      disabled={!canEditUsers || isSelf || !canModifyAdmin}
                      onCheckedChange={(checked) => handleToggleAtivo(u, checked)}
                      aria-label="Ativar ou desativar usuário"
                    />
                    <Label
                      htmlFor={`ativo-${u.id}`}
                      className={`text-xs text-gray-600 font-medium ${
                        !canEditUsers || isSelf || !canModifyAdmin
                          ? 'cursor-not-allowed opacity-60'
                          : 'cursor-pointer'
                      }`}
                    >
                      {isAtivo ? 'Ativo' : 'Inativo'}
                    </Label>
                  </div>

                  <div className="flex items-center gap-1">
                    {canEditUsers ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!canModifyAdmin}
                          onClick={() => handleOpenEdit(u)}
                          className="h-8 px-2.5 text-xs text-gray-700 border-gray-300 hover:bg-gray-50 disabled:opacity-40"
                          title={
                            !canModifyAdmin
                              ? 'RH não pode editar o Administrador'
                              : 'Editar usuário'
                          }
                        >
                          <Pencil className="w-3.5 h-3.5 mr-1 text-gray-500" />
                          <span>Editar</span>
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isSelf || !canModifyAdmin}
                          onClick={() => setDeleteUser(u)}
                          className="h-8 px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
                          title={
                            isSelf
                              ? 'Você não pode excluir seu próprio usuário'
                              : !canModifyAdmin
                                ? 'RH não pode excluir o Administrador'
                                : 'Excluir usuário'
                          }
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    ) : (
                      <span className="text-[11px] text-gray-400 italic">Somente leitura</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Modal Criar / Editar Usuário */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-[#1A2233]">
                {editingUser ? 'Editar Usuário' : 'Novo Usuário do Sistema'}
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-500">
                {editingUser
                  ? 'Atualize os dados cadastrais, setor ou altere a senha deste usuário.'
                  : 'Cadastre um novo gestor de TI ou integrante do RH para acessar o sistema.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Nome Completo *</Label>
                <Input
                  required
                  placeholder="Ex.: Carlos Mendes"
                  value={formNome}
                  onChange={(e) => setFormNome(e.target.value)}
                  className="mt-1.5 h-10 text-sm border-gray-300"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">E-mail Corporativo *</Label>
                <Input
                  type="email"
                  required
                  placeholder="Ex.: carlos.mendes@empresa.com.br"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="mt-1.5 h-10 text-sm border-gray-300"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  {editingUser
                    ? 'Atenção: alterar o e-mail de um usuário existente exige confirmação por senha do PocketBase.'
                    : 'Usuários criados internamente já nascem com o e-mail verificado.'}
                </p>
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">
                  Papel de Acesso (Perfil) *
                </Label>
                <Select
                  value={formRole}
                  onValueChange={(val) => {
                    const newRole = val as UserRole
                    setFormRole(newRole)
                    // Sugere auto-preenchimento para RH caso não tenha setor selecionado
                    if (newRole === 'rh' && !formSetor) {
                      const rhSetor = setores.find(
                        (s) => s.nome.toUpperCase() === 'RH' || s.chave?.toLowerCase() === 'rh',
                      )
                      if (rhSetor) setFormSetor(rhSetor.nome)
                    }
                  }}
                >
                  <SelectTrigger className="mt-1.5 h-10 text-sm border-gray-300">
                    <SelectValue placeholder="Selecione o papel de acesso" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Admin só pode ser criado/atribuído se o usuário atual for Admin */}
                    {isCurrentAdmin && (
                      <SelectItem value="admin">
                        Admin — Acesso total a todas as configurações e etapas
                      </SelectItem>
                    )}
                    <SelectItem value="rh">
                      RH — Conduz Etapa 1, gerencia usuários e cria onboardings
                    </SelectItem>
                    <SelectItem value="gestao">
                      Gestão — Acompanha desde a Etapa 1, conduz Etapa 2 e avalia
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Campo Departamento / Setor */}
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-gray-700">
                    Departamento / Setor{' '}
                    {formRole === 'gestao' ? '(Altamente Recomendado)' : '(Opcional)'}
                  </Label>
                  {formSetor && (
                    <button
                      type="button"
                      onClick={() => setFormSetor('')}
                      className="text-[11px] text-brand-600 hover:underline"
                    >
                      Limpar seleção
                    </button>
                  )}
                </div>

                <Select
                  value={formSetor ? formSetor : '__none__'}
                  onValueChange={(val) => setFormSetor(val === '__none__' ? '' : val)}
                >
                  <SelectTrigger
                    className={`mt-1.5 h-10 text-sm border-gray-300 ${
                      formRole === 'gestao' && !formSetor
                        ? 'border-amber-400 bg-amber-50/40 focus:ring-amber-500'
                        : ''
                    }`}
                  >
                    <SelectValue placeholder="Selecione o departamento / setor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      <span className="text-gray-400 italic">Nenhum departamento atribuído</span>
                    </SelectItem>
                    {setores.map((s) => (
                      <SelectItem key={s.id} value={s.nome}>
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: s.cor || '#2563EB' }}
                          />
                          <span>{s.nome}</span>
                          {s.descricao && (
                            <span className="text-[11px] text-gray-400 truncate max-w-[200px]">
                              — {s.descricao}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Orientações contextuais para o papel Gestão */}
                {formRole === 'gestao' ? (
                  <div
                    className={`mt-2 p-2.5 rounded-lg border text-xs flex items-start gap-2 ${
                      !formSetor
                        ? 'bg-amber-50/90 border-amber-200 text-amber-900'
                        : 'bg-blue-50/80 border-blue-200 text-blue-900'
                    }`}
                  >
                    <Info
                      className={`w-4 h-4 shrink-0 mt-0.5 ${
                        !formSetor ? 'text-amber-600' : 'text-blue-600'
                      }`}
                    />
                    <div className="leading-relaxed">
                      {!formSetor ? (
                        <span>
                          <strong>Atenção:</strong> Usuários com perfil <strong>Gestão</strong>{' '}
                          devem ter um departamento atribuído. Sem ele, a política de visibilidade
                          restringirá o acesso e o gestor não visualizará colaboradores,
                          questionários ou avaliações de nenhuma área.
                        </span>
                      ) : (
                        <span>
                          Este gestor acompanhará exclusivamente colaboradores, provas e avaliações
                          vinculados ao setor <strong>{formSetor}</strong>.
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-gray-500 mt-1">
                    Alimentado dinamicamente pelos setores cadastrados no sistema. Pode ser deixado
                    em branco para administradores.
                  </p>
                )}
              </div>

              {/* Chave Pode editar questionários do seu setor (Apenas para papel Gestão) */}
              {formRole === 'gestao' && (
                <div className="p-3 rounded-lg border border-purple-200 bg-purple-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5 pr-2">
                      <Label
                        htmlFor="pode_editar_questionarios"
                        className="text-xs font-bold text-purple-950 cursor-pointer"
                      >
                        Pode editar questionários do seu setor
                      </Label>
                      <p className="text-[11px] text-purple-800 leading-relaxed">
                        Permite a este gestor criar, alterar e excluir questionários e questões do
                        próprio setor. Por padrão fica desativada (somente leitura).
                      </p>
                    </div>
                    <Switch
                      id="pode_editar_questionarios"
                      checked={formPodeEditarQuestionarios}
                      onCheckedChange={setFormPodeEditarQuestionarios}
                    />
                  </div>
                  <div className="text-[10px] text-purple-700 font-medium">
                    {formPodeEditarQuestionarios ? (
                      <span className="text-emerald-700 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Permissão de edição concedida para o setor {formSetor || 'do gestor'}.
                      </span>
                    ) : (
                      <span>
                        O gestor terá acesso em modo somente leitura aos questionários do setor.
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-gray-700">
                    {editingUser ? 'Redefinir Senha (opcional)' : 'Senha de Acesso *'}
                  </Label>
                  {editingUser && (
                    <span className="text-[11px] text-gray-400">
                      Deixe em branco para manter a atual
                    </span>
                  )}
                </div>
                <div className="relative mt-1.5">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    type="password"
                    required={!editingUser}
                    placeholder={
                      editingUser ? 'Nova senha (mínimo 8 dígitos)' : 'Mínimo 8 caracteres'
                    }
                    value={formSenha}
                    onChange={(e) => setFormSenha(e.target.value)}
                    className="pl-9 h-10 text-sm border-gray-300"
                  />
                </div>

                {editingUser && formSenha.trim() !== '' && (
                  <div className="mt-3 p-3 bg-amber-50/60 rounded-lg border border-amber-200 space-y-2">
                    <Label className="text-xs font-semibold text-gray-700">
                      Senha atual do usuário
                    </Label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <Input
                        type="password"
                        placeholder="Informe a senha atual do usuário"
                        value={formSenhaAtual}
                        onChange={(e) => setFormSenhaAtual(e.target.value)}
                        className="pl-9 h-9 text-xs border-amber-300 bg-white"
                      />
                    </div>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      Para definir uma nova senha para este usuário, informe a senha atual dele. Se
                      não a souber, oriente o usuário a usar &apos;Esqueci minha senha&apos; na tela
                      de login, ou recrie o usuário.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 bg-gray-50/50">
                <div className="space-y-0.5">
                  <Label className="text-xs font-semibold text-gray-800">Usuário Ativo</Label>
                  <p className="text-[11px] text-gray-500">
                    Usuários inativos não conseguem autenticar nem são listados como gestores.
                  </p>
                </div>
                <Switch
                  checked={formAtivo}
                  disabled={editingUser ? currentUser?.id === editingUser.id : false}
                  onCheckedChange={setFormAtivo}
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => setModalOpen(false)}
                className="h-10 text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="h-10 text-xs bg-brand-600 hover:bg-brand-700 text-white font-semibold"
              >
                {saving ? 'Salvando...' : editingUser ? 'Salvar Alterações' : 'Criar Usuário'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmação de Exclusão */}
      <AlertDialog open={!!deleteUser} onOpenChange={(open) => !open && setDeleteUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-2">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <AlertDialogTitle className="text-lg font-bold text-gray-900">
              Excluir Usuário?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-gray-600 leading-relaxed">
              Tem certeza que deseja remover o usuário{' '}
              <strong className="text-gray-900">{deleteUser?.name}</strong> ({deleteUser?.email})?
              Esta ação não pode ser desfeita e removerá o acesso do usuário ao sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} className="text-xs h-9">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white text-xs h-9 font-semibold"
            >
              {deleting ? 'Excluindo...' : 'Sim, Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
