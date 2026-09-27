export interface ExtractedImovelData {
  titulo: string;
  preco: number;
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
    titulo: {
      type: 'string',
      description: 'Título conciso do anúncio do imóvel',
    },
    preco: {
      type: 'number',
      description: 'Preço de venda do imóvel em Reais (apenas o número, ex: 450000.00)',
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
    'titulo',
    'preco',
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
1. Extraia o valor de VENDA (campo "preco") como número float (ex: se for R$ 450.000, coloque 450000). Não confunda com condomínio ou IPTU.
2. Extraia a área útil ou privativa (campo "area_util") em m² como número float (ex: 65).
3. Formate o "endereco" com Rua/Av, Bairro, "Porto Alegre - RS". Se não houver número, use apenas rua e bairro.
4. Identifique o "bairro".
5. Se a orientação solar for citada (manhã = Leste, tarde = Oeste, Norte, Sul), preencha "posicao_solar". Se não for mencionada, use "Indefinido".
6. Em "comentario_analise", destaque resumidamente os pontos fortes e eventuais pontos fracos/atenções.
7. Em "confianca_extracao", avalie sua certeza sobre os dados encontrados: "alta" se preço, área e endereço estão explícitos; "media" se faltou endereço exato mas tem bairro e valores; "baixa" se algum dado essencial está duvidoso.

Título original da página: ${pageTitle}

Conteúdo do anúncio em Markdown:
---
${markdownText}
---`;

  const response = await fetch(`${host}/api/chat`, {
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
        temperature: 0.1, // temperatura baixa para precisão numérica
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Falha na chamada ao Ollama (HTTP ${response.status}): ${errorText}`);
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

  // Validação estrita pós-LLM dos campos numéricos
  if (typeof parsed.preco !== 'number' || isNaN(parsed.preco) || parsed.preco <= 0) {
    console.warn(`[LLM] Preco invalido recebido: ${parsed.preco}. Marcando confianca como baixa.`);
    parsed.preco = Math.max(0, Number(parsed.preco) || 0);
    parsed.confianca_extracao = 'baixa';
  }

  if (typeof parsed.area_util !== 'number' || isNaN(parsed.area_util) || parsed.area_util <= 0) {
    console.warn(`[LLM] Area util invalida recebida: ${parsed.area_util}. Marcando confianca como baixa.`);
    parsed.area_util = Math.max(0, Number(parsed.area_util) || 0);
    parsed.confianca_extracao = 'baixa';
  }

  return parsed;
}
