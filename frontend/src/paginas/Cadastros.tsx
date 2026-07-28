import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api, type Fonte, type FuncaoCadastro, type NaturezasDespesa, type Orgao, type Programa } from '../api';
import { Cartao, Carregando, Etiqueta, TituloPagina } from '../componentes/base';
import { formatarInteiro } from '../formato';

const ABAS = [
  { chave: 'institucional', rotulo: 'Estrutura institucional' },
  { chave: 'programatica', rotulo: 'PPA: programas e ações' },
  { chave: 'funcional', rotulo: 'Classificação funcional' },
  { chave: 'natureza', rotulo: 'Natureza da despesa' },
  { chave: 'fontes', rotulo: 'Fontes de recursos' },
] as const;

type Aba = (typeof ABAS)[number]['chave'];

const ROTULOS_PODER: Record<string, string> = {
  EXECUTIVO: 'Executivo',
  LEGISLATIVO: 'Legislativo',
  JUDICIARIO: 'Judiciário',
  MINISTERIO_PUBLICO: 'Ministério Público',
  DEFENSORIA: 'Defensoria Pública',
  TRIBUNAL_CONTAS: 'Tribunal de Contas',
};

export function PaginaCadastros() {
  const [aba, setAba] = useState<Aba>('institucional');

  const orgaos = useQuery({ queryKey: ['orgaos'], queryFn: () => api.get<Orgao[]>('/cadastros/orgaos'), enabled: aba === 'institucional' });
  const programas = useQuery({ queryKey: ['programas'], queryFn: () => api.get<Programa[]>('/cadastros/programas'), enabled: aba === 'programatica' });
  const funcoes = useQuery({ queryKey: ['funcoes'], queryFn: () => api.get<FuncaoCadastro[]>('/cadastros/funcoes'), enabled: aba === 'funcional' });
  const naturezas = useQuery({
    queryKey: ['naturezas-despesa'],
    queryFn: () => api.get<NaturezasDespesa>('/cadastros/naturezas-despesa'),
    enabled: aba === 'natureza',
  });
  const fontes = useQuery({ queryKey: ['fontes'], queryFn: () => api.get<Fonte[]>('/cadastros/fontes'), enabled: aba === 'fontes' });

  return (
    <>
      <TituloPagina
        titulo="Tabelas de referência"
        descricao="Estrutura institucional do Estado, programas e ações do PPA e classificações orçamentárias adotadas na elaboração da lei. As tabelas são carregadas a partir de arquivos abertos e podem ser substituídas pelas extrações oficiais da SEFA e da STN."
      />

      <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
        {ABAS.map((item) => (
          <button
            key={item.chave}
            type="button"
            onClick={() => setAba(item.chave)}
            className={`-mb-px border-b-2 px-3 py-2 text-xs font-semibold transition ${
              aba === item.chave ? 'border-parana-700 text-parana-800' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {item.rotulo}
          </button>
        ))}
      </div>

      {aba === 'institucional' && (
        <Cartao titulo="Órgãos e unidades orçamentárias" descricao="Classificação institucional utilizada na fixação da despesa.">
          {orgaos.isLoading && <Carregando />}
          <div className="max-h-[36rem] overflow-auto">
            <table className="tabela-orcamento">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Órgão</th>
                  <th>Poder</th>
                  <th>Administração</th>
                  <th>Unidades orçamentárias</th>
                </tr>
              </thead>
              <tbody>
                {orgaos.data?.map((o) => (
                  <tr key={o.codigo}>
                    <td className="font-mono">{o.codigo}</td>
                    <td>
                      <span className="font-semibold">{o.sigla}</span>
                      <p className="text-[0.6875rem] text-slate-500">{o.nome}</p>
                    </td>
                    <td>{ROTULOS_PODER[o.poder] ?? o.poder}</td>
                    <td>{o.tipoAdministracao.replace('_', ' ')}</td>
                    <td>
                      <ul className="space-y-0.5">
                        {o.unidades.map((u) => (
                          <li key={u.codigo} className="text-[0.6875rem]">
                            <span className="font-mono">{u.codigo}</span> · {u.nome}
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Cartao>
      )}

      {aba === 'programatica' && (
        <Cartao titulo="Programas e ações do Plano Plurianual" descricao="Cada dotação da lei orçamentária deve estar vinculada a uma ação de programa vigente no PPA.">
          {programas.isLoading && <Carregando />}
          <div className="max-h-[36rem] overflow-auto">
            <table className="tabela-orcamento">
              <thead>
                <tr>
                  <th>Programa</th>
                  <th>Denominação e objetivo</th>
                  <th>Tipo</th>
                  <th>Vigência</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {programas.data?.map((p) => (
                  <tr key={p.codigo}>
                    <td className="font-mono">{p.codigo}</td>
                    <td className="max-w-96">
                      <span className="font-semibold">{p.nome}</span>
                      {p.objetivo && <p className="mt-0.5 text-[0.6875rem] leading-snug text-slate-500">{p.objetivo}</p>}
                    </td>
                    <td>
                      <Etiqueta tom={p.tipo === 'TEMATICO' ? 'info' : 'neutro'}>{p.tipo}</Etiqueta>
                    </td>
                    <td className="whitespace-nowrap">
                      {p.ppaInicio}–{p.ppaFim}
                    </td>
                    <td>
                      <ul className="space-y-0.5">
                        {p.acoes.map((a) => (
                          <li key={a.codigo} className="text-[0.6875rem]">
                            <span className="font-mono">{a.codigo}</span> · {a.nome}
                            {a.produto && (
                              <span className="text-slate-500">
                                {' '}
                                — {a.produto}
                                {a.metaFisica ? ` (${formatarInteiro(a.metaFisica)} ${a.unidadeMedida ?? ''})` : ''}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Cartao>
      )}

      {aba === 'funcional' && (
        <Cartao titulo="Funções e subfunções de governo" descricao="Classificação funcional estabelecida pela Portaria MOG 42/1999.">
          {funcoes.isLoading && <Carregando />}
          <div className="max-h-[36rem] overflow-auto">
            <table className="tabela-orcamento">
              <thead>
                <tr>
                  <th>Função</th>
                  <th>Denominação</th>
                  <th>Subfunções</th>
                </tr>
              </thead>
              <tbody>
                {funcoes.data?.map((f) => (
                  <tr key={f.codigo}>
                    <td className="font-mono">{f.codigo}</td>
                    <td className="font-semibold">{f.nome}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {f.subfuncoes.map((s) => (
                          <span key={s.codigo} className="rounded bg-slate-100 px-1.5 py-0.5 text-[0.6875rem]">
                            <span className="font-mono">{s.codigo}</span> {s.nome}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Cartao>
      )}

      {aba === 'natureza' && (
        <div className="grid gap-4 xl:grid-cols-3">
          <Cartao titulo="Grupos de natureza da despesa">
            {naturezas.isLoading && <Carregando />}
            <table className="tabela-orcamento">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Denominação</th>
                  <th>Categoria</th>
                </tr>
              </thead>
              <tbody>
                {naturezas.data?.grupos.map((g) => (
                  <tr key={g.codigo}>
                    <td className="font-mono">{g.codigo}</td>
                    <td>{g.nome}</td>
                    <td className="font-mono">{g.categoria}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Cartao>

          <Cartao titulo="Modalidades de aplicação">
            <div className="max-h-[30rem] overflow-auto">
              <table className="tabela-orcamento">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Denominação</th>
                  </tr>
                </thead>
                <tbody>
                  {naturezas.data?.modalidades.map((m) => (
                    <tr key={m.codigo}>
                      <td className="font-mono">{m.codigo}</td>
                      <td>{m.nome}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Cartao>

          <Cartao titulo="Elementos de despesa" descricao="A coluna de grupos indica em quais grupos de natureza o elemento pode ser utilizado.">
            <div className="max-h-[30rem] overflow-auto">
              <table className="tabela-orcamento">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Denominação</th>
                    <th>Grupos</th>
                  </tr>
                </thead>
                <tbody>
                  {naturezas.data?.elementos.map((e) => (
                    <tr key={e.codigo}>
                      <td className="font-mono">{e.codigo}</td>
                      <td>{e.nome}</td>
                      <td className="font-mono">{e.grupos}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Cartao>
        </div>
      )}

      {aba === 'fontes' && (
        <Cartao titulo="Fontes e destinações de recursos" descricao="Vinculações que determinam a destinação obrigatória das receitas.">
          {fontes.isLoading && <Carregando />}
          <div className="max-h-[36rem] overflow-auto">
            <table className="tabela-orcamento">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Denominação</th>
                  <th>Tipo</th>
                  <th>Vinculação</th>
                  <th>Origem</th>
                </tr>
              </thead>
              <tbody>
                {fontes.data?.map((f) => (
                  <tr key={f.codigo}>
                    <td className="font-mono">{f.codigo}</td>
                    <td>{f.nome}</td>
                    <td>
                      <Etiqueta tom={f.tipo === 'LIVRE' ? 'positivo' : 'info'}>{f.tipo}</Etiqueta>
                    </td>
                    <td>{f.vinculacao ?? '-'}</td>
                    <td>{f.origem.replace('_', ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Cartao>
      )}
    </>
  );
}
