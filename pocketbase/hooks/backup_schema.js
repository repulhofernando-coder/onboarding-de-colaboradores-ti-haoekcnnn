/**
 * Hook: download do backup estrutural (SQL) — apenas Admin.
 *
 * GET /backend/v1/backup-schema
 *
 * Serve o conteúdo do backup estrutural SQL (o mesmo documento versionado em
 * docs/backup-estrutural/schema.sql no repositório). O SQL está EMBUTIDO na
 * constante BACKUP_SCHEMA_SQL abaixo — o deploy do backend não leva a pasta
 * docs/, então ler o arquivo do disco em runtime sempre devolvia 404. Embutir
 * garante que o download funcione de verdade e entrega exatamente o documento
 * aprovado (tabelas, enums, índices, gatilhos e RLS comentadas).
 *
 * ATENÇÃO: ao regenerar docs/backup-estrutural/schema.sql (nova migração
 * estrutural), atualize também a constante BACKUP_SCHEMA_SQL deste arquivo.
 *
 * Acesso: SOMENTE Admin (papel "admin"). Anônimo 401, RH/Gestão 403.
 */

const BACKUP_SCHEMA_SQL = `-- ============================================================================
-- BACKUP ESTRUTURAL — Gestão de Colaboradores TI (Mundo Open)
-- ============================================================================
-- Data de geração : 2026-11-06
-- Versão do sistema : 0.0.84 (package.json)
-- Origem : estrutura real do backend Skip Cloud (PocketBase), espelhada em
--          src/lib/pocketbase/schema.json (gerado do esquema ao vivo) e nas
--          migrações aplicadas em pocketbase/migrations/ (0001 a 0057).
-- Dialeto : PostgreSQL 15+ (compatível com Supabase)
--
-- O QUE ESTE SCRIPT FAZ
--   Recria, num banco PostgreSQL/Supabase vazio, TODA a estrutura do sistema:
--   extensões, enums, tabelas (com PK/FK/defaults/checks), índices, gatilhos
--   de updated_at e as políticas de RLS equivalentes às regras de API do
--   PocketBase (Admin / RH / Gestão, autenticado e acesso público por token).
--
-- O QUE ESTE SCRIPT NÃO FAZ
--   NÃO importa DADOS (registros) nem ARQUIVOS (uploads). É um backup
--   ESTRUTURAL/documental. Veja o README.md ao lado para como exportar dados.
--
-- COMO USAR
--   1. Crie um projeto Supabase (ou banco PostgreSQL vazio).
--   2. Rode este script UMA vez, por inteiro, no SQL Editor / psql.
--      Ele é idempotente nas partes "create if not exists" das bases
--      (extensões/funções), mas as tabelas são criadas sem "if not exists"
--      para não esconder divergências — rode em banco vazio.
--   3. As políticas RLS assumem que o papel do usuário viaja no JWT em
--      app_metadata.role ('admin' | 'rh' | 'gestao') e o setor em
--      app_metadata.setor, replicando o campo role/setor da coleção users
--      do PocketBase. Veja as funções auxiliares app_role()/app_setor().
--   4. No PocketBase as regras "vazias" significam acesso PÚBLICO (sem
--      login) — usado nos tokens de prova, feedback, documento e ficha do
--      colaborador. Aqui viram políticas SELECT/INSERT liberadas para
--      anon+authenticated; as colunas de token continuam como chave de
--      acesso do aplicativo.
--   5. Cabeçalho de campos: nas coleções do PocketBase, campos de relação
--      (relation) e json são guardados como colunas text/jsonb aqui.
--      Campos select com muitas opções foram mapeados para enums quando
--      o conjunto de valores é fixo no código (ver enums na seção 0.1).
--   6. CICLO DE FKs: candidatos <-> teste_tentativas se referenciam
--      mutuamente (candidato guarda a última tentativa; a tentativa guarda
--      o candidato na prova de contratação). A FK candidatos.tentativa_id
--      é criada via ALTER TABLE após teste_tentativas (seção 14).
--   7. "setor" em várias tabelas é TEXTO (espelho fiel do PocketBase, que
--      guarda o setor como texto livre/junção), enquanto *_ref é a relação
--      estruturada quando existe.
-- ============================================================================
-- ÍNDICE DAS COLEÇÕES ESPELHADAS (22 tabelas)
--   users · setores · materiais · fases_modelo · modelo_tarefas ·
--   itens_integracao_modelo · onboardings · tarefas_onboarding ·
--   confirmacoes_colaborador · avaliacoes · logs_auditoria · questionarios ·
--   teste_questoes · candidatos · teste_tentativas · avaliacoes_colaborador ·
--   certificados · cursos · colaborador_cursos · colaborador_documentos ·
--   colaborador_anotacoes · ferias_concessoes
--
-- Nota sobre IDs: o PocketBase usa ids de 15 caracteres. Mantivemos
--   id text primary key com default de 15 caracteres gerados de um UUID,
--   para preservar compatibilidade caso você importe dados exportados.
--   Se preferir uuid nativo no Supabase, troque o tipo antes da importação.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 0. EXTENSÕES E AUXILIARES
-- ----------------------------------------------------------------------------

create extension if not exists pgcrypto;   -- gen_random_uuid()

-- Comentário geral do esquema
comment on schema public is 'Estrutura do sistema Gestão de Colaboradores TI (espelho PocketBase -> PostgreSQL/Supabase)';

-- Papel do usuário logado, vindo do JWT (app_metadata.role).
-- Espelha o campo select "role" da coleção users do PocketBase.
-- Em Supabase: guarde o papel em auth.users -> raw_user_meta_data->>'role'
-- (ou app_metadata); a função abaixo lê o claim do JWT já decodificado.
create or replace function public.app_role() returns text
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    nullif(current_setting('request.jwt.claim.role', true), ''),
    ''
  );
$$;

-- Setor do usuário logado, vindo do JWT (app_metadata.setor).
-- Espelha o campo texto "setor" da coleção users (visibilidade do papel Gestão).
create or replace function public.app_setor() returns text
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'setor',
    nullif(current_setting('request.jwt.claim.setor', true), ''),
    ''
  );
$$;

-- Id do usuário logado (auth.uid() convertido para texto, para casar com os ids text).
create or replace function public.app_uid() returns text
language sql stable as $$
  select coalesce(auth.uid()::text, '');
$$;

-- true se o usuário está autenticado (equivalente a @request.auth.id != '')
create or replace function public.autenticado() returns boolean
language sql stable as $$
  select coalesce(auth.uid()::text, '') <> '';
$$;

-- true se Admin ou RH (padrão recorrente nas regras do sistema)
create or replace function public.e_admin_ou_rh() returns boolean
language sql stable as $$
  select public.app_role() in ('admin', 'rh');
$$;

-- true se o setor informado "coincide" com o setor do usuário Gestão.
-- Espelha o operador ~ (contains) do PocketBase usado nas regras
-- (@request.auth.setor != '' && campo ~ @request.auth.setor).
create or replace function public.setor_coincide(valor text) returns boolean
language sql stable as $$
  select public.app_setor() <> ''
    and valor is not null
    and valor ilike '%' || public.app_setor() || '%';
$$;

-- true se o usuário pode editar questionários: Admin/RH sempre; Gestão só
-- com a chave "pode_editar_questionarios" ligada no próprio cadastro
-- (migração 0050, enforcement também via RLS).
create or replace function public.pode_editar_questionarios() returns boolean
language sql stable security definer set search_path = public as $$
  select public.e_admin_ou_rh()
    or (
      public.app_role() = 'gestao'
      and exists (
        select 1 from public.users u
        where u.id = public.app_uid()
          and u.pode_editar_questionarios is true
      )
    );
$$;

-- Atualiza updated_at em todo UPDATE (espelha o autodate "onUpdate" do PocketBase)
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 0.1 ENUMS (espelham os campos "select" do PocketBase)
-- ----------------------------------------------------------------------------

create type public.user_role as enum ('admin', 'rh', 'gestao');
comment on type public.user_role is 'Papéis do sistema: Admin (acesso total), RH (cria usuários/onboardings, Etapa 1) e Gestão (acompanha, controla a partir da Etapa 2)';

create type public.tipo_conteudo as enum ('video', 'manual');
comment on type public.tipo_conteudo is 'Tipo de material/tarefa: vídeo ou manual';

create type public.status_onboarding as enum (
  'novo', 'em_andamento', 'avaliacao_pendente', 'concluido', 'nao_apto', 'em_acompanhamento'
);
comment on type public.status_onboarding is 'Status do onboarding; nao_apto = reprovado na avaliação (teto de 2 reavaliações), em_acompanhamento = não apto ainda em acompanhamento';

create type public.status_teste_conhecimento as enum (
  'bloqueado', 'liberado', 'aprovado', 'reprovado', 'reteste_liberado'
);
comment on type public.status_teste_conhecimento is 'Ciclo da prova de conhecimento do colaborador (Etapa 3), com reteste liberado pelo gestor/RH';

create type public.decisao_avaliacao as enum ('apto', 'nao_apto');
comment on type public.decisao_avaliacao is 'Decisão da avaliação da Etapa 2 (gestor/admin)';

create type public.tipo_questao as enum ('objetiva', 'dissertativa');
comment on type public.tipo_questao is 'Dissertativas ficam fora do sorteio e não pesam na nota automática (critério do gestor)';

create type public.status_candidato as enum (
  'pre_selecionado', 'prova_enviada', 'prova_concluida', 'aprovado_aguardando_rh',
  'aprovado', 'reprovado', 'desistiu', 'convertido'
);
comment on type public.status_candidato is 'Fluxo de pré-seleção; convertido = candidato virou colaborador (onboarding)';

create type public.status_avaliacao_colaborador as enum ('pendente', 'concluida', 'cancelada');
comment on type public.status_avaliacao_colaborador is 'Status da avaliação aplicada ao colaborador via token público';

create type public.status_curso_colaborador as enum ('pendente', 'em_andamento', 'concluido');
comment on type public.status_curso_colaborador is 'Status do curso atribuído ao colaborador na grade';

create type public.status_documento_colaborador as enum ('pendente', 'confirmado');
comment on type public.status_documento_colaborador is 'Confirmação de documento complementar pelo colaborador via link público';

create type public.tipo_anotacao as enum ('feedback_1_1', 'avaliacao', 'observacao_geral');
comment on type public.tipo_anotacao is 'Tipos de anotação no perfil do colaborador';

create type public.nivel_curso as enum ('essencial', 'recomendado', 'complementar');
comment on type public.nivel_curso is 'Nível do curso na grade de cursos do setor';

create type public.tipo_ferias as enum ('integral', 'fracionada');
comment on type public.tipo_ferias is 'Tipo de concessão de férias';

-- ----------------------------------------------------------------------------
-- 0.2 TABELA DE USUÁRIOS (coleção "users" — auth do PocketBase)
-- ----------------------------------------------------------------------------

-- Coleção de autenticação. Além dos campos de negócio abaixo, o PocketBase
-- mantém campos de sistema (email, emailVisibility, verified, password,
-- tokenKey). No Supabase, a autenticação é do próprio Supabase Auth
-- (auth.users); esta tabela guarda o perfil e o papel. O id continua text
-- para preservar os ids de 15 caracteres do PocketBase na importação.
create table public.users (
  id                        text primary key default substring(gen_random_uuid()::text from 1 for 15),
  email                     text not null unique check (email <> ''),
  email_visivel             boolean not null default false,
  verificado                boolean not null default false,
  senha_hash                text,            -- NÃO usar em Supabase (auth fica no Supabase Auth); guardado só para referência da importação
  token_key                 text unique,     -- espelho do tokenKey do PocketBase (refresh tokens)
  name                      text,
  avatar                    text,            -- arquivo no storage (PocketBase: {collectionId}/{recordId}/arquivo)
  ativo                     boolean,         -- usuário ativo/inativado
  role                      public.user_role,
  pode_editar_questionarios boolean default false,  -- chave por usuário (só papel Gestão); Admin/RH sempre podem
  setor                     text,            -- setor do usuário (base da visibilidade do papel Gestão)
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
comment on table public.users is 'Usuários do sistema (Admin/RH/Gestão). Perfil + papel; autenticação de fato fica no Supabase Auth';
comment on column public.users.role is 'Papel: admin (acesso total), rh (cria usuários/onboardings, conduz Etapa 1), gestao (acompanha; controla a partir da Etapa 2)';
comment on column public.users.setor is 'Setor do usuário; usado para restringir o que o papel Gestão vê';

create index idx_users_role on public.users (role);
create index idx_users_setor on public.users (setor);

create trigger trg_users_updated before update on public.users
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 1. SETORES (coleção "setores")
-- ----------------------------------------------------------------------------
-- Cadastro de setores da empresa. Regra do PocketBase: leitura pública
-- (list/view ""), escrita só autenticado.

create table public.setores (
  id          text primary key default substring(gen_random_uuid()::text from 1 for 15),
  nome        text not null,
  chave       text,                 -- chave normalizada usada nas comparações de setor
  descricao   text,
  cor         text,                 -- cor de exibição (hex) na interface
  ativo       boolean default true,
  ordem       numeric,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.setores is 'Setores/áreas da empresa; base da visibilidade por setor do papel Gestão';

create unique index idx_setores_nome on public.setores (nome);
create index idx_setores_chave on public.setores (chave);
create index idx_setores_ativo_ordem on public.setores (ativo, ordem);

create trigger trg_setores_updated before update on public.setores
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 2. MATERIAIS / BIBLIOTECA (coleção "materiais")
-- ----------------------------------------------------------------------------
-- Materiais de treinamento (vídeos e manuais) da Biblioteca. Leitura pública
-- (o colaborador acessa materiais pelo link/token sem login), escrita só
-- autenticado.

create table public.materiais (
  id            text primary key default substring(gen_random_uuid()::text from 1 for 15),
  titulo        text not null,
  tipo          public.tipo_conteudo not null,
  descricao     text,
  arquivo       text,             -- arquivo no storage (PocketBase: {collectionId}/{recordId}/arquivo)
  criado_por    text references public.users(id) on delete set null,
  setor_ref     text references public.setores(id) on delete set null,  -- setor dono do material
  setor_origem  text,             -- texto legível do setor na época do cadastro
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on table public.materiais is 'Biblioteca de materiais (vídeos/manuais) usados nas tarefas de onboarding e documentos complementares';

create index idx_materiais_tipo on public.materiais (tipo);
create index idx_materiais_titulo on public.materiais (titulo);
create index idx_materiais_setor_ref on public.materiais (setor_ref);

create trigger trg_materiais_updated before update on public.materiais
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 3. FASES DO MODELO (coleção "fases_modelo")
-- ----------------------------------------------------------------------------
-- Fases da Etapa 2 do onboarding (Config./Acessos, Mapeamento, Shadowing,
-- Invertido, Solo N1, Consolidação). Leitura pública, escrita autenticada.

create table public.fases_modelo (
  id             text primary key default substring(gen_random_uuid()::text from 1 for 15),
  titulo         text not null,
  descricao      text,
  ordem          numeric,
  setor_ref      text references public.setores(id) on delete set null,
  etapa          numeric,
  dias_previstos numeric,          -- dias previstos da fase (soma total = 15 dias de Etapa 2)
  setor          text,              -- texto legível do setor
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
comment on table public.fases_modelo is 'Fases da Etapa 2 do modelo de onboarding, com cronograma em dias';

create index idx_fases_modelo_setor_ref on public.fases_modelo (setor_ref);
create index idx_fases_modelo_ordem on public.fases_modelo (ordem);

create trigger trg_fases_modelo_updated before update on public.fases_modelo
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 4. MODELOS DE TAREFAS (coleção "modelo_tarefas")
-- ----------------------------------------------------------------------------
-- Tarefas-modelo por setor/fase, reaproveitadas ao criar onboardings.
-- Tudo autenticado (list/view/create/update/delete "@request.auth.id != ''").

create table public.modelo_tarefas (
  id            text primary key default substring(gen_random_uuid()::text from 1 for 15),
  titulo        text not null,
  tipo          public.tipo_conteudo not null,
  conteudo_url  text,             -- arquivo no storage (upload direto no modelo)
  conteudo_link text,             -- link externo alternativo
  obrigatorio   boolean default false,
  ordem         numeric,
  etapa         numeric,          -- etapa do onboarding a que pertence (1..3)
  descricao     text,
  material      text references public.materiais(id) on delete set null,
  setor_ref     text references public.setores(id) on delete set null,
  fase          text references public.fases_modelo(id) on delete set null,
  setor         text,             -- texto legível do setor
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on table public.modelo_tarefas is 'Tarefas-modelo por setor/fase, usadas para montar o cronograma de cada onboarding';

create index idx_modelo_tarefas_setor on public.modelo_tarefas (setor);
create index idx_modelo_tarefas_setor_ref on public.modelo_tarefas (setor_ref);
create index idx_modelo_tarefas_fase on public.modelo_tarefas (fase);

create trigger trg_modelo_tarefas_updated before update on public.modelo_tarefas
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 5. ITENS DO CHECKLIST DE INTEGRAÇÃO (coleção "itens_integracao_modelo")
-- ----------------------------------------------------------------------------
-- Itens-padrão do Checklist de Integração da Etapa 1. Leitura autenticada;
-- criar/editar/excluir é Admin/RH.

create table public.itens_integracao_modelo (
  id         text primary key default substring(gen_random_uuid()::text from 1 for 15),
  titulo     text not null,
  ordem      numeric,
  ativo      boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.itens_integracao_modelo is 'Itens-padrão do Checklist de Integração da Etapa 1';

create index idx_itens_integracao_ordem on public.itens_integracao_modelo (ordem);

create trigger trg_itens_integracao_updated before update on public.itens_integracao_modelo
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 6. ONBOARDINGS / COLABORADORES (coleção "onboardings")
-- ----------------------------------------------------------------------------
-- Tabela central: cada registro é um colaborador (e seu processo). A ficha
-- única do colaborador (contratação, onboarding(s), desligamento, avaliações)
-- é construída sobre ela. list/view são PÚBLICOS no PocketBase porque a ficha
-- do colaborador e páginas de token acessam sem login; escrita autenticada.

create table public.onboardings (
  id                          text primary key default substring(gen_random_uuid()::text from 1 for 15),
  colaborador_nome            text not null,
  colaborador_email           text not null,
  cargo                       text,
  gestor_id                   text not null references public.users(id) on delete restrict,
  data_inicio                 date not null,
  data_fim                    date not null,
  status                      public.status_onboarding not null,
  etapa_atual                 numeric,
  etapa1_concluida            boolean default false,
  data_conclusao_etapa1       date,
  etapa1_concluida_por        text references public.users(id) on delete set null,
  etapa2_concluida            boolean default false,
  data_conclusao_etapa2       date,
  etapa2_concluida_por        text references public.users(id) on delete set null,
  etapa3_concluida            boolean default false,
  data_conclusao_etapa3       date,
  setor_ref                   text references public.setores(id) on delete set null,
  email_etapa1_enviado        boolean default false,
  email_etapa2_enviado        boolean default false,
  email_avaliacao_enviado     boolean default false,
  token_acesso_colaborador    text,          -- token do link público da ficha do colaborador
  fases_concluidas            jsonb,         -- json: fases da Etapa 2 já concluídas
  fase_atual_id               text,          -- id da fase em andamento (referência lógica a fases_modelo)
  reavaliacoes_count          numeric default 0,  -- teto de 2 reavaliações após não apto
  prazo_suplementar_dias      numeric,       -- dias extras concedidos na reavaliação
  cronograma_fases            jsonb,         -- json: cronograma calculado das fases
  clientes_mapeamento         jsonb,         -- json: clientes da fase de Mapeamento
  tecnico_responsavel_nome    text,
  tecnico_responsavel_email   text,
  checklist_integracao        jsonb,         -- json: itens do Checklist de Integração (Etapa 1)
  fases_sinalizadas           jsonb,         -- json: sinalizações de fim de fase
  teste_conhecimento_status   public.status_teste_conhecimento,
  teste_ultima_nota           numeric,
  teste_ultimo_percentual     numeric,
  teste_tentativas_count      numeric default 0,  -- teto de 2 tentativas na prova
  questionarios_vinculados    jsonb,
  questionario_id             text references public.questionarios(id) on delete set null,
  questoes_sorteadas          jsonb,         -- json: questões sorteadas para a prova deste colaborador
  data_admissao               date,          -- admissão (base do ciclo de férias)
  ferias_vencimento           date,          -- vencimento do período aquisitivo de férias
  sem_onboarding              boolean default false,  -- cadastro direto sem processo de onboarding
  desligado                   boolean default false,
  desligado_em                date,
  desligamento_motivo         text,
  desligamento_obs            text,
  desligado_por               text references public.users(id) on delete set null,
  setor                       text,          -- texto legível do setor
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);
comment on table public.onboardings is 'Colaboradores e seus processos de onboarding (ficha única da pessoa)';
comment on column public.onboardings.token_acesso_colaborador is 'Token do link público /colaborador/:token — confirmação de materiais sem login';
comment on column public.onboardings.reavaliacoes_count is 'Quantas reavaliações já ocorreram (máx. 2 quando não apto)';

create index idx_onboardings_setor on public.onboardings (setor);
create index idx_onboardings_status on public.onboardings (status);
create index idx_onboardings_gestor on public.onboardings (gestor_id);
create index idx_onboardings_data_fim on public.onboardings (data_fim);
create index idx_onboardings_setor_ref on public.onboardings (setor_ref);
create index idx_onboardings_token_acesso on public.onboardings (token_acesso_colaborador);
create index idx_onboardings_data_admissao on public.onboardings (data_admissao);
create index idx_onboardings_ferias_venc on public.onboardings (ferias_vencimento);

create trigger trg_onboardings_updated before update on public.onboardings
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 7. TAREFAS DO ONBOARDING (coleção "tarefas_onboarding")
-- ----------------------------------------------------------------------------
-- Instâncias de tarefas de cada onboarding (Etapa 1 materiais/checklist,
-- Etapa 2 fases). list/view públicos (colaborador confirma via token).

create table public.tarefas_onboarding (
  id                     text primary key default substring(gen_random_uuid()::text from 1 for 15),
  onboarding_id          text not null references public.onboardings(id) on delete cascade,
  titulo                 text not null,
  tipo                   public.tipo_conteudo not null,
  conteudo_url           text,          -- arquivo no storage (upload direto)
  conteudo_link          text,
  concluida              boolean default false,
  concluida_em           date,
  criado_automaticamente boolean default false,  -- gerada a partir do modelo
  etapa                  numeric,
  descricao              text,
  ordem                  numeric,
  material               text references public.materiais(id) on delete set null,
  fase                   text references public.fases_modelo(id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
comment on table public.tarefas_onboarding is 'Tarefas concretas de cada onboarding (vídeo/manual a assistir, fase a cumprir)';

create index idx_tarefas_onboarding_id on public.tarefas_onboarding (onboarding_id);
create index idx_tarefas_onboarding_fase on public.tarefas_onboarding (fase);

create trigger trg_tarefas_onboarding_updated before update on public.tarefas_onboarding
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 8. CONFIRMAÇÕES DO COLABORADOR (coleção "confirmacoes_colaborador")
-- ----------------------------------------------------------------------------
-- Registro de "confirmo que assisti/li" feito pelo COLABORADOR no link
-- público, com data/hora e IP (decisão de produto: confirmação sem login).
-- list/view PÚBLICOS (a página do token precisa ver o estado) e create
-- PÚBLICO (a confirmação vem do link sem login); update/delete autenticado.

create table public.confirmacoes_colaborador (
  id            text primary key default substring(gen_random_uuid()::text from 1 for 15),
  onboarding    text not null references public.onboardings(id) on delete cascade,
  tarefa        text not null references public.tarefas_onboarding(id) on delete cascade,
  confirmado_em date,
  ip            text,
  observacao    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on table public.confirmacoes_colaborador is 'Confirmações de leitura/visualização feitas pelo colaborador via link público (com data/hora e IP)';

create unique index idx_conf_onb_tarefa on public.confirmacoes_colaborador (onboarding, tarefa);
create index idx_conf_onboarding on public.confirmacoes_colaborador (onboarding);
create index idx_conf_tarefa on public.confirmacoes_colaborador (tarefa);

create trigger trg_confirmacoes_updated before update on public.confirmacoes_colaborador
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 9. AVALIAÇÕES (coleção "avaliacoes")
-- ----------------------------------------------------------------------------
-- Avaliações da Etapa 2 (gestor/admin): apto/não apto, ciclo, prazo
-- suplementar e feedback lido pelo colaborador via token público.

create table public.avaliacoes (
  id                      text primary key default substring(gen_random_uuid()::text from 1 for 15),
  onboarding_id           text not null references public.onboardings(id) on delete cascade,
  avaliador_id            text not null references public.users(id) on delete restrict,
  decisao                 public.decisao_avaliacao not null,
  observacoes             text,
  ciclo                   numeric,             -- nº do ciclo de avaliação (1, 2, ...)
  fase_retorno_id         text,                -- fase para a qual o colaborador voltou (não apto)
  prazo_suplementar_dias  numeric,
  definitivo              boolean default false,  -- reavaliação definitiva (esgota as 2 reavaliações)
  feedback_colaborador    text,                -- texto de feedback exibido ao colaborador
  feedback_token          text,                -- token do link público de feedback
  feedback_lido_em        date,
  feedback_lido_ip        text,
  feedback_acessos_count  numeric default 0,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
comment on table public.avaliacoes is 'Avaliações da Etapa 2 com decisão apto/não apto e feedback via token público';
comment on column public.avaliacoes.feedback_token is 'Token do link público /feedback-avaliacao/:token';

create index idx_avaliacoes_avaliador_id on public.avaliacoes (avaliador_id);
create index idx_avaliacoes_feedback_token on public.avaliacoes (feedback_token);

create trigger trg_avaliacoes_updated before update on public.avaliacoes
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 10. LOGS DE AUDITORIA (coleção "logs_auditoria")
-- ----------------------------------------------------------------------------
-- Trilha de auditoria do sistema (conclusões de fase fora do prazo, exclusões,
-- concessão/revogação de permissão etc.). Retenção de 6 meses (limpeza).
-- create PÚBLICO no PocketBase porque hooks e páginas de token gravam logs;
-- update/delete só Admin.

create table public.logs_auditoria (
  id               text primary key default substring(gen_random_uuid()::text from 1 for 15),
  onboarding_id    text references public.onboardings(id) on delete set null,
  colaborador_nome text,
  usuario_id       text references public.users(id) on delete set null,
  usuario_nome     text,
  usuario_role     text,
  gestor_nome      text,
  acao             text not null,
  detalhes         text,
  fora_prazo       boolean default false,   -- conclusão registrada fora do prazo
  destaque_prazo   text,                    -- texto de destaque do atraso
  metadata         jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
comment on table public.logs_auditoria is 'Trilha de auditoria: ações sensíveis com autor, data e destaque para fora do prazo (retenção 6 meses)';

create index idx_logs_onboarding on public.logs_auditoria (onboarding_id);
create index idx_logs_usuario on public.logs_auditoria (usuario_id);
create index idx_logs_created on public.logs_auditoria (created_at);
create index idx_logs_fora_prazo on public.logs_auditoria (fora_prazo);

create trigger trg_logs_updated before update on public.logs_auditoria
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 11. QUESTIONÁRIOS (coleção "questionarios")
-- ----------------------------------------------------------------------------
-- Questionários das 3 categorias de prova (Etapa 3, avaliação do colaborador,
-- prova do pré-candidato). Régua padrão 95% (1 erro/20), quantidade por prova
-- configurável (padrão 20). Visibilidade: Admin/RH; Gestão vê os do seu setor
-- (ou globais, setor vazio); Gestão edita só com pode_editar_questionarios.

create table public.questionarios (
  id                   text primary key default substring(gen_random_uuid()::text from 1 for 15),
  nome                 text not null,
  setor                text,               -- vazio = questionário global (todos os setores)
  tipo_de_uso          text not null,      -- 'onboarding_etapa3' | 'avaliacao_colaborador' | 'contratacao'
  percentual_aprovacao numeric default 95, -- régua de aprovação (padrão 95%)
  ativo                boolean default true,
  descricao            text,
  questoes_por_prova   numeric default 20, -- quantidade sorteada por prova (padrão 20)
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
comment on table public.questionarios is 'Questionários das provas; sorteio de questões objetivas, dissertativas fora do sorteio';
comment on column public.questionarios.tipo_de_uso is 'Categoria de prova: onboarding (Etapa 3), avaliação do colaborador ou contratação (pré-candidato)';

create index idx_questionarios_setor on public.questionarios (setor);
create index idx_questionarios_tipo on public.questionarios (tipo_de_uso);
create index idx_questionarios_ativo on public.questionarios (ativo);

create trigger trg_questionarios_updated before update on public.questionarios
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 12. QUESTÕES (coleção "teste_questoes")
-- ----------------------------------------------------------------------------
-- Banco de questões vinculado a um questionário; objetivas entram no sorteio,
-- dissertativas (mín. 2 na prova de contratação) são sempre apresentadas.

create table public.teste_questoes (
  id                  text primary key default substring(gen_random_uuid()::text from 1 for 15),
  enunciado           text not null,
  alternativas        jsonb,               -- json: array de alternativas da objetiva
  correta_index       numeric,             -- índice da alternativa correta (objetivas)
  gabarito_comentario text,                -- comentário do gabarito (visível a Admin/Gestor/RH)
  ordem               numeric not null,
  ativo               boolean default true,
  tema                text,
  questionario_id     text references public.questionarios(id) on delete cascade,
  tipo                public.tipo_questao default 'objetiva',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
comment on table public.teste_questoes is 'Banco de questões por questionário; objetivas sorteadas, dissertativas sempre presentes';

create index idx_teste_questoes_ordem on public.teste_questoes (ordem);
create index idx_teste_questoes_ativo on public.teste_questoes (ativo);

create trigger trg_teste_questoes_updated before update on public.teste_questoes
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 13. CANDIDATOS DE PRÉ-SELEÇÃO (coleção "candidatos")
-- ----------------------------------------------------------------------------
-- Fluxo de contratação: RH cadastra candidato, envia prova por token público,
-- acompanha nota e formaliza a conversão em colaborador (onboarding).
-- OBS.: candidatos e teste_tentativas se referenciam mutuamente
-- (candidatos.tentativa_id guarda a última tentativa; teste_tentativas
-- aponta para o candidato na prova de contratação). Para resolver o ciclo,
-- a FK candidatos.tentativa_id -> teste_tentativas é adicionada via
-- ALTER TABLE APÓS a criação de teste_tentativas (seção 14).

create table public.candidatos (
  id                    text primary key default substring(gen_random_uuid()::text from 1 for 15),
  nome                  text not null,
  email                 text not null,
  cargo_pretendido      text,
  setor                 text,                 -- setor pretendido (visibilidade do Gestão)
  questionario_id       text references public.questionarios(id) on delete set null,
  status                public.status_candidato not null,
  token_publico         text,                 -- token do link público da prova (/candidato/prova/:token)
  nota_acertos          numeric,
  total_questoes        numeric,
  percentual_obtido     numeric,
  aprovado_teste        boolean,
  data_envio_prova      date,
  data_conclusao_prova  date,
  data_inicio_prova     text,                 -- texto: início do cronômetro de 60 min (só prova de contratação)
  decidido_por          text references public.users(id) on delete set null,
  data_decisao          date,
  motivo_reprovacao     text,
  motivo_desistencia    text,
  criado_por            text references public.users(id) on delete set null,
  rh_responsavel        text references public.users(id) on delete set null,
  data_formalizacao_rh  date,
  colaborador_id        text references public.onboardings(id) on delete set null,  -- preenchido quando convertido
  tentativa_id          text,                 -- última tentativa (FK criada na seção 14)
  questoes_sorteadas    jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
comment on table public.candidatos is 'Candidatos de pré-seleção (contratação): prova via token público, aprovação do RH e conversão em colaborador';
comment on column public.candidatos.colaborador_id is 'Onboarding gerado quando o candidato é convertido em colaborador';

create unique index idx_candidatos_token on public.candidatos (token_publico)
  where token_publico is not null and token_publico <> '';
create index idx_candidatos_status on public.candidatos (status);
create index idx_candidatos_setor on public.candidatos (setor);
create index idx_candidatos_email on public.candidatos (email);

create trigger trg_candidatos_updated before update on public.candidatos
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 14. TENTATIVAS DE PROVA (coleção "teste_tentativas")
-- ----------------------------------------------------------------------------
-- Cada submissão de prova (colaborador Etapa 3 OU pré-candidato), com
-- respostas completas em JSON. No PocketBase create/update não têm regra de
-- API (null): gravam apenas via hooks do servidor; delete só Admin.

create table public.teste_tentativas (
  id                    text primary key default substring(gen_random_uuid()::text from 1 for 15),
  onboarding_id         text references public.onboardings(id) on delete cascade,  -- null quando é prova de pré-candidato
  candidato_id          text references public.candidatos(id) on delete cascade,   -- prova do pré-candidato (contratação)
  -- FK cíclica: candidatos.tentativa_id -> teste_tentativas é criada abaixo
  questionario_id       text references public.questionarios(id) on delete set null,
  tentativa_numero      numeric not null,          -- 1 = primeira, 2 = reteste
  respostas             jsonb not null,            -- json: respostas (objetivas e dissertativas)
  total_questoes        numeric not null,
  acertos               numeric not null,
  percentual            numeric not null,
  aprovado              boolean,                   -- régua de 95% do questionário
  data_submissao        date not null,
  ip                    text,
  reteste_liberado      boolean default false,
  reteste_liberado_em   date,
  reteste_liberado_por  text,                      -- texto (nome de quem liberou)
  questoes_sorteadas    jsonb,                     -- json: questões apresentadas nesta tentativa
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
comment on table public.teste_tentativas is 'Tentativas de prova (colaborador e pré-candidato); respostas completas em JSON, inclusive dissertativas';
comment on column public.teste_tentativas.respostas is 'Respostas da prova em JSON — não existe coleção separada para respostas dissertativas';

create index idx_teste_tentativas_onboarding on public.teste_tentativas (onboarding_id);
create index idx_teste_tentativas_submissao on public.teste_tentativas (data_submissao desc);

create trigger trg_teste_tentativas_updated before update on public.teste_tentativas
  for each row execute function public.set_updated_at();

-- FK cíclica (fechamento): candidatos.tentativa_id guarda a última tentativa
-- do candidato; teste_tentativas.candidato_id (acima) aponta para o candidato.
alter table public.candidatos
  add constraint fk_candidatos_tentativa
  foreign key (tentativa_id) references public.teste_tentativas(id)
  on delete set null;

create index idx_candidatos_tentativa on public.candidatos (tentativa_id);

-- ----------------------------------------------------------------------------
-- 15. AVALIAÇÕES APLICADAS AO COLABORADOR (coleção "avaliacoes_colaborador")
-- ----------------------------------------------------------------------------
-- Avaliação formal aplicada pelo RH/Admin a um colaborador, respondida pelo
-- próprio colaborador via token público (sem login).

create table public.avaliacoes_colaborador (
  id                 text primary key default substring(gen_random_uuid()::text from 1 for 15),
  colaborador        text not null references public.onboardings(id) on delete cascade,
  questionario_id    text not null references public.questionarios(id) on delete restrict,
  token              text not null unique,    -- link público /avaliacao/:token
  status             public.status_avaliacao_colaborador not null default 'pendente',
  tipo_avaliacao     text,
  nota               numeric,
  total_questoes     numeric,
  percentual         numeric,
  aprovado           boolean,
  regua_aprovacao    numeric,                 -- régua usada nesta aplicação
  tentativa_id       text references public.teste_tentativas(id) on delete set null,
  aplicada_por       text references public.users(id) on delete set null,
  data_aplicacao     date,
  data_conclusao     date,
  observacoes        text,
  questoes_sorteadas jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
comment on table public.avaliacoes_colaborador is 'Avaliações aplicadas ao colaborador, respondidas via link público por token';

create index idx_avaliacoes_colab_colaborador on public.avaliacoes_colaborador (colaborador);
create index idx_avaliacoes_colab_questionario on public.avaliacoes_colaborador (questionario_id);
create index idx_avaliacoes_colab_status on public.avaliacoes_colaborador (status);

create trigger trg_avaliacoes_colab_updated before update on public.avaliacoes_colaborador
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 16. CERTIFICADOS (coleção "certificados")
-- ----------------------------------------------------------------------------
-- Certificados do colaborador, alimentados por RH/Admin (upload PDF/imagem),
-- com validade opcional. Acesso restrito a RH/Admin + auditoria de acesso.

create table public.certificados (
  id             text primary key default substring(gen_random_uuid()::text from 1 for 15),
  colaborador    text not null references public.onboardings(id) on delete cascade,
  titulo         text not null,
  emissor        text not null,
  data_emissao   date not null,
  data_validade  date,              -- opcional
  arquivo        text,              -- arquivo no storage (PDF/imagem)
  registrado_por text references public.users(id) on delete set null,
  observacoes    text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
comment on table public.certificados is 'Certificados do colaborador (upload RH/Admin), seção do Perfil do Colaborador';

create index idx_certificados_colaborador on public.certificados (colaborador);
create index idx_certificados_data_emissao on public.certificados (data_emissao);
create index idx_certificados_data_validade on public.certificados (data_validade);

create trigger trg_certificados_updated before update on public.certificados
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 17. CURSOS / GRADE (coleção "cursos")
-- ----------------------------------------------------------------------------
-- Grade de cursos por setor (link externo), com nível. Visibilidade:
-- Admin/RH; Gestão vê os do seu setor (comparação por chave OU nome do setor).

create table public.cursos (
  id          text primary key default substring(gen_random_uuid()::text from 1 for 15),
  titulo      text not null,
  descricao   text,
  link        text not null check (link ilike 'http%'),   -- url (espelha o tipo url do PocketBase)
  nivel       public.nivel_curso not null,
  setor       text not null references public.setores(id) on delete restrict,
  ativo       boolean default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.cursos is 'Grade de cursos por setor (links externos), com nível essencial/recomendado/complementar';

create index idx_cursos_setor on public.cursos (setor);
create index idx_cursos_nivel on public.cursos (nivel);
create index idx_cursos_ativo on public.cursos (ativo);

create trigger trg_cursos_updated before update on public.cursos
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 18. CURSOS ATRIBUÍDOS AO COLABORADOR (coleção "colaborador_cursos")
-- ----------------------------------------------------------------------------

create table public.colaborador_cursos (
  id            text primary key default substring(gen_random_uuid()::text from 1 for 15),
  colaborador   text not null references public.onboardings(id) on delete cascade,
  curso         text not null references public.cursos(id) on delete cascade,
  status        public.status_curso_colaborador not null default 'pendente',
  atribuido_em  date,
  concluido_em  date,
  observacao    text,
  atribuido_por text,   -- texto (nome), espelho fiel do PocketBase
  concluido_por text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on table public.colaborador_cursos is 'Cursos da grade atribuídos a cada colaborador, com acompanhamento de conclusão';

create index idx_colab_cursos_colab on public.colaborador_cursos (colaborador);
create index idx_colab_cursos_curso on public.colaborador_cursos (curso);
create index idx_colab_cursos_status on public.colaborador_cursos (status);

create trigger trg_colab_cursos_updated before update on public.colaborador_cursos
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 19. DOCUMENTOS COMPLEMENTARES (coleção "colaborador_documentos")
-- ----------------------------------------------------------------------------
-- Documento complementar atribuído ao colaborador a partir de um material da
-- Biblioteca, confirmado por token público. list/view e update PÚBLICOS
-- (a página do token marca a confirmação); create/delete Admin/RH.

create table public.colaborador_documentos (
  id            text primary key default substring(gen_random_uuid()::text from 1 for 15),
  colaborador   text not null references public.onboardings(id) on delete cascade,
  material      text not null references public.materiais(id) on delete restrict,
  token         text not null unique,   -- link público /documento-complementar/:token
  status        public.status_documento_colaborador not null default 'pendente',
  confirmado_em date,
  confirmado_ip text,
  observacao    text,
  atribuido_por text,
  atribuido_em  date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on table public.colaborador_documentos is 'Documentos complementares atribuídos ao colaborador, confirmados via link público por token';

create index idx_colab_docs_colaborador on public.colaborador_documentos (colaborador);
create index idx_colab_docs_material on public.colaborador_documentos (material);
create index idx_colab_docs_status on public.colaborador_documentos (status);

create trigger trg_colab_docs_updated before update on public.colaborador_documentos
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 20. ANOTAÇÕES DO COLABORADOR (coleção "colaborador_anotacoes")
-- ----------------------------------------------------------------------------
-- Anotações (feedback 1:1, avaliação, observação geral) na ficha do
-- colaborador. Gestão vê/escreve do seu setor; cada autor pode editar/excluir
-- as próprias anotações.

create table public.colaborador_anotacoes (
  id          text primary key default substring(gen_random_uuid()::text from 1 for 15),
  colaborador text not null references public.onboardings(id) on delete cascade,
  tipo        public.tipo_anotacao not null,
  texto       text not null,
  autor       text not null references public.users(id) on delete restrict,
  autor_nome  text,     -- snapshot do nome na época
  autor_role  text,     -- snapshot do papel na época
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.colaborador_anotacoes is 'Anotações na ficha do colaborador (feedback 1:1, avaliação, observação geral) com autor e papel';

create index idx_colab_anot_colaborador on public.colaborador_anotacoes (colaborador);
create index idx_colab_anot_tipo on public.colaborador_anotacoes (tipo);
create index idx_colab_anot_autor on public.colaborador_anotacoes (autor);

create trigger trg_colab_anot_updated before update on public.colaborador_anotacoes
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 21. FÉRIAS (coleção "ferias_concessoes")
-- ----------------------------------------------------------------------------
-- Concessões de férias por colaborador; o ciclo é calculado da data de
-- admissão (onboardings.data_admissao → ferias_vencimento).

create table public.ferias_concessoes (
  id                   text primary key default substring(gen_random_uuid()::text from 1 for 15),
  onboarding           text not null references public.onboardings(id) on delete cascade,
  colaborador_setor    text,           -- snapshot do setor para filtros/visibilidade
  data_inicio          date not null,
  tipo                 public.tipo_ferias not null,
  registrado_por       text references public.users(id) on delete set null,
  registrado_por_nome  text,
  observacao           text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
comment on table public.ferias_concessoes is 'Concessões de férias (integral/fracionada) por colaborador';

create index idx_ferias_conc_onboarding on public.ferias_concessoes (onboarding);
create index idx_ferias_conc_setor on public.ferias_concessoes (colaborador_setor);
create index idx_ferias_conc_data_inicio on public.ferias_concessoes (data_inicio);

create trigger trg_ferias_conc_updated before update on public.ferias_concessoes
  for each row execute function public.set_updated_at();

-- ============================================================================
-- POLÍTICAS DE RLS (espelho das regras de API do PocketBase)
-- ============================================================================
-- Convenções de tradução:
--   "" (regra vazia)                 -> acesso PÚBLICO (anon + authenticated)
--   "@request.auth.id != ''"         -> autenticado
--   "@request.auth.role = 'admin'"   -> app_role() = 'admin'
--   campo ~ @request.auth.setor      -> setor_coincide(campo)   (contains)
--   regra null (nenhuma)             -> SEM política = negado ao cliente
--                                       (só servidor/service role)
--
-- Por padrão o Supabase nega tudo quando RLS está ligado sem política.

alter table public.users enable row level security;
alter table public.setores enable row level security;
alter table public.materiais enable row level security;
alter table public.fases_modelo enable row level security;
alter table public.modelo_tarefas enable row level security;
alter table public.itens_integracao_modelo enable row level security;
alter table public.onboardings enable row level security;
alter table public.tarefas_onboarding enable row level security;
alter table public.confirmacoes_colaborador enable row level security;
alter table public.avaliacoes enable row level security;
alter table public.logs_auditoria enable row level security;
alter table public.questionarios enable row level security;
alter table public.teste_questoes enable row level security;
alter table public.teste_tentativas enable row level security;
alter table public.candidatos enable row level security;
alter table public.avaliacoes_colaborador enable row level security;
alter table public.certificados enable row level security;
alter table public.cursos enable row level security;
alter table public.colaborador_cursos enable row level security;
alter table public.colaborador_documentos enable row level security;
alter table public.colaborador_anotacoes enable row level security;
alter table public.ferias_concessoes enable row level security;

-- --- users -----------------------------------------------------------------
-- list/view/create/update: autenticado; delete: Admin OU o próprio usuário.
create policy users_select on public.users for select to authenticated using (true);
create policy users_insert on public.users for insert to authenticated with check (true);
create policy users_update on public.users for update to authenticated using (true) with check (true);
create policy users_delete on public.users for delete to authenticated
  using (public.app_role() = 'admin' or id = public.app_uid());

-- --- setores ----------------------------------------------------------------
create policy setores_select on public.setores for select to anon, authenticated using (true);
create policy setores_insert on public.setores for insert to authenticated with check (true);
create policy setores_update on public.setores for update to authenticated using (true) with check (true);
create policy setores_delete on public.setores for delete to authenticated using (true);

-- --- materiais --------------------------------------------------------------
create policy materiais_select on public.materiais for select to anon, authenticated using (true);
create policy materiais_insert on public.materiais for insert to authenticated with check (true);
create policy materiais_update on public.materiais for update to authenticated using (true) with check (true);
create policy materiais_delete on public.materiais for delete to authenticated using (true);

-- --- fases_modelo -----------------------------------------------------------
create policy fases_modelo_select on public.fases_modelo for select to anon, authenticated using (true);
create policy fases_modelo_insert on public.fases_modelo for insert to authenticated with check (true);
create policy fases_modelo_update on public.fases_modelo for update to authenticated using (true) with check (true);
create policy fases_modelo_delete on public.fases_modelo for delete to authenticated using (true);

-- --- modelo_tarefas ---------------------------------------------------------
create policy modelo_tarefas_select on public.modelo_tarefas for select to authenticated using (true);
create policy modelo_tarefas_insert on public.modelo_tarefas for insert to authenticated with check (true);
create policy modelo_tarefas_update on public.modelo_tarefas for update to authenticated using (true) with check (true);
create policy modelo_tarefas_delete on public.modelo_tarefas for delete to authenticated using (true);

-- --- itens_integracao_modelo ------------------------------------------------
create policy itens_integracao_select on public.itens_integracao_modelo for select to authenticated using (true);
create policy itens_integracao_write on public.itens_integracao_modelo for insert to authenticated
  with check (public.e_admin_ou_rh());
create policy itens_integracao_update on public.itens_integracao_modelo for update to authenticated
  using (public.e_admin_ou_rh()) with check (public.e_admin_ou_rh());
create policy itens_integracao_delete on public.itens_integracao_modelo for delete to authenticated
  using (public.e_admin_ou_rh());

-- --- onboardings ------------------------------------------------------------
-- Leitura pública (ficha do colaborador via token); escrita autenticada.
create policy onboardings_select on public.onboardings for select to anon, authenticated using (true);
create policy onboardings_insert on public.onboardings for insert to authenticated with check (true);
create policy onboardings_update on public.onboardings for update to authenticated using (true) with check (true);
create policy onboardings_delete on public.onboardings for delete to authenticated using (true);

-- --- tarefas_onboarding -----------------------------------------------------
create policy tarefas_select on public.tarefas_onboarding for select to anon, authenticated using (true);
create policy tarefas_insert on public.tarefas_onboarding for insert to authenticated with check (true);
create policy tarefas_update on public.tarefas_onboarding for update to authenticated using (true) with check (true);
create policy tarefas_delete on public.tarefas_onboarding for delete to authenticated using (true);

-- --- confirmacoes_colaborador ----------------------------------------------
-- Leitura e criação públicas (confirmação pelo link, sem login);
-- alteração/exclusão autenticada.
create policy confirmacoes_select on public.confirmacoes_colaborador for select to anon, authenticated using (true);
create policy confirmacoes_insert on public.confirmacoes_colaborador for insert to anon, authenticated with check (true);
create policy confirmacoes_update on public.confirmacoes_colaborador for update to authenticated using (true) with check (true);
create policy confirmacoes_delete on public.confirmacoes_colaborador for delete to authenticated using (true);

-- --- avaliacoes -------------------------------------------------------------
-- Leitura: Admin/RH ou Gestão do mesmo setor (via onboarding_id.setor).
create policy avaliacoes_select on public.avaliacoes for select to authenticated
  using (
    public.e_admin_ou_rh()
    or (
      public.app_role() = 'gestao'
      and exists (
        select 1 from public.onboardings o
        where o.id = avaliacoes.onboarding_id
          and public.setor_coincide(o.setor)
      )
    )
  );
create policy avaliacoes_insert on public.avaliacoes for insert to authenticated with check (true);
create policy avaliacoes_update on public.avaliacoes for update to authenticated using (true) with check (true);
create policy avaliacoes_delete on public.avaliacoes for delete to authenticated using (true);

-- --- logs_auditoria ---------------------------------------------------------
-- Leitura autenticada; criação pública (gravação de logs por hooks/tokens);
-- alteração/exclusão só Admin.
create policy logs_select on public.logs_auditoria for select to authenticated using (true);
create policy logs_insert on public.logs_auditoria for insert to anon, authenticated with check (true);
create policy logs_update on public.logs_auditoria for update to authenticated
  using (public.app_role() = 'admin') with check (public.app_role() = 'admin');
create policy logs_delete on public.logs_auditoria for delete to authenticated
  using (public.app_role() = 'admin');

-- --- questionarios ----------------------------------------------------------
-- Leitura: Admin/RH, ou Gestão do próprio setor (ou globais, setor vazio).
-- Escrita: Admin/RH, ou Gestão com a chave pode_editar_questionarios.
create policy questionarios_select on public.questionarios for select to authenticated
  using (
    public.e_admin_ou_rh()
    or (
      public.app_role() = 'gestao'
      and public.app_setor() <> ''
      and (setor is null or setor = '' or public.setor_coincide(setor))
    )
  );
create policy questionarios_insert on public.questionarios for insert to authenticated
  with check (public.pode_editar_questionarios()
    and (public.app_role() <> 'gestao' or public.app_setor() = '' or setor is null or setor = '' or public.setor_coincide(setor)));
create policy questionarios_update on public.questionarios for update to authenticated
  using (public.pode_editar_questionarios()
    and (public.app_role() <> 'gestao' or public.app_setor() = '' or setor is null or setor = '' or public.setor_coincide(setor)))
  with check (public.pode_editar_questionarios()
    and (public.app_role() <> 'gestao' or public.app_setor() = '' or setor is null or setor = '' or public.setor_coincide(setor)));
create policy questionarios_delete on public.questionarios for delete to authenticated
  using (public.pode_editar_questionarios()
    and (public.app_role() <> 'gestao' or public.app_setor() = '' or setor is null or setor = '' or public.setor_coincide(setor)));

-- --- teste_questoes ---------------------------------------------------------
create policy teste_questoes_select on public.teste_questoes for select to authenticated using (true);
create policy teste_questoes_insert on public.teste_questoes for insert to authenticated
  with check (
    public.e_admin_ou_rh()
    or (
      public.app_role() = 'gestao'
      and public.pode_editar_questionarios()
      and exists (
        select 1 from public.questionarios q
        where q.id = teste_questoes.questionario_id
          and (q.setor is null or q.setor = '' or public.setor_coincide(q.setor))
      )
    )
  );
create policy teste_questoes_update on public.teste_questoes for update to authenticated
  using (
    public.e_admin_ou_rh()
    or (
      public.app_role() = 'gestao'
      and public.pode_editar_questionarios()
      and exists (
        select 1 from public.questionarios q
        where q.id = teste_questoes.questionario_id
          and (q.setor is null or q.setor = '' or public.setor_coincide(q.setor))
      )
    )
  )
  with check (
    public.e_admin_ou_rh()
    or (
      public.app_role() = 'gestao'
      and public.pode_editar_questionarios()
      and exists (
        select 1 from public.questionarios q
        where q.id = teste_questoes.questionario_id
          and (q.setor is null or q.setor = '' or public.setor_coincide(q.setor))
      )
    )
  );
create policy teste_questoes_delete on public.teste_questoes for delete to authenticated
  using (
    public.e_admin_ou_rh()
    or (
      public.app_role() = 'gestao'
      and public.pode_editar_questionarios()
      and exists (
        select 1 from public.questionarios q
        where q.id = teste_questoes.questionario_id
          and (q.setor is null or q.setor = '' or public.setor_coincide(q.setor))
      )
    )
  );

-- --- teste_tentativas -------------------------------------------------------
-- Gravação SÓ pelo servidor (hooks): sem política de insert/update para
-- clientes. Leitura autenticada; exclusão só Admin.
create policy teste_tentativas_select on public.teste_tentativas for select to authenticated using (true);
create policy teste_tentativas_delete on public.teste_tentativas for delete to authenticated
  using (public.app_role() = 'admin');

-- --- candidatos -------------------------------------------------------------
-- Leitura: Admin/RH ou Gestão do setor; criação Admin/RH; alteração
-- autenticada (hooks/pages do fluxo); exclusão Admin/RH.
create policy candidatos_select on public.candidatos for select to authenticated
  using (
    public.e_admin_ou_rh()
    or (public.app_role() = 'gestao' and public.setor_coincide(setor))
  );
create policy candidatos_insert on public.candidatos for insert to authenticated
  with check (public.e_admin_ou_rh());
create policy candidatos_update on public.candidatos for update to authenticated using (true) with check (true);
create policy candidatos_delete on public.candidatos for delete to authenticated
  using (public.e_admin_ou_rh());

-- --- avaliacoes_colaborador -------------------------------------------------
create policy avaliacoes_colab_select on public.avaliacoes_colaborador for select to authenticated using (true);
create policy avaliacoes_colab_insert on public.avaliacoes_colaborador for insert to authenticated
  with check (public.e_admin_ou_rh());
create policy avaliacoes_colab_update on public.avaliacoes_colaborador for update to authenticated
  using (public.e_admin_ou_rh()) with check (public.e_admin_ou_rh());
create policy avaliacoes_colab_delete on public.avaliacoes_colaborador for delete to authenticated
  using (public.app_role() = 'admin');

-- --- certificados -----------------------------------------------------------
create policy certificados_select on public.certificados for select to authenticated
  using (public.e_admin_ou_rh());
create policy certificados_insert on public.certificados for insert to authenticated
  with check (public.e_admin_ou_rh());
create policy certificados_update on public.certificados for update to authenticated
  using (public.e_admin_ou_rh()) with check (public.e_admin_ou_rh());
create policy certificados_delete on public.certificados for delete to authenticated
  using (public.e_admin_ou_rh());

-- --- cursos -----------------------------------------------------------------
-- Leitura: Admin/RH ou Gestão do setor (comparação por chave OU nome do setor).
create policy cursos_select on public.cursos for select to authenticated
  using (
    public.e_admin_ou_rh()
    or (
      public.app_role() = 'gestao'
      and public.app_setor() <> ''
      and exists (
        select 1 from public.setores s
        where s.id = cursos.setor
          and (s.chave ilike '%' || public.app_setor() || '%'
               or s.nome  ilike '%' || public.app_setor() || '%'
               or s.chave = public.app_setor())
      )
    )
  );
create policy cursos_insert on public.cursos for insert to authenticated with check (public.e_admin_ou_rh());
create policy cursos_update on public.cursos for update to authenticated
  using (public.e_admin_ou_rh()) with check (public.e_admin_ou_rh());
create policy cursos_delete on public.cursos for delete to authenticated
  using (public.e_admin_ou_rh());

-- --- colaborador_cursos -----------------------------------------------------
create policy colab_cursos_select on public.colaborador_cursos for select to authenticated
  using (
    public.e_admin_ou_rh()
    or (
      public.app_role() = 'gestao'
      and exists (
        select 1 from public.onboardings o
        where o.id = colaborador_cursos.colaborador
          and public.setor_coincide(o.setor)
      )
    )
  );
create policy colab_cursos_insert on public.colaborador_cursos for insert to authenticated
  with check (public.e_admin_ou_rh());
create policy colab_cursos_update on public.colaborador_cursos for update to authenticated
  using (public.e_admin_ou_rh()) with check (public.e_admin_ou_rh());
create policy colab_cursos_delete on public.colaborador_cursos for delete to authenticated
  using (public.e_admin_ou_rh());

-- --- colaborador_documentos -------------------------------------------------
-- Leitura e alteração públicas (o token do colaborador confirma o documento);
-- criação/exclusão Admin/RH.
create policy colab_docs_select on public.colaborador_documentos for select to anon, authenticated using (true);
create policy colab_docs_insert on public.colaborador_documentos for insert to authenticated
  with check (public.e_admin_ou_rh());
create policy colab_docs_update on public.colaborador_documentos for update to anon, authenticated using (true) with check (true);
create policy colab_docs_delete on public.colaborador_documentos for delete to authenticated
  using (public.e_admin_ou_rh());

-- --- colaborador_anotacoes --------------------------------------------------
create policy colab_anot_select on public.colaborador_anotacoes for select to authenticated
  using (
    public.e_admin_ou_rh()
    or (
      public.app_role() = 'gestao'
      and exists (
        select 1 from public.onboardings o
        where o.id = colaborador_anotacoes.colaborador
          and public.setor_coincide(o.setor)
      )
    )
  );
create policy colab_anot_insert on public.colaborador_anotacoes for insert to authenticated
  with check (
    public.e_admin_ou_rh()
    or (
      public.app_role() = 'gestao'
      and exists (
        select 1 from public.onboardings o
        where o.id = colaborador_anotacoes.colaborador
          and public.setor_coincide(o.setor)
      )
    )
  );
-- update/delete: Admin/RH, ou o próprio autor da anotação
create policy colab_anot_update on public.colaborador_anotacoes for update to authenticated
  using (public.e_admin_ou_rh() or autor = public.app_uid())
  with check (public.e_admin_ou_rh() or autor = public.app_uid());
create policy colab_anot_delete on public.colaborador_anotacoes for delete to authenticated
  using (public.e_admin_ou_rh() or autor = public.app_uid());

-- --- ferias_concessoes ------------------------------------------------------
create policy ferias_select on public.ferias_concessoes for select to authenticated
  using (
    public.e_admin_ou_rh()
    or (
      public.app_role() = 'gestao'
      and exists (
        select 1 from public.onboardings o
        where o.id = ferias_concessoes.onboarding
          and public.setor_coincide(o.setor)
      )
    )
  );
create policy ferias_insert on public.ferias_concessoes for insert to authenticated
  with check (public.e_admin_ou_rh());
create policy ferias_update on public.ferias_concessoes for update to authenticated
  using (public.e_admin_ou_rh()) with check (public.e_admin_ou_rh());
create policy ferias_delete on public.ferias_concessoes for delete to authenticated
  using (public.e_admin_ou_rh());

-- ============================================================================
-- FIM — estrutura espelhada de 22 coleções do PocketBase
-- (users + 21 coleções de aplicação), com enums, índices, gatilhos e RLS.
-- DADOS NÃO ESTÃO INCLUÍDOS — veja README.md para exportá-los.
-- ============================================================================

commit;
`

