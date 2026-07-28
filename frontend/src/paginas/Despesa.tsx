import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  api,
  EXERCICIO,
  type Fonte,
  type FuncaoCadastro,
  type NaturezasDespesa,
  type PaginaDotacoes,
  type Programa,
  type UnidadeCadastro,
} from '../api';
import { useAutenticacao } from '../autenticacao';
import { Aviso, Botao, Cartao, Carregando, Etiqueta, Indicador, TituloPagina, Vazio } from '../componentes/base';
import { formatarInteiro, formatarMoeda, formatarResumo, rotuloEsfera, rotuloStatus } from '../formato';

interface Filtros {
  unidade: string;
  funcao: string;
  programa: string;
  fonte: string;
  grupo: string;
}

const FILTROS_VAZIOS: Filtros = { unidade: '', funcao: '', programa: '', fonte: '', grupo: '' };

const rotuloProposta = (status: string) => {
  const tom = status === 'HOMOLOGADA' ? 'positivo' : status === 'DEVOLVIDA' ? 'negativo' : 'atencao';
  return <Etiqueta tom={tom}>{rotuloStatus(status)}</Etiqueta>;
};

export function PaginaDespesa() {
  const { podeEditar, usuario } = useAutenticacao();
  const clienteQuery = useQueryClient();
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VAZIOS);
  const [pagina, setPagina] = useState(1);
  const [formularioAberto, setFormularioAberto] = useState(false);

  const cadastros = useQuery({
    queryKey: ['cadastros-despesa'],
    queryFn: async () => {
      const [unidades, funcoes, programas, naturezas, fontes] = await Promise.all([
        api.get<UnidadeCadastro[]>('/cadastros/unidades'),
        api.get<FuncaoCadastro[]>('/cadastros/funcoes'),
        api.get<Programa[]>('/cadastros/programas'),
        api.get<NaturezasDespesa>('/cadastros/naturezas-despesa'),
        api.get<Fonte[]>('/cadastros/fontes'),
      ]);
      return { unidades, funcoes, programas, naturezas, fontes };
    },
  });

  const consulta = new URLSearchParams({ pagina: String(pagina), porPagina: '50' });
  for (const [chave, valor] of Object.entries(filtros)) if (valor) consulta.set(chave, valor);

  const dotacoes = useQuery({
    queryKey: ['dotacoes', EXERCICIO, filtros, pagina],
    queryFn: () => api.get<PaginaDotacoes>(`/exercicios/${EXERCICIO}/dotacoes?${consulta.toString()}`),
  });

  const totalPaginas = dotacoes.data ? Math.max(1, Math.ceil(dotacoes.data.total / dotacoes.data.porPagina)) : 1;

  function atualizarFiltro(chave: keyof Filtros, valor: string) {
    setFiltros((atual) => ({ ...atual, [chave]: valor }));
    setPagina(1);
  }

  return (
    <>
      <TituloPagina
        titulo="Fixação da despesa"
        descricao="Quadro de Detalhamento da Despesa: classificação institucional, funcional-programática, natureza da despesa e fonte de recursos de cada dotação."
        acoes={
          podeEditar && (
            <Botao onClick={() => setFormularioAberto((aberto) => !aberto)} tipo={formularioAberto ? 'secundario' : 'primario'}>
              {formularioAberto ? 'Fechar formulário' : 'Incluir dotação'}
            </Botao>
          )
        }
      />

      {formularioAberto && cadastros.data && (
        <FormularioDotacao
          cadastros={cadastros.data}
          unidadeFixa={usuario?.perfil === 'UNIDADE_ORCAMENTARIA' ? (usuario.unidade?.codigo ?? null) : null}
          aoConcluir={() => {
            clienteQuery.invalidateQueries({ queryKey: ['dotacoes'] });
            clienteQuery.invalidateQueries({ queryKey: ['painel'] });
            clienteQuery.invalidateQueries({ queryKey: ['limites'] });
          }}
        />
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Indicador
          rotulo="Dotações no filtro"
          valor={dotacoes.data ? formatarInteiro(dotacoes.data.total) : '-'}
          detalhe={`Página ${pagina} de ${totalPaginas}`}
        />
        <Indicador
          rotulo="Soma das dotações filtradas"
          valor={dotacoes.data ? formatarResumo(dotacoes.data.somaValor) : '-'}
          detalhe={dotacoes.data ? `R$ ${formatarMoeda(dotacoes.data.somaValor)}` : undefined}
          tom="destaque"
        />
        <Indicador rotulo="Registros por página" valor={String(dotacoes.data?.porPagina ?? 50)} />
      </div>

      <Cartao
        className="mt-4"
        titulo="Quadro de Detalhamento da Despesa"
        acoes={
          <>
            <select
              value={filtros.unidade}
              onChange={(e) => atualizarFiltro('unidade', e.target.value)}
              className="max-w-56 rounded-md border border-slate-300 px-2 py-1 text-xs"
            >
              <option value="">Todas as unidades</option>
              {cadastros.data?.unidades.map((u) => (
                <option key={u.codigo} value={u.codigo}>
                  {u.codigo} · {u.sigla}
                </option>
              ))}
            </select>
            <select
              value={filtros.funcao}
              onChange={(e) => atualizarFiltro('funcao', e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs"
            >
              <option value="">Todas as funções</option>
              {cadastros.data?.funcoes.map((f) => (
                <option key={f.codigo} value={f.codigo}>
                  {f.codigo} · {f.nome}
                </option>
              ))}
            </select>
            <select
              value={filtros.grupo}
              onChange={(e) => atualizarFiltro('grupo', e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs"
            >
              <option value="">Todos os grupos</option>
              {cadastros.data?.naturezas.grupos.map((g) => (
                <option key={g.codigo} value={g.codigo}>
                  {g.codigo} · {g.nome}
                </option>
              ))}
            </select>
            <select
              value={filtros.fonte}
              onChange={(e) => atualizarFiltro('fonte', e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs"
            >
              <option value="">Todas as fontes</option>
              {cadastros.data?.fontes.map((f) => (
                <option key={f.codigo} value={f.codigo}>
                  {f.codigo}
                </option>
              ))}
            </select>
            <Botao tipo="secundario" onClick={() => setFiltros(FILTROS_VAZIOS)}>
              Limpar
            </Botao>
          </>
        }
      >
        {dotacoes.isLoading && <Carregando />}
        {dotacoes.error && <Aviso>Não foi possível carregar as dotações.</Aviso>}
        {dotacoes.data && (
          <>
            <div className="max-h-[34rem] overflow-auto">
              <table className="tabela-orcamento">
                <thead>
                  <tr>
                    <th>U.O.</th>
                    <th>Funcional-programática</th>
                    <th>Ação</th>
                    <th>Natureza</th>
                    <th>Fonte</th>
                    <th>Esfera</th>
                    <th>Situação</th>
                    <th className="numero">Valor (R$)</th>
                  </tr>
                </thead>
                <tbody>
                  {dotacoes.data.itens.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <span className="font-mono">{d.unidade.codigo}</span>
                        <p className="text-[0.6875rem] text-slate-500">{d.unidade.sigla}</p>
                      </td>
                      <td className="font-mono text-[0.75rem]">
                        {d.funcao.codigo}.{d.subfuncao.codigo}.{d.programa.codigo}.{d.acao.codigo}.{d.subtitulo}
                      </td>
                      <td className="max-w-80">
                        {d.acao.nome}
                        <p className="text-[0.6875rem] text-slate-500">
                          {d.funcao.nome} / {d.subfuncao.nome}
                        </p>
                      </td>
                      <td>
                        <span className="font-mono">{d.natureza}</span>
                        <p className="text-[0.6875rem] text-slate-500">{d.elemento.nome}</p>
                      </td>
                      <td className="font-mono">{d.fonte.codigo}</td>
                      <td>{rotuloEsfera(d.esfera)}</td>
                      <td>{rotuloProposta(d.propostaStatus)}</td>
                      <td className="numero">{formatarMoeda(d.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {dotacoes.data.itens.length === 0 && <Vazio mensagem="Nenhuma dotação encontrada para os filtros informados." />}
            </div>
            <footer className="flex items-center justify-between border-t border-slate-200 px-4 py-2">
              <span className="text-xs text-slate-500">
                Exibindo {dotacoes.data.itens.length} de {formatarInteiro(dotacoes.data.total)} dotações
              </span>
              <div className="flex items-center gap-2">
                <Botao tipo="secundario" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
                  Anterior
                </Botao>
                <span className="text-xs tabular-nums text-slate-600">
                  {pagina} / {totalPaginas}
                </span>
                <Botao tipo="secundario" disabled={pagina >= totalPaginas} onClick={() => setPagina((p) => p + 1)}>
                  Próxima
                </Botao>
              </div>
            </footer>
          </>
        )}
      </Cartao>
    </>
  );
}

interface Cadastros {
  unidades: UnidadeCadastro[];
  funcoes: FuncaoCadastro[];
  programas: Programa[];
  naturezas: NaturezasDespesa;
  fontes: Fonte[];
}

function FormularioDotacao({
  cadastros,
  unidadeFixa,
  aoConcluir,
}: {
  cadastros: Cadastros;
  unidadeFixa: string | null;
  aoConcluir: () => void;
}) {
  const unidadeInicial = unidadeFixa
    ? cadastros.unidades.find((u) => u.codigo === unidadeFixa)
    : cadastros.unidades.find((u) => u.codigo === '3000.3001');

  const [unidadeId, setUnidadeId] = useState<number>(unidadeInicial?.id ?? cadastros.unidades[0].id);
  const [funcaoId, setFuncaoId] = useState<number>(cadastros.funcoes.find((f) => f.codigo === '10')?.id ?? cadastros.funcoes[0].id);
  const [subfuncaoId, setSubfuncaoId] = useState<number | null>(null);
  const [programaId, setProgramaId] = useState<number>(
    cadastros.programas.find((p) => p.codigo === '1101')?.id ?? cadastros.programas[0].id,
  );
  const [acaoId, setAcaoId] = useState<number | null>(null);
  const [grupoId, setGrupoId] = useState<number>(cadastros.naturezas.grupos.find((g) => g.codigo === '3')!.id);
  const [modalidadeId, setModalidadeId] = useState<number>(cadastros.naturezas.modalidades.find((m) => m.codigo === '90')!.id);
  const [elementoId, setElementoId] = useState<number>(cadastros.naturezas.elementos.find((e) => e.codigo === '39')!.id);
  const [fonteId, setFonteId] = useState<number>(cadastros.fontes.find((f) => f.codigo === '500')!.id);
  const [esfera, setEsfera] = useState('F');
  const [subtitulo, setSubtitulo] = useState('0000');
  const [valor, setValor] = useState('1000000');
  const [justificativa, setJustificativa] = useState('');
  const [mensagem, setMensagem] = useState<{ tom: 'erro' | 'sucesso'; texto: string } | null>(null);

  const funcaoSelecionada = cadastros.funcoes.find((f) => f.id === funcaoId);
  const programaSelecionado = cadastros.programas.find((p) => p.id === programaId);
  const grupoSelecionado = cadastros.naturezas.grupos.find((g) => g.id === grupoId);

  const elementosCompativeis = useMemo(
    () =>
      cadastros.naturezas.elementos.filter((e) =>
        grupoSelecionado ? e.grupos.split(',').map((g) => g.trim()).includes(grupoSelecionado.codigo) : true,
      ),
    [cadastros.naturezas.elementos, grupoSelecionado],
  );

  const inclusao = useMutation({
    mutationFn: () =>
      api.post(`/exercicios/${EXERCICIO}/dotacoes`, {
        unidadeId,
        funcaoId,
        subfuncaoId: subfuncaoId ?? funcaoSelecionada?.subfuncoes[0]?.id,
        programaId,
        acaoId: acaoId ?? programaSelecionado?.acoes[0]?.id,
        grupoId,
        modalidadeId,
        elementoId,
        fonteId,
        esfera,
        subtitulo,
        valor: Number(valor),
        justificativa: justificativa || undefined,
      }),
    onSuccess: () => {
      setMensagem({ tom: 'sucesso', texto: 'Dotação incluída na proposta da unidade orçamentária.' });
      aoConcluir();
    },
    onError: (erro: Error) => setMensagem({ tom: 'erro', texto: erro.message }),
  });

  const campo = 'w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs';
  const etiqueta = 'block text-[0.6875rem] font-semibold text-slate-600';

  return (
    <Cartao
      titulo="Inclusão de dotação orçamentária"
      descricao="O sistema recusa a inclusão quando o elemento é incompatível com o grupo de natureza ou quando a ação não pertence ao programa selecionado."
    >
      <div className="grid gap-3 px-4 py-3 md:grid-cols-3 xl:grid-cols-4">
        <div>
          <label className={etiqueta}>Unidade orçamentária</label>
          <select
            className={campo}
            value={unidadeId}
            disabled={Boolean(unidadeFixa)}
            onChange={(e) => setUnidadeId(Number(e.target.value))}
          >
            {cadastros.unidades.map((u) => (
              <option key={u.id} value={u.id}>
                {u.codigo} · {u.sigla}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={etiqueta}>Função</label>
          <select
            className={campo}
            value={funcaoId}
            onChange={(e) => {
              setFuncaoId(Number(e.target.value));
              setSubfuncaoId(null);
            }}
          >
            {cadastros.funcoes.map((f) => (
              <option key={f.id} value={f.id}>
                {f.codigo} · {f.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={etiqueta}>Subfunção</label>
          <select
            className={campo}
            value={subfuncaoId ?? funcaoSelecionada?.subfuncoes[0]?.id ?? ''}
            onChange={(e) => setSubfuncaoId(Number(e.target.value))}
          >
            {funcaoSelecionada?.subfuncoes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.codigo} · {s.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={etiqueta}>Programa</label>
          <select
            className={campo}
            value={programaId}
            onChange={(e) => {
              setProgramaId(Number(e.target.value));
              setAcaoId(null);
            }}
          >
            {cadastros.programas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.codigo} · {p.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className={etiqueta}>Ação</label>
          <select className={campo} value={acaoId ?? programaSelecionado?.acoes[0]?.id ?? ''} onChange={(e) => setAcaoId(Number(e.target.value))}>
            {programaSelecionado?.acoes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.codigo} · {a.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={etiqueta}>Subtítulo (localizador)</label>
          <input className={campo} value={subtitulo} onChange={(e) => setSubtitulo(e.target.value)} />
        </div>

        <div>
          <label className={etiqueta}>Esfera</label>
          <select className={campo} value={esfera} onChange={(e) => setEsfera(e.target.value)}>
            <option value="F">Fiscal</option>
            <option value="S">Seguridade Social</option>
          </select>
        </div>

        <div>
          <label className={etiqueta}>Grupo de natureza</label>
          <select
            className={campo}
            value={grupoId}
            onChange={(e) => {
              setGrupoId(Number(e.target.value));
            }}
          >
            {cadastros.naturezas.grupos.map((g) => (
              <option key={g.id} value={g.id}>
                {g.codigo} · {g.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={etiqueta}>Modalidade de aplicação</label>
          <select className={campo} value={modalidadeId} onChange={(e) => setModalidadeId(Number(e.target.value))}>
            {cadastros.naturezas.modalidades.map((m) => (
              <option key={m.id} value={m.id}>
                {m.codigo} · {m.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={etiqueta}>Elemento de despesa</label>
          <select className={campo} value={elementoId} onChange={(e) => setElementoId(Number(e.target.value))}>
            {cadastros.naturezas.elementos.map((e) => (
              <option key={e.id} value={e.id}>
                {e.codigo} · {e.nome}
                {elementosCompativeis.some((c) => c.id === e.id) ? '' : ' (incompatível)'}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={etiqueta}>Fonte de recursos</label>
          <select className={campo} value={fonteId} onChange={(e) => setFonteId(Number(e.target.value))}>
            {cadastros.fontes.map((f) => (
              <option key={f.id} value={f.id}>
                {f.codigo} · {f.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={etiqueta}>Valor (R$)</label>
          <input className={campo} inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} />
        </div>

        <div className="md:col-span-2 xl:col-span-3">
          <label className={etiqueta}>Justificativa</label>
          <input className={campo} value={justificativa} onChange={(e) => setJustificativa(e.target.value)} placeholder="Opcional" />
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
        <p className="text-[0.6875rem] text-slate-500">
          Natureza resultante: <span className="font-mono">{grupoSelecionado?.categoria}.{grupoSelecionado?.codigo}.
          {cadastros.naturezas.modalidades.find((m) => m.id === modalidadeId)?.codigo}.
          {cadastros.naturezas.elementos.find((e) => e.id === elementoId)?.codigo}</span>
        </p>
        <div className="flex items-center gap-3">
          {mensagem && <Aviso tom={mensagem.tom}>{mensagem.texto}</Aviso>}
          <Botao onClick={() => inclusao.mutate()} disabled={inclusao.isPending || Number(valor) <= 0}>
            {inclusao.isPending ? 'Registrando...' : 'Registrar dotação'}
          </Botao>
        </div>
      </footer>
    </Cartao>
  );
}
