import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'
import {
  GitCommit,
  UserCheck,
  Rocket,
  ArrowRightLeft,
  GraduationCap,
  Award,
  CheckCircle2,
  Clock,
  Calendar,
  ExternalLink,
  ShieldCheck,
  Briefcase,
  Layers,
  FileCheck2,
} from 'lucide-react'
import { formatDateTime, formatShortDate } from '@/lib/dateUtils'
import type {
  Onboarding,
  LogAuditoria,
  AvaliacaoColaborador,
  CertificadoColaborador,
  ColaboradorCurso,
  ColaboradorDocumento,
  ColaboradorAnotacao,
} from '@/types/onboarding'

export interface SecaoTrajetoriaProps {
  colaboradorAtual: Onboarding
  todosOnboardings: Onboarding[]
  logsAuditoria: LogAuditoria[]
  avaliacoes: AvaliacaoColaborador[]
  certificados: CertificadoColaborador[]
  cursos?: ColaboradorCurso[]
  documentos?: ColaboradorDocumento[]
  anotacoes?: ColaboradorAnotacao[]
  onNavegarOnboarding?: (id: string) => void
}

export type TipoEventoTrajetoria =
  | 'contratacao'
  | 'onboarding_inicio'
  | 'etapa1_concluida'
  | 'etapa2_concluida'
  | 'etapa3_concluida'
  | 'mudanca_cargo_setor'
  | 'avaliacao_dossie'
  | 'certificado'
  | 'curso_grade'
  | 'documento_complementar'
  | 'anotacao_gestor'
  | 'auditoria_geral'

export interface EventoTrajetoria {
  id: string
  dataHora: string
  tipo: TipoEventoTrajetoria
  titulo: string
  subtitulo?: string
  detalhes?: string
  autorNome?: string
  autorRole?: string
  badgeLabel?: string
  badgeColor?: string
  linkOnboardingId?: string
  dadosExtras?: Record<string, unknown>
}

