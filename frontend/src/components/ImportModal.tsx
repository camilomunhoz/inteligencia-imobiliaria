import React, { useState, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  X,
  Link2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  MapPin,
  Database,
  Globe,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
}

interface StepItem {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  status: 'idle' | 'running' | 'done' | 'error';
  message?: string;
}

interface LogEntry {
  timestamp: string;
  step: string;
  status: 'running' | 'done' | 'error';
  message: string;
}

const INITIAL_STEPS: StepItem[] = [
  {
    id: 'deduplicacao',
    label: 'Deduplicação e Checagem',
    description: 'Verifica existência prévia do anúncio no PostgreSQL',
    icon: Database,
    status: 'idle',
  },
  {
    id: 'scraping',
    label: 'Coleta Stealth da Página',
    description: 'Playwright carrega o anúncio contornando proteções',
    icon: Globe,
    status: 'idle',
  },
  {
    id: 'limpeza',
    label: 'Higienização e Fotos',
    description: 'Converte HTML em Markdown e extrai fotos em alta',
    icon: FileText,
    status: 'idle',
  },
  {
    id: 'llm',
    label: 'Inteligência Artificial Local',
    description: 'Qwen 2.5 analisa valores, taxas, dormitórios e orientação solar',
    icon: Sparkles,
    status: 'idle',
  },
  {
    id: 'geocoding',
    label: 'Geocodificação e PostGIS',
    description: 'Calcula coordenadas e métricas de distância espacial',
    icon: MapPin,
    status: 'idle',
  },
];

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
}) => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [steps, setSteps] = useState<StepItem[]>(INITIAL_STEPS);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [completedSuccess, setCompletedSuccess] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const resetState = () => {
    setUrl('');
    setLoading(false);
    setSteps(INITIAL_STEPS.map((s) => ({ ...s, status: 'idle', message: undefined })));
    setLogs([]);
    setShowLogs(false);
    setCompletedSuccess(false);
    setGlobalError(null);
  };

  const handleClose = () => {
    if (loading) {
      if (confirm('A ingestão está em andamento. Deseja cancelar?')) {
        abortControllerRef.current?.abort();
        resetState();
        onClose();
      }
      return;
    }
    resetState();
    onClose();
  };

  const updateStepStatus = (
    stepId: string,
    status: 'running' | 'done' | 'error',
    message: string
  ) => {
    setSteps((prev) =>
      prev.map((step) => {
        // Mapear steps do backend para os 5 passos visuais
        let matches = step.id === stepId;
        if (step.id === 'geocoding' && (stepId === 'persistencia' || stepId === 'postgis')) {
          matches = true;
        }

        if (matches) {
          return {
            ...step,
            status,
            message,
          };
        }
        return step;
      })
    );

    setLogs((prev) => [
      ...prev,
      {
        timestamp: new Date().toLocaleTimeString('pt-BR'),
        step: stepId,
        status,
        message,
      },
    ]);
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetUrl = url.trim();
    if (!targetUrl) return;

    setLoading(true);
    setGlobalError(null);
    setCompletedSuccess(false);
    setSteps(INITIAL_STEPS.map((s) => ({ ...s, status: 'idle', message: undefined })));
    setLogs([]);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('/api/imoveis/importar-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: targetUrl }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Erro na conexão com o servidor (Status ${response.status})`);
      }

      if (!response.body) {
        throw new Error('Servidor não forneceu fluxo legível de resposta.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;

          const jsonStr = trimmed.replace(/^data:\s*/, '');
          if (!jsonStr) continue;

          try {
            const data = JSON.parse(jsonStr);

            if (data.step === 'conclusao') {
              if (data.status === 'done') {
                setCompletedSuccess(true);
                // Marca todos os steps como done
                setSteps((prev) =>
                  prev.map((s) => ({ ...s, status: s.status === 'error' ? 'error' : 'done' }))
                );
                setTimeout(() => {
                  onImportSuccess();
                  handleClose();
                }, 1800);
              } else {
                setGlobalError(data.message || 'Falha na ingestão do anúncio.');
              }
            } else if (data.step === 'erro') {
              setGlobalError(data.message);
              updateStepStatus('erro', 'error', data.message);
            } else {
              updateStepStatus(data.step, data.status, data.message);
            }
          } catch {
            // Ignorar linhas não-JSON
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Ingestão cancelada pelo usuário.');
      } else {
        setGlobalError(err.message || 'Erro inesperado na comunicação com o backend.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card p-6 shadow-2xl focus:outline-none">
          {/* Header */}
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <Dialog.Title className="text-lg font-bold text-foreground">
                Importar Anúncio Imobiliário
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-xs text-muted-foreground">
                Processamento completo: Playwright, Readability, IA local Qwen 2.5 e PostGIS.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                disabled={loading}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          {/* Form */}
          <form onSubmit={handleImport} className="mt-4 space-y-4">
            <div>
              <label htmlFor="import-url" className="block text-xs font-semibold text-foreground mb-1.5">
                URL do Anúncio (Venda ou Aluguel)
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                  <Link2 className="h-4 w-4" />
                </div>
                <input
                  id="import-url"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.zapimoveis.com.br/imovel/... ou viva-real, quintoandar, etc."
                  required
                  disabled={loading || completedSuccess}
                  className="w-full rounded-lg border bg-background py-2.5 pl-9 pr-3 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                />
              </div>
            </div>

            {/* Stepper de Progresso em Tempo Real */}
            {(loading || logs.length > 0 || completedSuccess || globalError) && (
              <div className="rounded-xl border bg-secondary/20 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Progresso da Ingestão
                  </span>
                  {loading && (
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-primary">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Em execução...
                    </span>
                  )}
                  {completedSuccess && (
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" />
                      Concluído com sucesso!
                    </span>
                  )}
                </div>

                <div className="space-y-2.5">
                  {steps.map((step) => {
                    const isRunning = step.status === 'running';
                    const isDone = step.status === 'done';
                    const isError = step.status === 'error';
                    const StepIcon = step.icon;

                    return (
                      <div
                        key={step.id}
                        className={`flex items-start gap-3 rounded-lg border p-2.5 transition-colors ${
                          isRunning
                            ? 'border-primary/50 bg-primary/5 shadow-sm'
                            : isDone
                            ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20'
                            : isError
                            ? 'border-rose-200 bg-rose-50/50 dark:border-rose-900/40 dark:bg-rose-950/20'
                            : 'border-border/60 bg-card/60 opacity-60'
                        }`}
                      >
                        <div className="mt-0.5 shrink-0">
                          {isRunning ? (
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          ) : isDone ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          ) : isError ? (
                            <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                          ) : (
                            <StepIcon className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-xs font-semibold ${
                                isRunning
                                  ? 'text-primary'
                                  : isDone
                                  ? 'text-foreground'
                                  : isError
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : 'text-muted-foreground'
                              }`}
                            >
                              {step.label}
                            </span>
                          </div>

                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {step.message || step.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Acordeão de Logs Detalhados */}
                {logs.length > 0 && (
                  <div className="pt-2 border-t border-border/60">
                    <button
                      type="button"
                      onClick={() => setShowLogs(!showLogs)}
                      className="flex items-center justify-between w-full text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                    >
                      <span>Ver logs detalhados ({logs.length} eventos)</span>
                      {showLogs ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>

                    {showLogs && (
                      <div className="mt-2 max-h-36 overflow-y-auto rounded-lg bg-black/80 p-2.5 font-mono text-[10px] text-zinc-300 space-y-1">
                        {logs.map((log, idx) => (
                          <div key={idx} className="flex items-start gap-2">
                            <span className="text-zinc-500 shrink-0">[{log.timestamp}]</span>
                            <span
                              className={
                                log.status === 'done'
                                  ? 'text-emerald-400'
                                  : log.status === 'error'
                                  ? 'text-rose-400'
                                  : 'text-sky-300'
                              }
                            >
                              [{log.step}]
                            </span>
                            <span className="truncate">{log.message}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Mensagem de Erro Geral */}
            {globalError && (
              <div className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/40 p-3 text-xs text-rose-700 dark:text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-semibold block">Erro na importação:</span>
                  <span>{globalError}</span>
                </div>
              </div>
            )}

            {/* Botoes de Acao */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="rounded-lg border px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50"
              >
                {completedSuccess ? 'Fechar' : 'Cancelar'}
              </button>

              <button
                type="submit"
                disabled={loading || !url.trim() || completedSuccess}
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
