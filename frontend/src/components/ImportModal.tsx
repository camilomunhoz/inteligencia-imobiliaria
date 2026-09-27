import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Link2, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
}) => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setErrorMessage(null);
    setStatusMessage('Acessando o anúncio e extraindo dados...');

    try {
      const response = await fetch('/api/imoveis/importar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Falha ao processar o anúncio');
      }

      setStatusMessage('Imóvel importado e analisado com sucesso!');
      setTimeout(() => {
        setLoading(false);
        setUrl('');
        setStatusMessage(null);
        onClose();
        onImportSuccess();
      }, 1200);
    } catch (err: any) {
      setLoading(false);
      setErrorMessage(err.message || 'Erro inesperado ao importar o imóvel');
      setStatusMessage(null);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setUrl('');
    setErrorMessage(null);
    setStatusMessage(null);
    onClose();
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-card p-6 shadow-xl focus:outline-none">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <Dialog.Title className="text-lg font-bold text-foreground">
                Importar Novo Anúncio
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-xs text-muted-foreground">
                Insira a URL de um anúncio (VivaReal, Zap, QuintoAndar ou imobiliárias locais de Porto Alegre).
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                disabled={loading}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleImport} className="mt-4 space-y-4">
            <div>
              <label htmlFor="url" className="block text-xs font-semibold text-foreground mb-1.5">
                URL do Anúncio
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                  <Link2 className="h-4 w-4" />
                </div>
                <input
                  id="url"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.exemplo.com.br/imovel/123456"
                  required
                  disabled={loading}
                  className="w-full rounded-lg border bg-background py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                />
              </div>
            </div>

            {loading && (
              <div className="flex items-center gap-2.5 rounded-lg bg-primary/10 p-3 text-xs text-primary">
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                <span>{statusMessage}</span>
              </div>
            )}

            {statusMessage && !loading && (
              <div className="flex items-center gap-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 p-3 text-xs text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{statusMessage}</span>
              </div>
            )}

            {errorMessage && (
              <div className="flex items-center gap-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 p-3 text-xs text-rose-700 dark:text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="rounded-lg border px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || !url.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Processando...</span>
                  </>
                ) : (
                  <span>Iniciar Ingestão</span>
                )}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
