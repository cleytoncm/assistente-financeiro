-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('income', 'expense');

-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "is_hidden" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "cards" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "is_hidden" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "name" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "category_id" TEXT,
    "account_id" TEXT,
    "card_id" TEXT,
    "refund_of_transaction_id" TEXT,
    "installment_group_id" TEXT,
    "installment_number" INTEGER,
    "installment_count" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_refund_of_transaction_id_fkey" FOREIGN KEY ("refund_of_transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CheckConstraint: exatamente uma de account_id/card_id (RF-01)
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_exactly_one_destination"
  CHECK (("account_id" IS NOT NULL) <> ("card_id" IS NOT NULL));

-- CheckConstraint: campos de parcelamento todos nulos ou todos preenchidos juntos (RF-02)
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_installment_fields_together"
  CHECK (
    ("installment_group_id" IS NULL AND "installment_number" IS NULL AND "installment_count" IS NULL)
    OR
    ("installment_group_id" IS NOT NULL AND "installment_number" IS NOT NULL AND "installment_count" IS NOT NULL)
  );

-- UniqueIndex: nome+tipo único por usuário, tratando categorias do seed (user_id nulo) como um
-- "usuário" comum para fins de unicidade (coalesce evita que NULL burle a checagem de duplicata)
CREATE UNIQUE INDEX "categories_user_name_type_key"
  ON "categories" (COALESCE("user_id", '0'), "name", "type");
