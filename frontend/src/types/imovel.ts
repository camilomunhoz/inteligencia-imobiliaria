export type TipoTransacao = 'venda' | 'aluguel';

export interface SubScores {
  preco: number;
  posicaoSolar: number;
  distanciaRedencao: number;
  distanciaParcao: number;
  distanciaSaidaPoa: number;
  comercioProximo: number;
}

export interface Imovel {
  id: number;
  url_origem?: string;
  tipo_transacao: TipoTransacao;
  titulo: string;
  preco: number;
  condominio: number;
  iptu: number;
  custo_total_mensal?: number;
  area_util: number;
  preco_m2: number;
  endereco: string;
  bairro: string;
  posicao_solar?: string;
  comentario_ia?: string;
  confianca_extracao?: 'baixa' | 'media' | 'alta';
  imagens?: string[];
  latitude: number;
  longitude: number;
  distanciaRedencao: number;
  distanciaParcao: number;
  distanciaSaidaPoa: number;
  comercio1km: number;
  scoreFinal: number;
  subScores: SubScores;
}
