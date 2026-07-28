/** Estruturas de leitura usadas pelo motor de validacao e pelos relatorios. */

export type Esfera = 'F' | 'S' | 'I';

export interface ReceitaItem {
  id: number;
  natureza: string;
  naturezaNome: string;
  categoria: string;
  origem: string;
  especie: string;
  deducao: boolean;
  fonte: string;
  fonteNome: string;
  fonteOrigem: string;
  fonteVinculacao: string | null;
  esfera: string;
  valor: number;
}

export interface DotacaoItem {
  id: number;
  unidade: string;
  unidadeNome: string;
  unidadeSigla: string;
  orgao: string;
  orgaoNome: string;
  orgaoSigla: string;
  poder: string;
  funcao: string;
  funcaoNome: string;
  subfuncao: string;
  subfuncaoNome: string;
  programa: string;
  programaNome: string;
  programaPpaFim: number;
  programaAtivo: boolean;
  acao: string;
  acaoNome: string;
  acaoTipo: string;
  subtitulo: string;
  esfera: string;
  categoria: string;
  grupo: string;
  grupoNome: string;
  modalidade: string;
  modalidadeNome: string;
  elemento: string;
  elementoNome: string;
  elementoGrupos: string;
  fonte: string;
  fonteNome: string;
  fonteOrigem: string;
  fonteVinculacao: string | null;
  rp: string;
  valor: number;
  propostaStatus: string;
}

export interface LimiteItem {
  unidade: string;
  unidadeNome: string;
  escopo: string;
  valor: number;
}

export interface EmendaItem {
  numero: string;
  autor: string;
  valor: number;
  status: string;
}

export interface OrcamentoSnapshot {
  exercicio: number;
  parametros: Record<string, number>;
  receitas: ReceitaItem[];
  dotacoes: DotacaoItem[];
  limites: LimiteItem[];
  emendas: EmendaItem[];
}

export type Severidade = 'ERRO' | 'ALERTA' | 'INFO';

export interface ResultadoRegra {
  regra: string;
  titulo: string;
  severidade: Severidade;
  aprovado: boolean;
  mensagem: string;
  fundamento?: string;
  valorApurado?: number;
  valorReferencia?: number;
  detalhes?: unknown;
}
