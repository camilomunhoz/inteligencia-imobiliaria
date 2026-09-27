import React from 'react';
import { type Imovel } from '../types/imovel.js';
import { MapPin, Sun, Compass, ShoppingBag, ArrowUpRight, Trash2 } from 'lucide-react';

interface PropertyCardProps {
  imovel: Imovel;
  isSelected?: boolean;
  onSelect: (imovel: Imovel) => void;
  onHover?: (imovel: Imovel | null) => void;
  onDelete?: (imovel: Imovel) => void;
}

export const PropertyCard: React.FC<PropertyCardProps> = ({
  imovel,
  isSelected,
  onSelect,
  onHover,
  onDelete,
}) => {
  const isVenda = imovel.tipo_transacao === 'venda';
  const mainImage = imovel.imagens?.[0] || 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=80';

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Cor do badge de score de 0 a 10
  const getScoreColor = (score: number) => {
    if (score >= 8.0) return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800';
    if (score >= 6.0) return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800';
    if (score >= 4.0) return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800';
    return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800';
  };

  return (
    <div
      onClick={() => onSelect(imovel)}
      onMouseEnter={() => onHover?.(imovel)}
      onMouseLeave={() => onHover?.(null)}
      className={`group relative flex flex-col rounded-xl border bg-card p-4 transition-all duration-200 cursor-pointer hover:shadow-md ${
        isSelected
          ? 'ring-2 ring-primary border-primary shadow-sm'
          : 'hover:border-foreground/20'
      }`}
    >
      {/* Imagem + Tag de Score e Transação */}
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg bg-muted">
        <img
          src={mainImage}
          alt={imovel.titulo}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
          <span className="rounded-md bg-background/90 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider backdrop-blur-sm text-foreground">
            {isVenda ? 'Venda' : 'Aluguel'}
          </span>
          {imovel.confianca_extracao && (
            <span className="rounded-md bg-background/80 px-1.5 py-0.5 text-[10px] text-muted-foreground backdrop-blur-sm">
              IA: {imovel.confianca_extracao}
            </span>
          )}
        </div>

        {/* Badge de Score Geral */}
        <div className="absolute top-2.5 right-2.5">
          <div
            className={`flex items-center gap-1 rounded-md border px-2 py-1 shadow-sm backdrop-blur-sm ${getScoreColor(
              imovel.scoreFinal
            )}`}
          >
            <span className="text-[10px] uppercase font-bold tracking-wider">Score</span>
            <span className="text-sm font-extrabold">{imovel.scoreFinal.toFixed(1)}</span>
          </div>
        </div>
      </div>

      {/* Conteúdo textual */}
      <div className="mt-3 flex flex-1 flex-col">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="font-medium truncate">{imovel.bairro || 'Porto Alegre'}</span>
          <span>•</span>
          <span>{imovel.area_util} m²</span>
        </div>

        <h3 className="mt-1 text-sm font-semibold leading-snug line-clamp-2 text-foreground group-hover:text-primary transition-colors">
          {imovel.titulo}
        </h3>

        {/* Métricas Financeiras Adaptadas */}
        <div className="mt-3 rounded-lg bg-secondary/50 p-2.5">
          {isVenda ? (
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-[11px] text-muted-foreground">Valor de Venda</p>
                <p className="text-base font-bold text-foreground">{formatCurrency(imovel.preco)}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-muted-foreground">Preço / m²</p>
                <p className="text-xs font-semibold text-foreground/80">{formatCurrency(imovel.preco_m2)}/m²</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between">
                <div>
                  <p className="text-[11px] text-muted-foreground">Aluguel Base</p>
                  <p className="text-base font-bold text-foreground">{formatCurrency(imovel.preco)}/mês</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-muted-foreground">Custo Mensal Total</p>
                  <p className="text-sm font-extrabold text-primary">
                    {formatCurrency(imovel.custo_total_mensal || imovel.preco)}/mês
                  </p>
                </div>
              </div>
              {(imovel.condominio > 0 || imovel.iptu > 0) && (
                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                  <span>Condomínio: {formatCurrency(imovel.condominio)}</span>
                  <span>IPTU: {formatCurrency(imovel.iptu)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Indicadores de Conveniência e POIs */}
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground border-t pt-2.5">
          <div className="flex items-center gap-1" title="Orientação Solar">
            <Sun className="h-3.5 w-3.5 text-amber-500" />
            <span>{imovel.posicao_solar || 'Indefinido'}</span>
          </div>

          <div className="flex items-center gap-1" title="Distância até a Redenção">
            <Compass className="h-3.5 w-3.5 text-blue-500" />
            <span>{(imovel.distanciaRedencao / 1000).toFixed(1)} km Redenção</span>
          </div>

          <div className="flex items-center gap-1" title="Comércios em 1km">
            <ShoppingBag className="h-3.5 w-3.5 text-emerald-500" />
            <span>{imovel.comercio1km} comércios</span>
          </div>
        </div>

        {/* Ações inferiores: Link original e Botão de Deletar */}
        <div className="mt-2.5 flex items-center justify-between border-t border-border/40 pt-2">
          {imovel.url_origem ? (
            <a
              href={imovel.url_origem}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors"
            >
              <span>Ver anúncio original</span>
              <ArrowUpRight className="h-3 w-3" />
            </a>
          ) : (
            <div />
          )}

          {onDelete && (
            <button
              type="button"
              title="Excluir este imóvel e imagens"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(imovel);
              }}
              className="flex items-center gap-1 rounded-md p-1 text-[11px] text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
