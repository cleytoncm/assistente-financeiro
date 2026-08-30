-- Seed do catálogo de categorias (RF-03) — populado como parte da migration para que
-- `prisma migrate deploy` sozinho já deixe o catálogo pronto em qualquer ambiente.
INSERT INTO "categories" ("id", "user_id", "name", "type", "created_at") VALUES
  (gen_random_uuid(), NULL, 'Salário', 'income', now()),
  (gen_random_uuid(), NULL, 'Freelance', 'income', now()),
  (gen_random_uuid(), NULL, 'Investimentos', 'income', now()),
  (gen_random_uuid(), NULL, 'Outras receitas', 'income', now()),
  (gen_random_uuid(), NULL, 'Alimentação', 'expense', now()),
  (gen_random_uuid(), NULL, 'Transporte', 'expense', now()),
  (gen_random_uuid(), NULL, 'Moradia', 'expense', now()),
  (gen_random_uuid(), NULL, 'Saúde', 'expense', now()),
  (gen_random_uuid(), NULL, 'Educação', 'expense', now()),
  (gen_random_uuid(), NULL, 'Lazer', 'expense', now()),
  (gen_random_uuid(), NULL, 'Compras', 'expense', now()),
  (gen_random_uuid(), NULL, 'Contas e serviços', 'expense', now()),
  (gen_random_uuid(), NULL, 'Outras despesas', 'expense', now())
ON CONFLICT (COALESCE("user_id", '0'), "name", "type") DO NOTHING;
