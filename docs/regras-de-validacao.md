# Regras de validação da proposta orçamentária

Este documento descreve a metodologia de apuração de cada regra do motor de validação, implementado em `backend/src/dominio/validacao.ts`. As bases de cálculo e os enquadramentos das classificações estão em `backend/src/dominio/classificacoes.ts`.

Todas as regras operam sobre o **retrato do orçamento** (`OrcamentoSnapshot`), que reúne as receitas previstas, as dotações das propostas em situação consolidável (enviada, em análise ou homologada), os tetos, as emendas e os parâmetros fiscais do exercício.

## Severidades

| Severidade | Efeito |
| --- | --- |
| Impedimento | Bloqueia a aprovação da proposta consolidada; a rotina de linha de comando encerra com código de saída 2. |
| Alerta | Não bloqueia, mas exige manifestação expressa do órgão central antes do envio. |
| Informativa | Apenas evidencia um valor relevante para a análise. |

## Bases de cálculo

### Receita líquida de impostos e transferências de impostos

Base dos mínimos constitucionais de educação e saúde. Compõem a base:

- impostos próprios do Estado — naturezas iniciadas por `1.1.1` (ICMS, IPVA, ITCMD e IRRF sobre a folha estadual);
- transferências da União de natureza tributária — FPE (`1.7.1.8.01.2`), cota-parte do IPI-Exportação (`1.7.1.8.06`) e desoneração das exportações da LC 87/1996 (`1.7.1.8.01.3`);
- **deduzidas** as parcelas do ICMS e do IPVA pertencentes aos municípios (`9.1.1.8.03` e `9.1.1.8.04`), na forma do art. 158 da Constituição Federal.

As deduções destinadas à formação do FUNDEB (`9.1.1.8.01`, `9.1.1.8.02` e `9.1.7`) **não** reduzem a base, porque o próprio aporte ao fundo é computado como aplicação em educação. Demais restituições (`9.1.9`) também não integram a base.

### Despesa com pessoal

Considera as dotações do grupo de natureza 1 (Pessoal e Encargos Sociais), excluídos os elementos previdenciários 01 (aposentadorias e reformas), 03 (pensões) e 05 (outros benefícios previdenciários), na forma do art. 19, §1º, VI, da LC 101/2000. Os limites são apurados por Poder, agregando o Tribunal de Contas ao Legislativo e a Defensoria Pública ao Executivo.

### Fontes vinculadas a impostos

- **Educação:** fontes 500 (recursos não vinculados de impostos), 540 (parcela estadual do FUNDEB) e 569 (outros recursos vinculados à educação). As complementações da União ao FUNDEB (542 e 543) e o salário-educação (550) não são computados no mínimo de 25%, por constituírem recursos adicionais.
- **Saúde:** fontes 500 e 659. As transferências federais do SUS (600 e 602) não integram o mínimo de 12%, que se refere à aplicação de receitas próprias.
- **FUNDEB:** fontes 540 a 543, para apuração da parcela mínima de remuneração dos profissionais.

## Detalhamento das regras

### LOA-001 — Equilíbrio entre receita prevista e despesa fixada

Compara a soma das receitas previstas (líquidas das deduções) com a soma das dotações. A diferença admitida é definida pelo parâmetro `TOLERANCIA_EQUILIBRIO`, com valor padrão de R$ 0,01.

**Fundamento:** art. 2º da Lei 4.320/1964 e art. 4º, I, a, da LC 101/2000.

### LOA-002 — Equilíbrio da despesa por fonte de recursos

Agrupa receitas e despesas por fonte de recursos e aponta as fontes com divergência superior à tolerância. Detecta tanto despesa fixada em fonte sem receita prevista quanto receita vinculada sem aplicação correspondente — situação que caracterizaria desvio de destinação legal.

**Fundamento:** art. 8º, parágrafo único, da LC 101/2000.

### LOA-003 — Propostas dentro dos tetos comunicados

Soma as dotações de cada unidade orçamentária e compara com o teto de escopo `TOTAL` registrado para o exercício. Relaciona as unidades excedentes com o valor do excesso e informa quantas unidades estão sem teto cadastrado.

### LOA-004 — Aplicação mínima em manutenção e desenvolvimento do ensino

Apura as dotações da função 12 (Educação) custeadas pelas fontes vinculadas a impostos e compara com o percentual do parâmetro `PERC_MIN_EDUCACAO` (25%) aplicado sobre a base de impostos e transferências.

**Fundamento:** art. 212 da CF e art. 69 da Lei 9.394/1996.

### LOA-005 — Aplicação mínima em ações e serviços públicos de saúde

Mesma metodologia da regra anterior, aplicada à função 10 (Saúde) e ao parâmetro `PERC_MIN_SAUDE` (12%).

**Fundamento:** art. 198, §2º, II, da CF e art. 6º da LC 141/2012.

### LOA-006 — Parcela mínima do FUNDEB na remuneração dos profissionais

Sobre o total das dotações custeadas pelas fontes do FUNDEB, verifica se a parcela classificada no grupo de natureza 1 alcança o percentual de `PERC_MIN_FUNDEB_PROFISSIONAIS` (70%).

**Fundamento:** art. 212-A, XI, da CF.

