ALTER TABLE "pontos_interesse" ADD COLUMN "hash_id" varchar(64);--> statement-breakpoint
ALTER TABLE "pontos_interesse" ADD CONSTRAINT "pontos_interesse_hash_id_unique" UNIQUE("hash_id");