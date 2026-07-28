export const EXERCICIO = 2027;

const CHAVE_TOKEN = 'loa2027.token';

export function obterToken(): string | null {
  return localStorage.getItem(CHAVE_TOKEN);
}

export function guardarToken(token: string | null) {
  if (token) localStorage.setItem(CHAVE_TOKEN, token);
  else localStorage.removeItem(CHAVE_TOKEN);
}

export class ErroApi extends Error {
  constructor(
    readonly status: number,
    mensagem: string,
    readonly detalhes?: unknown,
  ) {
    super(mensagem);
  }
}

async function requisicao<T>(caminho: string, opcoes: RequestInit = {}): Promise<T> {
  const token = obterToken();
  const resposta = await fetch(`/api${caminho}`, {
    ...opcoes,
    headers: {
      // O cabecalho de tipo so acompanha requisicoes que efetivamente enviam corpo.
      ...(opcoes.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opcoes.headers ?? {}),
    },
  });

  if (resposta.status === 204) return undefined as T;

  const tipo = resposta.headers.get('content-type') ?? '';
  const corpo = tipo.includes('application/json') ? await resposta.json() : await resposta.text();

  if (!resposta.ok) {
    const mensagem = typeof corpo === 'object' && corpo !== null && 'erro' in corpo ? String(corpo.erro) : 'Falha na comunicacao com a API.';
    const detalhes = typeof corpo === 'object' && corpo !== null && 'detalhes' in corpo ? corpo.detalhes : undefined;
    throw new ErroApi(resposta.status, mensagem, detalhes);
  }
  return corpo as T;
}

export const api = {
  get: <T>(caminho: string) => requisicao<T>(caminho),
  post: <T>(caminho: string, corpo?: unknown) =>
    requisicao<T>(caminho, { method: 'POST', body: corpo === undefined ? undefined : JSON.stringify(corpo) }),
  put: <T>(caminho: string, corpo: unknown) => requisicao<T>(caminho, { method: 'PUT', body: JSON.stringify(corpo) }),
  delete: <T>(caminho: string) => requisicao<T>(caminho, { method: 'DELETE' }),
};

/** Endereco absoluto usado nos downloads de anexos. */
export function enderecoDownload(caminho: string): string {
  return `/api${caminho}`;
}

// ---------------------------------------------------------------------------
// Tipos das respostas da API
// ---------------------------------------------------------------------------

export interface Usuario {
  id: number;
  nome: string;
  email: string;
  perfil: 'ADMIN' | 'ORGAO_CENTRAL' | 'UNIDADE_ORCAMENTARIA' | 'CONTROLE_INTERNO' | 'CONSULTA';
  unidade: { codigo: string; nome: string } | null;
}

export interface Totais {
  receitaTotal: number;
  despesaTotal: number;
  diferenca: number;
  receitasCorrentes: number;
  receitasCapital: number;
  deducoesReceita: number;
  despesasCorrentes: number;
  despesasCapital: number;
  reservaContingencia: number;
  despesaPessoal: number;
  porFuncao: { codigo: string; nome: string; valor: number }[];
  porOrgao: { codigo: string; sigla: string; nome: string; valor: number }[];
  porGrupo: { codigo: string; nome: string; valor: number }[];
  porFonte: { codigo: string; nome: string; valor: number }[];
  porEsfera: { esfera: string; receita: number; despesa: number }[];
  quantidadeDotacoes: number;
  quantidadeUnidades: number;
}

export interface Painel {
  exercicio: { ano: number; status: string; ppaInicio: number; ppaFim: number; dataLimiteUO: string | null; dataEnvioAlep: string | null };
  parametros: Record<string, number>;
  totais: Totais;
  propostas: { status: string; quantidade: number }[];
  ultimaValidacao: { id: number; executadaEm: string; totalErros: number; totalAlertas: number; totalRegras: number; aprovado: boolean } | null;
  ultimaConsolidacao: { id: number; versao: number; geradaEm: string; hash: string; equilibrada: boolean; validacaoOk: boolean } | null;
}

export interface ResultadoValidacao {
  regra: string;
  titulo: string;
  severidade: 'ERRO' | 'ALERTA' | 'INFO';
  aprovado: boolean;
  mensagem: string;
  fundamento: string | null;
  valorApurado: number | null;
  valorReferencia: number | null;
  detalhes: unknown;
}

export interface RelatorioValidacao {
  execucaoId?: number;
  exercicio: number;
  executadaEm: string;
  totalRegras: number;
  totalErros: number;
  totalAlertas: number;
  aprovado: boolean;
  resultados: ResultadoValidacao[];
}

