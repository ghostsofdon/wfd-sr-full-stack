-- CreateTable
CREATE TABLE "properties" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "address" VARCHAR(500),
    "city" VARCHAR(100),
    "state" VARCHAR(2),
    "zip_code" VARCHAR(10),
    "status" VARCHAR(50) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unit_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "property_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "bedrooms" INTEGER,
    "bathrooms" DECIMAL(3,1),
    "square_footage" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unit_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "property_id" UUID NOT NULL,
    "unit_type_id" UUID NOT NULL,
    "unit_number" VARCHAR(50) NOT NULL,
    "floor" INTEGER,
    "status" VARCHAR(50) NOT NULL DEFAULT 'available',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unit_pricing" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "unit_id" UUID NOT NULL,
    "base_rent" DECIMAL(10,2) NOT NULL,
    "market_rent" DECIMAL(10,2) NOT NULL,
    "effective_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unit_pricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "residents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "property_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(20),
    "status" VARCHAR(50) NOT NULL DEFAULT 'active',
    "move_in_date" DATE,
    "move_out_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "residents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "property_id" UUID NOT NULL,
    "resident_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "lease_start_date" DATE NOT NULL,
    "lease_end_date" DATE NOT NULL,
    "monthly_rent" DECIMAL(10,2) NOT NULL,
    "lease_type" VARCHAR(50) NOT NULL DEFAULT 'fixed',
    "status" VARCHAR(50) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resident_ledger" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "property_id" UUID NOT NULL,
    "resident_id" UUID NOT NULL,
    "transaction_type" VARCHAR(50) NOT NULL,
    "charge_code" VARCHAR(100),
    "amount" DECIMAL(10,2) NOT NULL,
    "transaction_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resident_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "renewal_offers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "property_id" UUID NOT NULL,
    "resident_id" UUID NOT NULL,
    "lease_id" UUID NOT NULL,
    "renewal_start_date" DATE NOT NULL,
    "renewal_end_date" DATE,
    "proposed_rent" DECIMAL(10,2),
    "offer_expiration_date" DATE,
    "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "renewal_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "renewal_risk_scores" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "property_id" UUID NOT NULL,
    "resident_id" UUID NOT NULL,
    "lease_id" UUID NOT NULL,
    "risk_score" INTEGER NOT NULL,
    "risk_tier" VARCHAR(10) NOT NULL,
    "calculated_at" TIMESTAMP(3) NOT NULL,
    "as_of_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "renewal_risk_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_signals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "risk_score_id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "resident_id" UUID NOT NULL,
    "days_to_expiry" INTEGER NOT NULL,
    "payment_history_delinquent" BOOLEAN NOT NULL,
    "no_renewal_offer_yet" BOOLEAN NOT NULL,
    "rent_growth_above_market" BOOLEAN NOT NULL,
    "current_rent" DECIMAL(10,2) NOT NULL,
    "market_rent" DECIMAL(10,2),
    "rent_delta_pct" DECIMAL(5,2),
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_delivery_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_id" VARCHAR(255) NOT NULL,
    "property_id" UUID NOT NULL,
    "resident_id" UUID NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "last_attempt_at" TIMESTAMP(3),
    "next_retry_at" TIMESTAMP(3),
    "rms_response_status" INTEGER,
    "rms_response_body" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_delivery_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_dead_letter_queue" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "webhook_delivery_log_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "moved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_dead_letter_queue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "properties_name_key" ON "properties"("name");

-- CreateIndex
CREATE INDEX "properties_status_idx" ON "properties"("status");

-- CreateIndex
CREATE UNIQUE INDEX "unit_types_property_id_name_key" ON "unit_types"("property_id", "name");

-- CreateIndex
CREATE INDEX "units_property_id_idx" ON "units"("property_id");

-- CreateIndex
CREATE INDEX "units_status_idx" ON "units"("status");

-- CreateIndex
CREATE UNIQUE INDEX "units_property_id_unit_number_key" ON "units"("property_id", "unit_number");

-- CreateIndex
CREATE INDEX "unit_pricing_unit_id_idx" ON "unit_pricing"("unit_id");

-- CreateIndex
CREATE INDEX "unit_pricing_effective_date_idx" ON "unit_pricing"("effective_date");

-- CreateIndex
CREATE UNIQUE INDEX "unit_pricing_unit_id_effective_date_key" ON "unit_pricing"("unit_id", "effective_date");

-- CreateIndex
CREATE INDEX "residents_property_id_idx" ON "residents"("property_id");

-- CreateIndex
CREATE INDEX "residents_unit_id_idx" ON "residents"("unit_id");

-- CreateIndex
CREATE INDEX "residents_status_idx" ON "residents"("status");

-- CreateIndex
CREATE INDEX "leases_property_id_idx" ON "leases"("property_id");