### LOA-007 — Reserva de contingência mínima

Soma as dotações da função 99 ou do grupo de natureza 9 e compara com `PERC_MIN_RESERVA_CONTINGENCIA` aplicado sobre a RCL projetada.

**Fundamento:** art. 5º, III, da LC 101/2000 e LDO do exercício.

### LOA-008 — Limites de despesa com pessoal por Poder

Apura a despesa com pessoal de cada Poder e a compara com os limites do art. 20 da LC 101/2000: 3% para o Legislativo com o Tribunal de Contas, 6% para o Judiciário, 2% para o Ministério Público e 49% para o Executivo, além do limite global de 60% da RCL. A memória de apuração traz o valor e o percentual de cada Poder.

### LOA-009 — Regra de ouro

Compara a receita de operações de crédito (fontes de origem `OPERACAO_CREDITO`) com o total das despesas de capital (grupos 4, 5 e 6).

**Fundamento:** art. 167, III, da CF.

### LOA-010 — Compatibilidade entre grupo de natureza e elemento de despesa

Cada elemento de despesa registra os grupos de natureza em que pode ser utilizado. A regra relaciona as dotações cuja combinação é inválida — por exemplo, o elemento 51 (Obras e Instalações) classificado no grupo 1 (Pessoal e Encargos Sociais). A mesma verificação é aplicada de forma preventiva no momento da inclusão da dotação pela API, que recusa o lançamento.

**Fundamento:** Portaria Interministerial STN/SOF 163/2001.

### LOA-011 — Vedação de classificações genéricas

Aponta as dotações que utilizam a modalidade de aplicação 99 (A Definir) ou o elemento 99 (A Classificar) fora da reserva de contingência. Classificada como alerta, por depender de autorização na LDO.

### LOA-012 — Compatibilidade com o PPA

Relaciona as dotações vinculadas a programas inativos ou cuja vigência no PPA encerra antes do exercício da lei.

**Fundamento:** art. 165, §7º, da CF e art. 5º da LC 101/2000.

### LOA-013 — Previsão para precatórios e sentenças judiciais

Verifica a existência de dotação nos elementos 91 (Sentenças Judiciais) e 92 (Despesas de Exercícios Anteriores).

**Fundamento:** art. 100, §5º, da CF.

### LOA-014 — Homologação das propostas

Relaciona as unidades cujas propostas foram incluídas na consolidação sem homologação do órgão central, com o valor correspondente. Classificada como alerta.

### LOA-015 — Limite global das emendas parlamentares

Soma as emendas que não foram rejeitadas e compara com `PERC_LIMITE_EMENDAS` aplicado sobre a RCL projetada.

### LOA-016 — Destinação das operações de crédito

Complementa a regra de ouro no nível da dotação: aponta as despesas correntes custeadas por fontes de operação de crédito.

**Fundamento:** art. 167, III, da CF e art. 12, §2º, da LC 101/2000.

### LOA-017 — Aporte do orçamento fiscal à seguridade social

Regra informativa. Compara a despesa das funções 08, 09 e 10 com as receitas próprias da esfera da seguridade social, evidenciando o aporte necessário do orçamento fiscal. Não se exige equilíbrio isolado por esfera, uma vez que a lei orçamentária é apresentada de forma consolidada.

**Fundamento:** art. 165, §5º, e art. 195, §1º, da CF.

### LOA-018 — Consistência dos valores lançados

Aponta dotações com valor nulo ou negativo e receitas cujo sinal é incompatível com a natureza — deduções devem ser negativas e as demais receitas positivas. A mesma verificação é aplicada na inclusão e na alteração pela API.

## Validação prévia por unidade orçamentária

No envio de uma proposta setorial, o sistema executa o subconjunto de regras aplicáveis ao recorte da unidade: LOA-003, LOA-010, LOA-011, LOA-012 e LOA-018. Havendo impedimento, o envio é recusado com o detalhamento das inconsistências, evitando que a proposta chegue ao órgão central com erro de classificação.

## Parâmetros configuráveis

Os percentuais e limites são registrados como parâmetros fiscais do exercício e podem ser ajustados pelo órgão central conforme a LDO aprovada, sem alteração de código.

| Parâmetro | Padrão da carga de referência |
| --- | --- |
| `RCL_PROJETADA` | Receita corrente líquida projetada para o exercício |
| `PERC_MIN_EDUCACAO` | 25% |
| `PERC_MIN_SAUDE` | 12% |
| `PERC_MIN_FUNDEB_PROFISSIONAIS` | 70% |
| `PERC_MIN_RESERVA_CONTINGENCIA` | 0,5% da RCL |
| `PERC_MAX_PESSOAL_TOTAL` | 60% da RCL |
| `PERC_MAX_PESSOAL_EXECUTIVO` | 49% da RCL |
| `PERC_MAX_PESSOAL_LEGISLATIVO` | 3% da RCL |
| `PERC_MAX_PESSOAL_JUDICIARIO` | 6% da RCL |
| `PERC_MAX_PESSOAL_MP` | 2% da RCL |
| `PERC_LIMITE_EMENDAS` | 0,5% da RCL |
| `TOLERANCIA_EQUILIBRIO` | R$ 0,01 |