export interface Receita {
  id: number;
  natureza: { codigo: string; nome: string; categoria: string; deducao: boolean };
  fonte: { codigo: string; nome: string };
  esfera: string;
  valor: number;
  memoriaCalculo: string | null;
}

export interface Dotacao {
  id: number;
  propostaId: number;
  propostaStatus: string;
  unidade: { codigo: string; sigla: string; nome: string };
  orgao: { codigo: string; sigla: string };
  funcao: { codigo: string; nome: string };
  subfuncao: { codigo: string; nome: string };
  programa: { codigo: string; nome: string };
  acao: { codigo: string; nome: string; tipo: string };
  subtitulo: string;
  localizador: string | null;
  esfera: string;
  natureza: string;
  grupo: { codigo: string; nome: string };
  modalidade: { codigo: string; nome: string };
  elemento: { codigo: string; nome: string };
  fonte: { codigo: string; nome: string };
  rp: string;
  valor: number;
  justificativa: string | null;
}

export interface PaginaDotacoes {
  total: number;
  somaValor: number;
  pagina: number;
  porPagina: number;
  itens: Dotacao[];
}

export interface Proposta {
  id: number;
  status: string;
  versao: number;
  enviadaEm: string | null;
  analisadaEm: string | null;
  parecer: string | null;
  unidade: { id: number; codigo: string; sigla: string; nome: string };
  orgao: { codigo: string; sigla: string; poder: string };
  quantidadeDotacoes: number;
  total: number;
  teto: number | null;
  saldoTeto: number | null;
}

export interface Limite {
  id: number;
  unidade: { codigo: string; sigla: string; nome: string };
  orgao: { codigo: string; sigla: string };
  escopo: string;
  valor: number;
  proposto: number;
  saldo: number;
  utilizacao: number;
  observacao: string | null;
}

export interface Anexo {
  codigo: string;
  titulo: string;
  formatos: string[];
}

export interface TabelaAnexo {
  codigo: string;
  titulo: string;
  fundamento?: string;
  colunas: { chave: string; titulo: string; tipo: 'texto' | 'moeda' | 'numero' }[];
  linhas: Record<string, string | number>[];
}

export interface Consolidacao {
  id: number;
  versao: number;
  geradaEm: string;
  geradaPor: string | null;
  receitaTotal: number;
  despesaTotal: number;
  fiscalDespesa: number;
  seguridadeDespesa: number;
  equilibrada: boolean;
  validacaoOk: boolean;
  hash: string;
  resumo: { quantidadeDotacoes: number; quantidadeUnidades: number; validacao: { erros: number; alertas: number } } | null;
}

export interface Emenda {
  id: number;
  numero: string;
  autor: string;
  tipo: string;
  objeto: string;
  municipio: string | null;
  valor: number;
  status: string;
  unidade: { codigo: string; sigla: string };
  acao: { codigo: string; nome: string } | null;
}

export interface RegistroAuditoria {
  id: number;
  acao: string;
  entidade: string;
  entidadeId: string | null;
  detalhes: unknown;
  criadoEm: string;
  usuario: { nome: string; email: string; perfil: string } | null;
}

export interface Orgao {
  codigo: string;
  sigla: string;
  nome: string;
  poder: string;
  tipoAdministracao: string;
  unidades: { id: number; codigo: string; sigla: string; nome: string }[];
}

export interface Programa {
  id: number;
  codigo: string;
  nome: string;
  tipo: string;
  objetivo: string | null;
  publicoAlvo: string | null;
  ppaInicio: number;
  ppaFim: number;
  ativo: boolean;
  acoes: { id: number; codigo: string; nome: string; tipo: string; produto: string | null; unidadeMedida: string | null; metaFisica: number | null }[];
}

export interface Fonte {
  id: number;
  codigo: string;
  nome: string;
  tipo: string;
  vinculacao: string | null;
  origem: string;
}

export interface NaturezasDespesa {
  grupos: { id: number; codigo: string; nome: string; categoria: string }[];
  modalidades: { id: number; codigo: string; nome: string }[];
  elementos: { id: number; codigo: string; nome: string; grupos: string }[];
}

export interface UnidadeCadastro {
  id: number;
  codigo: string;
  sigla: string;
  nome: string;
  orgao: { codigo: string; sigla: string; nome: string; poder: string };
}

export interface FuncaoCadastro {
  id: number;
  codigo: string;
  nome: string;
  subfuncoes: { id: number; codigo: string; nome: string }[];
}

export interface ProjetoLei {
  ementa: string;
  artigos: { numero: string; caput: string; incisos?: string[] }[];
  texto: string;
}
