import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import pb from '@/lib/pocketbase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Database,
  Download,
  FileCode2,
  FileText,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react'

/**
 * Página /backup-estrutural (só Admin).
 *
 * Dois downloads, ambos servidos por rotas restritas do backend:
 * - "Baixar backup estrutural (SQL)" → /backend/v1/backup-schema
 *   (docs/backup-estrutural/schema.sql)
 * - "Baixar README (instruções)" → /backend/v1/backup-readme
 *   (docs/backup-estrutural/README.md)
 *
 * O acesso é bloqueado na tela (só admin vê) e reforçado no backend
 * (401 para anônimo, 403 para RH/Gestão).
 */
export default function BackupEstrutural() {
  const { user } = useAuth()
  const [baixando, setBaixando] = useState<'sql' | 'readme' | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState<'sql' | 'readme' | null>(null)

  const baixarArquivo = async (
    rota: '/backend/v1/backup-schema' | '/backend/v1/backup-readme',
    nomeArquivo: string,
    mimeType: string,
    tamanhoMinimo: number,
  ) => {
    const resposta = await fetch(pb.buildUrl(rota), {
      method: 'GET',
      headers: { Authorization: pb.authStore.token },
    })
    if (!resposta.ok) {
      const corpo = await resposta.text()
      let msg = `Erro ${resposta.status}`
      try {
        msg = JSON.parse(corpo)?.error || msg
      } catch (_) {
        /* corpo não é JSON */
      }
      throw new Error(msg)
    }
    const texto = await resposta.text()
    if (!texto || texto.length < tamanhoMinimo) {
      throw new Error('Resposta vazia do servidor.')
    }
    const blob = new Blob([texto], { type: `${mimeType};charset=utf-8` })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = nomeArquivo
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const handleDownload = async (tipo: 'sql' | 'readme') => {
    setBaixando(tipo)
    setErro(null)
    setOk(null)
    try {
      if (tipo === 'sql') {
        await baixarArquivo(
          '/backend/v1/backup-schema',
          'backup-estrutural-gestao-colaboradores.sql',
          'application/sql',
          100,
        )
      } else {
        await baixarArquivo('/backend/v1/backup-readme', 'README.md', 'text/markdown', 100)
      }
      setOk(tipo)
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        (e as Error)?.message ||
        (tipo === 'sql'
          ? 'Falha ao obter o backup estrutural.'
          : 'Falha ao obter o README (instruções).')
      setErro(msg)
    } finally {
      setBaixando(null)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-lg font-bold text-[#1A2233]">Backup Estrutural (SQL)</h2>
        <p className="text-sm text-gray-500 mt-1">
          Espelho da estrutura atual do banco (PostgreSQL/Supabase) para guardar como referência ou
          restaurar num Supabase próprio.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                <Database className="w-5 h-5 text-brand-600" />
              </div>
              <div>
                <CardTitle className="text-base">schema.sql — estrutura completa</CardTitle>
                <CardDescription className="mt-1">
                  Tabelas, enums, índices, gatilhos e políticas RLS equivalentes às regras de acesso
                  do sistema (Admin/RH/Gestão, tokens públicos de prova, feedback, documento e ficha
                  do colaborador).
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="shrink-0">
              <ShieldCheck className="w-3 h-3 mr-1" /> Somente Admin
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="text-sm text-gray-600 space-y-1.5">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
              22 coleções espelhadas (usuários, setores, onboardings, provas, candidatos, férias,
              certificados, logs…)
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
              Comentários em português, cabeçalho com data e versão do sistema
            </li>
            <li className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <span>
                <strong>Não inclui dados nem arquivos</strong> — é backup estrutural/documental.
                Como exportar dados está descrito no README do pacote (disponível no segundo botão
                de download, abaixo).
              </span>
            </li>
          </ul>

          {erro && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => handleDownload('sql')} disabled={baixando !== null}>
              {baixando === 'sql' ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              {baixando === 'sql' ? 'Gerando download…' : 'Baixar backup estrutural (SQL)'}
            </Button>
            <Button
              variant="outline"
              onClick={() => handleDownload('readme')}
              disabled={baixando !== null}
            >
              {baixando === 'readme' ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FileText className="w-4 h-4 mr-2" />
              )}
              {baixando === 'readme' ? 'Gerando download…' : 'Baixar README (instruções)'}
            </Button>
            {ok === 'sql' && (
              <span className="text-sm text-green-700 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Download concluído
              </span>
            )}
            {ok === 'readme' && (
              <span className="text-sm text-green-700 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Download do README concluído
              </span>
            )}
          </div>

          <p className="text-xs text-gray-400 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="flex items-center gap-1.5">
              <FileCode2 className="w-3.5 h-3.5" />
              O arquivo também está versionado no repositório em docs/backup-estrutural/schema.sql
            </span>
            <span className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              README versionado em docs/backup-estrutural/README.md
            </span>
            {user?.email ? ` · sessão: ${user.email}` : ''}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
