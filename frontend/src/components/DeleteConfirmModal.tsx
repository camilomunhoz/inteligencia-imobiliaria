import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { type Imovel } from '../types/imovel.js';
import { AlertTriangle, Loader2, Trash2, X } from 'lucide-react';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  imovel: Imovel | null;
  onClose: () => void;
  onSuccess: (deletedId: number) => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  imovel,
  onClose,
  onSuccess,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!imovel) return null;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const isVenda = imovel.tipo_transacao === 'venda';
  const mainImage =
    imovel.imagens?.[0] ||
    'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=80';

  const handleConfirm = async () => {
    setIsDeleting(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/imoveis/${imovel.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro ao excluir imóvel (código ${res.status})`);
      }

      onSuccess(imovel.id);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha na comunicação com o servidor ao excluir o imóvel.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    if (isDeleting) return;
    setErrorMsg(null);
    onClose();
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-6 shadow-2xl focus:outline-none">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60">
                <Trash2 className="h-5 w-5" />
              </div>
              <Dialog.Title className="text-base font-bold text-foreground">
                Excluir Imóvel
              </Dialog.Title>
            </div>
            <button
              onClick={handleClose}
              disabled={isDeleting}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Resumo do Imóvel a Deletar */}
          <div className="mt-4 rounded-xl border border-border/80 bg-secondary/30 p-3 flex gap-3 items-center">
            <img
              src={mainImage}
              alt={imovel.titulo}
              className="h-16 w-20 rounded-lg object-cover bg-muted shrink-0"
            />
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-background border border-border text-foreground">
                {isVenda ? 'Venda' : 'Aluguel'}
              </span>
              <p className="mt-1 text-xs font-bold text-foreground line-clamp-1">
                {imovel.titulo}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                {imovel.bairro || 'Porto Alegre'} • {formatCurrency(isVenda ? imovel.preco : (imovel.custo_total_mensal || imovel.preco))}
              </p>
            </div>
          </div>

          {/* Aviso Destrutivo */}
          <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/60 p-3 text-xs text-rose-800 dark:text-rose-200">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
            <p className="leading-relaxed">
              Esta ação removerá permanentemente o imóvel da base de dados e apagará todas as imagens locais em disco.
            </p>
          </div>

          {errorMsg && (
            <div className="mt-3 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 p-2.5 rounded-lg border border-rose-200 dark:border-rose-900/60">
              {errorMsg}
            </div>
          )}

          {/* Ações */}
          <div className="mt-6 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={handleClose}
              disabled={isDeleting}
              className="rounded-lg border border-border bg-background px-3.5 py-2 text-xs font-medium text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isDeleting}
              className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-rose-700 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Excluindo...</span>
                </>
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Excluir Definitivamente</span>
                </>
              )}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
