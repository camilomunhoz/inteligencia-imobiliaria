import React from 'react';
import * as Slider from '@radix-ui/react-slider';
import { TipoTransacao } from '../types/imovel.js';
import {
  RotateCcw,
  Sparkles,
  TrendingDown,
  Sun,
  Compass,
  Car,
  ShoppingBag,
  Sliders,
} from 'lucide-react';

export interface ScoreWeightsState {
  pesoPreco: number; // preco_m2 para venda, custo_total_mensal para aluguel
  pesoPosicaoSolar: number;
  pesoDistanciaRedencao: number;
  pesoDistanciaParcao: number;
  pesoDistanciaSaidaPoa: number;
  pesoComercioProximo: number;
}

export const DEFAULT_WEIGHTS: ScoreWeightsState = {
  pesoPreco: 1.5,
  pesoPosicaoSolar: 1.0,
  pesoDistanciaRedencao: 1.0,
  pesoDistanciaParcao: 1.0,
  pesoDistanciaSaidaPoa: 1.0,
  pesoComercioProximo: 1.0,
};

export const PRESETS: { id: string; name: string; description: string; weights: ScoreWeightsState }[] = [
  {
    id: 'padrao',
    name: 'Equilibrado',
    description: 'Balanço ponderado entre custos, distâncias e conveniências.',
    weights: {
      pesoPreco: 1.5,
      pesoPosicaoSolar: 1.0,
      pesoDistanciaRedencao: 1.0,
      pesoDistanciaParcao: 1.0,
      pesoDistanciaSaidaPoa: 1.0,
      pesoComercioProximo: 1.0,
    },
  },
  {
    id: 'economia',
    name: 'Foco em Economia',
    description: 'Prioriza o menor valor financeiro sobre conveniências.',
    weights: {
      pesoPreco: 2.5,
      pesoPosicaoSolar: 0.5,
      pesoDistanciaRedencao: 0.5,
      pesoDistanciaParcao: 0.5,
      pesoDistanciaSaidaPoa: 0.5,
      pesoComercioProximo: 0.8,
    },
  },
  {
    id: 'parques',
    name: 'Foco em Lazer / Parques',
    description: 'Máxima prioridade à proximidade com a Redenção e Parcão.',
    weights: {
      pesoPreco: 1.0,
      pesoPosicaoSolar: 1.0,
      pesoDistanciaRedencao: 2.5,
      pesoDistanciaParcao: 2.5,
      pesoDistanciaSaidaPoa: 0.5,
      pesoComercioProximo: 1.0,
    },
  },
  {
    id: 'conveniencia',
    name: 'Foco em Conveniência',
    description: 'Prioriza abundância de farmácias, padarias e mercados próximos.',
    weights: {
      pesoPreco: 1.0,
      pesoPosicaoSolar: 0.8,
      pesoDistanciaRedencao: 0.5,
      pesoDistanciaParcao: 0.5,
      pesoDistanciaSaidaPoa: 0.5,
      pesoComercioProximo: 2.5,
    },
  },
  {
    id: 'mobilidade',
    name: 'Foco em Mobilidade (Saída)',
    description: 'Privilegia acesso rápido à Freeway e deslocamento metropolitano.',
    weights: {
      pesoPreco: 1.0,
      pesoPosicaoSolar: 0.5,
      pesoDistanciaRedencao: 0.5,
      pesoDistanciaParcao: 0.5,
      pesoDistanciaSaidaPoa: 2.5,
      pesoComercioProximo: 0.8,
    },
  },
];

interface WeightSlidersProps {
  weights: ScoreWeightsState;
  onChange: (weights: ScoreWeightsState) => void;
  tipoTransacao: TipoTransacao;
  isOpen: boolean;
  onClose: () => void;
}

