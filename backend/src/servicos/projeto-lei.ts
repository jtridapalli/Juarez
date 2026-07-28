import { centavos, formatarBRL } from '../lib/money.js';
import type { OrcamentoSnapshot } from '../dominio/tipos.js';
import { totalizacoes } from './anexos.js';

const UNIDADES = ['', 'mil', 'milhao', 'bilhao', 'trilhao'];
const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const DEZ_A_DEZENOVE = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const UM_A_NOVE = ['', 'um', 'dois', 'tres', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];

function grupoEmPalavras(n: number): string {
  const centena = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];

  if (centena === 1 && resto === 0) partes.push('cem');
  else if (centena > 0) partes.push(CENTENAS[centena]);

  if (resto >= 10 && resto < 20) partes.push(DEZ_A_DEZENOVE[resto - 10]);
  else {
    const dezena = Math.floor(resto / 10);
    const unidade = resto % 10;
    if (dezena > 0) partes.push(DEZENAS[dezena]);
    if (unidade > 0) partes.push(UM_A_NOVE[unidade]);
  }
  return partes.join(' e ');
}

/** Converte um valor monetario para a forma escrita usada no texto da lei. */
export function valorEmPalavras(valor: number): string {
  const inteiro = Math.floor(Math.abs(valor));
  const centavosValor = Math.round((Math.abs(valor) - inteiro) * 100);

  if (inteiro === 0 && centavosValor === 0) return 'zero real';

  const grupos: number[] = [];
  let restante = inteiro;
  while (restante > 0) {
    grupos.push(restante % 1000);
    restante = Math.floor(restante / 1000);
  }

  const partes: string[] = [];
  for (let i = grupos.length - 1; i >= 0; i -= 1) {
    const grupo = grupos[i];
    if (grupo === 0) continue;
    const texto = grupoEmPalavras(grupo);
    if (i === 0) partes.push(texto);
    else if (i === 1) partes.push(`${grupo === 1 ? '' : `${texto} `}mil`.trim());
    else {
      const escala = UNIDADES[i];
      const plural = escala.replace('ao', 'oes');
      partes.push(`${texto} ${grupo === 1 ? escala : plural}`);
    }
  }

  const reais = `${partes.join(' e ')} ${inteiro === 1 ? 'real' : 'reais'}`;
  if (centavosValor === 0) return reais;
  return `${reais} e ${grupoEmPalavras(centavosValor)} ${centavosValor === 1 ? 'centavo' : 'centavos'}`;
}

export interface TextoProjetoLei {
  ementa: string;
  artigos: { numero: string; caput: string; incisos?: string[] }[];
  texto: string;
}

/**
 * Gera o texto do Projeto de Lei Orcamentaria Anual a partir dos valores
 * consolidados, na estrutura usualmente adotada pelo Estado do Parana.
 */
