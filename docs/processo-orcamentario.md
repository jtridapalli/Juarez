# Processo de elaboração da LOA no sistema

## Instrumentos de planejamento

A lei orçamentária anual é o terceiro instrumento do ciclo previsto no art. 165 da Constituição Federal:

| Instrumento | Função | Relação com o sistema |
| --- | --- | --- |
| PPA 2024–2027 | Define programas, objetivos e metas para quatro anos | Programas e ações são tabelas de referência; a regra LOA-012 recusa dotação vinculada a programa fora da vigência |
| LDO 2027 | Fixa metas fiscais, prioridades e limites para a LOA | Origem dos parâmetros fiscais: RCL projetada, percentuais mínimos, limites de pessoal, reserva de contingência e limite de emendas |
| LOA 2027 | Estima a receita e fixa a despesa do exercício | Objeto do sistema |

Como 2027 é o último exercício do PPA 2024–2027, todos os programas da carga de referência têm vigência encerrando em 2027.

## Etapas do ciclo

### 1. Abertura do exercício

O órgão central de orçamento registra o exercício, a vigência do PPA, a data-limite para envio das propostas setoriais e a data prevista de remessa do projeto de lei à Assembleia Legislativa. Registra também os parâmetros fiscais decorrentes da LDO aprovada.

### 2. Projeção da receita

A receita é estimada por natureza da receita, fonte de recursos e esfera orçamentária. Cada linha registra a memória de cálculo, atendendo à exigência do art. 12 da LC 101/2000. São lançadas separadamente, com valor negativo:

- a cota-parte de 25% do ICMS e de 50% do IPVA pertencente aos municípios (art. 158 da CF);
- as parcelas destinadas à formação do FUNDEB (art. 212-A da CF);
- as restituições e demais deduções.

A receita líquida resultante é o limite da despesa a ser fixada.

### 3. Definição e comunicação dos tetos

O órgão central estabelece o teto de cada unidade orçamentária. A interface apresenta o grau de utilização de cada teto e destaca as unidades que o excederam ou que estão próximas do limite.

### 4. Captação das propostas setoriais

Cada unidade orçamentária detalha suas dotações informando:

- classificação institucional (unidade orçamentária);
- classificação funcional (função e subfunção);
- classificação programática (programa, ação e subtítulo/localizador);
- natureza da despesa (categoria econômica, grupo, modalidade de aplicação e elemento);
- fonte de recursos, esfera orçamentária, identificador de uso e identificador de resultado primário;
- valor e justificativa.

No momento do lançamento, o sistema recusa a dotação quando o elemento é incompatível com o grupo de natureza ou quando a ação não pertence ao programa selecionado. Unidades orçamentárias só alteram dotações da própria unidade e apenas enquanto a proposta estiver em elaboração ou devolvida.

### 5. Tramitação

```
EM_ELABORACAO ──enviar──► ENVIADA ──analisar──► EM_ANALISE ──homologar──► HOMOLOGADA
      ▲                       │                      │                          │
      └────────reabrir────────┴───────devolver───────┘                          │
                                    ▼                                           │
                                DEVOLVIDA ──enviar──► ENVIADA                   │
      └──────────────────────────────reabrir──────────────────────────────────---┘
```

O envio executa a validação prévia do recorte da unidade e é recusado se houver impedimento. A reabertura incrementa a versão da proposta, preservando o histórico na trilha de auditoria.

### 6. Validação legal

Com as propostas enviadas, o órgão central ou o controle interno executa o motor de validação sobre o conjunto consolidável. O resultado é persistido com valor apurado, valor de referência, fundamento legal e memória de apuração de cada regra, permitindo comparar execuções ao longo do fechamento.

### 7. Consolidação

A consolidação fecha uma versão numerada, calculando os totais por esfera, o resumo por função, órgão e grupo de natureza, e um código de integridade SHA-256 sobre o conteúdo consolidado. Versões sucessivas permitem comparar cenários; o código de integridade permite comprovar que os anexos publicados correspondem à base consolidada.

### 8. Geração dos anexos e do projeto de lei

Os anexos da Lei 4.320/1964, os demonstrativos da LRF e o texto do projeto de lei são gerados a partir da base consolidada. O texto reproduz os valores em algarismos e por extenso, conforme a técnica legislativa, e discrimina receitas correntes e de capital, deduções, despesas correntes e de capital, reserva de contingência, orçamento fiscal, orçamento da seguridade social e despesa com pessoal.

## Perfis e responsabilidades

| Perfil | Responsabilidade no ciclo |
| --- | --- |
| Órgão central de orçamento (SEPL/SEFA) | Parâmetros fiscais, projeção da receita, tetos, análise e homologação das propostas, validação e consolidação |
| Unidade orçamentária | Detalhamento e envio da proposta da própria unidade |
| Controle interno (CGE) | Execução da validação e acompanhamento da conformidade |
| Consulta | Acompanhamento sem permissão de alteração |

## Correspondência com o calendário legal

| Etapa | Prazo típico |
| --- | --- |
| Aprovação da LDO e definição dos parâmetros | Até o encerramento do primeiro período legislativo do ano anterior |
| Envio das propostas setoriais | Data-limite registrada no exercício (na carga de referência, 31 de julho do ano anterior) |
| Consolidação e validação final | Agosto e setembro do ano anterior |
| Remessa do projeto de lei à Assembleia Legislativa | Até 30 de setembro do ano anterior |
