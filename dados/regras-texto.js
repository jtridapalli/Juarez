/**
 * Catálogo das regras e das divergências encontradas na auditoria.
 *
 * Este arquivo é TEXTO, não cálculo. Ele existe para que cada número da tela possa
 * apontar para o enunciado que o produziu, e para que o enunciado possa apontar de
 * volta para o lugar do código que o executa.
 *
 * Duas honestidades que o catálogo precisa manter:
 *
 * 1. Onde a consulta auditada NÃO reproduz o enunciado literal da metodologia, o
 *    campo `enunciado` vem nulo e a tela escreve que o texto não foi publicado. A
 *    alternativa — parafrasear e apresentar como citação — transformaria a leitura
 *    do auditor em fonte primária.
 * 2. Onde o painel ACRESCENTA uma premissa que o documento não tem (o aumento
 *    nominal de 2027, o vegetativo da tela), isso é dito no próprio enunciado. Um
 *    parâmetro de tela apresentado como regra do documento é a maneira mais rápida
 *    de contaminar uma conclusão.
 */

/** As sete famílias de regras da metodologia, com o que cada uma governa. */
export const FAMILIAS = Object.freeze([
  {
    chave: 'B',
    nome: 'Base de dados',
    n: 5,
    governa: 'de onde vem cada número e a que data ele se refere',
    onde: 'nucleo/csv.js',
  },
  {
    chave: 'E',
    nome: 'Estrutura da projeção',
    n: 8,
    governa: 'o que é realizado, o que é projetado e como os dois se somam',
    onde: 'nucleo/projecao2026.js',
  },
  {
    chave: 'R',
    nome: 'Reajustes',
    n: 5,
    governa: 'o reajuste geral, os aumentos específicos e as naturezas alcançadas',
    onde: 'nucleo/regras.js',
  },
  {
    chave: 'V',
    nome: 'Vegetativo',
    n: 2,
    governa: 'o crescimento histórico de cada linha e o teto que o corta',
    onde: 'nucleo/regras.js',
  },
  {
    chave: 'X',
    nome: 'Exceções',
    n: 5,
    governa: 'linha desligada, natureza de mediana e cesta que não se projeta',
    onde: 'nucleo/projecao2026.js',
  },
  {
    chave: 'D',
    nome: 'Exercício seguinte',
    n: 7,
    governa: 'a projeção de 2027, a âncora, o vegetativo e o 13º',
    onde: 'nucleo/projecao2027.js',
  },
  {
    chave: 'A',
    nome: 'Auditoria e conferência',
    n: 9,
    governa: 'as identidades que a carga tem de satisfazer para ser publicada',
    onde: 'nucleo/conferencia.js',
  },
]);

/**
 * As regras que este painel EXECUTA, com o lugar do código e a prova em tela.
 *
 * `prova` aponta para a aba onde o leitor confere o enunciado contra o número. Uma
 * regra sem prova em tela é uma afirmação, e o painel inteiro existe para não
 * produzir afirmações.
 */