export function SecaoTrajetoria({
  colaboradorAtual,
  todosOnboardings,
  logsAuditoria,
  avaliacoes,
  certificados,
  cursos = [],
  documentos = [],
  anotacoes = [],
  onNavegarOnboarding,
}: SecaoTrajetoriaProps) {
  // Unificação cronológica (mais recentes primeiro)
  const eventos = useMemo<EventoTrajetoria[]>(() => {
    const lista: EventoTrajetoria[] = []

    // 1. Onboardings (Criação + Conclusões de cada um)
    todosOnboardings.forEach((onb, index) => {
      const sufixoOnb =
        todosOnboardings.length > 1 ? ` (#${onb.id.slice(0, 6)} • ${onb.setor || 'Geral'})` : ''

      // Início do Onboarding
      lista.push({
        id: `onb-inicio-${onb.id}`,
        dataHora: onb.created,
        tipo: 'onboarding_inicio',
        titulo: `Início do Onboarding${sufixoOnb}`,
        subtitulo: `Cargo: ${onb.cargo || 'Não especificado'} • Área: ${onb.setor || 'TI'}`,
        detalhes: `Processo de integração iniciado com prazo até ${formatShortDate(onb.data_fim)}. Gestor: ${onb.expand?.gestor_id?.name || 'Gestão TI'}.`,
        badgeLabel: 'Onboarding',
        badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        linkOnboardingId: onb.id,
      })

      // Conclusão Etapa 1
      if (onb.etapa1_concluida && onb.data_conclusao_etapa1) {
        lista.push({
          id: `onb-etapa1-${onb.id}`,
          dataHora: onb.data_conclusao_etapa1,
          tipo: 'etapa1_concluida',
          titulo: `Conclusão da Etapa 1 — Apresentação Institucional${sufixoOnb}`,
          subtitulo: 'Integração e entrega de equipamentos concluídas pelo RH',
          detalhes: 'Checklist de equipamentos e boas-vindas institucionais validados com êxito.',
          autorNome: onb.expand?.etapa1_concluida_por?.name || 'RH',
          autorRole: 'RH',
          badgeLabel: 'Etapa 1 RH',
          badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          linkOnboardingId: onb.id,
        })
      }

      // Conclusão Etapa 2
      if (onb.etapa2_concluida && onb.data_conclusao_etapa2) {
        lista.push({
          id: `onb-etapa2-${onb.id}`,
          dataHora: onb.data_conclusao_etapa2,
          tipo: 'etapa2_concluida',
          titulo: `Conclusão da Etapa 2 — Vivência Técnica${sufixoOnb}`,
          subtitulo: 'Todas as fases técnicas cumpridas e validadas',
          detalhes: 'Fases práticas de suporte TI concluídas com relatos e acompanhamento técnico.',
          autorNome: onb.expand?.etapa2_concluida_por?.name || 'Gestão TI',
          autorRole: 'Gestão',
          badgeLabel: 'Etapa 2 Técnica',
          badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          linkOnboardingId: onb.id,
        })
      }

      // Conclusão Etapa 3
      if (onb.etapa3_concluida && onb.data_conclusao_etapa3) {
        const apto = onb.status === 'concluido'
        lista.push({
          id: `onb-etapa3-${onb.id}`,
          dataHora: onb.data_conclusao_etapa3,
          tipo: 'etapa3_concluida',
          titulo: `Avaliação Final do Onboarding${sufixoOnb}: ${apto ? 'Aprovado (Apto)' : 'Não Apto'}`,
          subtitulo: `Decisão registrada pelo gestor responsável (${onb.expand?.gestor_id?.name || 'Gestão'})`,
          detalhes: apto
            ? 'Colaborador validado com sucesso e integrado em definitivo à rotina do setor.'
            : 'Avaliação final indicou necessidades adicionais de alinhamento.',
          badgeLabel: apto ? 'Aprovado' : 'Não Apto',
          badgeColor: apto
            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
            : 'bg-red-100 text-red-800 border-red-300',
          linkOnboardingId: onb.id,
        })
      }
    })

    // 2. Logs de Auditoria (Contratação, Mudanças de Cargo/Setor/Gestor, etc.)
    logsAuditoria.forEach((log) => {
      const acaoNorm = (log.acao || '').toLowerCase()
      const detalhesNorm = (log.detalhes || '').toLowerCase()

      // Contratação / Formalização de Candidato
      if (acaoNorm.includes('formalização') || acaoNorm.includes('contratação')) {
        lista.push({
          id: `log-contratacao-${log.id}`,
          dataHora: log.created,
          tipo: 'contratacao',
          titulo: 'Contratação e Formalização pelo RH',
          subtitulo: `Formalizado por: ${log.usuario_nome || 'RH'}`,
          detalhes: log.detalhes || 'Candidato formalizado e convertido em colaborador oficial.',
          autorNome: log.usuario_nome,
          autorRole: log.usuario_role || 'RH',
          badgeLabel: 'Contratação',
          badgeColor: 'bg-purple-100 text-purple-800 border-purple-300 font-bold',
          linkOnboardingId: log.onboarding_id,
        })
        return
      }

      // Mudança de Cargo / Setor / Gestor
      if (
        acaoNorm.includes('edição de dados') ||
        acaoNorm.includes('cargo') ||
        acaoNorm.includes('setor') ||
        detalhesNorm.includes('atualizado') ||
        detalhesNorm.includes('→')
      ) {
        lista.push({
          id: `log-mudanca-${log.id}`,
          dataHora: log.created,
          tipo: 'mudanca_cargo_setor',
          titulo: 'Alteração Funcional (Cargo / Setor / Gestor)',
          subtitulo: `Modificado por ${log.usuario_nome || 'Usuário'} (${(log.usuario_role || 'RH').toUpperCase()})`,
          detalhes: log.detalhes || 'Atualização nos dados de cargo, setor ou gestor.',
          autorNome: log.usuario_nome,
          autorRole: log.usuario_role,
          badgeLabel: 'Mudança de Área / Função',
          badgeColor: 'bg-amber-100 text-amber-900 border-amber-300 font-bold',
          linkOnboardingId: log.onboarding_id,
        })
        return
      }

      // Inclusão / Edição / Exclusão de Certificados via logs
      if (acaoNorm.includes('certificado')) {
        // Ignoramos o log direto para não duplicar com os registros de certificados abaixo
        return
      }
    })

    // 3. Avaliações do Dossiê (Reciclagem, Mudança de Área, Avaliação Periódica)
    avaliacoes.forEach((av) => {
      const qNome = av.expand?.questionario_id?.nome || 'Questionário Técnico'
      const tipoNome =
        av.tipo_avaliacao === 'reciclagem'
          ? 'Reciclagem Técnica'
          : av.tipo_avaliacao === 'mudanca_area'
            ? 'Avaliação de Mudança de Área'
            : av.tipo_avaliacao === 'avaliacao'
              ? 'Avaliação Periódica'
              : 'Avaliação Avulsa'

      const dataEvento = av.data_conclusao || av.data_aplicacao || av.created
      const statusLabel =
        av.status === 'concluida'
          ? av.aprovado
            ? `Aprovado (${av.percentual ?? 0}%)`
            : `Reprovado (${av.percentual ?? 0}%)`
          : av.status === 'cancelada'
            ? 'Cancelada'
            : 'Pendente de resposta'

      lista.push({
        id: `av-dossie-${av.id}`,
        dataHora: dataEvento,
        tipo: 'avaliacao_dossie',
        titulo: `${tipoNome}: ${qNome}`,
        subtitulo: `Status: ${statusLabel} • Aplicada por: ${av.expand?.aplicada_por?.name || 'RH/Admin'}`,
        detalhes:
          av.status === 'concluida'
            ? `Nota: ${av.nota ?? 0}/${av.total_questoes ?? 0} acertos (${av.percentual ?? 0}% de aproveitamento, régua de aprovação ≥ ${av.regua_aprovacao ?? 80}%).${av.observacoes ? ` Obs: ${av.observacoes}` : ''}`
            : `Avaliação aplicada em ${formatShortDate(av.data_aplicacao || av.created)} aguardando submissão do colaborador.`,
        autorNome: av.expand?.aplicada_por?.name || 'RH',
        autorRole: 'RH',
        badgeLabel: tipoNome,
        badgeColor:
          av.status === 'concluida'
            ? av.aprovado
              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
              : 'bg-red-100 text-red-800 border-red-300'
            : 'bg-amber-50 text-amber-800 border-amber-300',
      })
    })

    // 4. Certificados Registrados
    certificados.forEach((cert) => {
      lista.push({
        id: `cert-${cert.id}`,
        dataHora: cert.data_emissao || cert.created,
        tipo: 'certificado',
        titulo: `Certificação: ${cert.titulo}`,
        subtitulo: `Emissor: ${cert.emissor}${cert.data_validade ? ` • Validade: ${formatShortDate(cert.data_validade)}` : ' • Sem expiração'}`,
        detalhes: `Registrado por ${cert.expand?.registrado_por?.name || 'RH/Admin'}.${cert.observacoes ? ` ${cert.observacoes}` : ''}${cert.arquivo ? ' (Documento comprovatório anexado)' : ''}`,
        autorNome: cert.expand?.registrado_por?.name || 'RH',
        autorRole: 'RH',
        badgeLabel: 'Certificado',
        badgeColor: 'bg-blue-100 text-blue-800 border-blue-300 font-bold',
      })
    })

    // 5. Cursos da Grade (Atribuição e Conclusão)
    cursos.forEach((c) => {
      const cursoTitulo = c.expand?.curso?.titulo || 'Treinamento'
      const nivel = (c.expand?.curso?.nivel || 'essencial').toUpperCase()
      const autorAtribuicao = c.atribuido_por || 'RH/Admin'

      // Se o curso já foi concluído, adicionar o marco de conclusão
      if (c.status === 'concluido' && c.concluido_em) {
        lista.push({
          id: `curso-concluido-${c.id}`,
          dataHora: c.concluido_em,
          tipo: 'curso_grade',
          titulo: `Curso Concluído: ${cursoTitulo}`,
          subtitulo: `Nível: ${nivel} • Conclusão validada pelo RH/Admin`,
          detalhes: `Colaborador concluiu com êxito o curso da grade técnica.${c.observacao ? ` Obs: ${c.observacao}` : ''}`,
          autorNome: c.concluido_por || autorAtribuicao,
          autorRole: 'RH',
          badgeLabel: 'Curso Concluído',
          badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold',
        })
      }

      // Evento de Associação / Atribuição
      lista.push({
        id: `curso-atribuido-${c.id}`,
        dataHora: c.atribuido_em || c.created,
        tipo: 'curso_grade',
        titulo: `Curso Associado: ${cursoTitulo} (${nivel})`,
        subtitulo: `Trilha de capacitação da grade de departamento`,
        detalhes: `Curso pontuado na grade técnica atribuído ao colaborador.${c.observacao ? ` Obs: ${c.observacao}` : ''}`,
        autorNome: autorAtribuicao,
        autorRole: 'RH',
        badgeLabel: `Grade: ${nivel}`,
        badgeColor:
          c.expand?.curso?.nivel === 'essencial'
            ? 'bg-red-50 text-red-700 border-red-200 font-semibold'
            : c.expand?.curso?.nivel === 'recomendado'
              ? 'bg-amber-50 text-amber-800 border-amber-200 font-semibold'
              : 'bg-blue-50 text-blue-700 border-blue-200 font-semibold',
      })
    })

    // 6. Documentos Complementares (Associação e Confirmação de Leitura)
    documentos.forEach((doc) => {
      const docTitulo = doc.expand?.material?.titulo || 'Documento Complementar'
      const tipoMat = (doc.expand?.material?.tipo || 'arquivo').toUpperCase()

      // Confirmação de leitura pelo colaborador (se confirmada)
      if (doc.status === 'confirmado' && doc.confirmado_em) {
        lista.push({
          id: `doc-confirmado-${doc.id}`,
          dataHora: doc.confirmado_em,
          tipo: 'documento_complementar',
          titulo: `Leitura Confirmada: ${docTitulo}`,
          subtitulo: `Confirmação registrada via link público pelo colaborador`,
          detalhes: `Colaborador marcou "Confirmo que li/assisti" com carimbo oficial de data e hora.`,
          autorNome: colaboradorAtual.colaborador_nome,
          autorRole: 'Colaborador',
          badgeLabel: 'Documento Lido',
          badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold',
        })
      }

      // Evento de Associação / Envio pelo RH/Gestor
      lista.push({
        id: `doc-associado-${doc.id}`,
        dataHora: doc.atribuido_em || doc.created,
        tipo: 'documento_complementar',
        titulo: `Documento Complementar: ${docTitulo}`,
        subtitulo: `Material complementar do acervo central (${tipoMat})`,
        detalhes: `Documento associado ao perfil com link público de confirmação.${doc.observacao ? ` Instruções: ${doc.observacao}` : ''}`,
        autorNome: doc.atribuido_por || 'RH/Admin',
        autorRole: 'RH',
        badgeLabel: 'Doc Complementar',
        badgeColor: 'bg-blue-50 text-blue-700 border-blue-200 font-semibold',
      })
    })

    // 7. Anotações & Feedbacks Internos do Gestor (Uso exclusivo interno)
    anotacoes.forEach((anot) => {
      const tipoLabel =
        anot.tipo === 'feedback_1_1'
          ? 'Anotação Interna (1:1)'
          : anot.tipo === 'avaliacao'
            ? 'Anotação Interna (Avaliação)'
            : 'Observação Interna'

      lista.push({
        id: `anot-${anot.id}`,
        dataHora: anot.created,
        tipo: 'anotacao_gestor',
        titulo: `Anotação Interna do Gestor (${tipoLabel})`,
        subtitulo: `Registrado por ${anot.autor_nome || anot.expand?.autor?.name || 'Gestão'} (Confidencial / Interno)`,
        detalhes: anot.texto,
        autorNome: anot.autor_nome || anot.expand?.autor?.name || 'Gestor',
        autorRole: anot.autor_role || 'Gestão',
        badgeLabel: tipoLabel,
        badgeColor:
          anot.tipo === 'feedback_1_1'
            ? 'bg-purple-50 text-purple-700 border-purple-200 font-semibold'
            : anot.tipo === 'avaliacao'
              ? 'bg-blue-50 text-blue-700 border-blue-200 font-semibold'
              : 'bg-slate-100 text-slate-700 border-slate-300 font-semibold',
      })
    })

    // Ordenação decrescente: do evento mais recente para o mais antigo
    return lista.sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime())
  }, [todosOnboardings, logsAuditoria, avaliacoes, certificados, cursos, documentos, anotacoes])

  const getIconeEvento = (tipo: TipoEventoTrajetoria) => {
    switch (tipo) {
      case 'contratacao':
        return <UserCheck className="w-4 h-4 text-purple-600" />
      case 'onboarding_inicio':
        return <Rocket className="w-4 h-4 text-indigo-600" />
      case 'etapa1_concluida':
      case 'etapa2_concluida':
      case 'etapa3_concluida':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />
      case 'mudanca_cargo_setor':
        return <ArrowRightLeft className="w-4 h-4 text-amber-600" />
      case 'avaliacao_dossie':
        return <GraduationCap className="w-4 h-4 text-teal-600" />
      case 'certificado':
        return <Award className="w-4 h-4 text-blue-600" />
      case 'curso_grade':
        return <GraduationCap className="w-4 h-4 text-emerald-600" />
      case 'documento_complementar':
        return <FileCheck2 className="w-4 h-4 text-blue-600" />
      case 'anotacao_gestor':
        return <GitCommit className="w-4 h-4 text-purple-600" />
      default:
        return <GitCommit className="w-4 h-4 text-gray-500" />
    }
  }

  const getCorLinha = (tipo: TipoEventoTrajetoria) => {
    switch (tipo) {
      case 'contratacao':
        return 'border-purple-300 bg-purple-50 text-purple-700'
      case 'onboarding_inicio':
        return 'border-indigo-300 bg-indigo-50 text-indigo-700'
      case 'etapa1_concluida':
      case 'etapa2_concluida':
      case 'etapa3_concluida':
        return 'border-emerald-300 bg-emerald-50 text-emerald-700'
      case 'mudanca_cargo_setor':
        return 'border-amber-300 bg-amber-50 text-amber-700'
      case 'avaliacao_dossie':
        return 'border-teal-300 bg-teal-50 text-teal-700'
      case 'certificado':
        return 'border-blue-300 bg-blue-50 text-blue-700'
      case 'curso_grade':
        return 'border-emerald-300 bg-emerald-50 text-emerald-700'
      case 'documento_complementar':
        return 'border-blue-300 bg-blue-50 text-blue-700'
      case 'anotacao_gestor':
        return 'border-purple-300 bg-purple-50 text-purple-700'
      default:
        return 'border-gray-300 bg-gray-50 text-gray-700'
    }
  }

  return (
    <Card className="border border-gray-200 shadow-sm overflow-hidden bg-white">
      <CardHeader className="bg-gradient-to-r from-purple-50/70 via-indigo-50/40 to-white border-b border-gray-100 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-base font-bold text-gray-900">
                  Trajetória Unificada do Colaborador
                </CardTitle>
                <Badge
                  variant="outline"
                  className="text-xs bg-white text-purple-800 border-purple-200"
                >
                  {eventos.length}{' '}
                  {eventos.length === 1 ? 'evento registrado' : 'eventos registrados'}
                </Badge>
              </div>
              <CardDescription className="text-xs text-gray-500 mt-0.5">
                Fio condutor da vida funcional na empresa: contratação, onboardings, mudanças de
                área, avaliações e certificações
              </CardDescription>
            </div>
          </div>

          {todosOnboardings.length > 1 && (
            <div className="text-xs bg-white px-3 py-1.5 rounded-lg border border-purple-200 text-purple-900 font-semibold flex items-center gap-1.5 shrink-0">
              <Rocket className="w-3.5 h-3.5 text-purple-600" />
              <span>{todosOnboardings.length} processos de onboarding ao longo da vida</span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6">
        {eventos.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-xs">
            Nenhum marco registrado na trajetória deste colaborador até o momento.
          </div>
        ) : (
          <div className="relative pl-6 sm:pl-8 space-y-6 before:content-[''] before:absolute before:left-3 sm:before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-gradient-to-b before:from-purple-400 before:via-blue-300 before:to-gray-200">
            {eventos.map((ev) => {
              const corEstilo = getCorLinha(ev.tipo)
              const isOutroOnboarding =
                ev.linkOnboardingId && ev.linkOnboardingId !== colaboradorAtual.id

              return (
                <div key={ev.id} className="relative group">
                  {/* Ponto / Ícone no Fio Cronológico */}
                  <div
                    className={`absolute -left-[31px] sm:-left-[35px] top-1 w-6 h-6 rounded-full border-2 bg-white flex items-center justify-center shadow-xs transition-transform group-hover:scale-110 ${corEstilo}`}
                  >
                    {getIconeEvento(ev.tipo)}
                  </div>

                  {/* Card do Evento */}
                  <div className="bg-white rounded-xl border border-gray-200/90 p-4 shadow-2xs hover:shadow-sm hover:border-gray-300 transition-all space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-gray-900">{ev.titulo}</h4>
                          {ev.badgeLabel && (
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-semibold ${ev.badgeColor || 'bg-gray-50 text-gray-700'}`}
                            >
                              {ev.badgeLabel}
                            </Badge>
                          )}
                        </div>
                        {ev.subtitulo && (
                          <p className="text-xs text-gray-600 font-medium">{ev.subtitulo}</p>
                        )}
                      </div>

                      <div className="text-left sm:text-right shrink-0">
                        <span className="text-[11px] font-mono text-gray-500 flex items-center sm:justify-end gap-1">
                          <Calendar className="w-3 h-3 text-gray-400" />
                          {formatDateTime(ev.dataHora)}
                        </span>
                        {ev.autorNome && (
                          <span className="text-[10px] text-gray-400 block mt-0.5">
                            Registrado por: <strong>{ev.autorNome}</strong>
                            {ev.autorRole ? ` (${ev.autorRole.toUpperCase()})` : ''}
                          </span>
                        )}
                      </div>
                    </div>

                    {ev.detalhes && (
                      <p className="text-xs text-gray-600 whitespace-pre-line bg-gray-50/60 p-2.5 rounded-lg border border-gray-100">
                        {ev.detalhes}
                      </p>
                    )}

                    {/* Ações / Links para navegar entre onboardings */}
                    {ev.linkOnboardingId && (
                      <div className="pt-2 flex items-center justify-between gap-2 border-t border-gray-100 text-xs">
                        <span className="text-[11px] text-gray-500">
                          Onboarding vinculado: <strong>#{ev.linkOnboardingId.slice(0, 8)}</strong>
                          {ev.linkOnboardingId === colaboradorAtual.id && (
                            <span className="text-emerald-600 font-semibold ml-1">
                              (visualizando agora)
                            </span>
                          )}
                        </span>

                        {isOutroOnboarding && (
                          <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-brand-700 hover:text-brand-800 hover:bg-brand-50 gap-1"
                          >
                            <Link to={`/colaboradores/${ev.linkOnboardingId}`}>
                              <span>Abrir outro onboarding</span>
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
