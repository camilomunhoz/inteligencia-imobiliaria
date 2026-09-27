import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Navbar } from './components/Navbar.js';
import { PropertyCard } from './components/PropertyCard.js';
import { Map } from './components/Map.js';
import { ImportModal } from './components/ImportModal.js';
import { PropertyDetailModal } from './components/PropertyDetailModal.js';
import {
  WeightSliders,
  DEFAULT_WEIGHTS,
  type ScoreWeightsState,
} from './components/WeightSliders.js';
import { type Imovel, type TipoTransacao } from './types/imovel.js';
import {
  Loader2,
  ArrowUpDown,
  SlidersHorizontal,
  RefreshCw,
  List,
  Map as MapIcon,
  Sliders,
} from 'lucide-react';

export const App: React.FC = () => {
  const [tipoTransacao, setTipoTransacao] = useState<TipoTransacao>('venda');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [imoveis, setImoveis] = useState<Imovel[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedImovel, setSelectedImovel] = useState<Imovel | null>(null);
  const [hoveredImovel, setHoveredImovel] = useState<Imovel | null>(null);
  const [detailImovel, setDetailImovel] = useState<Imovel | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [isSlidersOpen, setIsSlidersOpen] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<'score' | 'preco_asc' | 'preco_desc'>('score');
  const [weights, setWeights] = useState<ScoreWeightsState>(DEFAULT_WEIGHTS);

  // Modo de exibição no mobile: 'lista' | 'mapa'
  const [mobileTab, setMobileTab] = useState<'lista' | 'mapa'>('lista');

  // Controle de Dark Mode na tag <html>
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Carregar lista de imóveis da API
  const fetchImoveis = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/imoveis?tipo=${tipoTransacao}`);
      if (!res.ok) throw new Error('Falha ao carregar imóveis');
      const data = await res.json();
      const rawList = Array.isArray(data) ? data : data.imoveis || [];

      const normalized: Imovel[] = rawList.map((item: any) => ({
        ...item,
        tipo_transacao: (item.tipo_transacao || item.tipoTransacao || tipoTransacao) as TipoTransacao,
        area_util: Number(item.area_util || item.areaUtil || 0),
        preco_m2: Number(item.preco_m2 || item.precoM2 || 0),
        preco: Number(item.preco || 0),
        condominio: Number(item.condominio || 0),
        iptu: Number(item.iptu || 0),
        custo_total_mensal: Number(
          item.custo_total_mensal || item.custoTotalMensal || item.preco || 0
        ),
        posicao_solar: item.posicao_solar || item.posicaoSolar || 'Indefinido',
        latitude: Number(item.latitude || 0),
        longitude: Number(item.longitude || 0),
        distanciaRedencao: Number(item.distanciaRedencao || 0),
        distanciaParcao: Number(item.distanciaParcao || 0),
        distanciaSaidaPoa: Number(item.distanciaSaidaPoa || 0),
        comercio1km: Number(item.comercio1km || 0),
        scoreFinal: Number(item.scoreFinal || 0),
        subScores: item.subScores || {
          preco: 5,
          posicaoSolar: 5,
          distanciaRedencao: 5,
          distanciaParcao: 5,
          distanciaSaidaPoa: 5,
          comercioProximo: 5,
        },
      }));
      setImoveis(normalized);
    } catch (err) {
      console.error('Erro ao buscar imóveis:', err);
      setImoveis([]);
    } finally {
      setIsLoading(false);
    }
  }, [tipoTransacao]);

  useEffect(() => {
    fetchImoveis();
    setSelectedImovel(null);
  }, [fetchImoveis]);

  // Recálculo dinâmico de scores no cliente usando pesos customizados
  const recalculatedImoveis = useMemo(() => {
    const totalWeight =
      weights.pesoPreco +
      weights.pesoPosicaoSolar +
      weights.pesoDistanciaRedencao +
      weights.pesoDistanciaParcao +
      weights.pesoDistanciaSaidaPoa +
      weights.pesoComercioProximo;

    if (totalWeight <= 0) return imoveis;

    return imoveis.map((item) => {
      const sub = item.subScores;
      if (!sub) return item;

      const weightedSum =
        sub.preco * weights.pesoPreco +
        sub.posicaoSolar * weights.pesoPosicaoSolar +
        sub.distanciaRedencao * weights.pesoDistanciaRedencao +
        sub.distanciaParcao * weights.pesoDistanciaParcao +
        sub.distanciaSaidaPoa * weights.pesoDistanciaSaidaPoa +
        sub.comercioProximo * weights.pesoComercioProximo;

      const newScore = Number((weightedSum / totalWeight).toFixed(1));

      return {
        ...item,
        scoreFinal: newScore,
      };
    });
  }, [imoveis, weights]);

  // Ordenação dos imóveis recalculados
  const sortedImoveis = useMemo(() => {
    return [...recalculatedImoveis].sort((a, b) => {
      if (sortBy === 'score') {
        return b.scoreFinal - a.scoreFinal;
      }
      const valA = tipoTransacao === 'venda' ? a.preco : a.custo_total_mensal || a.preco;
      const valB = tipoTransacao === 'venda' ? b.preco : b.custo_total_mensal || b.preco;
      if (sortBy === 'preco_asc') return valA - valB;
      return valB - valA;
    });
  }, [recalculatedImoveis, sortBy, tipoTransacao]);

  // Estatísticas rápidas
  const avgScore =
    sortedImoveis.length > 0
      ? (
          sortedImoveis.reduce((acc, i) => acc + i.scoreFinal, 0) / sortedImoveis.length
        ).toFixed(1)
      : '0.0';

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const avgPrice =
    sortedImoveis.length > 0
      ? formatCurrency(
          sortedImoveis.reduce(
            (acc, i) =>
              acc +
              (tipoTransacao === 'venda' ? i.preco_m2 : i.custo_total_mensal || i.preco),
            0
          ) / sortedImoveis.length
        )
      : 'R$ 0';

  return (
    <div className="flex h-screen flex-col bg-background text-foreground overflow-hidden">
      {/* Navbar Superior */}
      <Navbar
        tipoTransacao={tipoTransacao}
        onTipoTransacaoChange={(t) => setTipoTransacao(t)}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        onOpenImport={() => setIsImportModalOpen(true)}
        totalCount={sortedImoveis.length}
      />

      {/* Painel de Sliders e Presets Retrátil */}
      <WeightSliders
        weights={weights}
        onChange={(newWeights) => setWeights(newWeights)}
        tipoTransacao={tipoTransacao}
        isOpen={isSlidersOpen}
        onClose={() => setIsSlidersOpen(false)}
      />

      {/* Barra de Ações Rápidas e Estatísticas */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 sm:px-6 py-2.5 bg-card/60">
        <div className="flex items-center gap-4 text-xs">
          <div>
            <span className="text-muted-foreground">Média do Score:</span>{' '}
            <span className="font-bold text-foreground">{avgScore} / 10</span>
          </div>
          <div className="hidden sm:block">
            <span className="text-muted-foreground">
              {tipoTransacao === 'venda' ? 'Média Preço/m²:' : 'Custo Médio Mensal:'}
            </span>{' '}
            <span className="font-bold text-foreground">{avgPrice}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Botão de Abrir Sliders de Pesos */}
          <button
            type="button"
            onClick={() => setIsSlidersOpen(!isSlidersOpen)}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
              isSlidersOpen
                ? 'bg-primary text-primary-foreground border-primary'
                : 'hover:bg-muted text-foreground'
            }`}
          >
            <Sliders className="h-3.5 w-3.5" />
            <span>Pesos do Score</span>
          </button>

          {/* Recarregar */}
          <button
            type="button"
            onClick={fetchImoveis}
            title="Recarregar lista"
            className="rounded-lg border p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {/* Ordenação */}
          <div className="flex items-center gap-1.5 rounded-lg border bg-background px-2.5 py-1 text-xs">
            <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-xs font-semibold text-foreground focus:outline-none cursor-pointer"
            >
              <option value="score">Maior Score</option>
              <option value="preco_asc">Menor Preço</option>
              <option value="preco_desc">Maior Preço</option>
            </select>
          </div>

          {/* Mobile Switch: Lista vs Mapa */}
          <div className="flex items-center rounded-lg border bg-muted/60 p-0.5 text-xs font-semibold lg:hidden">
            <button
              type="button"
              onClick={() => setMobileTab('lista')}
              className={`flex items-center gap-1 rounded px-2.5 py-1 transition ${
                mobileTab === 'lista'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground'
              }`}
            >
              <List className="h-3.5 w-3.5" />
              <span>Lista</span>
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('mapa')}
              className={`flex items-center gap-1 rounded px-2.5 py-1 transition ${
                mobileTab === 'mapa'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground'
              }`}
            >
              <MapIcon className="h-3.5 w-3.5" />
              <span>Mapa</span>
            </button>
          </div>
        </div>
      </div>

      {/* Área Principal Split Screen */}
      <div className="flex flex-1 overflow-hidden">
        {/* Coluna Esquerda: Listagem Rolável */}
        <div
          className={`flex w-full flex-col border-r lg:w-1/2 xl:w-[48%] overflow-hidden bg-background ${
            mobileTab === 'mapa' ? 'hidden lg:flex' : 'flex'
          }`}
        >
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
            {isLoading ? (
              <div className="flex h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="text-xs">Carregando imóveis e calculando scores...</span>
              </div>
            ) : sortedImoveis.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                <SlidersHorizontal className="h-10 w-10 text-muted-foreground/60" />
                <p className="text-sm font-semibold text-foreground">
                  Nenhum imóvel de {tipoTransacao === 'venda' ? 'venda' : 'aluguel'} encontrado.
                </p>
                <p className="text-xs max-w-sm">
                  Utilize o botão "Importar Anúncio" no topo para analisar uma nova oportunidade com nossa IA.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-6">
                {sortedImoveis.map((imovel) => (
                  <PropertyCard
                    key={imovel.id}
                    imovel={imovel}
                    isSelected={selectedImovel?.id === imovel.id}
                    onSelect={(item) => {
                      setSelectedImovel(item);
                      setDetailImovel(item);
                    }}
                    onHover={(item) => setHoveredImovel(item)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Coluna Direita: Mapa Interativo MapLibre */}
        <div
          className={`h-full p-2 sm:p-3 bg-muted/20 ${
            mobileTab === 'lista'
              ? 'hidden lg:block lg:w-1/2 xl:w-[52%]'
              : 'w-full block lg:w-1/2 xl:w-[52%]'
          }`}
        >
          <Map
            imoveis={sortedImoveis}
            selectedImovel={selectedImovel}
            hoveredImovel={hoveredImovel}
            onSelectImovel={(item) => {
              setSelectedImovel(item);
              setDetailImovel(item);
            }}
            isDarkMode={isDarkMode}
          />
        </div>
      </div>

      {/* Modal de Importação com Streaming em Tempo Real */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={() => fetchImoveis()}
      />

      {/* Modal de Detalhamento do Imóvel & Decomposição do Score */}
      <PropertyDetailModal
        imovel={detailImovel}
        onClose={() => setDetailImovel(null)}
      />
    </div>
  );
};