export const REGRAS = Object.freeze([
  // ------------------------------------------------------- base de dados
  {
    codigo: 'B1',
    familia: 'B',
    titulo: 'Duas origens, duas datas',
    enunciado: null,
    resumo: 'A planilha de projeção e o relatório do SIAFIC são extrações de dias '
      + 'diferentes da mesma execução. Janeiro a julho têm de coincidir ao centavo; '
      + 'agosto e a dotação podem divergir por alteração orçamentária.',
    onde: 'nucleo/csv.js · casaOrigens',
    prova: 'cargaCsv',
    nota: 'A consulta publicava jan–ago de uma origem e a dotação de outra sem '
      + 'declarar a régua de nenhuma das duas.',
  },
  {
    codigo: 'B2',
    familia: 'B',
    titulo: 'Chave orçamentária de dez campos',
    enunciado: null,
    resumo: 'Órgão, UGE, UGR, unidade, ação, natureza, fonte, detalhamento, IDEX e '
      + 'marcador. Os nove códigos normalizam como inteiro; o marcador fica como '
      + 'texto, porque é ele que distingue a linha de mediana da linha comum na '
      + 'mesma natureza.',
    onde: 'nucleo/csv.js · chaveOrcamentaria',
    prova: 'cargaCsv',
    nota: 'A planilha perde o zero à esquerda e o relatório o mantém. Comparar '
      + 'texto com texto acha zero correspondências em mil linhas.',
  },
  {
    codigo: 'B5',
    familia: 'B',
    titulo: 'Cardinalidade um para um',
    enunciado: null,
    resumo: 'A carga PARA quando uma chave casa com mais de uma linha. Chave parcial '
      + 'faz o fator de crescimento incidir na linha errada, e prosseguir com o que '
      + 'casou é pior que não carregar.',
    onde: 'nucleo/csv.js · casaOrigens',
    prova: 'cargaCsv',
    nota: '',
  },

  // -------------------------------------------- estrutura e regras 5.1–5.5
  {
    codigo: 'E1',
    familia: 'E',
    titulo: 'Oito meses realizados, quatro projetados',
    enunciado: null,
    resumo: 'Janeiro a agosto são liquidação e não se movem sob nenhuma premissa. '
      + 'Setembro a dezembro são projeção. Toda premissa de 2026 só alcança quatro '
      + 'meses, e é por isso que o reajuste geral de maio não custa nada.',
    onde: 'nucleo/regras.js · primeiroMesProjetado',
    prova: 'simulacao',
    nota: '',
  },
  {
    codigo: '5.1',
    familia: 'X',
    titulo: 'Linha desligada',
    enunciado: 'Linhas com valores zerados em julho E agosto têm os meses '
      + 'projetados zerados.',
    resumo: 'É "e", não "ou". Um mês zerado sozinho é atraso de empenho; tratá-lo '
      + 'como desligamento apagaria a linha do exercício.',
    onde: 'nucleo/regras.js · ehDesligada',
    prova: 'projecao',
    nota: '252 das 1.023 linhas caem neste ramo, e elas continuam no exercício de '
      + '2027 valendo zero — não saem do conjunto.',
  },
  {
    codigo: '5.2',
    familia: 'X',
    titulo: 'Naturezas projetadas pela mediana',
    enunciado: 'Para as naturezas 3.1.90.16, 3.1.90.92 e 3.1.90.94, cada mês '
      + 'projetado recebe a mediana dos valores de janeiro a agosto.',
    resumo: 'Roda ANTES da composição, e por isso vence o critério que o documento '
      + 'atribui ao elemento: os elementos 16, 92 e 94 aparecem no quadro de '
      + 'critérios com uma régua e executam com outra.',
    onde: 'nucleo/projecao2026.js · ramo mediana',
    prova: 'projecao',
    nota: 'A mediana é flat de setembro a dezembro. Como agosto dessas linhas é '
      + 'excepcionalmente alto, é a queda delas que faz setembro ficar abaixo de '
      + 'agosto no total do Estado, num modelo em que a regra 5.3 só cresce.',
  },
  {
    codigo: '5.3',
    familia: 'E',
    titulo: 'Composição a partir de agosto',
    enunciado: 'valor(m) = valor(m−1) × (1 + min(cv_m, teto)) × (1 + reajuste) '
      + '× (1 + aumentos específicos)',
    resumo: 'O fator incide sobre o MÊS ANTERIOR PROJETADO — nunca sobre agosto '
      + 'repetido e nunca sobre o total do exercício. Cada linha compõe a sua '
      + 'própria cadeia de quatro passos.',
    onde: 'nucleo/projecao2026.js · ramo composicao',
    prova: 'projecao',
    nota: '',
  },
  {
    codigo: '5.4',
    familia: 'V',
    titulo: 'Coeficiente de variação e o teto',
    enunciado: 'O crescimento vegetativo mensal é o coeficiente de variação '
      + 'histórico da linha, limitado ao teto de 1,50%. Células em branco são '
      + 'tratadas como 9,99.',
    resumo: 'Branco NÃO é zero. Zero declarado afirma que a linha não cresce; branco '
      + 'afirma que não há histórico declarado, e o documento manda tratar como '
      + '9,99 — que o teto corta. São resultados opostos a partir da mesma célula.',
    onde: 'nucleo/regras.js · cvDoMes, CV_VAZIO',
    prova: 'projecao',
    nota: 'O teto morde em 1.219 meses-linha dos 4.092 projetados, e 13 desses '
      + 'são célula em branco.',
  },
  {
    codigo: '5.5',
    familia: 'E',
    titulo: '13º dentro de dezembro',
    enunciado: 'A provisão do 13º salário corresponde ao valor projetado de '
      + 'dezembro, nas naturezas 3.1.90.04, 11, 12, 13, 16 e 3.1.91.13.',
    resumo: 'O 13º é lançado DENTRO de dezembro, e não como décima terceira '
      + 'parcela. É por isso que dezembro vem cerca de cinquenta por cento acima '
      + 'dos vizinhos na série publicada.',
    onde: 'nucleo/projecao2026.js · t13',
    prova: 'projecao',
    nota: 'Separar dezembro puro da provisão é o que permite a regra D2 ancorar '
      + '2027 no mês certo. Somar os dois e ancorar no total inflaria 2027 inteiro.',
  },
  {
    codigo: 'E4',
    familia: 'E',
    titulo: 'Exercício = realizado + projetado',
    enunciado: null,
    resumo: 'O exercício de 2026 é a soma dos oito meses liquidados e dos quatro '
      + 'projetados, com o 13º já dentro de dezembro. A identidade é conferida e '
      + 'bloqueia a carga.',
    onde: 'nucleo/conferencia.js',
    prova: 'conferencia',
    nota: '',
  },
  {
    codigo: 'E6',
    familia: 'E',
    titulo: 'Crédito a abrir',
    enunciado: null,
    resumo: 'Projeção menos dotação atualizada. A consulta publicava só a leitura '
      + 'líquida do Estado inteiro, em que sobra de um Poder cobre falta de outro — '
      + 'o que orçamentariamente não acontece.',
    onde: 'nucleo/agregacao.js · creditoAAbrir',
    prova: 'abertura',
    nota: 'As três leituras diferem em mais de um bilhão e oitocentos milhões.',
  },
  {
    codigo: 'E8',
    familia: 'E',
    titulo: 'Agregação que fecha',
    enunciado: null,
    resumo: 'Toda agregação percorre a mesma lista de linhas, devolve o total '
      + 'percorrido junto com os grupos e publica o resíduo entre os dois. Chave sem '
      + 'classificação vai para um balde explícito.',
    onde: 'nucleo/agregacao.js · agrega',
    prova: 'conferencia',
    nota: 'É a regra que o quadro 28 da consulta violava em R$ 1.385,0 mi.',
  },

  // -------------------------------------------------------------- reajustes
  {
    codigo: 'R1',
    familia: 'R',
    titulo: 'Reajuste geral com mês de vigência',
    enunciado: 'Reajuste geral de 5,00% com vigência em maio de 2026.',
    resumo: 'Maio é mês JÁ REALIZADO. O reajuste já está dentro do liquidado e não '
      + 'incide sobre nenhum dos quatro meses projetados: a premissa é DORMENTE.',
    onde: 'nucleo/projecao2026.js · reaj',
    prova: 'simulacao',
    nota: 'O contador de meses-linha alcançados pelo reajuste é zero. Deslocar a '
      + 'vigência para setembro revela o custo que a premissa esconde.',
  },
  {
    codigo: 'R2',
    familia: 'R',
    titulo: 'Naturezas alcançadas pelo reajuste',
    enunciado: null,
    resumo: 'O reajuste geral alcança 3.1.90.04, 11, 13, 16 e 3.1.91.13 — '
      + 'vencimentos e o que os acompanha. Não alcança aposentadorias, pensões, '
      + 'auxílios nem a cesta de exercícios anteriores.',
    onde: 'nucleo/regras.js · NAT_REAJUSTE',
    prova: 'simulacao',
    nota: '',
  },
  {
    codigo: 'R4',
    familia: 'R',
    titulo: 'Aumentos específicos por trio',
    enunciado: null,
    resumo: 'Quatro aumentos declarados, cada um amarrado a um trio de órgão, '
      + 'unidade e natureza, com mês próprio de vigência. Três vigoram em outubro; '
      + 'um vigora em agosto, mês já realizado.',
    onde: 'nucleo/regras.js · especificos',
    prova: 'simulacao',
    nota: 'Quatro DECLARADOS, três APLICADOS. A consulta contava os quatro como '
      + 'aplicados. Os três de outubro são aritmeticamente necessários: sem eles '
      + 'outubro não alcança o valor publicado, porque ele cresce mais que o teto.',
  },
  {
    codigo: 'R5',
    familia: 'R',
    titulo: 'Composição multiplicativa dos fatores',
    enunciado: null,
    resumo: 'Vegetativo, reajuste geral e específicos se compõem por produto, não '
      + 'por soma. Num mês com teto cheio e específico de 3,50% o fator é 1,0150 × '
      + '1,0350, e não 1,0500.',
    onde: 'nucleo/projecao2026.js · f',
    prova: 'projecao',
    nota: '',
  },

  // ------------------------------------------------------------ vegetativo
  {
    codigo: 'V1',
    familia: 'V',
    titulo: 'Teto mensal de 1,50%',
    enunciado: null,
    resumo: 'O teto é por MÊS-LINHA, e não por linha nem por exercício. A resposta '
      + 'do exercício ao teto não é linear: cada linha só passa a sentir o teto a '
      + 'partir do ponto em que ele corta o histórico dela.',
    onde: 'nucleo/sensibilidade.js · curva',
    prova: 'simulacao',
    nota: '',
  },
  {
    codigo: 'V2',
    familia: 'V',
    titulo: 'Vegetativo não é sazonalidade',
    enunciado: null,
    resumo: 'A continuação sazonal a taxa declarada é outra leitura, publicada ao '
      + 'lado. Ela não enxerga teto, mediana nem desligamento, e por construção '
      + 'fica abaixo do modelo da DOE.',
    onde: 'nucleo/comparacao.js · vegetativoDaTela',
    prova: 'metodos',
    nota: 'É premissa DA TELA, não do documento.',
  },

  // ------------------------------------------------------- exercício de 2027
  {
    codigo: 'D1',
    familia: 'D',
    titulo: 'Não partir da média de 2026',
    enunciado: 'A projeção de 2027 não deve utilizar a média do exercício de 2026 '
      + 'como base.',
    resumo: 'É princípio, e não se executa: o código o obedece por construção. Em '
      + 'lugar nenhum existe uma média de 2026 multiplicada por doze, salvo na cesta '
      + 'D4, onde o documento manda exatamente isso.',
    onde: 'nucleo/projecao2027.js',
    prova: 'ano2027',
    nota: '',
  },
  {
    codigo: 'D2',
    familia: 'D',
    titulo: 'Âncora: dezembro de 2026 projetado',
    enunciado: 'O mês de referência para 2027 é dezembro de 2026 projetado.',
    resumo: 'Sem a provisão do 13º. Ancorar no dezembro publicado — que já leva o '
      + '13º dentro — inflaria os doze meses de 2027 em cerca de quarenta e quatro '
      + 'por cento da provisão a cada mês.',
    onde: 'nucleo/projecao2027.js · ancora',
    prova: 'ano2027',
    nota: 'Ancorar em dezembro e não na média é a decisão que responde por quase '
      + 'nove décimos do crescimento de 2027. É o efeito-base.',
  },
  {
    codigo: 'D3',
    familia: 'D',
    titulo: 'Doze meses encadeados',
    enunciado: null,
    resumo: 'Cada mês de 2027 vale a âncora corrigida pelo fator acumulado do mês. '
      + 'A cadeia é da linha, não do agregado.',
    onde: 'nucleo/projecao2027.js · fd2027Linha',
    prova: 'ano2027',
    nota: '',
  },
  {
    codigo: 'D4',
    familia: 'D',
    titulo: 'Cesta que não se projeta',
    enunciado: 'Para os elementos 91 a 94, cada mês de 2027 corresponde à média do '
      + 'exercício de 2026.',
    resumo: 'Sentenças judiciais, exercícios anteriores e indenizações. Nenhum fator '
      + 'de vegetativo as alcança, e o ano vale a média de 2026 × 12.',
    onde: 'nucleo/projecao2027.js · classe d4',
    prova: 'ano2027',
    nota: 'É a única passagem em que a média de 2026 é usada, e é o documento que '
      + 'manda usá-la. Fora dela, D1 proíbe.',
  },
  {
    codigo: 'D5',
    familia: 'D',
    titulo: '13º de 2027',
    enunciado: 'A provisão do 13º de 2027 corresponde a 90% de dezembro para os '
      + 'ativos e 95% para inativos e RPPS.',
    resumo: 'Dentro de dezembro, como em 2026. Os fatores diferem porque a base de '
      + 'cálculo do inativo é mais estável ao longo do ano.',
    onde: 'nucleo/projecao2027.js · t13',
    prova: 'ano2027',
    nota: '',
  },
  {
    codigo: 'D6',
    familia: 'D',
    titulo: 'Vegetativo de 2027',
    enunciado: 'Crescimento vegetativo de 1,50% para ativos e 0,50% para inativos '
      + 'e RPPS.',
    resumo: 'O enunciado traz o percentual e NÃO diz o período. Lido como taxa ao '
      + 'ano, o fator do mês k é (1+v)^(k/12). Lido ao mês, compõe 19,56% no ano.',
    onde: 'nucleo/projecao2027.js · fatorD6',
    prova: 'ano2027',
    nota: 'A distância entre as duas leituras do MESMO enunciado é de R$ 3,88 bi — '
      + 'maior que o crédito a abrir do exercício corrente. As duas rodam sempre, e '
      + 'a leitura publicada é a anual, porque vegetativo de folha é taxa de ano.',
  },
  {
    codigo: 'D7',
    familia: 'D',
    titulo: 'Aumento nominal de 2027',
    enunciado: null,
    resumo: 'Não consta do documento. É parâmetro declarado DESTE painel, com mês '
      + 'de vigência, e nasce em zero: nenhum número publicado o contém.',
    onde: 'nucleo/regras.js · aumentoNominal27',
    prova: 'simulacao',
    nota: 'Existe porque a decisão de 2027 ainda não foi tomada, e o painel precisa '
      + 'responder quanto custa um ponto antes de a premissa ser fixada.',
  },

  // ------------------------------------------------------------- auditoria
  {
    codigo: 'A1',
    familia: 'A',
    titulo: 'Rastro até a linha',
    enunciado: null,
    resumo: 'Todo número da tela se abre até a linha orçamentária que o produziu, '
      + 'com a cadeia de agosto de 2026 a dezembro de 2027 e o fator de cada passo.',
    onde: 'nucleo/projecao2027.js · cadeiaDaLinha',
    prova: 'projecao',
    nota: '',
  },
  {
    codigo: 'A4',
    familia: 'A',
    titulo: 'A conferência trava a carga',
    enunciado: 'A conferência trava a carga se a maior diferença passar de um real.',
    resumo: 'As identidades internas são bloqueantes: a carga não publica indicador '
      + 'enquanto alguma não fechar. Aderência e distância entre fontes não '
      + 'bloqueiam, porque divergir do publicado é o que se quer MEDIR.',
    onde: 'nucleo/conferencia.js · TOL_INTERNA',
    prova: 'conferencia',
    nota: 'Um real é um real porque os valores circulam em reais no sistema inteiro. '
      + 'Se circulassem em milhões, a mesma constante seria uma tolerância de um '
      + 'milhão de reais.',
  },
  {
    codigo: 'A9',
    familia: 'A',
    titulo: 'Ancestral único',
    enunciado: null,
    resumo: 'Uma chamada de carga por mudança de premissa ou de recorte, e todas as '
      + 'abas leem o mesmo objeto. Nenhuma aba recalcula nada.',
    onde: 'nucleo/carga.js · montaCarga',
    prova: 'conferencia',
    nota: 'Dois números diferentes para a mesma grandeza exigiriam dois cálculos '
      + 'diferentes, e só existe um. É a correção estrutural do caso dos quadros '
      + '13 e 22.',
  },
]);

