# Projeção da folha de pagamento do Estado do Paraná

Reimplementação conferida do modelo de projeção da folha de pagamento do Estado do
Paraná (DOE/SEFA-PR), a partir da auditoria dos 28 quadros da consulta de
**29/09/2026, 13h35**.

Não é uma cópia do painel auditado. É a mesma metodologia executada de novo, com as
correções dos defeitos que a auditoria encontrou embutidas na estrutura — de modo que
a classe de defeito deixe de ser possível, e não apenas de estar corrigida nesta
carga.

## Como rodar

Não há dependência para instalar. Node 20 ou mais novo basta.

```bash
node scripts/gerar-dados.mjs   # gera dados/modelo.json e imprime a calibração
node servidor.mjs              # serve em http://localhost:8080/
node --test "testes/*.test.mjs"
```

A interface importa os módulos de `nucleo/` e `dados/` **diretamente**, como ES
modules. Não há empacotador: o arquivo que o navegador executa é o mesmo que os
testes executam, e por isso não existe passo de build onde a tela possa divergir do
que foi conferido.

Para verificar a tela sem navegador aberto, com Chrome em modo headless:

```bash
google-chrome --headless=new --remote-debugging-port=9222 \
  --user-data-dir=/tmp/perfil-chrome about:blank &
node scripts/verifica-tela.mjs
```

## As quatro decisões estruturais

**Os valores circulam em reais no sistema inteiro.** A conversão para milhões e
bilhões acontece só na apresentação. É o que faz a tolerância de um real da
conferência ser um real de verdade: se os valores circulassem em milhões, a mesma
constante seria uma tolerância de um milhão.

**Um ancestral só.** `montaCarga` roda uma vez por mudança de premissa ou de recorte,
e as oito abas leem o mesmo objeto. Nenhuma aba recalcula nada. Dois números
diferentes para a mesma grandeza passam a exigir dois cálculos diferentes, e só
existe um.

**A conferência trava a carga.** As identidades internas são bloqueantes: a tela não
publica indicador enquanto alguma não fechar ao real. Aderência ao publicado e
distância entre fontes **não** bloqueiam, porque divergir do publicado é o que se
quer medir quando a base é reancorada.

**Toda contagem vem com o denominador.** "719 linhas de ativos" não diz se o modelo
tem 771 linhas ou 1.023. O quadro 28 da consulta publicava as duas contagens sem o
denominador, e somá-las dava a resposta errada.

## O que a auditoria encontrou, e o que esta reimplementação faz

| Achado | Gravidade | Correção estrutural |
| --- | --- | --- |
| As agregações do quadro 28 somavam R$ 1.385,0 mi menos que o exercício do próprio quadro | defeito | Toda agregação devolve o total percorrido junto com os grupos, manda chave não classificada para um balde explícito e publica o resíduo; a conferência trava se passar de um real |
| Quadros 13 e 22 publicavam R$ 24.681,0 mi e R$ 24.771,0 mi com o mesmo rótulo | defeito | Ancestral único |
| Quatro aumentos específicos contados como aplicados; três vigoram em mês projetado | defeito | Contadores de declarados e de aplicados separados; a carga falha se um trio declarado não tiver linha |
| O crédito publicado (R$ 2.974,1 mi) é o líquido do Estado; a soma das faltas reais é R$ 4.843,6 mi | erro de régua | As três leituras publicadas lado a lado, com a lista das 71 unidades descobertas |
| Elementos 16, 92 e 94 recebem no documento uma régua e executam outra | erro de régua | As duas colunas publicadas lado a lado |
| D6 traz o percentual e não declara o período; a diferença entre as leituras é R$ 3,88 bi | ambiguidade | As duas leituras rodam sempre, com a razão da escolha declarada |
| 88,6% do crescimento de 2027 vem de ancorar em dezembro, não do vegetativo | omissão | A decomposição roda sempre |
| O reajuste geral de 5,00% vigora em maio, mês já liquidado: alcança zero mês-linha | omissão | O contador de alcance é publicado junto com a premissa |
| O quadro 28 publica 771 linhas de um modelo de 1.023 | omissão | Denominador explícito em toda contagem |

## As oito abas

| Aba | Responde |
| --- | --- |
| Simulação | Quanto custa cada ponto de cada premissa |
| Projeção 2026 | Como cada regra produz cada mês, linha por linha |
| Crédito e abertura | Quanto crédito precisa ser aberto, e por qual régua |
| Exercício 2027 | De onde vem o crescimento, e o que D6 quer dizer |
| Métodos | O que cada leitura projetaria, e qual serve de referência |
| Conferência | A carga fecha, e onde ela diverge do publicado |
| Regras | Qual enunciado produz cada número, e onde ele é executado |
| Carga de CSV | Como reancorar a base, e o que a carga exige |

## Estrutura

```
nucleo/        o cálculo, sem nada de interface
  regras.js        premissas, listas de natureza e as funções de classificação
  projecao2026.js  regras 5.1 a 5.5
  projecao2027.js  regras D1 a D7
  agregacao.js     as nove agregações, com resíduo publicado
  recorte.js       filtro hierárquico, válido para a tela inteira
  comparacao.js    ARIMA recortado, vegetativo, piso e backtest
  sensibilidade.js quanto custa cada ponto
  conferencia.js   as três classes de verificação e a trava
  carga.js         o ancestral único
  csv.js           carga de CSV e casamento de origens
  formato.js       a única fronteira de apresentação
dados/         os números publicados e o conjunto calibrado
publico/       a interface
testes/        185 testes de node:test
scripts/       geração do conjunto e verificação da tela
```

## Sobre o conjunto de dados

`dados/modelo.json` é um conjunto **sintético calibrado** de 1.023 linhas em 77
unidades orçamentárias, construído para reproduzir os números publicados na consulta.
Ele não é a base real da SEFA-PR, que não é pública: serve para que cada número da
tela possa ser conferido contra a regra que o produziu, e para que a conferência tenha
o que conferir.

A calibração fecha em **39 de 39 identidades internas**, com pior diferença de
R$ 0,00, e em **113 de 113 verificações de aderência** aos números publicados. O
gerador resolve os alvos por mês com conjuntos de corte independentes e os dezenove
elementos de despesa por Newton em escalares logarítmicos; `node
scripts/gerar-dados.mjs` imprime o relatório de calibração item a item.

O 13º salário é **derivado** da regra, e não um alvo de calibração. Tratá-lo como alvo
era aritmeticamente impossível: a provisão exigiria cerca de 60% da massa anual nas
naturezas que provisionam, e 27% da folha é inativo, que a regra 5.5 exclui.

Para usar a base real, a aba **Carga de CSV** aceita a planilha de projeção e o
relatório do SIAFIC, exige cardinalidade um para um e exige que janeiro a julho batam
ao centavo nas duas origens.