export const WeightSliders: React.FC<WeightSlidersProps> = ({
  weights,
  onChange,
  tipoTransacao,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const isVenda = tipoTransacao === 'venda';

  const updateWeight = (field: keyof ScoreWeightsState, val: number) => {
    onChange({
      ...weights,
      [field]: val,
    });
  };

  const sliders = [
    {
      key: 'pesoPreco' as const,
      label: isVenda ? 'Preço por m² (Venda)' : 'Custo Total Mensal (Aluguel)',
      description: isVenda
        ? 'Impacto do valor do metro quadrado na nota geral'
        : 'Impacto da soma aluguel + condomínio + IPTU na nota geral',
      icon: TrendingDown,
      color: 'text-emerald-500',
    },
    {
      key: 'pesoPosicaoSolar' as const,
      label: 'Orientação Solar',
      description: 'Valoriza faces Norte (manhã/tarde) e Leste',
      icon: Sun,
      color: 'text-amber-500',
    },
    {
      key: 'pesoDistanciaRedencao' as const,
      label: 'Parque da Redenção',
      description: 'Proximidade com o Parque Farroupilha',
      icon: Compass,
      color: 'text-blue-500',
    },
    {
      key: 'pesoDistanciaParcao' as const,
      label: 'Parque Moinhos de Vento (Parcão)',
      description: 'Proximidade com a área nobre do Moinhos',
      icon: Compass,
      color: 'text-indigo-500',
    },
    {
      key: 'pesoDistanciaSaidaPoa' as const,
      label: 'Saída para Freeway',
      description: 'Acesso às saídas norte de Porto Alegre',
      icon: Car,
      color: 'text-orange-500',
    },
    {
      key: 'pesoComercioProximo' as const,
      label: 'Comércios a pé (1 km)',
      description: 'Densidade de farmácias, padarias e supermercados',
      icon: ShoppingBag,
      color: 'text-emerald-600',
    },
  ];

  return (
    <div className="border-b bg-card px-6 py-4 shadow-inner">
      <div className="flex flex-col gap-4">
        {/* Header do Painel */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">
              Ajuste de Pesos do Score Multicritério
            </h3>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
              Recálculo instantâneo no cliente
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onChange(DEFAULT_WEIGHTS)}
              className="flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Restaurar Padrão</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border px-2.5 py-1 text-xs font-semibold hover:bg-muted"
            >
              Recolher
            </button>
          </div>
        </div>

        {/* Presets Rápidos */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-xs font-semibold text-muted-foreground mr-1">Perfis Prontos:</span>
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onChange(preset.weights)}
              title={preset.description}
              className="flex items-center gap-1 rounded-lg border bg-secondary/40 px-2.5 py-1 text-xs font-medium text-foreground transition hover:border-primary hover:bg-primary/10"
            >
              <Sparkles className="h-3 w-3 text-primary" />
              <span>{preset.name}</span>
            </button>
          ))}
        </div>

        {/* Sliders Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
          {sliders.map((s) => {
            const currentVal = weights[s.key];
            const Icon = s.icon;

            return (
              <div
                key={s.key}
                className="flex flex-col gap-2 rounded-xl border bg-background/50 p-3"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <Icon className={`h-3.5 w-3.5 ${s.color}`} />
                    <span className="font-semibold text-foreground">{s.label}</span>
                  </div>
                  <span className="font-mono font-bold text-primary">{currentVal.toFixed(1)}x</span>
                </div>

                <p className="text-[10px] text-muted-foreground line-clamp-1">{s.description}</p>

                <Slider.Root
                  className="relative flex h-5 w-full touch-none select-none items-center"
                  value={[currentVal]}
                  max={3.0}
                  min={0.0}
                  step={0.1}
                  onValueChange={(val) => updateWeight(s.key, val[0])}
                >
                  <Slider.Track className="relative h-1.5 grow rounded-full bg-secondary">
                    <Slider.Range className="absolute h-full rounded-full bg-primary" />
                  </Slider.Track>
                  <Slider.Thumb
                    className="block h-4 w-4 rounded-full border-2 border-primary bg-background shadow-md transition-transform hover:scale-110 focus:outline-none"
                    aria-label={s.label}
                  />
                </Slider.Root>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