// Ponte de escopo: o JSVM executa callbacks de rota em um pool separado, onde
// declarações de nível superior (BACKUP_SCHEMA_SQL) não são visíveis. Publica
// o SQL no store da aplicação, que É acessível de dentro do callback.
// Conteúdo do README do pacote (docs/backup-estrutural/README.md), embutido
// pelo mesmo motivo do SQL: o deploy do backend só leva pocketbase/hooks/ —
// a pasta docs/ nunca chega ao servidor, e ler o arquivo do disco em runtime
// devolvia 404 (regressão corrigida na 0.0.86). Embutir garante que o
// download funcione de verdade e entregue exatamente o documento aprovado.
//
// ATENÇÃO: ao alterar docs/backup-estrutural/README.md, atualize também a
// constante BACKUP_README_MD abaixo (e a rota já serve attachment com
// filename="README.md").

const BACKUP_README_MD = `# Backup Estrutural — SQL (PostgreSQL / Supabase)

**Gerado em:** 2026-11-06 · **Versão do sistema:** 0.0.84

Este pacote é um **backup ESTRUTURAL/documental** do banco do sistema
**Gestão de Colaboradores TI** (Mundo Open). Ele contém o script SQL que
recria, num PostgreSQL/Supabase vazio, toda a estrutura das **22 coleções**
do backend Skip Cloud (PocketBase):

| Grupo | Tabelas |
|---|---|
| Identidade e estrutura | \`users\`, \`setores\` |
| Biblioteca e modelos | \`materiais\`, \`fases_modelo\`, \`modelo_tarefas\`, \`itens_integracao_modelo\` |
| Onboarding / colaborador | \`onboardings\`, \`tarefas_onboarding\`, \`confirmacoes_colaborador\` |
| Avaliações e provas | \`avaliacoes\`, \`questionarios\`, \`teste_questoes\`, \`teste_tentativas\`, \`avaliacoes_colaborador\`, \`candidatos\` |
| Auditoria e acessos | \`logs_auditoria\` |
| Perfil do colaborador | \`certificados\`, \`cursos\`, \`colaborador_cursos\`, \`colaborador_documentos\`, \`colaborador_anotacoes\`, \`ferias_concessoes\` |

O script inclui enums (campos select), PK/FK/defaults/checks, índices,
gatilho de \`updated_at\` e **políticas RLS equivalentes às regras de API do
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
2. Rode \`schema.sql\` **uma única vez e por inteiro** (SQL Editor do Supabase
   ou \`psql -f schema.sql\`). Ele cria tudo em uma transação (\`begin/commit\`).
3. O papel/setor do usuário deve ir no JWT: \`role\` ∈ \`admin | rh | gestao\`
   e \`setor\` (texto). No Supabase, grave em \`raw_user_meta_data\` do usuário
   do Auth — as funções \`app_role()\` / \`app_setor()\` leem esses claims.
   Detalhe: o \`id\` do usuário do Auth precisa casar com o id da tabela
   \`public.users\` (ao importar dados, mantenha os ids de 15 caracteres do
   PocketBase, ou crie o usuário no Auth com o mesmo id).

## Como exportar os DADOS (quando quiser migrar de verdade)

O objetivo declarado aqui é backup estrutural, mas se um dia você quiser
levar os dados, os caminhos são:

1. **Exportações do próprio sistema** — a área de Limpeza de Ambiente e os
   módulos do app permitem exportar listas (colaboradores, onboardings,
   candidatos, logs) em arquivos; servem de insumo para carga via SQL.
2. **API do PocketBase** — todas as coleções expõem REST:

   \`\`\`bash
   # exemplo: baixar todos os onboardings (paginado)
   curl "https://SEU-BACKEND/api/collections/onboardings/records?perPage=500&page=1" \\
     -H "Authorization: TOKEN_ADMIN"
   \`\`\`

   Faça o mesmo para cada coleção da tabela acima (e para \`users\`).
   Converta os JSON em \`INSERT\`s (ou use um ETL simples) respeitando os ids
   originais de 15 caracteres, para preservar as relações.
3. **Arquivos** — baixe do storage do PocketBase e reenvie para o Supabase
   Storage; os nomes seguem \`{collectionId}/{recordId}/{arquivo}\`.

## Observações de fidelidade (o SQL é um espelho, não uma reescrita)

- **Regras "vazias"** no PocketBase (\`""\`) = acesso público sem login.
  No SQL viraram políticas para \`anon, authenticated\` — é o caso dos links
  de token (prova do candidato \`/candidato/prova/:token\`, feedback de
  avaliação, documento complementar, ficha do colaborador e confirmações).
  O token continua sendo a chave de acesso que o app apresenta.
- **Regras \`null\`** (nenhuma regra de API) = a coleção só é escrita pelo
  servidor. É o caso de \`teste_tentativas\` (insert/update via hooks): no SQL
  não há política de insert/update para clientes — só leitura autenticada e
  exclusão por Admin.
- **Visibilidade do papel Gestão**: setor via \`setor_coincide()\` (equivalente
  ao operador \`~\` do PocketBase). Em \`cursos\` a comparação usa chave **ou**
  nome do setor; em \`questionarios\`, setor vazio = questionário global.
- **Chave "Pode editar questionários do seu setor"** (por usuário, só papel
  Gestão, desligada por padrão): enforcement em \`pode_editar_questionarios()\`,
  usado nas políticas de \`questionarios\` e \`teste_questoes\`.
- **Ciclo de FKs**: \`candidatos.tentativa_id\` → \`teste_tentativas\` é criada
  por \`ALTER TABLE\` após a criação das duas tabelas.
- **ids**: \`text\` de 15 caracteres (padrão PocketBase) para preservar as
  relações ao importar dados. Se preferir \`uuid\` no Supabase, converta
  **antes** da importação.
- **\`users.senha_hash\`**: o hash do PocketBase não serve no Supabase Auth;
  ao migrar, os usuários terão de redefinir senha (ou use o fluxo de
  convite/reset do Supabase). A coluna existe só como referência.

## Arquivos e downloads

O pacote é entregue dentro do sistema por DOIS downloads, ambos na página
**Backup Estrutural** (só Admin; anônimo recebe 401 e RH/Gestão recebe 403):

- **"Baixar backup estrutural (SQL)"** — entrega o \`schema.sql\` completo
  (estrutura em uma transação), servido por \`/backend/v1/backup-schema\`.
- **"Baixar README (instruções)"** — entrega este \`README.md\`, servido por
  \`/backend/v1/backup-readme\`.

Os dois cobrem apenas a **ESTRUTURA** do banco — os DADOS saem pelas
exportações (CSV) e pela API do próprio sistema, como descrito na seção
"Como exportar os DADOS" acima.
`

