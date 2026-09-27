export interface ExtractedImovelData {
  tipo_transacao: 'venda' | 'aluguel';
  titulo: string;
  preco: number;
  condominio: number;
  iptu: number;
  area_util: number;
  endereco: string;
  bairro: string;
  posicao_solar?: 'Norte' | 'Sul' | 'Leste' | 'Oeste' | 'Indefinido';
  comentario_analise: string;
  confianca_extracao: 'baixa' | 'media' | 'alta';
}

const PROPERTY_JSON_SCHEMA = {
  type: 'object',
  properties: {
    tipo_transacao: {
      type: 'string',
      enum: ['venda', 'aluguel'],
      description: 'Modalidade do anúncio: "venda" (para comprar) ou "aluguel" (locação)',
    },
    titulo: {
      type: 'string',
      description: 'Título conciso do anúncio do imóvel',
    },
    preco: {
      type: 'number',
      description: 'Preço principal em Reais: valor de VENDA ou valor mensal de ALUGUEL (apenas o número, ex: 450000 ou 2500)',
    },
    condominio: {
      type: 'number',
      description: 'Valor mensal da taxa de condomínio em Reais (0 se não informado ou isento)',
    },
    iptu: {
      type: 'number',
      description: 'Valor mensal do IPTU em Reais (0 se não informado ou isento)',
    },
    area_util: {
      type: 'number',
      description: 'Área útil ou privativa em metros quadrados (apenas o número, ex: 65.5)',
    },
    endereco: {
      type: 'string',
      description: 'Endereço completo incluindo rua, número (se houver), bairro, Porto Alegre - RS',
    },
    bairro: {
      type: 'string',
      description: 'Bairro do imóvel em Porto Alegre (ex: Bom Fim, Petrópolis, Menino Deus)',
    },
    posicao_solar: {
      type: 'string',
      enum: ['Norte', 'Sul', 'Leste', 'Oeste', 'Indefinido'],
      description: 'Orientação solar predominante mencionada no anúncio',
    },
    comentario_analise: {
      type: 'string',
      description: 'Resumo com principais pontos fortes e fracos do imóvel identificado na descrição',
    },
    confianca_extracao: {
      type: 'string',
      enum: ['baixa', 'media', 'alta'],
      description: 'Autoavaliação do modelo sobre a clareza e precisão das informações extraídas',
    },
  },
  required: [
    'tipo_transacao',
    'titulo',
    'preco',
    'condominio',
    'iptu',
    'area_util',
    'endereco',
    'bairro',
    'comentario_analise',
    'confianca_extracao',
  ],
};

export async function extractWithOllama(
  markdownText: string,
  pageTitle: string
): Promise<ExtractedImovelData> {
  const host = process.env.OLLAMA_HOST || 'http://localhost:11434';
  const model = process.env.OLLAMA_MODEL || 'qwen2.5:7b';

  console.log(`[LLM] Enviando texto limpo para Ollama (${model} em ${host})...`);

  const prompt = `Você é um analista imobiliário especialista em Porto Alegre - RS.
Sua tarefa é extrair estritamente as informações do anúncio imobiliário fornecido abaixo.

Instruções cruciais:
1. "tipo_transacao": Identifique com máxima atenção se o anúncio é de "venda" (comprar) ou de "aluguel" (locação).
2. "preco": Se for venda, coloque o valor total de venda. Se for aluguel, coloque o valor mensal do aluguel básico. Não junte condomínio ou IPTU no campo "preco".
3. "condominio": Taxa mensal de condomínio (apenas o número, ou 0 se não informado).
4. "iptu": Valor mensal de IPTU (apenas o número, ou 0 se não informado). Se o anúncio trouxer IPTU anual, divida por 12.
5. "area_util": Área útil ou privativa em m² (número float, ex: 65).
6. "endereco": Formate com Rua/Av, Bairro, "Porto Alegre - RS". Se não houver número, use apenas rua e bairro.
7. "bairro": Nome do bairro em Porto Alegre.
8. "posicao_solar": Se a orientação for citada (manhã = Leste, tarde = Oeste, Norte, Sul), preencha. Caso contrário, use "Indefinido".
9. "comentario_analise": Destaque pontos fortes e eventuais pontos fracos/atenções.
10. "confianca_extracao": "alta" se valores e localização estiverem explícitos; "media" se faltou endereço exato mas tem bairro e valores; "baixa" se algum valor essencial estiver duvidoso.

Título original da página: ${pageTitle}

Conteúdo do anúncio em Markdown:
---
${markdownText}
---`;

  let response;
  try {
    response = await fetch(`${host}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        format: PROPERTY_JSON_SCHEMA,
        stream: false,
        options: {
          temperature: 0.1,
        },
      }),
      signal: AbortSignal.timeout(120000),
    });
  } catch (fetchErr: unknown) {
    const err = fetchErr as Error;
    if (err.name === 'TimeoutError') {
      throw new Error(`Tempo limite excedido (2 min) ao aguardar inferência do Ollama (${model}).`);
    }
    throw new Error(
      `Não foi possível conectar ao Ollama em "${host}". Verifique se o Ollama está aberto e rodando no seu computador (erro: ${err.message}).`
    );
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Falha na resposta do Ollama (HTTP ${response.status}): ${errorText}`);
  }

  const json = (await response.json()) as {
    message?: { content?: string };
  };

  const rawContent = json.message?.content;
  if (!rawContent) {
    throw new Error('Ollama retornou resposta vazia.');
  }

  let parsed: ExtractedImovelData;
  try {
    parsed = JSON.parse(rawContent) as ExtractedImovelData;
  } catch {
    throw new Error(`Erro ao fazer parse do JSON retornado pelo Ollama: ${rawContent}`);
  }

  // Sanitização e validação numérica pós-LLM
  parsed.condominio = Math.max(0, Number(parsed.condominio) || 0);
  parsed.iptu = Math.max(0, Number(parsed.iptu) || 0);

  if (typeof parsed.preco !== 'number' || isNaN(parsed.preco) || parsed.preco <= 0) {
    console.warn(`[LLM] Preço inválido recebido: ${parsed.preco}. Marcando confiança como baixa.`);
    parsed.preco = Math.max(0, Number(parsed.preco) || 0);
    parsed.confianca_extracao = 'baixa';
  }

  if (typeof parsed.area_util !== 'number' || isNaN(parsed.area_util) || parsed.area_util <= 0) {
    console.warn(`[LLM] Área útil inválida recebida: ${parsed.area_util}. Marcando confiança como baixa.`);
    parsed.area_util = Math.max(0, Number(parsed.area_util) || 0);
    parsed.confianca_extracao = 'baixa';
  }

  if (parsed.tipo_transacao !== 'aluguel' && parsed.tipo_transacao !== 'venda') {
    parsed.tipo_transacao = 'venda';
  }

  return parsed;
}
