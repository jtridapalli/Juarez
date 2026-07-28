import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { EXERCICIO } from './api';
import { useAutenticacao } from './autenticacao';
import { Carregando } from './componentes/base';
import { rotuloPerfil } from './formato';
import { PaginaAnexos } from './paginas/Anexos';
import { PaginaAuditoria } from './paginas/Auditoria';
import { PaginaCadastros } from './paginas/Cadastros';
import { PaginaConsolidacao } from './paginas/Consolidacao';
import { PaginaDespesa } from './paginas/Despesa';
import { PaginaLimites } from './paginas/Limites';
import { PaginaLogin } from './paginas/Login';
import { PaginaPainel } from './paginas/Painel';
import { PaginaPropostas } from './paginas/Propostas';
import { PaginaReceita } from './paginas/Receita';
import { PaginaValidacao } from './paginas/Validacao';

const MENU = [
  { rota: '/painel', rotulo: 'Painel do orçamento', grupo: 'Acompanhamento' },
  { rota: '/receita', rotulo: 'Previsão da receita', grupo: 'Elaboração' },
  { rota: '/despesa', rotulo: 'Fixação da despesa', grupo: 'Elaboração' },
  { rota: '/propostas', rotulo: 'Propostas setoriais', grupo: 'Elaboração' },
  { rota: '/limites', rotulo: 'Tetos orçamentários', grupo: 'Elaboração' },
  { rota: '/validacao', rotulo: 'Validação legal', grupo: 'Fechamento' },
  { rota: '/consolidacao', rotulo: 'Consolidação', grupo: 'Fechamento' },
  { rota: '/anexos', rotulo: 'Anexos e projeto de lei', grupo: 'Fechamento' },
  { rota: '/cadastros', rotulo: 'Tabelas de referência', grupo: 'Administração' },
  { rota: '/auditoria', rotulo: 'Trilha de auditoria', grupo: 'Administração' },
];

function Cabecalho() {
  const { usuario, sair } = useAutenticacao();
  return (
    <header className="flex items-center justify-between gap-4 border-b border-parana-800 bg-parana-900 px-5 py-2.5 text-white">
      <div className="flex items-baseline gap-3">
        <span className="text-sm font-semibold tracking-wide">GOVERNO DO ESTADO DO PARANÁ</span>
        <span className="hidden text-xs text-parana-200 sm:inline">
          Sistema de Elaboração da Lei Orçamentária Anual · Exercício {EXERCICIO}
        </span>
      </div>
      {usuario && (
        <div className="flex items-center gap-3 text-right">
          <div className="hidden sm:block">
            <p className="text-xs font-semibold leading-tight">{usuario.nome}</p>
            <p className="text-[0.6875rem] leading-tight text-parana-200">
              {rotuloPerfil(usuario.perfil)}
              {usuario.unidade ? ` · ${usuario.unidade.codigo}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={sair}
            className="rounded border border-parana-600 px-2 py-1 text-xs font-semibold hover:bg-parana-800"
          >
            Sair
          </button>
        </div>
      )}
    </header>
  );
}

function MenuLateral() {
  const grupos = [...new Set(MENU.map((item) => item.grupo))];
  return (
    <nav className="w-56 shrink-0 border-r border-slate-200 bg-white px-2 py-3">
      {grupos.map((grupo) => (
        <div key={grupo} className="mb-3">
          <p className="px-2 pb-1 text-[0.625rem] font-bold uppercase tracking-wider text-slate-400">{grupo}</p>
          {MENU.filter((item) => item.grupo === grupo).map((item) => (
            <NavLink
              key={item.rota}
              to={item.rota}
              className={({ isActive }) =>
                `block rounded px-2 py-1.5 text-[0.8125rem] transition ${
                  isActive ? 'bg-parana-100 font-semibold text-parana-800' : 'text-slate-700 hover:bg-slate-50'
                }`
              }
            >
              {item.rotulo}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );
}

export function App() {
  const { usuario, carregando } = useAutenticacao();

  if (carregando) {
    return (
      <div className="flex h-full items-center justify-center">
        <Carregando mensagem="Validando sessão..." />
      </div>
    );
  }

  if (!usuario) return <PaginaLogin />;

  return (
    <div className="flex h-full flex-col">
      <Cabecalho />
      <div className="flex min-h-0 flex-1">
        <MenuLateral />
        <main className="min-w-0 flex-1 overflow-auto p-5">
          <Routes>
            <Route path="/" element={<Navigate to="/painel" replace />} />
            <Route path="/painel" element={<PaginaPainel />} />
            <Route path="/receita" element={<PaginaReceita />} />
            <Route path="/despesa" element={<PaginaDespesa />} />
            <Route path="/propostas" element={<PaginaPropostas />} />
            <Route path="/limites" element={<PaginaLimites />} />
            <Route path="/validacao" element={<PaginaValidacao />} />
            <Route path="/consolidacao" element={<PaginaConsolidacao />} />
            <Route path="/anexos" element={<PaginaAnexos />} />
            <Route path="/cadastros" element={<PaginaCadastros />} />
            <Route path="/auditoria" element={<PaginaAuditoria />} />
            <Route path="*" element={<Navigate to="/painel" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
