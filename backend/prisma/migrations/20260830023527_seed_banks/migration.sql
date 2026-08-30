-- Seed do catálogo de bancos (RF-06) — populado como parte da migration para que
-- `prisma migrate deploy` sozinho já deixe o catálogo pronto em qualquer ambiente.
INSERT INTO "banks" ("id", "name", "code", "created_at") VALUES
  (gen_random_uuid(), 'Banco do Brasil', '001', now()),
  (gen_random_uuid(), 'Banco do Nordeste', '004', now()),
  (gen_random_uuid(), 'Banrisul', '041', now()),
  (gen_random_uuid(), 'Inter', '077', now()),
  (gen_random_uuid(), 'Caixa Econômica Federal', '104', now()),
  (gen_random_uuid(), 'XP Investimentos', '102', now()),
  (gen_random_uuid(), 'Original', '212', now()),
  (gen_random_uuid(), 'Bradesco', '237', now()),
  (gen_random_uuid(), 'BTG Pactual', '208', now()),
  (gen_random_uuid(), 'Nubank', '260', now()),
  (gen_random_uuid(), 'Mercado Pago', '323', now()),
  (gen_random_uuid(), 'C6 Bank', '336', now()),
  (gen_random_uuid(), 'Itaú Unibanco', '341', now()),
  (gen_random_uuid(), 'Safra', '422', now()),
  (gen_random_uuid(), 'PagBank', '290', now()),
  (gen_random_uuid(), 'Neon', '735', now()),
  (gen_random_uuid(), 'Sicredi', '748', now()),
  (gen_random_uuid(), 'Sicoob', '756', now()),
  (gen_random_uuid(), 'Santander', '033', now())
ON CONFLICT ("code") DO NOTHING;
