# Tabelas de referência

As classificações orçamentárias e a estrutura institucional são carregadas de arquivos CSV em `backend/data`, com separador ponto-e-vírgula e codificação UTF-8. Linhas iniciadas por `#` são ignoradas.

## Arquivos

| Arquivo | Conteúdo | Origem oficial |
| --- | --- | --- |
| `funcoes.csv` | Funções de governo (2 dígitos) | Portaria MOG 42/1999 |
| `subfuncoes.csv` | Subfunções (3 dígitos), com a função de vínculo típico | Portaria MOG 42/1999 |
| `grupos-natureza-despesa.csv` | Grupos de natureza da despesa e categoria econômica | Portaria Interministerial STN/SOF 163/2001 |
| `modalidades-aplicacao.csv` | Modalidades de aplicação | Portaria Interministerial STN/SOF 163/2001 |
| `elementos-despesa.csv` | Elementos de despesa e grupos de natureza compatíveis | Portaria Interministerial STN/SOF 163/2001 |
| `naturezas-receita.csv` | Naturezas da receita utilizadas pelo Estado, com indicador de dedução | Ementário da Receita Orçamentária (STN) |
| `fontes-recurso.csv` | Fontes e destinações de recursos, com tipo, vinculação e origem | Portaria STN 710/2021 e detalhamento da SEFA-PR |
| `orgaos.csv` | Órgãos orçamentários, Poder e tipo de administração | Estrutura administrativa do Estado do Paraná |
| `unidades-orcamentarias.csv` | Unidades orçamentárias e órgão de vínculo | Estrutura administrativa do Estado do Paraná |
| `programas.csv` | Programas do PPA, com objetivo e público-alvo | PPA 2024–2027 |
| `acoes.csv` | Ações por programa, com tipo, produto, unidade de medida e meta física | PPA 2024–2027 |

## Situação da carga que acompanha o repositório

Os arquivos distribuídos constituem uma **carga de referência**, montada para permitir a operação e a homologação do sistema com dados representativos da dimensão e da estrutura do orçamento estadual. As funções, subfunções, grupos de natureza, modalidades de aplicação e elementos de despesa seguem a codificação federal padronizada. Já os códigos de órgãos e unidades orçamentárias, os códigos de programas e ações e o detalhamento das naturezas de receita e das fontes específicas do Estado devem ser conferidos e substituídos pelas extrações oficiais antes do uso na elaboração da peça que será encaminhada à Assembleia Legislativa.

## Procedimento de substituição

1. Obter as tabelas oficiais:
   - classificação da despesa e ementário da receita: Portaria Interministerial STN/SOF 163/2001 e o Ementário da Receita Orçamentária publicado pela Secretaria do Tesouro Nacional para o exercício de referência;
   - fontes e destinações de recursos: tabela da STN acrescida do detalhamento estadual da Secretaria de Estado da Fazenda;
   - estrutura institucional, programas e ações: extrações da Secretaria de Estado do Planejamento.
2. Converter cada tabela para o formato CSV descrito acima, preservando os nomes das colunas.
3. Substituir os arquivos em `backend/data`.
4. Recriar a base e reexecutar a carga:

```bash
cd backend
npm run db:reset
```

5. Executar a validação e conferir o resultado:

```bash
npm run loa:gerar
```

## Observações sobre colunas específicas

### `elementos-despesa.csv` — coluna `grupos`

Lista, separada por vírgula, dos grupos de natureza em que o elemento pode ser utilizado. É a base da verificação de compatibilidade aplicada tanto no lançamento da dotação quanto na regra LOA-010. Ao incluir novos elementos, preencher essa coluna conforme a tabela de correlação vigente.

### `fontes-recurso.csv` — colunas `vinculacao` e `origem`

- `vinculacao` identifica a destinação legal (`EDUCACAO`, `SAUDE`, `FUNDEB`, `PREVIDENCIA`, `ASSISTENCIA_SOCIAL`, `OPERACAO_CREDITO`, `CONVENIO`, `ALIENACAO`, `OUTRAS`) e é usada nos demonstrativos de vínculo com os recursos.
- `origem` identifica a procedência (`TESOURO`, `PROPRIA`, `TRANSFERENCIA`, `OPERACAO_CREDITO`, `ALIENACAO`) e determina, entre outras verificações, a apuração da regra de ouro.

Os conjuntos de fontes considerados nos mínimos constitucionais estão declarados em `backend/src/dominio/classificacoes.ts` e devem ser revistos quando a tabela de fontes for substituída.

### `naturezas-receita.csv` — coluna `deducao`

Indica se a natureza representa dedução da receita. Deduções são lançadas com valor negativo e a API recusa o sinal incompatível. As deduções relativas à cota-parte dos municípios reduzem a base dos mínimos constitucionais; as destinadas à formação do FUNDEB não, conforme detalhado em `regras-de-validacao.md`.

## Plano orçamentário de referência

O arquivo `backend/prisma/dados/plano-loa2027.ts` contém a proposta base utilizada na carga: as linhas de receita com a respectiva memória de cálculo e as linhas de despesa com pesos relativos por fonte de recursos. Os valores estão expressos em R$ milhões na base do exercício de 2025 e são projetados para 2027 pelo fator definido em `PROJECAO`, que combina o crescimento real do PIB estadual com o deflator implícito adotado na LDO. Para trabalhar com outra base ou outro cenário macrofiscal, basta ajustar esse arquivo e reexecutar a carga.
