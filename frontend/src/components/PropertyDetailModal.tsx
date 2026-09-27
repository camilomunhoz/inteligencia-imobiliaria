import React, { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { type Imovel } from '../types/imovel.js';
import {
  X,
  MapPin,
  Sun,
  Compass,
  ShoppingBag,
  ExternalLink,
  Sparkles,
  TrendingDown,
  Car,
  Calendar,
  Edit3,
  Check,
  Loader2,
  History,
  AlertTriangle,
} from 'lucide-react';

interface PropertyDetailModalProps {
  imovel: Imovel | null;
  onClose: () => void;
  onPropertyUpdated?: () => void;
}

interface HistoricoItem {
  id: number;
  tipo_transacao: string;
  preco: string;
  condominio?: string;
  iptu?: string;
  custo_total_mensal?: string;
  capturado_em: string;
}

export const PropertyDetailModal: React.FC<PropertyDetailModalProps> = ({
  imovel,
  onClose,
  onPropertyUpdated,
}) => {
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editSuccess, setEditSuccess] = useState(false);

  // Campos de edição manual
  const [editPreco, setEditPreco] = useState<number>(0);
  const [editCondominio, setEditCondominio] = useState<number>(0);
  const [editIptu, setEditIptu] = useState<number>(0);
  const [editArea, setEditArea] = useState<number>(0);
  const [editPosicao, setEditPosicao] = useState<string>('Indefinido');

  useEffect(() => {
    if (!imovel) return;

    setEditPreco(imovel.preco || 0);
    setEditCondominio(imovel.condominio || 0);
    setEditIptu(imovel.iptu || 0);
    setEditArea(imovel.area_util || 0);
    setEditPosicao(imovel.posicao_solar || 'Indefinido');
    setIsEditing(false);
    setEditSuccess(false);

    // Buscar histórico temporal de preços
    setLoadingHistory(true);
    fetch(`/api/imoveis/${imovel.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.historico_precos) {
          setHistorico(data.historico_precos);
        }
      })
      .catch((err) => console.error('Erro ao carregar histórico:', err))
      .finally(() => setLoadingHistory(false));
  }, [imovel]);

  if (!imovel) return null;

  const isVenda = imovel.tipo_transacao === 'venda';
  const mainImage = imovel.imagens?.[0] || 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80';

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const getScoreColor = (score: number) => {
    if (score >= 8.0) return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-200';
    if (score >= 6.0) return 'text-blue-600 bg-blue-50 dark:bg-blue-950/60 dark:text-blue-400 border-blue-200';
    if (score >= 4.0) return 'text-amber-600 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-400 border-amber-200';
    return 'text-rose-600 bg-rose-50 dark:bg-rose-950/60 dark:text-rose-400 border-rose-200';
  };

  const getScoreBarColor = (score: number) => {
    if (score >= 8.0) return 'bg-emerald-500';
    if (score >= 6.0) return 'bg-blue-500';
    if (score >= 4.0) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  const handleSaveManualReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingEdit(true);
    setEditSuccess(false);

    try {
      const res = await fetch(`/api/imoveis/${imovel.id}/revisao`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          preco: editPreco,
          condominio: editCondominio,
          iptu: editIptu,
          area_util: editArea,
          posicao_solar: editPosicao,
          confianca_extracao: 'alta', // Validação manual confirmada
        }),
      });

      if (!res.ok) throw new Error('Falha ao salvar revisão.');

      setEditSuccess(true);
      setTimeout(() => {
        setIsEditing(false);
        setEditSuccess(false);
        onPropertyUpdated?.();
      }, 1000);
    } catch (err) {
      console.error(err);
      alert('Erro ao atualizar os dados do imóvel.');
    } finally {
      setSavingEdit(false);
    }
  };

  const subScoreItems = [
    {
      label: isVenda ? 'Preço por m²' : 'Custo Total Mensal',
      score: imovel.subScores?.preco ?? 5,
      detail: isVenda ? `${formatCurrency(imovel.preco_m2)}/m²` : `${formatCurrency(imovel.custo_total_mensal || imovel.preco)}/mês`,
      icon: TrendingDown,
    },
    {
      label: 'Posição Solar',
      score: imovel.subScores?.posicaoSolar ?? 5,
      detail: imovel.posicao_solar || 'Não informada',
      icon: Sun,
    },
    {
      label: 'Parque da Redenção',
      score: imovel.subScores?.distanciaRedencao ?? 5,
      detail: `${(imovel.distanciaRedencao / 1000).toFixed(2)} km`,
      icon: Compass,
    },
    {
      label: 'Parque Moinhos (Parcão)',
      score: imovel.subScores?.distanciaParcao ?? 5,
      detail: `${(imovel.distanciaParcao / 1000).toFixed(2)} km`,
      icon: Compass,
    },
    {
      label: 'Saída para Freeway',
      score: imovel.subScores?.distanciaSaidaPoa ?? 5,
      detail: `${(imovel.distanciaSaidaPoa / 1000).toFixed(2)} km`,
      icon: Car,
    },
    {
      label: 'Comércios em 1 km',
      score: imovel.subScores?.comercioProximo ?? 5,
      detail: `${imovel.comercio1km} farmácias, mercados e padarias`,
      icon: ShoppingBag,
    },
  ];

  return (
    <Dialog.Root open={!!imovel} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[92vh] w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border bg-card p-6 shadow-2xl focus:outline-none">
          {/* Header */}
          <div className="flex items-start justify-between border-b pb-4">
            <div className="pr-6">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-primary">
                  {isVenda ? 'Venda' : 'Aluguel'}
                </span>
                <span className="text-xs text-muted-foreground">ID #{imovel.id}</span>
                {imovel.confianca_extracao === 'baixa' && (
                  <span className="flex items-center gap-1 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 px-2 py-0.5 text-[10px] font-semibold">
                    <AlertTriangle className="h-3 w-3" />
                    Pendente de Revisão
                  </span>
                )}
              </div>
              <Dialog.Title className="mt-2 text-xl font-bold leading-tight text-foreground">
                {imovel.titulo}
              </Dialog.Title>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span>{imovel.endereco || imovel.bairro || 'Porto Alegre, RS'}</span>
              </div>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          {/* Imagem Principal */}
          <div className="mt-4 relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-muted">
            <img
              src={mainImage}
              alt={imovel.titulo}
              className="h-full w-full object-cover"
            />
            <div className="absolute bottom-3 right-3">
              <div
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 shadow-md backdrop-blur-md ${getScoreColor(
                  imovel.scoreFinal
                )}`}
              >
                <span className="text-xs font-bold uppercase tracking-wider">Score Geral</span>
                <span className="text-lg font-black">{imovel.scoreFinal.toFixed(1)}</span>
                <span className="text-xs opacity-75">/ 10</span>
              </div>
            </div>
          </div>

          {/* Financeiro Detalhado & Revisão Manual */}
          <div className="mt-5 rounded-xl border bg-secondary/30 p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Composição Financeira
              </h4>
              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span>{isEditing ? 'Cancelar Edição' : 'Revisar / Ajustar Valores'}</span>
              </button>
            </div>

            {isEditing ? (
              <form onSubmit={handleSaveManualReview} className="space-y-3 pt-1">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                      {isVenda ? 'Preço de Venda (R$)' : 'Aluguel Base (R$)'}
                    </label>
                    <input
                      type="number"
                      value={editPreco}
                      onChange={(e) => setEditPreco(Number(e.target.value))}
                      className="w-full rounded-lg border bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                      Área Útil (m²)
                    </label>
                    <input
                      type="number"
                      value={editArea}
                      onChange={(e) => setEditArea(Number(e.target.value))}
                      className="w-full rounded-lg border bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                      Condomínio (R$)
                    </label>
                    <input
                      type="number"
                      value={editCondominio}
                      onChange={(e) => setEditCondominio(Number(e.target.value))}
                      className="w-full rounded-lg border bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                      IPTU Mensal (R$)
                    </label>
                    <input
                      type="number"
                      value={editIptu}
                      onChange={(e) => setEditIptu(Number(e.target.value))}
                      className="w-full rounded-lg border bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-2">
                    <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                      Orientação Solar
                    </label>
                    <select
                      value={editPosicao}
                      onChange={(e) => setEditPosicao(e.target.value)}
                      className="w-full rounded-lg border bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                    >
                      <option value="Norte">Norte (Excelente)</option>
                      <option value="Leste">Leste (Sol da manhã)</option>
                      <option value="Oeste">Oeste (Sol da tarde)</option>
                      <option value="Sul">Sul (Sem sol direto)</option>
                      <option value="Indefinido">Indefinido</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t">
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
                  >
                    {savingEdit ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : editSuccess ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : null}
                    <span>{editSuccess ? 'Salvo!' : 'Confirmar e Recalcular'}</span>
                  </button>
                </div>
              </form>
            ) : isVenda ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="rounded-lg bg-card p-3 border">
                  <span className="text-[11px] text-muted-foreground block">Valor de Venda</span>
                  <span className="text-base font-bold text-foreground">{formatCurrency(imovel.preco)}</span>
                </div>
                <div className="rounded-lg bg-card p-3 border">
                  <span className="text-[11px] text-muted-foreground block">Área Útil</span>
                  <span className="text-base font-bold text-foreground">{imovel.area_util} m²</span>
                </div>
                <div className="rounded-lg bg-card p-3 border">
                  <span className="text-[11px] text-muted-foreground block">Preço / m²</span>
                  <span className="text-base font-bold text-foreground">{formatCurrency(imovel.preco_m2)}</span>
                </div>
                <div className="rounded-lg bg-card p-3 border">
                  <span className="text-[11px] text-muted-foreground block">Condomínio</span>
                  <span className="text-base font-bold text-foreground">{imovel.condominio ? formatCurrency(imovel.condominio) : 'Isento'}</span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="rounded-lg bg-card p-3 border">
                  <span className="text-[11px] text-muted-foreground block">Aluguel Base</span>
                  <span className="text-base font-bold text-foreground">{formatCurrency(imovel.preco)}/mês</span>
                </div>
                <div className="rounded-lg bg-card p-3 border">
                  <span className="text-[11px] text-muted-foreground block">Condomínio</span>
                  <span className="text-base font-bold text-foreground">{formatCurrency(imovel.condominio)}/mês</span>
                </div>
                <div className="rounded-lg bg-card p-3 border">
                  <span className="text-[11px] text-muted-foreground block">IPTU</span>
                  <span className="text-base font-bold text-foreground">{formatCurrency(imovel.iptu)}/mês</span>
                </div>
                <div className="rounded-lg bg-primary/10 border border-primary/20 p-3">
                  <span className="text-[11px] font-semibold text-primary block">Custo Total Mensal</span>
                  <span className="text-base font-extrabold text-primary">
                    {formatCurrency(imovel.custo_total_mensal || imovel.preco)}/mês
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Histórico Temporal de Preços */}
          <div className="mt-4 rounded-xl border bg-card p-4">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2.5">
              <History className="h-3.5 w-3.5" />
              <span>Histórico de Preços e Variação Temporal</span>
            </div>

            {loadingHistory ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                <span>Carregando histórico...</span>
              </div>
            ) : historico.length <= 1 ? (
              <p className="text-xs text-muted-foreground py-1">
                Primeira cotação registrada. Variações temporais serão listadas automaticamente conforme novas capturas do anúncio forem realizadas.
              </p>
            ) : (
              <div className="space-y-2">
                {historico.map((h, idx) => (
                  <div key={h.id} className="flex items-center justify-between rounded-lg border bg-secondary/20 px-3 py-2 text-xs">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        {new Date(h.capturado_em).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {idx === historico.length - 1 && (
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                          Atual
                        </span>
                      )}
                    </div>
                    <span className="font-bold text-foreground">
                      {formatCurrency(Number(h.preco))}
                      {h.custo_total_mensal && !isVenda && (
                        <span className="text-muted-foreground text-[11px] font-normal ml-1">
                          (Total: {formatCurrency(Number(h.custo_total_mensal))})
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Análise de Inteligência Artificial */}
          {imovel.comentario_ia && (
            <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-primary mb-1.5">
                <Sparkles className="h-4 w-4" />
                <span>Parecer da IA Local (Qwen 2.5)</span>
                {imovel.confianca_extracao && (
                  <span className="ml-auto text-[10px] font-normal text-muted-foreground">
                    Confiança: {imovel.confianca_extracao}
                  </span>
                )}
              </div>
              <p className="text-xs leading-relaxed text-foreground/90 italic">
                "{imovel.comentario_ia}"
              </p>
            </div>
          )}

          {/* Decomposição dos Sub-Scores */}
          <div className="mt-5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
              Decomposição Multicritério do Score
            </h4>
            <div className="space-y-2.5">
              {subScoreItems.map((item, idx) => (
                <div key={idx} className="flex flex-col gap-1 rounded-lg border bg-card p-3">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <item.icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-semibold text-foreground">{item.label}</span>
                      <span className="text-muted-foreground text-[11px]">({item.detail})</span>
                    </div>
                    <span className="font-bold text-foreground">{item.score.toFixed(1)} / 10</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${getScoreBarColor(item.score)}`}
                      style={{ width: `${Math.min(100, Math.max(0, item.score * 10))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer com link original */}
          <div className="mt-6 flex items-center justify-between border-t pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted"
            >
              Fechar
            </button>
            {imovel.url_origem && (
              <a
                href={imovel.url_origem}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
              >
                <span>Acessar Anúncio Original</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