export const GRAVIDADES = Object.freeze({
  defeito: {
    rotulo: 'Defeito',
    nota: 'Número publicado que não fecha. Corrigido nesta reimplementação.',
  },
  regua: {
    rotulo: 'Erro de régua',
    nota: 'Conta certa, rótulo errado: duas grandezas diferentes publicadas com o '
      + 'mesmo nome.',
  },
  leitura: {
    rotulo: 'Ambiguidade de enunciado',
    nota: 'O documento admite duas leituras e a consulta publica uma sem dizer que '
      + 'escolheu.',
  },
  omissao: {
    rotulo: 'Omissão material',
    nota: 'O número está certo e a informação que o torna interpretável não foi '
      + 'publicada.',
  },
});

/**
 * O que a auditoria encontrou, e o que esta reimplementação faz a respeito.
 *
 * Cada achado aponta para a aba onde o leitor confere a correção. Um achado sem
 * lugar de conferência seria mais uma afirmação não verificável, que é o problema
 * de origem.
 */
export const DIVERGENCIAS = Object.freeze([
  {
    chave: 'quadro28',
    gravidade: 'defeito',
    titulo: 'As agregações do quadro 28 não fecham com o exercício do mesmo quadro',
    achado: 'Três agregações do quadro somavam R$ 46.584,5 mi contra um exercício de '
      + 'R$ 47.969,5 mi publicado no mesmo quadro. Faltavam R$ 1.385,0 mi, e nada no '
      + 'quadro acusava: a diferença cabia no arredondamento da apresentação.',
    causa: 'Linhas cuja chave de agrupamento não casa com nenhum balde declarado '
      + 'desaparecem da soma em silêncio.',
    correcao: 'Toda agregação devolve o total percorrido junto com os grupos, manda '
      + 'chave não classificada para um balde explícito e publica o resíduo. A '
      + 'conferência interna trava a carga se o resíduo passar de um real.',
    onde: 'nucleo/agregacao.js',
    prova: 'conferencia',
    regras: ['E8', 'A4'],
  },
  {
    chave: 'executivo',
    gravidade: 'defeito',
    titulo: 'Duas projeções do Executivo com o mesmo rótulo',
    achado: 'O quadro 13 publicava R$ 24.681,0 mi e o quadro 22 publicava '
      + 'R$ 24.771,0 mi, ambos rotulados como projeção de 2026 do Poder Executivo. '
      + 'A diferença é de R$ 90,0 mi.',
    causa: 'Dois ancestrais: o arquivo de premissas de 31/08 e a carga de 25/09. '
      + 'Nenhum dos dois quadros declarava a sua régua.',
    correcao: 'Ancestral único. Uma chamada de carga por premissa e por recorte, e '
      + 'todas as abas leem o mesmo objeto — dois números diferentes para a mesma '
      + 'grandeza passam a exigir dois cálculos diferentes, e só existe um.',
    onde: 'nucleo/carga.js',
    prova: 'conferencia',
    regras: ['A9'],
  },
  {
    chave: 'credito',
    gravidade: 'regua',
    titulo: 'O crédito publicado é o líquido do Estado inteiro',
    achado: 'A consulta pede R$ 2.974,1 mi. A soma das faltas de quem está de fato '
      + 'descoberto é de R$ 4.381,3 mi por Poder e de R$ 4.843,6 mi por unidade '
      + 'orçamentária.',
    causa: 'A leitura líquida subtrai a sobra de quem está coberto da falta de quem '
      + 'não está. Orçamentariamente a sobra de um Poder não cobre a falta de outro.',
    correcao: 'As três leituras são publicadas lado a lado, com a lista das 71 '
      + 'unidades descobertas e a sobra de R$ 1.407,2 mi que não é transferível.',
    onde: 'nucleo/agregacao.js · creditoAAbrir',
    prova: 'abertura',
    regras: ['E6'],
  },
  {
    chave: 'd6',
    gravidade: 'leitura',
    titulo: 'O vegetativo de 2027 não declara o período',
    achado: 'O enunciado de D6 traz 1,50% e 0,50% sem dizer se é ao mês ou ao ano. '
      + 'Lido ao ano, 2027 custa R$ 50.307,7 mi; lido ao mês, R$ 54.188,1 mi.',
    causa: 'Ambiguidade do enunciado. A diferença entre as duas leituras da mesma '
      + 'frase é de R$ 3.880,4 mi — mais que o crédito a abrir do exercício corrente.',
    correcao: 'As duas leituras rodam sempre e aparecem lado a lado. A publicada é '
      + 'a anual, com a razão declarada: vegetativo de folha é taxa de ano, porque é '
      + 'o que progressões, promoções e anuênios acrescentam em doze meses.',
    onde: 'nucleo/projecao2027.js · fatorD6',
    prova: 'ano2027',
    regras: ['D6'],
  },
  {
    chave: 'crescimento27',
    gravidade: 'omissao',
    titulo: 'O crescimento de 2027 é atribuído ao vegetativo',
    achado: 'Dos R$ 2.915,1 mi de crescimento de 2027 sobre 2026, R$ 2.583,0 mi '
      + '(88,6%) vêm de ancorar em dezembro em vez de na média do ano, e só '
      + 'R$ 332,1 mi (11,4%) vêm do vegetativo de D6.',
    causa: 'A consulta publicava os dois exercícios lado a lado e nada entre eles. '
      + 'A discussão orçamentária se concentrava no décimo menor.',
    correcao: 'A decomposição roda sempre: 2027 é reprojetado com vegetativo e '
      + 'nominal em zero, e o que sobra de diferença contra 2026 é o efeito-base.',
    onde: 'nucleo/projecao2027.js · decompoeCrescimento2027',
    prova: 'ano2027',
    regras: ['D2'],
  },
  {
    chave: 'reajuste',
    gravidade: 'omissao',
    titulo: 'O reajuste geral de 5,00% é premissa dormente',
    achado: 'A vigência declarada é maio de 2026, mês já liquidado. O reajuste não '
      + 'incide sobre nenhum dos quatro meses projetados: o contador de meses-linha '
      + 'alcançados é zero.',
    causa: 'A premissa é publicada como se governasse o resultado. Ela já está '
      + 'dentro do realizado, e a projeção não a vê.',
    correcao: 'O contador de alcance é publicado junto com a premissa, e a '
      + 'sensibilidade mede o custo de deslocar a vigência para o primeiro mês em '
      + 'aberto — que é onde a dormência aparece como número.',
    onde: 'nucleo/sensibilidade.js · caso mesReajuste',
    prova: 'simulacao',
    regras: ['R1'],
  },
  {
    chave: 'especificos',
    gravidade: 'defeito',
    titulo: 'Quatro aumentos específicos declarados, três aplicados',
    achado: 'A consulta conta os quatro como aplicados. O quarto vigora em agosto, '
      + 'mês já realizado, e não alcança nenhum mês projetado.',
    causa: 'O contador publicado mistura premissa declarada com premissa aplicada.',
    correcao: 'Os dois contadores são publicados separados: declarados e aplicados. '
      + 'Uma premissa só conta como declarada se existir linha no trio de órgão, '
      + 'unidade e natureza — a carga falha se um trio declarado não tiver linha.',
    onde: 'nucleo/projecao2026.js · memoria',
    prova: 'simulacao',
    regras: ['R4'],
  },
  {
    chave: 'elemento',
    gravidade: 'regua',
    titulo: 'Três elementos executam com régua diferente da publicada',
    achado: 'Os elementos 16, 92 e 94 recebem no quadro de critérios a régua de base '
      + 'geral ou de orçamento atualizado, e executam pela mediana de janeiro a '
      + 'agosto.',
    causa: 'As naturezas 319016, 319092 e 319094 estão na lista da regra 5.2, que '
      + 'roda antes da composição e vence o critério do elemento.',
    correcao: 'As duas colunas são publicadas lado a lado: o critério que o '
      + 'documento atribui e o ramo que a linha de fato executou.',
    onde: 'nucleo/agregacao.js · CRITERIO_DO_DOCUMENTO',
    prova: 'projecao',
    regras: ['5.2'],
  },
  {
    chave: 'contadores',
    gravidade: 'omissao',
    titulo: 'O quadro 28 publica 771 linhas de um modelo de 1.023',
    achado: 'O quadro publica 719 ativos e 52 inativos. Somam 771, que é 1.023 menos '
      + 'as 252 linhas desligadas pela regra 5.1.',
    causa: 'O denominador é o das linhas VIVAS e não é declarado. Quem soma as duas '
      + 'linhas do quadro conclui que o modelo tem 771 linhas.',
    correcao: 'Os contadores são publicados com o denominador explícito, e a '
      + 'conferência verifica que os ramos de 2026 e as classes de 2027 particionam '
      + 'as 1.023 linhas.',
    onde: 'nucleo/projecao2027.js · memoria',
    prova: 'conferencia',
    regras: ['5.1'],
  },
]);

/** Índice de regra por código, para as abas que citam uma regra pelo nome. */
export const REGRA_POR_CODIGO = Object.freeze(Object.fromEntries(
  REGRAS.map((r) => [r.codigo, r]),
));