-- CreateIndex
CREATE INDEX "leases_resident_id_idx" ON "leases"("resident_id");

-- CreateIndex
CREATE INDEX "leases_lease_end_date_idx" ON "leases"("lease_end_date");

-- CreateIndex
CREATE INDEX "leases_status_idx" ON "leases"("status");

-- CreateIndex
CREATE INDEX "resident_ledger_property_id_idx" ON "resident_ledger"("property_id");

-- CreateIndex
CREATE INDEX "resident_ledger_resident_id_idx" ON "resident_ledger"("resident_id");

-- CreateIndex
CREATE INDEX "resident_ledger_transaction_date_idx" ON "resident_ledger"("transaction_date");

-- CreateIndex
CREATE INDEX "resident_ledger_transaction_type_idx" ON "resident_ledger"("transaction_type");

-- CreateIndex
CREATE INDEX "renewal_offers_property_id_idx" ON "renewal_offers"("property_id");

-- CreateIndex
CREATE INDEX "renewal_offers_resident_id_idx" ON "renewal_offers"("resident_id");

-- CreateIndex
CREATE INDEX "renewal_offers_status_idx" ON "renewal_offers"("status");

-- CreateIndex
CREATE INDEX "renewal_risk_scores_property_id_as_of_date_idx" ON "renewal_risk_scores"("property_id", "as_of_date" DESC);

-- CreateIndex
CREATE INDEX "renewal_risk_scores_resident_id_calculated_at_idx" ON "renewal_risk_scores"("resident_id", "calculated_at" DESC);

-- CreateIndex
CREATE INDEX "renewal_risk_scores_property_id_risk_tier_idx" ON "renewal_risk_scores"("property_id", "risk_tier");

-- CreateIndex
CREATE UNIQUE INDEX "renewal_risk_scores_resident_id_as_of_date_key" ON "renewal_risk_scores"("resident_id", "as_of_date");

-- CreateIndex
CREATE UNIQUE INDEX "risk_signals_risk_score_id_key" ON "risk_signals"("risk_score_id");

-- CreateIndex
CREATE INDEX "risk_signals_risk_score_id_idx" ON "risk_signals"("risk_score_id");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_delivery_log_event_id_key" ON "webhook_delivery_log"("event_id");

-- CreateIndex
CREATE INDEX "webhook_delivery_log_status_next_retry_at_idx" ON "webhook_delivery_log"("status", "next_retry_at");

-- CreateIndex
CREATE INDEX "webhook_delivery_log_property_id_created_at_idx" ON "webhook_delivery_log"("property_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "webhook_dead_letter_queue_webhook_delivery_log_id_key" ON "webhook_dead_letter_queue"("webhook_delivery_log_id");

-- AddForeignKey
ALTER TABLE "unit_types" ADD CONSTRAINT "unit_types_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_unit_type_id_fkey" FOREIGN KEY ("unit_type_id") REFERENCES "unit_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_pricing" ADD CONSTRAINT "unit_pricing_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "residents" ADD CONSTRAINT "residents_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "residents" ADD CONSTRAINT "residents_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leases" ADD CONSTRAINT "leases_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leases" ADD CONSTRAINT "leases_resident_id_fkey" FOREIGN KEY ("resident_id") REFERENCES "residents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leases" ADD CONSTRAINT "leases_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resident_ledger" ADD CONSTRAINT "resident_ledger_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resident_ledger" ADD CONSTRAINT "resident_ledger_resident_id_fkey" FOREIGN KEY ("resident_id") REFERENCES "residents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renewal_offers" ADD CONSTRAINT "renewal_offers_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renewal_offers" ADD CONSTRAINT "renewal_offers_resident_id_fkey" FOREIGN KEY ("resident_id") REFERENCES "residents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renewal_offers" ADD CONSTRAINT "renewal_offers_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "leases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renewal_risk_scores" ADD CONSTRAINT "renewal_risk_scores_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renewal_risk_scores" ADD CONSTRAINT "renewal_risk_scores_resident_id_fkey" FOREIGN KEY ("resident_id") REFERENCES "residents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renewal_risk_scores" ADD CONSTRAINT "renewal_risk_scores_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "leases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_signals" ADD CONSTRAINT "risk_signals_risk_score_id_fkey" FOREIGN KEY ("risk_score_id") REFERENCES "renewal_risk_scores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_delivery_log" ADD CONSTRAINT "webhook_delivery_log_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_delivery_log" ADD CONSTRAINT "webhook_delivery_log_resident_id_fkey" FOREIGN KEY ("resident_id") REFERENCES "residents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_dead_letter_queue" ADD CONSTRAINT "webhook_dead_letter_queue_webhook_delivery_log_id_fkey" FOREIGN KEY ("webhook_delivery_log_id") REFERENCES "webhook_delivery_log"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
