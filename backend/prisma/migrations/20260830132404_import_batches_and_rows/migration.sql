-- CreateEnum
CREATE TYPE "ImportFormat" AS ENUM ('ofx', 'csv', 'pdf_invoice');

-- CreateEnum
CREATE TYPE "ImportMode" AS ENUM ('staged', 'direct');

-- CreateEnum
CREATE TYPE "ImportBatchStatus" AS ENUM ('processando', 'aguardando_revisao', 'concluido', 'falhou');

-- CreateEnum
CREATE TYPE "ImportedRowResolution" AS ENUM ('pendente', 'aceita', 'descartada');

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "external_id" TEXT,
ADD COLUMN     "import_batch_id" TEXT;

-- CreateTable
CREATE TABLE "import_batches" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "format" "ImportFormat" NOT NULL,
    "account_id" TEXT,
    "card_id" TEXT,
    "mode" "ImportMode" NOT NULL,
    "status" "ImportBatchStatus" NOT NULL DEFAULT 'processando',
    "file_hash" CHAR(64) NOT NULL,
    "raw_content" BYTEA,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imported_rows" (
    "id" TEXT NOT NULL,
    "import_batch_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "type" "TransactionType" NOT NULL,
    "external_id" TEXT,
    "is_duplicate_suspect" BOOLEAN NOT NULL DEFAULT false,
    "duplicate_of_transaction_id" TEXT,
    "suggested_category_id" TEXT,
    "resolution" "ImportedRowResolution" NOT NULL DEFAULT 'pendente',
    "created_transaction_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "imported_rows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "imported_rows_created_transaction_id_key" ON "imported_rows"("created_transaction_id");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imported_rows" ADD CONSTRAINT "imported_rows_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imported_rows" ADD CONSTRAINT "imported_rows_duplicate_of_transaction_id_fkey" FOREIGN KEY ("duplicate_of_transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imported_rows" ADD CONSTRAINT "imported_rows_suggested_category_id_fkey" FOREIGN KEY ("suggested_category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imported_rows" ADD CONSTRAINT "imported_rows_created_transaction_id_fkey" FOREIGN KEY ("created_transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CheckConstraint: exatamente um entre account_id e card_id (RF-01)
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_exactly_one_destination"
  CHECK (("account_id" IS NOT NULL) <> ("card_id" IS NOT NULL));

-- CheckConstraint: pdf_invoice exige card_id; ofx/csv exigem account_id (RF-01)
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_format_matches_destination"
  CHECK (
    ("format" = 'pdf_invoice' AND "card_id" IS NOT NULL)
    OR
    ("format" IN ('ofx', 'csv') AND "account_id" IS NOT NULL)
  );

-- UniqueIndex: FITID único por conta/cartão de destino, usado na detecção de duplicata exata
-- (RF-04). Parcial (WHERE external_id IS NOT NULL) porque a maioria das transactions nunca tem
-- external_id (só as vindas de import OFX) e não deve competir por unicidade entre si.
CREATE UNIQUE INDEX "transactions_account_external_id_key"
  ON "transactions" ("account_id", "external_id")
  WHERE "external_id" IS NOT NULL AND "account_id" IS NOT NULL;

CREATE UNIQUE INDEX "transactions_card_external_id_key"
  ON "transactions" ("card_id", "external_id")
  WHERE "external_id" IS NOT NULL AND "card_id" IS NOT NULL;
