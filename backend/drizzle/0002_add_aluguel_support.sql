ALTER TABLE "imoveis" ADD COLUMN "tipo_transacao" varchar(20) DEFAULT 'venda' NOT NULL;--> statement-breakpoint
ALTER TABLE "imoveis" ADD COLUMN "condominio" numeric(10, 2) DEFAULT '0.00';--> statement-breakpoint
ALTER TABLE "imoveis" ADD COLUMN "iptu" numeric(10, 2) DEFAULT '0.00';--> statement-breakpoint
ALTER TABLE "imoveis" ADD COLUMN "custo_total_mensal" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "imoveis_historico_preco" ADD COLUMN "tipo_transacao" varchar(20) DEFAULT 'venda';--> statement-breakpoint
ALTER TABLE "imoveis_historico_preco" ADD COLUMN "condominio" numeric(10, 2) DEFAULT '0.00';--> statement-breakpoint
ALTER TABLE "imoveis_historico_preco" ADD COLUMN "iptu" numeric(10, 2) DEFAULT '0.00';--> statement-breakpoint
ALTER TABLE "imoveis_historico_preco" ADD COLUMN "custo_total_mensal" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "pesos_configuracao" ADD COLUMN "tipo_transacao" varchar(20) DEFAULT 'venda' NOT NULL;--> statement-breakpoint
ALTER TABLE "pesos_configuracao" ADD COLUMN "peso_custo_mensal" numeric(5, 2) DEFAULT '1.00' NOT NULL;--> statement-breakpoint
INSERT INTO "pesos_configuracao" (
  "nome_perfil",
  "tipo_transacao",
  "peso_preco_m2",
  "peso_custo_mensal",
  "peso_posicao_solar",
  "peso_distancia_redencao",
  "peso_distancia_parcao",
  "peso_distancia_saida_poa",
  "peso_comercio_proximo"
) VALUES (
  'aluguel_padrao',
  'aluguel',
  0.50,
  2.00,
  1.00,
  1.00,
  1.00,
  1.00,
  1.50
) ON CONFLICT ("nome_perfil") DO NOTHING;