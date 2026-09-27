CREATE EXTENSION IF NOT EXISTS postgis;
--> statement-breakpoint
CREATE TABLE "imoveis" (
	"id" serial PRIMARY KEY NOT NULL,
	"url_origem" varchar(1000),
	"titulo" varchar(255) NOT NULL,
	"preco" numeric(12, 2) NOT NULL,
	"area_util" numeric(10, 2) NOT NULL,
	"preco_m2" numeric(12, 2),
	"endereco" text NOT NULL,
	"bairro" varchar(100),
	"posicao_solar" varchar(20),
	"comentario_ia" text,
	"confianca_extracao" varchar(20) DEFAULT 'media',
	"imagens" jsonb DEFAULT '[]'::jsonb,
	"geom" geometry(Point, 4326),
	"criado_em" timestamp DEFAULT now() NOT NULL,
	"atualizado_em" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "imoveis_url_origem_unique" UNIQUE("url_origem")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_imoveis_geom" ON "imoveis" USING GIST ("geom");
--> statement-breakpoint
CREATE TABLE "imoveis_historico_preco" (
	"id" serial PRIMARY KEY NOT NULL,
	"imovel_id" integer NOT NULL,
	"preco" numeric(12, 2) NOT NULL,
	"capturado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pesos_configuracao" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome_perfil" varchar(50) NOT NULL,
	"peso_preco_m2" numeric(5, 2) DEFAULT '1.00' NOT NULL,
	"peso_posicao_solar" numeric(5, 2) DEFAULT '1.00' NOT NULL,
	"peso_distancia_redencao" numeric(5, 2) DEFAULT '1.00' NOT NULL,
	"peso_distancia_parcao" numeric(5, 2) DEFAULT '1.00' NOT NULL,
	"peso_distancia_saida_poa" numeric(5, 2) DEFAULT '1.00' NOT NULL,
	"peso_comercio_proximo" numeric(5, 2) DEFAULT '1.00' NOT NULL,
	"criado_em" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pesos_configuracao_nome_perfil_unique" UNIQUE("nome_perfil")
);
--> statement-breakpoint
INSERT INTO "pesos_configuracao" (
	"nome_perfil",
	"peso_preco_m2",
	"peso_posicao_solar",
	"peso_distancia_redencao",
	"peso_distancia_parcao",
	"peso_distancia_saida_poa",
	"peso_comercio_proximo"
) VALUES (
	'padrao',
	1.00,
	1.00,
	1.00,
	1.00,
	1.00,
	1.00
) ON CONFLICT ("nome_perfil") DO NOTHING;
--> statement-breakpoint
CREATE TABLE "pontos_interesse" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" varchar(255) NOT NULL,
	"categoria" varchar(50) NOT NULL,
	"origem" varchar(20) DEFAULT 'osm' NOT NULL,
	"geom" geometry(Point, 4326),
	"criado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_pontos_interesse_geom" ON "pontos_interesse" USING GIST ("geom");
--> statement-breakpoint
ALTER TABLE "imoveis_historico_preco" ADD CONSTRAINT "imoveis_historico_preco_imovel_id_imoveis_id_fk" FOREIGN KEY ("imovel_id") REFERENCES "public"."imoveis"("id") ON DELETE cascade ON UPDATE no action;