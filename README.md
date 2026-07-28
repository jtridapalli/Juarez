# Sistema de Elaboração da LOA 2027 — Governo do Estado do Paraná

Sistema para elaboração, validação e geração da **Lei Orçamentária Anual (LOA) do exercício de 2027**, último ano do PPA 2024–2027. Cobre o ciclo completo: definição dos parâmetros macrofiscais, projeção da receita, captação das propostas das unidades orçamentárias, verificação automática dos limites constitucionais e legais, consolidação versionada e geração dos anexos da Lei 4.320/1964 e do texto do projeto de lei.

> A base de dados que acompanha o repositório é uma **carga de referência** completa e equilibrada (R$ 84,9 bilhões, 59 unidades orçamentárias, 146 dotações), destinada à operação e à homologação do sistema. As tabelas de classificação e a estrutura institucional são carregadas de arquivos CSV abertos e devem ser substituídas pelas extrações oficiais da SEFA/SEPL e da STN antes do uso na elaboração da peça oficial. Ver `docs/tabelas-de-referencia.md`.

## Índice

- [Escopo funcional](#escopo-funcional)
- [Arquitetura](#arquitetura)
- [Como executar](#como-executar)
- [Perfis de acesso](#perfis-de-acesso)
- [Regras de validação](#regras-de-validação)
- [Anexos e documentos gerados](#anexos-e-documentos-gerados)
- [Geração do pacote por linha de comando](#geração-do-pacote-por-linha-de-comando)
- [Testes](#testes)
- [Documentação complementar](#documentação-complementar)

## Escopo funcional

| Módulo | Descrição |
| --- | --- |
| Ciclo orçamentário | Abertura do exercício, prazos de envio das unidades e de remessa à Assembleia Legislativa, e parâmetros macrofiscais da LDO (RCL projetada, mínimos constitucionais, limites da LRF). |
| Previsão da receita | Estimativa por natureza da receita, fonte de recursos e esfera orçamentária, com memória de cálculo por linha (art. 12 da LC 101/2000) e tratamento das deduções (transferências constitucionais a municípios e formação do FUNDEB). |
| Fixação da despesa | Quadro de Detalhamento da Despesa com classificação institucional, funcional-programática, natureza da despesa, fonte de recursos, esfera e identificador de resultado primário. |
| Propostas setoriais | Tramitação por unidade orçamentária: elaboração, envio, análise, devolução e homologação, com controle de teto e validação prévia no envio. |
| Tetos orçamentários | Limites comunicados por unidade, com grau de utilização e ajuste pelo órgão central. |
| Validação legal | Motor com 18 regras que apura equilíbrio, mínimos de educação e saúde, FUNDEB, reserva de contingência, limites de pessoal por Poder, regra de ouro e consistência das classificações. |
| Consolidação | Fechamento em versões numeradas, com resumo por função, órgão e grupo de natureza, resultado da validação e código de integridade SHA-256 da base consolidada. |
| Anexos e projeto de lei | Geração dos anexos da Lei 4.320/1964, dos demonstrativos da LRF e do texto do projeto de lei em CSV, XLSX, PDF e TXT. |
| Emendas parlamentares | Registro das proposições com verificação do limite global fixado na LDO. |
| Auditoria | Trilha das operações com identificação do usuário responsável. |

## Arquitetura

```
backend/     API REST (Node 22 + TypeScript + Fastify + Prisma + SQLite)
  data/                 tabelas de referência em CSV (classificações e estrutura institucional)
  prisma/               modelo de dados, carga inicial e plano orçamentário de referência
  src/dominio/          regras de negócio puras: classificações e motor de validação
  src/servicos/         montagem do retrato do orçamento, anexos, exportadores e projeto de lei
  src/rotas/            endpoints de autenticação, cadastros, orçamento, validação e relatórios
  src/cli/              geração do pacote completo da LOA em disco
  tests/                testes unitários e de integração (Vitest)

frontend/    Aplicação web (React 18 + TypeScript + Vite + Tailwind CSS 4 + TanStack Query + Recharts)
  src/paginas/          painel, receita, despesa, propostas, tetos, validação, consolidação, anexos, cadastros e auditoria
  src/componentes/      componentes de interface compartilhados

docs/        Documentação de arquitetura, regras de validação e tabelas de referência
```

As regras de negócio ficam isoladas em `backend/src/dominio`, operando sobre um retrato imutável do orçamento (`OrcamentoSnapshot`). Isso permite validar a proposta sem acesso ao banco, o que é usado tanto pelos testes unitários quanto pela validação prévia no envio de cada proposta setorial.

## Como executar

Requisitos: Node.js 22 ou superior.

### Backend

```bash
cd backend
npm install
cp .env.example .env
npm run prisma:generate     # gera o cliente de acesso ao banco
npm run db:push             # cria o banco SQLite
npm run seed                # carga de referência da LOA 2027
npm start                   # API em http://localhost:3333
```

### Frontend

```bash
cd frontend
npm install
npm run dev                 # interface em http://localhost:5173
```

O servidor de desenvolvimento encaminha as chamadas de `/api` para `http://localhost:3333`; use a variável `API_URL` para apontar para outro endereço.

Para recriar a base a partir do zero: `npm run db:reset` (remove o arquivo SQLite local, recria o esquema e reexecuta a carga).

## Perfis de acesso

A carga de referência cria os usuários abaixo, todos com a senha `loa2027`:

| Perfil | Usuário | Permissões |
| --- | --- | --- |
| Administrador | `admin@sepl.pr.gov.br` | Acesso integral. |
| Órgão central de orçamento | `orcamento@sepl.pr.gov.br`, `contabilidade@sefa.pr.gov.br` | Parâmetros fiscais, receita, tetos, dotações de qualquer unidade, tramitação das propostas, validação e consolidação. |
| Unidade orçamentária | `gos@sesa.pr.gov.br`, `gos@seed.pr.gov.br`, `gos@sesp.pr.gov.br` | Dotações da própria unidade, apenas enquanto a proposta estiver em elaboração ou devolvida, e envio da proposta. |
| Controle interno | `auditoria@cge.pr.gov.br` | Execução da validação e consulta integral. |
| Consulta | `consulta@pr.gov.br` | Somente leitura. |

## Regras de validação

O motor avalia 18 regras, classificadas como **impedimento** (bloqueia o envio), **alerta** (exige manifestação do órgão central) ou **informativa**.

| Regra | Verificação | Fundamento |
| --- | --- | --- |
| LOA-001 | Equilíbrio entre receita prevista e despesa fixada | Art. 2º da Lei 4.320/1964 |
| LOA-002 | Equilíbrio da despesa por fonte de recursos | Art. 8º, parágrafo único, da LC 101/2000 |
| LOA-003 | Propostas dentro dos tetos comunicados | LDO e art. 4º da LC 101/2000 |
| LOA-004 | Aplicação mínima de 25% na manutenção e desenvolvimento do ensino | Art. 212 da CF |
| LOA-005 | Aplicação mínima de 12% em ações e serviços públicos de saúde | Art. 198, §2º, II, da CF e LC 141/2012 |
| LOA-006 | Parcela mínima de 70% do FUNDEB na remuneração dos profissionais | Art. 212-A, XI, da CF |
| LOA-007 | Reserva de contingência mínima em relação à RCL | Art. 5º, III, da LC 101/2000 |
| LOA-008 | Limites de despesa com pessoal por Poder e órgão autônomo | Arts. 19 e 20 da LC 101/2000 |
| LOA-009 | Regra de ouro: operações de crédito limitadas às despesas de capital | Art. 167, III, da CF |
| LOA-010 | Compatibilidade entre grupo de natureza e elemento de despesa | Portaria STN/SOF 163/2001 |
| LOA-011 | Vedação de modalidade "a definir" e elemento "a classificar" | Portaria STN/SOF 163/2001 e LDO |
| LOA-012 | Vinculação das dotações a programas vigentes do PPA | Art. 165, §7º, da CF |
| LOA-013 | Previsão de dotação para precatórios e sentenças judiciais | Art. 100, §5º, da CF |
| LOA-014 | Homologação das propostas incluídas na consolidação | Cronograma da LDO |
| LOA-015 | Limite global das emendas parlamentares | LDO e art. 166 da CF |
| LOA-016 | Operações de crédito aplicadas exclusivamente em despesas de capital | Art. 167, III, da CF |
| LOA-017 | Aporte do orçamento fiscal ao orçamento da seguridade social | Art. 165, §5º, e art. 195, §1º, da CF |
| LOA-018 | Consistência dos valores lançados | Art. 15 da Lei 4.320/1964 |

O detalhamento da metodologia de apuração de cada regra está em `docs/regras-de-validacao.md`.

## Anexos e documentos gerados

| Documento | Conteúdo |
| --- | --- |
| Anexo I | Resumo geral da receita e da despesa por categoria econômica |
| Anexo II — Receita | Receita por categoria econômica, natureza e fonte de recursos |
| Anexo II — Despesa | Despesa por órgão, categoria econômica e grupo de natureza |
| Anexo VI | Programa de trabalho por unidade orçamentária |
| Anexo VII | Demonstrativo do programa de trabalho de governo (funcional-programático) |
| Anexo VIII | Despesa por função, subfunção e programa, conforme o vínculo com os recursos |
| Anexo IX | Despesa por órgão e função |
| QDD | Quadro de Detalhamento da Despesa |
| Demonstrativos complementares | Fontes de recursos, mínimos constitucionais e limites legais, orçamentos fiscal e da seguridade social, e despesa por Poder |
| Projeto de lei | Texto do projeto de lei orçamentária, com os valores escritos por extenso |

Cada anexo é disponibilizado em JSON (para a interface), CSV com separador ponto-e-vírgula e BOM (compatível com o Excel em português), XLSX formatado e PDF em paisagem para publicação. Há também uma planilha única com todos os anexos em abas separadas.

## Geração do pacote por linha de comando

```bash
cd backend
npm run loa:gerar -- --ano 2027 --saida ./output
```

O comando executa o motor de validação, imprime o resultado regra a regra e grava em disco:

```
output/
  validacao.json                     resultado das 18 regras
  resumo.json                        totalizações consolidadas
  projeto-de-lei.txt                 texto do projeto de lei
  LOA2027-anexos-completos.xlsx      planilha com todos os anexos
  anexos/*.csv, anexos/*.pdf         anexos individuais
```

O processo encerra com código de saída 2 quando há impedimentos, o que permite o uso em rotinas automatizadas de fechamento.

## Testes

```bash
cd backend
npm test          # 54 testes: motor de validação, anexos, exportadores e API
npm run typecheck
```

Os testes de integração criam um banco SQLite isolado (`prisma/loa2027-test.db`), executam a carga de referência e exercitam a API por injeção de requisições, sem depender de servidor em execução.

```bash
cd frontend
npm run build     # verificação de tipos e empacotamento
```

## Documentação complementar

- `docs/arquitetura.md` — decisões de projeto, modelo de dados e fluxo de informação
- `docs/regras-de-validacao.md` — metodologia de apuração de cada regra
- `docs/tabelas-de-referencia.md` — origem das tabelas e procedimento de substituição pelas extrações oficiais
- `docs/processo-orcamentario.md` — ciclo de elaboração e papéis envolvidos