export function gerarProjetoLei(o: OrcamentoSnapshot): TextoProjetoLei {
  const t = totalizacoes(o);
  const fiscal = t.porEsfera.find((e) => e.esfera === 'F') ?? { receita: 0, despesa: 0 };
  const seguridade = t.porEsfera.find((e) => e.esfera === 'S') ?? { receita: 0, despesa: 0 };
  const reais = (v: number) => `R$ ${formatarBRL(v)} (${valorEmPalavras(v)})`;

  const ementa = `Estima a receita e fixa a despesa do Estado do Parana para o exercicio financeiro de ${o.exercicio}.`;

  const artigos = [
    {
      numero: 'Art. 1o',
      caput: `Esta Lei estima a receita e fixa a despesa do Estado do Parana para o exercicio financeiro de ${o.exercicio}, compreendendo o Orcamento Fiscal e o Orcamento da Seguridade Social, nos termos do art. 165, §5o, da Constituicao Federal e do art. 133 da Constituicao do Estado do Parana.`,
    },
    {
      numero: 'Art. 2o',
      caput: `A receita total e estimada em ${reais(t.receitaTotal)}, desdobrada na forma dos anexos desta Lei, sendo:`,
      incisos: [
        `I - receitas correntes, no valor de ${reais(t.receitasCorrentes)};`,
        `II - receitas de capital, no valor de ${reais(t.receitasCapital)};`,
        `III - deducoes da receita corrente, no valor de ${reais(Math.abs(t.deducoesReceita))}.`,
      ],
    },
    {
      numero: 'Art. 3o',
      caput: `A despesa total e fixada em ${reais(t.despesaTotal)}, em igual valor a receita estimada, assim distribuida:`,
      incisos: [
        `I - despesas correntes, no valor de ${reais(t.despesasCorrentes)};`,
        `II - despesas de capital, no valor de ${reais(t.despesasCapital)};`,
        `III - reserva de contingencia, no valor de ${reais(t.reservaContingencia)}.`,
      ],
    },
    {
      numero: 'Art. 4o',
      caput: `O Orcamento Fiscal e fixado em ${reais(fiscal.despesa)} e o Orcamento da Seguridade Social em ${reais(seguridade.despesa)}, observado o disposto no art. 195, §1o, da Constituicao Federal quanto ao aporte de recursos do Orcamento Fiscal necessario ao equilibrio da seguridade social, no valor de ${reais(centavos(seguridade.despesa - seguridade.receita))}.`,
    },
    {
      numero: 'Art. 5o',
      caput: `A reserva de contingencia, no valor de ${reais(t.reservaContingencia)}, destina-se ao atendimento de passivos contingentes e de outros riscos e eventos fiscais imprevistos, na forma do art. 5o, III, b, da Lei Complementar Federal 101, de 4 de maio de 2000.`,
    },
    {
      numero: 'Art. 6o',
      caput: 'Fica o Poder Executivo autorizado a abrir creditos suplementares, mediante decreto, utilizando como fontes os recursos previstos no art. 43 da Lei Federal 4.320, de 17 de marco de 1964, ate os limites e nas condicoes estabelecidos na Lei de Diretrizes Orcamentarias.',
    },
    {
      numero: 'Art. 7o',
      caput: 'Fica o Poder Executivo autorizado a proceder as alteracoes de fontes de recursos, de modalidade de aplicacao e de elemento de despesa necessarias a execucao orcamentaria, sem alteracao do valor total de cada acao, observada a legislacao vigente.',
    },
    {
      numero: 'Art. 8o',
      caput: `As despesas com pessoal e encargos sociais, fixadas em ${reais(t.despesaPessoal)}, observam os limites estabelecidos nos arts. 19 e 20 da Lei Complementar Federal 101, de 4 de maio de 2000.`,
    },
    {
      numero: 'Art. 9o',
      caput: 'Esta Lei entra em vigor em 1o de janeiro do exercicio a que se refere.',
    },
  ];

  const linhas: string[] = [
    'GOVERNO DO ESTADO DO PARANA',
    '',
    `PROJETO DE LEI ORCAMENTARIA ANUAL - EXERCICIO DE ${o.exercicio}`,
    '',
    ementa.toUpperCase(),
    '',
    'A Assembleia Legislativa do Estado do Parana decretou e eu promulgo, nos termos do §7o do art. 71 da Constituicao Estadual, a seguinte Lei:',
    '',
  ];

  for (const artigo of artigos) {
    linhas.push(`${artigo.numero} ${artigo.caput}`);
    if (artigo.incisos) {
      linhas.push('');
      for (const inciso of artigo.incisos) linhas.push(inciso);
    }
    linhas.push('');
  }

  linhas.push('Curitiba, em __ de __________ de ____.');
  linhas.push('');
  linhas.push('Governador do Estado do Parana');
  linhas.push('Secretario de Estado da Fazenda');
  linhas.push('Secretario de Estado do Planejamento');
  linhas.push('');
  linhas.push('---');
  linhas.push(`Quantitativos consolidados: ${t.quantidadeUnidades} unidades orcamentarias e ${t.quantidadeDotacoes} dotacoes.`);

  return { ementa, artigos, texto: linhas.join('\n') };
}
