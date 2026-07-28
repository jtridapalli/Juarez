# Arquitetura

## Visão geral

```
┌──────────────────────────────┐        ┌────────────────────────────────────────┐
│ Interface web (React + Vite) │  HTTP  │ API REST (Fastify)                     │
│  painel, receita, despesa,   │ ─────► │  autenticação JWT e perfis de acesso   │
│  propostas, tetos, validação,│        │  cadastros, orçamento, relatórios      │
│  consolidação, anexos        │ ◄───── │                                        │
└──────────────────────────────┘        └───────────────┬────────────────────────┘
                                                        │
                              ┌─────────────────────────┴──────────────────────┐
                              │ Serviços                                       │
                              │  snapshot ....... retrato do orçamento         │
                              │  anexos ......... tabelas dos anexos legais    │
                              │  exportadores ... CSV, XLSX e PDF              │
                              │  projeto-lei .... texto do projeto de lei      │
                              └─────────────────────────┬──────────────────────┘
                                                        │
                              ┌─────────────────────────┴──────────────────────┐
                              │ Domínio (funções puras, sem acesso a banco)    │
                              │  classificacoes ... bases de cálculo legais    │
                              │  validacao ........ 18 regras de conformidade  │
                              └─────────────────────────┬──────────────────────┘
                                                        │
                                        ┌───────────────┴────────────────┐
                                        │ Prisma + SQLite                │
                                        │ carga a partir de CSV abertos  │
                                        └────────────────────────────────┘
```

## Decisões de projeto

### Domínio isolado da infraestrutura

O motor de validação recebe um `OrcamentoSnapshot` — estrutura de leitura com as receitas, dotações, tetos, emendas e parâmetros já desnormalizados — e devolve o relatório de conformidade. Nenhuma regra acessa o banco de dados.

Consequências práticas:

- as 18 regras são testadas por unidade com orçamentos sintéticos, sem carga de banco;
- a mesma implementação atende à validação global (fechamento) e à validação prévia por unidade orçamentária (envio da proposta);
- a substituição do banco não afeta as regras legais.

### Classificações como tabelas de referência substituíveis

Funções, subfunções, grupos de natureza, modalidades de aplicação, elementos de despesa, naturezas de receita, fontes de recursos, órgãos, unidades orçamentárias, programas e ações são carregados de arquivos CSV em `backend/data`. Isso reproduz a prática real, em que as tabelas são atualizadas anualmente pela STN e pela SEFA, e evita que os códigos fiquem embutidos no código-fonte.

### Compatibilidade elemento × grupo declarada em dados

Cada elemento de despesa declara os grupos de natureza em que pode ser utilizado (coluna `grupos` de `elementos-despesa.csv`). A verificação ocorre em dois pontos: preventivamente, na inclusão da dotação pela API, e no fechamento, pela regra LOA-010.

### Equilíbrio por fonte na geração da carga

A carga de referência define a despesa por pesos relativos e escalona cada fonte de recursos para consumir exatamente a receita líquida prevista naquela fonte. O resultado é uma proposta equilibrada no total e por fonte, com as vinculações constitucionais atendidas — condição necessária para que o sistema seja homologado com dados representativos.

### Aritmética monetária

Todos os valores passam pela função `centavos`, que arredonda no critério comercial com tolerância relativa, evitando que resíduos de ponto flutuante desloquem o arredondamento (por exemplo, R$ 1,005 representado internamente como 1,00499…). A função `distribuir` reparte um total entre pesos garantindo que a soma das parcelas seja exatamente igual ao total, lançando a diferença de arredondamento na última parcela.

## Modelo de dados

### Ciclo e parâmetros

- **Exercicio** — exercício financeiro, vigência do PPA, prazos de envio e situação do ciclo.
- **ParametroFiscal** — parâmetros macrofiscais e legais (RCL projetada, mínimos, limites), com o respectivo fundamento.

### Classificações

- **Orgao** e **UnidadeOrcamentaria** — classificação institucional, com Poder e tipo de administração.
- **Funcao** e **Subfuncao** — classificação funcional.
- **Programa** e **Acao** — classificação programática vinculada ao PPA, com produto, unidade de medida e meta física.
- **NaturezaReceita** — natureza da receita, com categoria econômica, origem, espécie e indicador de dedução.
- **GrupoNaturezaDespesa**, **ModalidadeAplicacao** e **ElementoDespesa** — componentes da natureza da despesa, combinados na dotação.
- **FonteRecurso** — fonte e destinação de recursos, com tipo, vinculação e origem.

### Elaboração

- **ReceitaPrevista** — previsão por natureza, fonte e esfera, com memória de cálculo.
- **LimiteOrcamentario** — teto por unidade orçamentária e escopo.
- **PropostaUO** — envelope da proposta de cada unidade, com situação, versão, datas e parecer.
- **Dotacao** — linha do Quadro de Detalhamento da Despesa, reunindo as quatro classificações, fonte, esfera, identificador de uso e resultado primário.
- **EmendaParlamentar** — proposições apresentadas durante a tramitação.

### Fechamento e controle

- **ExecucaoValidacao** e **ResultadoValidacao** — histórico das validações, com valor apurado, valor de referência e memória de apuração por regra.
- **Consolidacao** — versão consolidada, com totais por esfera, resumo, resultado da validação e código de integridade SHA-256.
- **Usuario** e **Auditoria** — controle de acesso por perfil e trilha das operações.

## Fluxo de informação

1. O órgão central abre o exercício e registra os parâmetros da LDO.
2. A receita é projetada por natureza e fonte, com memória de cálculo.
3. Os tetos são calculados e comunicados às unidades orçamentárias.
4. Cada unidade detalha suas dotações; o sistema recusa classificações inválidas no momento do lançamento.
5. A unidade envia a proposta, que é validada previamente no recorte da própria unidade.
6. O órgão central analisa, devolve ou homologa cada proposta.
7. A validação global apura as 18 regras sobre o conjunto consolidável.
8. A consolidação gera uma versão numerada com código de integridade.
9. Os anexos e o texto do projeto de lei são gerados para remessa à Assembleia Legislativa.

## Segurança

- Autenticação por JWT com validade de 12 horas.
- Autorização por perfil em cada endpoint de escrita.
- Unidades orçamentárias restritas à própria unidade e à situação editável da proposta (em elaboração ou devolvida).
- Registro de auditoria em todas as operações de escrita, com identificação do usuário.
- Erros de validação de requisição retornam a causa; falhas inesperadas retornam mensagem genérica, com o detalhe registrado apenas no log do servidor.
