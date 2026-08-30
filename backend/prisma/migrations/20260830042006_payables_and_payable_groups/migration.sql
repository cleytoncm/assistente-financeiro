-- CreateEnum
CREATE TYPE "PayableRecurrenceType" AS ENUM ('installment', 'recurring');

-- CreateTable
CREATE TABLE "payable_groups" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "recurrence_type" "PayableRecurrenceType" NOT NULL,
    "installment_count" INTEGER,
    "amount" DECIMAL(12,2) NOT NULL,
    "due_day" INTEGER NOT NULL,
    "description" TEXT,
    "counterparty" TEXT,
    "account_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payable_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payables" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "group_id" TEXT,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "due_date" DATE NOT NULL,
    "installment_number" INTEGER,
    "description" TEXT,
    "counterparty" TEXT,
    "account_id" TEXT,
    "paid_amount" DECIMAL(12,2),
    "paid_transaction_id" TEXT,
    "paid_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancellation_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payables_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payables_paid_transaction_id_key" ON "payables"("paid_transaction_id");

-- AddForeignKey
ALTER TABLE "payable_groups" ADD CONSTRAINT "payable_groups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payable_groups" ADD CONSTRAINT "payable_groups_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payables" ADD CONSTRAINT "payables_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payables" ADD CONSTRAINT "payables_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "payable_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payables" ADD CONSTRAINT "payables_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payables" ADD CONSTRAINT "payables_paid_transaction_id_fkey" FOREIGN KEY ("paid_transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CheckConstraint: installment_count preenchido sse recurrence_type='installment' (RF-02/RF-03)
ALTER TABLE "payable_groups" ADD CONSTRAINT "payable_groups_installment_count_iff_installment"
  CHECK (("recurrence_type" = 'installment') = ("installment_count" IS NOT NULL));

-- CheckConstraint: paid_transaction_id e paid_at nulos ou preenchidos juntos (RF-05)
ALTER TABLE "payables" ADD CONSTRAINT "payables_paid_fields_together"
  CHECK (("paid_transaction_id" IS NULL) = ("paid_at" IS NULL));

-- CheckConstraint: motivo de cancelamento só existe se a parcela está cancelada (RF-08)
ALTER TABLE "payables" ADD CONSTRAINT "payables_cancellation_reason_requires_cancelled_at"
  CHECK ("cancelled_at" IS NOT NULL OR "cancellation_reason" IS NULL);
