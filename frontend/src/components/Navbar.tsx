import React from 'react';
import { TipoTransacao } from '../types/imovel.js';
import { Building2, Sun, Moon, Plus, Home, Key } from 'lucide-react';

interface NavbarProps {
  tipoTransacao: TipoTransacao;
  onTipoTransacaoChange: (tipo: TipoTransacao) => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenImport: () => void;
  totalCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  tipoTransacao,
  onTipoTransacaoChange,
  isDarkMode,
  onToggleDarkMode,
  onOpenImport,
  totalCount,
}) => {
  return (
    <header className="sticky top-0 z-30 border-b bg-card/80 backdrop-blur-md transition-colors">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-foreground">
                Inteligência Imobiliária
              </span>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                Porto Alegre
              </span>
            </div>
            <p className="text-xs text-muted-foreground hidden sm:block">
              Scoring multicritério espacial e financeiro com PostGIS e IA
            </p>
          </div>
        </div>

        {/* Center: Switch Venda / Aluguel */}
        <div className="flex items-center rounded-lg border bg-muted/60 p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => onTipoTransacaoChange('venda')}
            className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 transition-all ${
              tipoTransacao === 'venda'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Home className="h-3.5 w-3.5" />
            <span>Comprar</span>
          </button>
          <button
            type="button"
            onClick={() => onTipoTransacaoChange('aluguel')}
            className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 transition-all ${
              tipoTransacao === 'aluguel'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Key className="h-3.5 w-3.5" />
            <span>Alugar</span>
          </button>
        </div>

        {/* Right side: Action & Theme */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden md:flex items-center text-xs text-muted-foreground">
            <span className="font-semibold text-foreground mr-1">{totalCount}</span>
            <span>{tipoTransacao === 'venda' ? 'imóveis à venda' : 'imóveis para aluguel'}</span>
          </div>

          <button
            type="button"
            onClick={onOpenImport}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Importar Anúncio</span>
            <span className="sm:hidden">Importar</span>
          </button>

          <button
            type="button"
            onClick={onToggleDarkMode}
            aria-label="Alternar tema"
            className="flex h-9 w-9 items-center justify-center rounded-lg border bg-card text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            {isDarkMode ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </header>
  );
};
