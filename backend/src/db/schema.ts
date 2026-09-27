import {
  pgTable,
  serial,
  varchar,
  text,
  numeric,
  timestamp,
  jsonb,
  integer,
  customType,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// Tipo customizado para geometria PostGIS Point WGS84 (SRID 4326)
export const geometryPoint = customType<{
  data: string;
  driverData: string;
}>({
  dataType() {
    return 'geometry(Point, 4326)';
  },
});

export const imoveis = pgTable('imoveis', {
  id: serial('id').primaryKey(),
  urlOrigem: varchar('url_origem', { length: 1000 }).unique(),
  titulo: varchar('titulo', { length: 255 }).notNull(),
  preco: numeric('preco', { precision: 12, scale: 2 }).notNull(),
  areaUtil: numeric('area_util', { precision: 10, scale: 2 }).notNull(),
  precoM2: numeric('preco_m2', { precision: 12, scale: 2 }),
  endereco: text('endereco').notNull(),
  bairro: varchar('bairro', { length: 100 }),
  posicaoSolar: varchar('posicao_solar', { length: 20 }), // 'Norte', 'Sul', 'Leste', 'Oeste'
  comentarioIa: text('comentario_ia'),
  confiancaExtracao: varchar('confianca_extracao', { length: 20 }).default('media'), // 'baixa', 'media', 'alta'
  imagens: jsonb('imagens').$type<string[]>().default([]),
  geom: geometryPoint('geom'),
  criadoEm: timestamp('criado_em').defaultNow().notNull(),
  atualizadoEm: timestamp('atualizado_em').defaultNow().notNull(),
});

export const pontosInteresse = pgTable('pontos_interesse', {
  id: serial('id').primaryKey(),
  hashId: varchar('hash_id', { length: 64 }).unique(),
  nome: varchar('nome', { length: 255 }).notNull(),
  categoria: varchar('categoria', { length: 50 }).notNull(), // 'parque', 'referencia_pessoal', 'supermercado', 'farmacia', 'padaria'
  origem: varchar('origem', { length: 20 }).notNull().default('osm'), // 'manual', 'osm'
  geom: geometryPoint('geom'),
  criadoEm: timestamp('criado_em').defaultNow().notNull(),
});

export const pesosConfiguracao = pgTable('pesos_configuracao', {
  id: serial('id').primaryKey(),
  nomePerfil: varchar('nome_perfil', { length: 50 }).notNull().unique(),
  pesoPrecoM2: numeric('peso_preco_m2', { precision: 5, scale: 2 }).notNull().default('1.00'),
  pesoPosicaoSolar: numeric('peso_posicao_solar', { precision: 5, scale: 2 }).notNull().default('1.00'),
  pesoDistanciaRedencao: numeric('peso_distancia_redencao', { precision: 5, scale: 2 }).notNull().default('1.00'),
  pesoDistanciaParcao: numeric('peso_distancia_parcao', { precision: 5, scale: 2 }).notNull().default('1.00'),
  pesoDistanciaSaidaPoa: numeric('peso_distancia_saida_poa', { precision: 5, scale: 2 }).notNull().default('1.00'),
  pesoComercioProximo: numeric('peso_comercio_proximo', { precision: 5, scale: 2 }).notNull().default('1.00'),
  criadoEm: timestamp('criado_em').defaultNow().notNull(),
});

export const imoveisHistoricoPreco = pgTable('imoveis_historico_preco', {
  id: serial('id').primaryKey(),
  imovelId: integer('imovel_id').references(() => imoveis.id, { onDelete: 'cascade' }).notNull(),
  preco: numeric('preco', { precision: 12, scale: 2 }).notNull(),
  capturadoEm: timestamp('capturado_em').defaultNow().notNull(),
});
