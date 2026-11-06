# Backup Estrutural — SQL (PostgreSQL / Supabase)

**Gerado em:** 2026-11-06 · **Versão do sistema:** 0.0.84

Este pacote é um **backup ESTRUTURAL/documental** do banco do sistema
**Gestão de Colaboradores TI** (Mundo Open). Ele contém o script SQL que
recria, num PostgreSQL/Supabase vazio, toda a estrutura das **22 coleções**
do backend Skip Cloud (PocketBase):

| Grupo | Tabelas |
|---|---|
| Identidade e estrutura | `users`, `setores` |
| Biblioteca e modelos | `materiais`, `fases_modelo`, `modelo_tarefas`, `itens_integracao_modelo` |
| Onboarding / colaborador | `onboardings`, `tarefas_onboarding`, `confirmacoes_colaborador` |
| Avaliações e provas | `avaliacoes`, `questionarios`, `teste_questoes`, `teste_tentativas`, `avaliacoes_colaborador`, `candidatos` |
| Auditoria e acessos | `logs_auditoria` |
| Perfil do colaborador | `certificados`, `cursos`, `colaborador_cursos`, `colaborador_documentos`, `colaborador_anotacoes`, `ferias_concessoes` |

O script inclui enums (campos select), PK/FK/defaults/checks, índices,
gatilho de `updated_at` e **políticas RLS equivalentes às regras de API do
PocketBase** (Admin/RH/Gestão, leitura pública para links de token etc.).

## O que está incluído e o que NÃO está

- ✅ Estrutura completa: tabelas, tipos, índices, gatilhos, políticas RLS.
- ✅ Comentários em português em cada tabela e nos campos importantes.
- ❌ **DADOS não estão incluídos** (nenhum registro de colaboradores,
  candidatos, provas, logs etc.).
- ❌ **ARQUIVOS não estão incluídos** (materiais da Biblioteca, avatares,
  certificados — são armazenados no storage do PocketBase).

## Como usar

1. Crie um projeto Supabase (ou um PostgreSQL vazio).
2. Rode `schema.sql` **uma única vez e por inteiro** (SQL Editor do Supabase
   ou `psql -f schema.sql`). Ele cria tudo em uma transação (`begin/commit`).
3. O papel/setor do usuário deve ir no JWT: `role` ∈ `admin | rh | gestao`
   e `setor` (texto). No Supabase, grave em `raw_user_meta_data` do usuário
   do Auth — as funções `app_role()` / `app_setor()` leem esses claims.
   Detalhe: o `id` do usuário do Auth precisa casar com o id da tabela
   `public.users` (ao importar dados, mantenha os ids de 15 caracteres do
   PocketBase, ou crie o usuário no Auth com o mesmo id).

## Como exportar os DADOS (quando quiser migrar de verdade)

O objetivo declarado aqui é backup estrutural, mas se um dia você quiser
levar os dados, os caminhos são:

1. **Exportações do próprio sistema** — a área de Limpeza de Ambiente e os
   módulos do app permitem exportar listas (colaboradores, onboardings,
   candidatos, logs) em arquivos; servem de insumo para carga via SQL.
2. **API do PocketBase** — todas as coleções expõem REST:

   ```bash
   # exemplo: baixar todos os onboardings (paginado)
   curl "https://SEU-BACKEND/api/collections/onboardings/records?perPage=500&page=1" \
     -H "Authorization: TOKEN_ADMIN"
   ```

   Faça o mesmo para cada coleção da tabela acima (e para `users`).
   Converta os JSON em `INSERT`s (ou use um ETL simples) respeitando os ids
   originais de 15 caracteres, para preservar as relações.
3. **Arquivos** — baixe do storage do PocketBase e reenvie para o Supabase
   Storage; os nomes seguem `{collectionId}/{recordId}/{arquivo}`.

## Observações de fidelidade (o SQL é um espelho, não uma reescrita)

- **Regras "vazias"** no PocketBase (`""`) = acesso público sem login.
  No SQL viraram políticas para `anon, authenticated` — é o caso dos links
  de token (prova do candidato `/candidato/prova/:token`, feedback de
  avaliação, documento complementar, ficha do colaborador e confirmações).
  O token continua sendo a chave de acesso que o app apresenta.
- **Regras `null`** (nenhuma regra de API) = a coleção só é escrita pelo
  servidor. É o caso de `teste_tentativas` (insert/update via hooks): no SQL
  não há política de insert/update para clientes — só leitura autenticada e
  exclusão por Admin.
- **Visibilidade do papel Gestão**: setor via `setor_coincide()` (equivalente
  ao operador `~` do PocketBase). Em `cursos` a comparação usa chave **ou**
  nome do setor; em `questionarios`, setor vazio = questionário global.
- **Chave "Pode editar questionários do seu setor"** (por usuário, só papel
  Gestão, desligada por padrão): enforcement em `pode_editar_questionarios()`,
  usado nas políticas de `questionarios` e `teste_questoes`.
- **Ciclo de FKs**: `candidatos.tentativa_id` → `teste_tentativas` é criada
  por `ALTER TABLE` após a criação das duas tabelas.
- **ids**: `text` de 15 caracteres (padrão PocketBase) para preservar as
  relações ao importar dados. Se preferir `uuid` no Supabase, converta
  **antes** da importação.
- **`users.senha_hash`**: o hash do PocketBase não serve no Supabase Auth;
  ao migrar, os usuários terão de redefinir senha (ou use o fluxo de
  convite/reset do Supabase). A coluna existe só como referência.

## Arquivos e downloads

O pacote é entregue dentro do sistema por DOIS downloads, ambos na página
**Backup Estrutural** (só Admin; anônimo recebe 401 e RH/Gestão recebe 403):

- **"Baixar backup estrutural (SQL)"** — entrega o `schema.sql` completo
  (estrutura em uma transação), servido por `/backend/v1/backup-schema`.
- **"Baixar README (instruções)"** — entrega este `README.md`, servido por
  `/backend/v1/backup-readme`.

Os dois cobrem apenas a **ESTRUTURA** do banco — os DADOS saem pelas
exportações (CSV) e pela API do próprio sistema, como descrito na seção
"Como exportar os DADOS" acima.