$app.store().set('backup_schema_sql', BACKUP_SCHEMA_SQL)
$app.store().set('backup_readme_md', BACKUP_README_MD)

routerAdd(
  'GET',
  '/backend/v1/backup-schema',
  (e) => {
    const authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { error: 'Autenticação necessária.' })
    }
    const role = (authRecord.getString('role') || '').trim().toLowerCase()
    if (role !== 'admin') {
      return e.json(403, { error: 'Acesso restrito a Admin.' })
    }

    const sql = $app.store().get('backup_schema_sql')
    if (!sql) {
      return e.json(500, { error: 'Conteúdo do backup não disponível no servidor.' })
    }

    e.response.header().set('Content-Disposition', 'attachment; filename="schema.sql"')
    e.response.header().set('Cache-Control', 'no-store')
    return e.blob(200, 'application/sql; charset=utf-8', sql)
  },
  $apis.requireAuth(),
)

// README do pacote — mesmo esquema: embutido no store, restrito a Admin
// (anônimo 401, RH/Gestão 403), attachment com filename="README.md".
routerAdd(
  'GET',
  '/backend/v1/backup-readme',
  (e) => {
    const authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { error: 'Autenticação necessária.' })
    }
    const role = (authRecord.getString('role') || '').trim().toLowerCase()
    if (role !== 'admin') {
      return e.json(403, { error: 'Acesso restrito a Admin.' })
    }

    const md = $app.store().get('backup_readme_md')
    if (!md) {
      return e.json(500, { error: 'Conteúdo do README não disponível no servidor.' })
    }

    e.response.header().set('Content-Disposition', 'attachment; filename="README.md"')
    e.response.header().set('Cache-Control', 'no-store')
    return e.blob(200, 'text/markdown; charset=utf-8', md)
  },
  $apis.requireAuth(),
)
