/**
 * Hook: download do backup estrutural (SQL) — apenas Admin.
 *
 * GET /backend/v1/backup-schema
 *
 * Serve o arquivo docs/backup-estrutural/schema.sql do projeto (o mesmo que
 * fica no repositório, com data/versão no cabeçalho). O conteúdo é lido em
 * tempo de resposta: se o arquivo não estiver disponível no filesystem do
 * hook, devolve 404 com instrução para obter o SQL no repositório.
 *
 * Acesso: SOMENTE Admin (papel "admin"). RH e Gestão recebem 403 — decisão
 * do recurso de backup estrutural.
 */

routerAdd(
  'GET',
  '/backend/v1/backup-schema',
  (e) => {
    const app = e.app || $app

    const authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { error: 'Autenticação necessária.' })
    }
    const role = (authRecord.getString('role') || '').trim().toLowerCase()
    if (role !== 'admin') {
      return e.json(403, { error: 'Acesso restrito a Admin.' })
    }

    // Caminhos possíveis do arquivo empacotado com os hooks (o processo roda
    // com o diretório pb_hooks como base).
    const candidatos = [
      'docs/backup-estrutural/schema.sql',
      '../docs/backup-estrutural/schema.sql',
      '../../docs/backup-estrutural/schema.sql',
      '/app/docs/backup-estrutural/schema.sql',
      'pb_public/backup-estrutural/schema.sql',
    ]

    for (const caminho of candidatos) {
      let conteudo = null
      try {
        conteudo = $os.readFile(caminho)
      } catch (_) {
        // tenta o próximo caminho
      }
      if (conteudo && String(conteudo).length > 0) {
        e.response
          .header()
          .set(
            'Content-Disposition',
            'attachment; filename="backup-estrutural-gestao-colaboradores.sql"',
          )
        e.response.header().set('Cache-Control', 'no-store')
        return e.blob(200, 'application/sql; charset=utf-8', String(conteudo))
      }
    }

    return e.json(404, {
      error:
        'Arquivo schema.sql não encontrado no servidor. Obtenha o backup no repositório (docs/backup-estrutural/schema.sql).',
    })
  },
  $apis.requireAuth(),
)
