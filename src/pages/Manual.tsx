import { useState } from 'react'
import MundoOpenLogo from '@/components/MundoOpenLogo'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Printer,
  Download,
  BookOpen,
  Calendar,
  Layers,
  Users,
  ShieldCheck,
  CheckSquare,
  Mail,
  FolderOpen,
  FileText,
  Clock,
  ArrowRight,
  Info,
} from 'lucide-react'

export default function Manual() {
  const [checklistState, setChecklistState] = useState<Record<number, boolean>>({})

  const handlePrint = () => {
    window.print()
  }

  const toggleCheck = (idx: number) => {
    setChecklistState((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }))
  }

  return (
    <div className="space-y-6 pb-12 print:p-0 print:space-y-4">
      {/* Barra de Ações Superior (Oculta na impressão) */}
      <div className="no-print bg-white border border-gray-200/90 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-700 bg-brand-50 px-2.5 py-1 rounded-full border border-brand-200">
            <BookOpen className="w-3.5 h-3.5" />
            Documentação & Guia Operacional
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
            Manual do Sistema de Onboarding
          </h1>
          <p className="text-xs sm:text-sm text-gray-500">
            Guia completo de procedimentos para Gestores, RH e Administradores. Gere o arquivo PDF
            oficial pelo botão ao lado.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0">
          <Button
            onClick={handlePrint}
            className="w-full sm:w-auto bg-brand-600 hover:bg-brand-700 text-white font-semibold shadow-sm gap-2"
          >
            <Download className="w-4 h-4" />
            <span>Baixar PDF / Imprimir</span>
          </Button>
        </div>
      </div>

      {/* DOCUMENTO OFICIAL DO MANUAL */}
      <article className="manual-document bg-white border border-gray-200 rounded-2xl p-6 sm:p-10 lg:p-12 shadow-xs print:border-none print:shadow-none print:p-0 text-slate-800">
        {/* Cabeçalho do Documento */}
        <header className="border-b-2 border-brand-600 pb-6 mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <MundoOpenLogo variant="full" size="lg" />
          </div>
          <div className="sm:text-right space-y-1">
            <Badge className="bg-brand-50 text-brand-700 border-brand-200 font-semibold text-xs">
              Documento Interno Oficial
            </Badge>
            <div className="text-xs text-gray-500">Janela Oficial: 15 Dias Corridos</div>
            <div className="text-xs text-gray-400">Público: RH, Gestores e Admin</div>
          </div>
        </header>

        {/* Título Principal */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-black text-gray-950 tracking-tight leading-snug">
            Manual do Sistema de Onboarding — Mundo Open — Onboarding de Colaboradores de TI — Guia
            para Gestores e RH
          </h1>
          <p className="text-sm text-gray-600 mt-2 font-medium">
            Diretrizes operacionais, fluxo detalhado em 3 etapas, cronograma de 15 dias, matriz de
            papéis e homologação do sistema.
          </p>
        </div>

        {/* ========================================================= */}
        {/* SEÇÃO 1 — Visão geral */}
        {/* ========================================================= */}
        <section className="mb-10 avoid-break">
          <div className="flex items-center gap-2.5 mb-4 border-b border-gray-200 pb-2">
            <div className="w-7 h-7 rounded-lg bg-brand-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
              1
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">
              SEÇÃO 1 — Visão geral
            </h2>
          </div>

          <p className="text-sm sm:text-base text-gray-700 leading-relaxed mb-4">
            O sistema acompanha a integração de novos colaboradores em{' '}
            <strong>3 etapas sequenciais</strong>, dentro de uma janela oficial de{' '}
            <strong>15 dias</strong>.
          </p>

          {/* Tabela de Etapas */}
          <div className="overflow-x-auto rounded-xl border border-gray-200 mb-5">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-900 font-bold border-b border-gray-200">
                <tr>
                  <th className="py-2.5 px-3.5">Etapa</th>
                  <th className="py-2.5 px-3.5">Responsável</th>
                  <th className="py-2.5 px-3.5">Descrição Operacional</th>
                  <th className="py-2.5 px-3.5 text-center">Duração</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                <tr className="hover:bg-slate-50/70">
                  <td className="py-2.5 px-3.5 font-bold text-gray-900">Etapa 1 — Integração</td>
                  <td className="py-2.5 px-3.5">
                    <span className="inline-flex items-center gap-1 font-semibold text-brand-700 bg-brand-50 px-2 py-0.5 rounded text-xs border border-brand-200">
                      RH
                    </span>
                  </td>
                  <td className="py-2.5 px-3.5 text-gray-700">
                    Apresentação da empresa, integração e entrega do notebook.
                  </td>
                  <td className="py-2.5 px-3.5 font-bold text-center text-gray-900">1 dia</td>
                </tr>
                <tr className="hover:bg-slate-50/70">
                  <td className="py-2.5 px-3.5 font-bold text-gray-900">
                    Etapa 2 — Vivência Técnica
                  </td>
                  <td className="py-2.5 px-3.5">
                    <span className="inline-flex items-center gap-1 font-semibold text-teal-800 bg-teal-50 px-2 py-0.5 rounded text-xs border border-teal-200">
                      Gestor responsável
                    </span>
                  </td>
                  <td className="py-2.5 px-3.5 text-gray-700">
                    Trilha de 6 fases práticas, progressivas.
                  </td>
                  <td className="py-2.5 px-3.5 font-bold text-center text-gray-900">13 dias</td>
                </tr>
                <tr className="hover:bg-slate-50/70">
                  <td className="py-2.5 px-3.5 font-bold text-gray-900">
                    Etapa 3 — Avaliação Final
                  </td>
                  <td className="py-2.5 px-3.5">
                    <span className="inline-flex items-center gap-1 font-semibold text-teal-800 bg-teal-50 px-2 py-0.5 rounded text-xs border border-teal-200">
                      Gestor responsável
                    </span>
                  </td>
                  <td className="py-2.5 px-3.5 text-gray-700">Decisão Apto / Não apto.</td>
                  <td className="py-2.5 px-3.5 font-bold text-center text-gray-900">1 dia</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Notas de Acesso */}
          <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3.5 sm:p-4 mb-4 text-xs sm:text-sm text-amber-900 flex items-start gap-3">
            <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <strong>Notas de acesso:</strong> apenas RH, Gestão e Admin entram no sistema; o
              colaborador novo <strong>NÃO tem login</strong> — acompanha e confirma os conteúdos
              por um link público exclusivo do seu onboarding.
            </div>
          </div>

          {/* Os 3 papéis */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mb-4">
            <div className="border border-purple-200 bg-purple-50/40 rounded-xl p-3.5">
              <div className="flex items-center gap-1.5 font-bold text-purple-900 text-sm mb-1.5">
                <ShieldCheck className="w-4 h-4 text-purple-700" />
                Admin
              </div>
              <p className="text-xs text-purple-950 leading-relaxed">
                Acesso total (todas as telas, usuários, modelos de tarefas, logs e configurações).
              </p>
            </div>

            <div className="border border-cyan-200 bg-cyan-50/40 rounded-xl p-3.5">
              <div className="flex items-center gap-1.5 font-bold text-cyan-900 text-sm mb-1.5">
                <Users className="w-4 h-4 text-cyan-700" />
                RH
              </div>
              <p className="text-xs text-cyan-950 leading-relaxed">
                Conduz a Etapa 1 por completo, cria onboardings e também pode criar usuários,
                acompanha as demais etapas em modo leitura e recebe o resultado da avaliação final.
              </p>
            </div>

            <div className="border border-teal-200 bg-teal-50/40 rounded-xl p-3.5">
              <div className="flex items-center gap-1.5 font-bold text-teal-900 text-sm mb-1.5">
                <Layers className="w-4 h-4 text-teal-700" />
                Gestão
              </div>
              <p className="text-xs text-teal-950 leading-relaxed">
                Acompanha desde a Etapa 1 (somente leitura), mas assume o controle a partir da Etapa
                2: conclui fases, define clientes de referência e faz a avaliação final; não acessa
                as telas de Usuários nem Modelos de Tarefas.
              </p>
            </div>
          </div>

          {/* Visibilidade */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-700">
            <strong>Visibilidade:</strong> gestores visualizam onboardings de todas as áreas, mas só
            podem agir naqueles em que são o gestor responsável (ou Admin).
          </div>
        </section>

        {/* ========================================================= */}
        {/* SEÇÃO 2 — Cronograma oficial — 15 dias exatos */}
        {/* ========================================================= */}
        <section className="mb-10 avoid-break page-break-before">
          <div className="flex items-center gap-2.5 mb-4 border-b border-gray-200 pb-2">
            <div className="w-7 h-7 rounded-lg bg-brand-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
              2
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">
              SEÇÃO 2 — Cronograma oficial — 15 dias exatos
            </h2>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-200 mb-4">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-900 font-bold border-b border-gray-200">
                <tr>
                  <th className="py-2.5 px-3.5">Fase / Macro-etapa</th>
                  <th className="py-2.5 px-3.5">Atividades Chave</th>
                  <th className="py-2.5 px-3.5">Responsável</th>
                  <th className="py-2.5 px-3.5 text-center">Duração</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                <tr>
                  <td className="py-2 px-3.5 font-bold text-gray-900">Etapa 1</td>
                  <td className="py-2 px-3.5 text-gray-700">Integração e entrega do notebook</td>
                  <td className="py-2 px-3.5 text-brand-700 font-semibold text-xs">RH</td>
                  <td className="py-2 px-3.5 font-bold text-center text-gray-900">1d</td>
                </tr>
                <tr>
                  <td className="py-2 px-3.5 font-bold text-gray-900">Fase 1</td>
                  <td className="py-2 px-3.5 text-gray-700">
                    Configuração e Acessos (MFA, Movidesk, Passportal, TeamViewer, vídeos)
                  </td>
                  <td className="py-2 px-3.5 text-teal-700 font-semibold text-xs">Gestor</td>
                  <td className="py-2 px-3.5 font-bold text-center text-gray-900">1d</td>
                </tr>
                <tr>
                  <td className="py-2 px-3.5 font-bold text-gray-900">Fase 2</td>
                  <td className="py-2 px-3.5 text-gray-700">Mapeamento de Ambientes</td>
                  <td className="py-2 px-3.5 text-teal-700 font-semibold text-xs">Gestor</td>
                  <td className="py-2 px-3.5 font-bold text-center text-gray-900">2d</td>
                </tr>
                <tr>
                  <td className="py-2 px-3.5 font-bold text-gray-900">Fase 3</td>
                  <td className="py-2 px-3.5 text-gray-700">Shadowing Ativo</td>
                  <td className="py-2 px-3.5 text-teal-700 font-semibold text-xs">Gestor</td>
                  <td className="py-2 px-3.5 font-bold text-center text-gray-900">2d</td>
                </tr>
                <tr>
                  <td className="py-2 px-3.5 font-bold text-gray-900">Fase 4</td>
                  <td className="py-2 px-3.5 text-gray-700">Atendimento Invertido</td>
                  <td className="py-2 px-3.5 text-teal-700 font-semibold text-xs">Gestor</td>
                  <td className="py-2 px-3.5 font-bold text-center text-gray-900">3d</td>
                </tr>
                <tr>
                  <td className="py-2 px-3.5 font-bold text-gray-900">Fase 5</td>
                  <td className="py-2 px-3.5 text-gray-700">Atendimento Solo N1</td>
                  <td className="py-2 px-3.5 text-teal-700 font-semibold text-xs">Gestor</td>
                  <td className="py-2 px-3.5 font-bold text-center text-gray-900">3d</td>
                </tr>
                <tr>
                  <td className="py-2 px-3.5 font-bold text-gray-900">Fase 6</td>
                  <td className="py-2 px-3.5 text-gray-700">Consolidação Prática</td>
                  <td className="py-2 px-3.5 text-teal-700 font-semibold text-xs">Gestor</td>
                  <td className="py-2 px-3.5 font-bold text-center text-gray-900">2d</td>
                </tr>
                <tr>
                  <td className="py-2 px-3.5 font-bold text-gray-900">Etapa 3</td>
                  <td className="py-2 px-3.5 text-gray-700">Avaliação Final</td>
                  <td className="py-2 px-3.5 text-teal-700 font-semibold text-xs">Gestor</td>
                  <td className="py-2 px-3.5 font-bold text-center text-gray-900">1d</td>
                </tr>
                <tr className="bg-brand-50/70 border-t-2 border-brand-300">
                  <td
                    colSpan={3}
                    className="py-2.5 px-3.5 font-black text-brand-900 text-right uppercase tracking-wider text-xs"
                  >
                    Total
                  </td>
                  <td className="py-2.5 px-3.5 font-black text-center text-brand-900 text-base">
                    15 exatos
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="space-y-2 text-xs sm:text-sm text-gray-700 bg-gray-50 p-4 rounded-xl border border-gray-200">
            <p>
              <strong>Avisos:</strong> ao criar um onboarding o sistema soma automaticamente os dias
              e bloqueia a criação se passar de 15 dias, mostrando o estouro; cada fase recebe uma
              data limite real (&quot;até dd/mm&quot;) e a avaliação final já tem a data reservada
              visível desde o início.
            </p>
            <p>
              <strong>O prazo é um teto, não uma espera:</strong> se uma fase terminar antes, a
              próxima abre na sequência — os 15 dias são a janela oficial do onboarding.
            </p>
          </div>
        </section>

        {/* ========================================================= */}
        {/* SEÇÃO 3 — Passo a passo do fluxo */}
        {/* ========================================================= */}
        <section className="mb-10 avoid-break page-break-before">
          <div className="flex items-center gap-2.5 mb-4 border-b border-gray-200 pb-2">
            <div className="w-7 h-7 rounded-lg bg-brand-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
              3
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">
              SEÇÃO 3 — Passo a passo do fluxo
            </h2>
          </div>

          {/* 3.1 Criação do onboarding */}
          <div className="mb-6 border-l-4 border-brand-600 pl-4 py-1">
            <h3 className="text-base font-bold text-gray-900 mb-2">
              3.1 Criação do onboarding (RH):
            </h3>
            <ol className="list-decimal list-inside space-y-1.5 text-xs sm:text-sm text-gray-700 leading-relaxed">
              <li>Menu Onboardings → botão &quot;Novo onboarding&quot;.</li>
              <li>Preencher nome do colaborador, cargo, área e gestor responsável.</li>
              <li>O sistema valida a soma dos dias (≤15) e gera o cronograma com datas reais.</li>
              <li>
                Enviar ao colaborador o Link Público (card no topo da tela de detalhe — botão
                &quot;Copiar link&quot;), pode ser mandado por WhatsApp ou e-mail.
              </li>
            </ol>
          </div>

          {/* 3.2 Etapa 1 — Integração */}
          <div className="mb-6 border-l-4 border-cyan-600 pl-4 py-1">
            <h3 className="text-base font-bold text-gray-900 mb-2">
              3.2 Etapa 1 — Integração (RH):
            </h3>
            <p className="text-xs sm:text-sm text-gray-700 leading-relaxed mb-3">
              O RH conduz os itens da etapa; o colaborador, pelo link público, confirma cada
              material clicando em &quot;Confirmo que assisti/li&quot; — registrado com data e hora.
            </p>
            <div className="p-3 bg-brand-50/70 border border-brand-200 rounded-lg text-xs sm:text-sm text-brand-950 mb-3 space-y-1.5">
              <strong className="block text-brand-900 font-bold">
                Checklist de Integração Completo (Exigência para conclusão da Etapa 1):
              </strong>
              <p>
                A Etapa 1 exige o cumprimento obrigatório do{' '}
                <strong>Checklist de Integração</strong> (entrega física de material: notebook
                corporativo, periféricos como teclado e mouse/mousepad, headset, cartão Flash/VR e
                apresentações institucionais ao gestor da área e demais gestores).
              </p>
              <p>
                A conferência é exclusiva do RH/Admin, registrando data/hora e o nome de quem
                entregou. Cada item conta com campo de <strong>observação interna opcional</strong>{' '}
                (ex.: patrimônio do equipamento, detalhes de entrega), visível para a gestão mas não
                exposta ao colaborador. O botão{' '}
                <strong>&quot;Concluir Etapa 1&quot; permanece desabilitado</strong> com aviso em
                destaque enquanto houver qualquer item pendente de entrega.
              </p>
            </div>
            <p className="text-xs sm:text-sm text-gray-700 leading-relaxed mb-3">
              Com todos os materiais confirmados e o checklist de integração 100% entregue, o RH
              clica em &quot;Concluir Etapa 1&quot; → o sistema trava a etapa, libera a Etapa 2 e
              envia e-mail automático ao gestor responsável (com o link do colaborador em destaque).
            </p>
            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-xs sm:text-sm text-amber-950">
              <strong>Painel Clientes de Referência visível desde a Etapa 1:</strong> o painel de
              indicação dos clientes no Passportal já fica posicionado no bloco da Etapa 2 desde a
              Etapa 1 em modo aguardando (&quot;Aguardando definição dos clientes pelo gestor —
              disponível na Etapa 2&quot;), garantindo previsibilidade sobre o estudo prático que
              virá a seguir.
            </div>
          </div>

          {/* 3.3 Etapa 2 — Vivência Técnica */}
          <div className="mb-6 border-l-4 border-teal-600 pl-4 py-1">
            <h3 className="text-base font-bold text-gray-900 mb-2">
              3.3 Etapa 2 — Vivência Técnica (Gestor):
            </h3>
            <div className="p-3 bg-brand-50/70 border border-brand-200 rounded-lg text-xs sm:text-sm text-brand-950 mb-3 space-y-1">
              <strong className="block text-brand-900 font-bold">
                Painel &quot;Técnico Responsável pelo Acompanhamento&quot; (Topo da Etapa 2):
              </strong>
              <p>
                Localizado logo no topo da Etapa 2 (antes da listagem de fases), permite ao Gestor
                Responsável ou Admin definir o nome (obrigatório) e e-mail (opcional) do técnico
                experiente que fará o acompanhamento inicial do novo colaborador. O RH visualiza em
                modo leitura, a alteração gera log formal de auditoria com histórico de quem
                alterou, e o nome do técnico é exibido em destaque no portal público do colaborador
                (&quot;Seu acompanhamento inicial: [nome]&quot;) para que ele saiba exatamente a
                quem recorrer.
              </p>
            </div>
            <div className="space-y-2 text-xs sm:text-sm text-gray-700 leading-relaxed">
              <p>Trilha em fases ordenadas — uma fase só libera quando a anterior é concluída.</p>
              <ul className="list-disc list-inside space-y-1 pl-1">
                <li>
                  <strong>Fase com itens:</strong> o colaborador confirma item a item pelo link
                  público; o gestor acompanha pelas badges (verde &quot;Confirmado pelo colaborador
                  em dd/mm às hh:mm&quot; / âmbar &quot;Aguardando confirmação&quot;).
                </li>
                <li>
                  <strong>Fase sem itens (prática):</strong> aparece o botão &quot;Concluir
                  fase&quot; direto, registrando data e responsável.
                </li>
                <li>
                  <strong>Fase mista:</strong> o gestor espera a confirmação do documento e conclui
                  a fase.
                </li>
              </ul>
              <div className="p-2.5 bg-red-50 text-red-900 border border-red-200 rounded-lg text-xs font-medium">
                <strong>Restrição:</strong> somente o gestor responsável (ou Admin) conclui fases da
                Etapa 2 — o RH visualiza com o aviso &quot;Conclusão restrita ao gestor&quot;.
              </div>
              <p>
                <strong>Destaque Fase 2 (Mapeamento de Ambientes):</strong> painel &quot;Clientes de
                Referência&quot;, onde o gestor digita os 3 clientes que o técnico deve estudar no
                Passportal (topologia, faixas de IP, sistemas legados); os nomes aparecem em
                destaque no portal do colaborador; cada alteração fica registrada na auditoria.
              </p>
            </div>

            {/* As 6 fases da trilha técnica */}
            <div className="mt-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800 mb-2.5">
                As 6 fases da trilha técnica com as descrições:
              </h4>
              <div className="space-y-2 text-xs sm:text-sm text-gray-700">
                <p>
                  <strong>1. Configuração e Acessos</strong> — MFA, validação dos acessos (Movidesk,
                  Passportal, TeamViewer) e vídeos tutoriais.
                </p>
                <p>
                  <strong>2. Mapeamento de Ambientes</strong> — estudo da documentação dos 3
                  clientes de referência no Passportal.
                </p>
                <p>
                  <strong>3. Shadowing Ativo</strong> — acompanhamento em tempo real da tela de um
                  técnico sênior; contato telefônico inicial mandatório com o cliente, consulta de
                  credenciais, TeamViewer e apontamentos no Movidesk.
                </p>
                <p>
                  <strong>4. Atendimento Invertido</strong> — o técnico em formação assume o teclado
                  em chamados reais, com contato telefônico prévio obrigatório e o sênior
                  acompanhando em chamada simultânea; nada é finalizado sem validação.
                </p>
                <p>
                  <strong>5. Atendimento Solo N1</strong> — chamados N1 individuais (redefinições,
                  impressoras, softwares padrão), sempre com contato telefônico inicial; dúvidas vão
                  ao padrinho designado.
                </p>
                <p>
                  <strong>6. Consolidação Prática</strong> — aumento de volumetria N1 e início de
                  demandas de média complexidade sob supervisão sob demanda.
                </p>
              </div>
              <p className="mt-3 text-xs text-teal-800 font-semibold">
                Ao concluir a última fase, o sistema envia e-mail ao gestor lembrando da avaliação
                final.
              </p>
            </div>
          </div>

          {/* 3.4 Etapa 3 — Teste de Conhecimento e Avaliação Final */}
          <div className="border-l-4 border-indigo-600 pl-4 py-1 space-y-3">
            <div>
              <h3 className="text-base font-bold text-gray-900 mb-1">
                3.4 Etapa 3 — Teste de Conhecimento Técnico e Avaliação Final:
              </h3>
              <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
                A Etapa 3 integra agora a realização prévia da prova de conhecimento vinculada ao
                colaborador como insumo mandatório para a decisão avaliativa do gestor.
              </p>
            </div>

            {/* Sub-bloco Questionário Vinculado e Regras da Prova */}
            <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2 text-xs sm:text-sm text-indigo-950">
              <strong className="block font-bold text-indigo-900 uppercase tracking-wide text-xs">
                Questionário Vinculado & Teste de Conhecimento (Regras Oficiais):
              </strong>
              <ul className="list-disc list-inside space-y-1.5 text-xs text-indigo-900">
                <li>
                  <strong>Vínculo no Onboarding:</strong> Ao cadastrar um onboarding, o sistema
                  pré-preenche automaticamente o questionário do setor do colaborador (ex.: setor
                  Windows vincula a <em>&quot;Prova de Windows — Atendimento e Suporte&quot;</em>).
                  O questionário fica fixado na criação do onboarding, garantindo que edições
                  futuras não alterem provas já em andamento.
                </li>
                <li>
                  <strong>Liberação automática:</strong> O teste é liberado no portal do colaborador
                  assim que o gestor conclui formalmente a Etapa 2 (Vivência Técnica). Se não houver
                  questionário ativo para o setor, a prova permanece bloqueada até vinculação
                  manual.
                </li>
                <li>
                  <strong>Régua de aprovação por questionário (Padrão 95%):</strong> Cada
                  questionário tem sua nota mínima de aprovação configurável (padrão oficial de 95%
                  — mínimo de 19 acertos na prova padrão de 20 questões).
                </li>
                <li>
                  <strong>Correção automática segura no servidor:</strong> A submissão é corrigida
                  automaticamente via hook server-side protegido (<code>teste_conhecimento.js</code>
                  ). O colaborador <strong>NÃO visualiza nota nem gabarito</strong> no portal
                  público — recebe apenas confirmação formal de envio para aguardar a reunião com o
                  gestor.
                </li>
                <li>
                  <strong>Visibilidade restrita por papel:</strong> O <em>Administrador</em> tem
                  acesso exclusivo ao gabarito comentado completo e ao mapa comparativo das
                  alternativas escolhidas para fins de auditoria técnica. O{' '}
                  <em>Gestor Responsável</em> e o <em>RH</em> visualizam exclusivamente a nota
                  numérica e o percentual obtido.
                </li>
                <li>
                  <strong>Insumo para a avaliação e fluxo de Reteste:</strong> Se a nota for
                  inferior à régua configurada, o sistema destaca &quot;Reprovado no teste&quot; ao
                  gestor, que pode optar entre liberar um <strong>Reteste</strong> pelo portal
                  público (com justificativa e registro em auditoria) ou registrar{' '}
                  <strong>Não Apto</strong> na avaliação. O reteste sempre reaplica o MESMO
                  questionário fixado originalmente no onboarding.
                </li>
              </ul>
            </div>

            {/* Sub-bloco Avaliação do Gestor */}
            <div className="space-y-2 text-xs sm:text-sm text-gray-700">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-950">
                <strong>Apto →</strong> onboarding concluído com sucesso; o colaborador recebe a
                mensagem de liberação no portal; RH e Admin recebem o resultado por e-mail
                institucional.
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-950">
                <strong>Não apto →</strong> o gestor escolhe em qual fase técnica o colaborador
                retorna (ex.: &quot;Atendimento Solo N1&quot;) e define prazo suplementar (5 dias
                por padrão, editável); o status muda para &quot;Em acompanhamento&quot; (âmbar); o
                histórico da primeira avaliação é preservado, respeitando o teto de 2 reavaliações
                ou encerramento como não apto definitivo.
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* SEÇÃO 4 & 5 */}
        {/* ========================================================= */}
        <section className="mb-10 avoid-break page-break-before">
          {/* SEÇÃO 4 */}
          <div className="mb-8">
            <div className="flex items-center gap-2.5 mb-3 border-b border-gray-200 pb-2">
              <div className="w-7 h-7 rounded-lg bg-brand-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                4
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">
                SEÇÃO 4 — Link público do colaborador e Mecanismo &quot;Sinalizar, não
                concluir&quot;
              </h2>
            </div>
            <div className="space-y-3 text-xs sm:text-sm text-gray-700 leading-relaxed">
              <p>
                Cada onboarding tem um link exclusivo (sem senha), disponível no card &quot;Link
                Público do Colaborador&quot;; o colaborador vê seu nome, área, contagem dos 15 dias,
                progresso (&quot;X de Y materiais confirmados&quot;), o{' '}
                <strong>Técnico Responsável pelo Acompanhamento em destaque na Etapa 2</strong> e as
                fases liberadas sequencialmente; a Etapa 2 só é destravada no portal após a
                conclusão da Etapa 1 pelo RH; as confirmações de itens individuais são irreversíveis
                e registradas com data e hora — servem como comprovação formal de capacitação. As
                observações internas do checklist de integração são mantidas estritamente
                confidenciais e nunca são exibidas ao colaborador.
              </p>
              <div className="p-3.5 bg-brand-50/70 border border-brand-200 rounded-xl space-y-2">
                <strong className="block text-brand-950 font-bold text-xs uppercase tracking-wide">
                  Mecanismo &quot;Sinalizar, não concluir&quot; (Regra Fundamental):
                </strong>
                <p>
                  Quando o colaborador confirma todos os vídeos e manuais de uma fase, surge o botão{' '}
                  <strong className="text-brand-900">
                    &quot;Finalizei minhas atividades desta fase&quot;
                  </strong>
                  . Ao clicar:
                </p>
                <ul className="list-disc list-inside space-y-1.5 pl-1 text-xs">
                  <li>
                    <strong>Sinalização segura com privilégio de sistema:</strong> a requisição é
                    processada pelo endpoint seguro do servidor (validando o token exclusivo do
                    onboarding), gravando a data e hora no histórico do onboarding mesmo em acesso
                    anônimo.
                  </li>
                  <li>
                    <strong>Registro formal na Auditoria:</strong> gera automaticamente um log na
                    trilha de auditoria (&quot;Sinalização de conclusão pelo colaborador&quot;) com
                    nome, data/hora e identificação da fase.
                  </li>
                  <li>
                    <strong>E-mail automático ao responsável:</strong> o sistema notifica
                    imediatamente a equipe de RH (se Etapa 1) ou o Gestor Responsável (se Etapa 2),
                    informando que o colaborador completou suas leituras.
                  </li>
                  <li>
                    <strong>Badge visual na tela interna:</strong> RH e Gestores visualizam a badge{' '}
                    <span className="font-semibold text-amber-900 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded text-[11px]">
                      &quot;Sinalizado pelo colaborador em dd/mm às hh:mm&quot;
                    </span>{' '}
                    no cabeçalho da etapa/fase correspondente.
                  </li>
                  <li>
                    <strong className="text-red-700">Conclusão é ato exclusivo da gestão:</strong> o
                    botão do colaborador <em>apenas sinaliza</em>; ele <strong>NÃO conclui</strong>{' '}
                    a fase nem avança o status do onboarding. A conclusão formal de etapas e fases
                    continua sendo ato indelegável do RH (Etapa 1) e do Gestor/Admin (Etapa 2), após
                    validação prática e conferência presencial.
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* SEÇÃO 5 */}
          <div>
            <div className="flex items-center gap-2.5 mb-3 border-b border-gray-200 pb-2">
              <div className="w-7 h-7 rounded-lg bg-brand-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                5
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">
                SEÇÃO 5 — Auditoria, Logs e Política de Retenção
              </h2>
            </div>
            <div className="space-y-2.5 text-xs sm:text-sm text-gray-700 leading-relaxed">
              <p>
                Aba <strong>&quot;Histórico & Auditoria&quot;</strong> (na página de cada
                onboarding) registra toda a trilha — conclusões de etapas e fases, confirmações do
                colaborador, sinalizações de término de fase, definição de clientes e decisões
                avaliativas — com quem fez, quando, e destaque explícito para prazos (ex.:
                &quot;Concluído 2 dias antes do prazo planejado&quot; / &quot;Concluído 1 dia após o
                prazo&quot;).
              </p>
              <p>
                Tela <strong>&quot;Logs&quot;</strong> (menu lateral, exclusiva do Admin): todos os
                onboardings, com filtros por colaborador, gestor e &quot;somente fora do
                prazo&quot;.
              </p>
              <p>
                <strong>Exportação:</strong> botões para baixar os logs filtrados em CSV ou TXT.
              </p>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                <p>
                  <strong>Política de Retenção de 6 meses (180 dias):</strong> todos os registros de
                  auditoria são conservados integralmente pelo período regulamentar de 6 meses para
                  fins de compliance e histórico trabalhista.
                </p>
                <p className="text-xs text-slate-500">
                  Um <strong>job cron diário automatizado</strong> executa pontualmente às{' '}
                  <strong>03:00 UTC</strong> (limpar_logs_auditoria_6meses) para expurgar registros
                  que ultrapassem a janela de 180 dias, garantindo integridade e conformidade de
                  armazenamento sem intervenção manual.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* SEÇÃO 6, 7 & 8 */}
        {/* ========================================================= */}
        <section className="mb-10 avoid-break page-break-before">
          {/* SEÇÃO 6 */}
          <div className="mb-8">
            <div className="flex items-center gap-2.5 mb-3 border-b border-gray-200 pb-2">
              <div className="w-7 h-7 rounded-lg bg-brand-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                6
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">
                SEÇÃO 6 — Modelos de Tarefas e Biblioteca
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-gray-700 leading-relaxed mb-2">
              A <strong>Biblioteca de Materiais</strong> (aba dentro de Modelos) aceita vídeos
              (.mp4) e manuais (.pdf, .pptx, .docx, até 50 MB), sobem uma única vez e são associados
              aos itens de qualquer área — atualizou o material na biblioteca, vale para todos os
              onboardings futuros.
            </p>
            <p className="text-xs sm:text-sm text-gray-700 leading-relaxed mb-2">
              <strong>Modelos por área:</strong> cada área tem aba própria com seus itens e fases;
              áreas novas podem ser criadas pelo botão &quot;Gerenciar Áreas&quot; (nome, descrição
              e cor) — exclusivo para Admin/RH. Áreas administrativas (RH, Comercial, Laboratório)
              ficam como lista simples; as técnicas têm a trilha de 6 fases.
            </p>
            <p className="text-xs sm:text-sm text-gray-700 leading-relaxed mb-2">
              <strong>Modelos do Checklist de Integração (Aba Etapa 1):</strong> os itens padrão do
              checklist de integração (equipamentos e apresentações) podem ser editados, adicionados
              ou reordenados por Admin e RH na aba &quot;Etapa 1 (RH / Integração Geral)&quot;.
              Onboardings novos são criados automaticamente com a lista modelo atualizada, enquanto
              onboardings já em andamento mantêm seu snapshot individual preservado.
            </p>
            <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
              <strong>Gestão de Questionários de Conhecimento (Aba Questionários):</strong> o
              Administrador gerencia questionários independentes por setor (Windows, Linux, Redes) e
              tipo de uso (&quot;onboarding&quot;, &quot;reciclagem&quot;, &quot;mudanca_area&quot;,
              &quot;avaliacao&quot;, &quot;contratacao&quot;). Cada questionário possui nome,
              descrição, setor, nota mínima configurável (padrão 95%), status ativo/inativo e seu
              respectivo banco de questões de múltipla escolha com alternativas, gabarito e
              comentário explicativo de auditoria.
            </p>
          </div>

          {/* SEÇÃO 7 */}
          <div className="mb-8">
            <div className="flex items-center gap-2.5 mb-3 border-b border-gray-200 pb-2">
              <div className="w-7 h-7 rounded-lg bg-brand-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                7
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">
                SEÇÃO 7 — Notificações por e-mail
              </h2>
            </div>
            <div className="space-y-1.5 text-xs sm:text-sm text-gray-700 leading-relaxed">
              <div className="flex items-start gap-2">
                <span className="font-bold text-brand-700">1.</span>
                <span>
                  Etapa 1 concluída → e-mail ao gestor responsável (com link do colaborador).
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-brand-700">2.</span>
                <span>Etapa 2 concluída → e-mail ao gestor pedindo a avaliação final.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-brand-700">3.</span>
                <span>Avaliação registrada → e-mail a RH e Admin com o resultado em destaque.</span>
              </div>
              <p className="text-xs text-gray-500 pt-1">
                * Dependem do SMTP configurado no painel do backend pelo Admin.
              </p>
            </div>
          </div>

          {/* SEÇÃO 8 */}
          <div className="mb-8">
            <div className="flex items-center gap-2.5 mb-3 border-b border-gray-200 pb-2">
              <div className="w-7 h-7 rounded-lg bg-brand-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                8
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">
                SEÇÃO 8 — Usuários
              </h2>
            </div>
            <div className="space-y-2 text-xs sm:text-sm text-gray-700 leading-relaxed">
              <p>
                <strong>Tela &quot;Usuários&quot;:</strong> Admin cria qualquer papel; RH também
                pode criar usuários (não pode editar/desativar o Admin).
              </p>
              <p>
                <strong>Cadastro:</strong> nome, e-mail, senha inicial e papel (Admin, RH ou
                Gestão). Contas desativadas não conseguem logar.
              </p>
              <p>
                <strong>Recuperação de senha:</strong> disponível na tela de login.
              </p>
            </div>
          </div>

          {/* SEÇÃO 9 */}
          <div className="mb-8">
            <div className="flex items-center gap-2.5 mb-3 border-b border-gray-200 pb-2">
              <div className="w-7 h-7 rounded-lg bg-red-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                9
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">
                SEÇÃO 9 — Exclusão de Colaboradores e Cascata Completa
              </h2>
            </div>
            <div className="space-y-2.5 text-xs sm:text-sm text-gray-700 leading-relaxed">
              <p>
                Caso um colaborador desista da vaga antes ou durante o processo, ou o RH crie um
                registro com dados incorretos, o sistema dispõe de rotina oficial de{' '}
                <strong>exclusão definitiva em cascata</strong>.
              </p>
              <div className="p-3 bg-red-50/70 border border-red-200 rounded-lg space-y-1.5 text-xs text-red-950">
                <p>
                  <strong>Quem tem permissão:</strong> Exclusivo para perfis{' '}
                  <span className="font-bold">Administrador</span> e{' '}
                  <span className="font-bold">RH</span>. Usuários com perfil de{' '}
                  <em>Gestão (gestor)</em> têm acesso estritamente somente-leitura e não visualizam
                  os botões de exclusão.
                </p>
                <p>
                  <strong>Onde acionar:</strong> Pelo ícone de lixeira no card do colaborador na
                  página <code>/colaboradores</code> ou pelo botão &quot;Excluir Colaborador&quot;
                  no cabeçalho da página de detalhe do colaborador (<code>/colaboradores/:id</code>
                  ).
                </p>
                <p>
                  <strong>Exclusão em cascata completa:</strong> Ao confirmar, o servidor remove em
                  transação atômica todos os onboardings do colaborador, todas as tarefas e
                  atividades, confirmações de leitura do portal público e avaliações. O link público
                  (token de acesso) é imediatamente invalidado, impedindo qualquer acesso futuro
                  pelo colaborador. Usuários de acesso ao sistema (tabela <code>users</code>) são
                  preservados.
                </p>
                <p>
                  <strong>Confirmação de segurança:</strong> Modal com resumo detalhado de todas as
                  contagens que serão apagadas + exigência de digitação do{' '}
                  <strong>nome exato do colaborador</strong> para habilitar o botão de confirmação.
                </p>
                <p>
                  <strong>Motivo e Auditoria:</strong> Campo opcional para informar o motivo (ex.:
                  &quot;Desistiu da vaga&quot;, &quot;Dados incorretos&quot;). A operação é gravada
                  de forma permanente no <em>Histórico & Auditoria</em> e na tela de <em>Logs</em>,
                  registrando executor, horário, motivo e resumo das quantidades excluídas.
                </p>
              </div>
            </div>
          </div>

          {/* SEÇÃO 10 */}
          <div>
            <div className="flex items-center gap-2.5 mb-3 border-b border-gray-200 pb-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                10
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">
                SEÇÃO 10 — Módulo de Pré-selecionados & Contratação
              </h2>
            </div>
            <div className="space-y-3 text-xs sm:text-sm text-gray-700 leading-relaxed">
              <p>
                O módulo <strong>Pré-selecionados</strong> (<code>/pre-selecionados</code>) atende
                ao fluxo de candidatos que foram aprovados na 1ª fase de entrevista e avançam para a
                avaliação técnica da vaga antes da contratação formal.
              </p>

              <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-lg space-y-2 text-xs text-blue-950">
                <p>
                  <strong>1. Cadastro Simples (RH / Admin):</strong> Ao cadastrar um candidato que
                  passou da 1ª fase de entrevista, são preenchidos apenas <em>Nome</em>,{' '}
                  <em>E-mail</em>, <em>Cargo Pretendido</em> e <em>Área / Setor</em>.
                </p>
                <p>
                  <strong>2. Vínculo Automático do Questionário:</strong> O sistema pré-seleciona a
                  prova ativa do setor escolhido (dando prioridade para questionários com{' '}
                  <code>tipo_de_uso = &quot;contratacao&quot;</code>; se não houver, utiliza o
                  questionário de onboarding do setor). Caso o setor não possua provas, o sistema
                  alerta e solicita a escolha manual.
                </p>
                <p>
                  <strong>3. Link Público da Prova (Sem Login):</strong> O cartão do candidato exibe
                  o botão <em>&quot;Copiar Link da Prova&quot;</em> (rota{' '}
                  <code>/candidato/prova/:token</code>). Ao copiar, o status muda automaticamente
                  para <em>&quot;Prova enviada&quot;</em> e aguarda o preenchimento.
                </p>
                <p>
                  <strong>4. Tentativa Única e Correção no Servidor (Sem Reteste):</strong> A prova
                  de contratação não possui reteste. O candidato preenche as questões de múltipla
                  escolha e, ao enviar, o servidor corrige imediatamente e grava a tentativa única.
                  O candidato NUNCA visualiza sua nota ou gabarito (apenas a tela de confirmação).
                </p>
                <p>
                  <strong>5. Notificação por E-mail ao Gestor:</strong> Quando a prova é concluída,
                  o sistema envia e-mail automático via SMTP aos Gestores e Admins da área com o
                  resumo dos acertos, percentual e sinalização da régua.
                </p>
                <p>
                  <strong>6. Avaliação Técnica do Gestor da Área (Aprovar / Reprovar):</strong> A
                  decisão técnica de perfil cabe exclusivamente ao <strong>Gestor da Área</strong>.
                  Ao clicar em <em>&quot;Aprovar Perfil&quot;</em>, o candidato <strong>NÃO</strong>{' '}
                  é convertido direto em colaborador: seu status avança para a fase intermediária{' '}
                  <span className="font-semibold text-sky-800 bg-sky-100 px-1.5 py-0.5 rounded">
                    &quot;Aprovado pelo Gestor — Aguardando RH&quot;
                  </span>
                  . Caso reprovado pelo gestor, o status vira <em>&quot;Reprovado&quot;</em> e o
                  link morre.
                </p>
                <p>
                  <strong>7. Fase Intermediária de Validação e Contato pelo RH:</strong> Nesta
                  etapa, o candidato é destacado na fila do RH para contato prévio (alinhamento
                  salarial, disponibilidade e data de início). As ações são{' '}
                  <strong>exclusivas de RH e Admin</strong> (gestores visualizam apenas o status de
                  acompanhamento e não podem formalizar):
                </p>
                <ul className="list-disc pl-5 space-y-1 text-blue-900">
                  <li>
                    <strong>Formalizar Contratação:</strong> Abre o modal de contratação para
                    informar a <em>Data de Início</em> e o <em>Gestor Responsável de TI</em>. Ao
                    confirmar, cria o colaborador oficial, inicia o Onboarding de 15 dias com todas
                    as tarefas e o status do candidato vira{' '}
                    <em>&quot;Convertido em colaborador&quot;</em>.
                  </li>
                  <li>
                    <strong>Registrar Desistência:</strong> Caso o candidato recuse a proposta ou
                    desista da oportunidade. Motivo opcional gravado no histórico, status vira{' '}
                    <em>&quot;Desistência registrada&quot;</em> e o link público é cancelado.
                  </li>
                  <li>
                    <strong>Reprovação pelo RH:</strong> Possibilidade de reprovar por critério
                    administrativo próprio do RH (ex.: pretensão salarial incompatível ou falta de
                    documentação). O motivo é exigido, registrado na auditoria e o link público é
                    encerrado.
                  </li>
                </ul>
                <p>
                  <strong>8. Regra de Encerramento do Link Público:</strong> O link público da prova
                  morre (token bloqueado com HTTP 403) em qualquer desfecho terminal que não seja a
                  conversão (reprovação pelo gestor, reprovação pelo RH ou desistência).
                </p>
                <p>
                  <strong>9. Rastro Completo & Auditoria:</strong> Todas as decisões (aprovação
                  técnica do gestor, formalização do RH, desistência e reprovações) geram registros
                  permanentes no <em>Histórico & Auditoria</em> com autor, papel, horário e motivos.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* SEÇÃO 11 — Checklist rápido de homologação */}
        {/* ========================================================= */}
        <section className="mb-10 avoid-break page-break-before">
          <div className="flex items-center gap-2.5 mb-4 border-b border-gray-200 pb-2">
            <div className="w-7 h-7 rounded-lg bg-brand-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
              11
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">
              SEÇÃO 11 — Checklist rápido de homologação
            </h2>
          </div>

          <p className="text-xs sm:text-sm text-gray-600 mb-4">
            Utilize os itens abaixo para validar a conformidade dos fluxos operacionais e regras de
            negócio do sistema:
          </p>

          <div className="space-y-2.5">
            {[
              'Criar onboarding de teste (validar soma dos 15 dias e checklist inicial de integração semeado);',
              'Tentar concluir Etapa 1 com itens de checklist pendentes → verificar bloqueio;',
              'RH marca itens do checklist como entregues com observação opcional → concluir Etapa 1;',
              'Conferir painel "Clientes de Referência" exibido em modo aguardando desde a Etapa 1;',
              'Gestor define Técnico Responsável no topo da Etapa 2 → conferir destaque no portal público;',
              'Gestor indica os 3 clientes na Fase 2 → conferir no portal do colaborador;',
              'Colaborador confirma todos os itens da fase no portal público e clica em "Finalizei minhas atividades desta fase" → verificar badge na tela interna, registro na auditoria e e-mail ao responsável;',
              'Confirmar que a sinalização do colaborador NÃO conclui a fase (conclusão permanece botão exclusivo do gestor/RH);',
              'Concluir uma fase fora do prazo de propósito → ver o destaque nos Logs;',
              'Registrar "Não apto" → escolher fase de retorno e conferir o status "Em acompanhamento";',
              'Exportar logs em CSV;',
              'Editar itens modelo do checklist na aba Etapa 1 de Modelos de Tarefas;',
              'Teste de Conhecimento na Etapa 3: colaborador responde 20 questões no portal público sem ver nota/gabarito;',
              'Simular correção automática: 19 acertos (95%) aprova no teste; 18 acertos (90%) sinaliza reprovado ao gestor;',
              'Gestor/RH visualizam nota e percentual da tentativa; Admin confere gabarito detalhado com justificativas comentadas;',
              'Gestor clica em "Liberar Reteste" com motivo → colaborador consegue submeter nova tentativa no portal público;',
              'Testar acesso cruzado: gestor de outra área vê, mas não consegue agir;',
              'Exclusão de colaborador: conferir que gestor não vê o botão, RH/Admin abrem modal com resumo, exigem nome, aceitam motivo opcional e apagam em cascata sem deixar órfãos;',
              'Módulo Pré-selecionados: cadastrar candidato com nome, e-mail, cargo e setor → verificar questionário pré-selecionado;',
              'Copiar link público da prova (/candidato/prova/:token) → status muda para "Prova enviada";',
              'Candidato responde as questões e submete → verificar bloqueio de segunda tentativa (sem reteste) e mensagem sem nota;',
              'Conferir notificação de conclusão da prova e insumo no cartão do candidato;',
              'Gestor da área decide "Aprovar Perfil" ou "Reprovar" com motivo opcional;',
              'Aprovação do gestor muda status para "Aprovado pelo Gestor — Aguardando RH" sem abrir conversão direta;',
              'Gestor NÃO visualiza os botões de formalização do RH;',
              'RH visualiza o cartão destacado na fila "Aguardando RH" com ações exclusivas;',
              'RH formaliza contratação com data de início e gestor → cria colaborador e onboarding completo;',
              'RH registra desistência ou reprovação própria com motivo → link público é invalidado e auditoria gravada.',
            ].map((item, idx) => (
              <div
                key={idx}
                onClick={() => toggleCheck(idx)}
                className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 bg-gray-50/70 hover:bg-white transition-colors cursor-pointer"
              >
                <div
                  className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                    checklistState[idx]
                      ? 'bg-brand-600 border-brand-600 text-white'
                      : 'border-gray-400 bg-white'
                  }`}
                >
                  {checklistState[idx] && <CheckSquare className="w-3.5 h-3.5" />}
                </div>
                <span
                  className={`text-xs sm:text-sm ${
                    checklistState[idx] ? 'text-gray-900 font-semibold' : 'text-gray-700'
                  }`}
                >
                  {item}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Rodapé do manual */}
        <footer className="mt-12 pt-6 border-t-2 border-gray-200 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500 gap-2">
          <div className="font-semibold text-gray-700">
            Mundo Open — Onboarding de Colaboradores de TI. Documento interno.
          </div>
          <div className="text-[11px] text-gray-400">
            Versão do Sistema 1.0 • Impresso via Painel de Controle
          </div>
        </footer>
      </article>

      {/* Dica de impressão no final da tela (Oculta na impressão) */}
      <div className="no-print bg-slate-100 border border-slate-200/80 rounded-xl p-4 text-xs text-slate-600 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Printer className="w-4 h-4 text-slate-500" />
          <span>
            Dica: No diálogo de impressão do navegador, selecione{' '}
            <strong>&quot;Salvar como PDF&quot;</strong> e mantenha a opção de{' '}
            <strong>&quot;Gráficos de plano de fundo&quot;</strong> marcada para preservar as cores
            e destaques visuais.
          </span>
        </div>
        <Button variant="outline" size="sm" onClick={handlePrint} className="shrink-0 font-medium">
          Imprimir agora
        </Button>
      </div>
    </div>
  )
}
