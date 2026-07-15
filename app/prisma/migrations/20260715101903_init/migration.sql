-- CreateTable
CREATE TABLE "bbq_base_items" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "conditionKey" TEXT,
    "conditionValue" TEXT,
    "qtyPerAdult" DOUBLE PRECISION,
    "qtyPerChild" DOUBLE PRECISION,
    "fixedQty" DOUBLE PRECISION,
    "minQty" DOUBLE PRECISION,
    "stepPeople" INTEGER,
    "stepQty" DOUBLE PRECISION,
    "unit" TEXT NOT NULL,
    "unitPrice" DOUBLE PRECISION,
    "roundMode" TEXT NOT NULL DEFAULT 'up',
    "shortNote" TEXT,
    "detailNote" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "bbq_base_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bbq_lists" (
    "id" TEXT NOT NULL,
    "shareCode" TEXT NOT NULL,
    "adults" INTEGER NOT NULL,
    "children" INTEGER NOT NULL,
    "options" TEXT NOT NULL,
    "aiCallCount" INTEGER NOT NULL DEFAULT 0,
    "surveyTriggered" BOOLEAN NOT NULL DEFAULT false,
    "surveyTriggeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bbq_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bbq_items" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "requiredAmount" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "purchaseQty" DOUBLE PRECISION NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "manualEdit" BOOLEAN NOT NULL DEFAULT false,
    "sourceBaseItemId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bbq_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bbq_feedbacks" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "shortageItems" TEXT NOT NULL,
    "wantedItems" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bbq_feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bbq_rate_limits" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bbq_rate_limits_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "bbq_lists_shareCode_key" ON "bbq_lists"("shareCode");

-- AddForeignKey
ALTER TABLE "bbq_items" ADD CONSTRAINT "bbq_items_listId_fkey" FOREIGN KEY ("listId") REFERENCES "bbq_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bbq_feedbacks" ADD CONSTRAINT "bbq_feedbacks_listId_fkey" FOREIGN KEY ("listId") REFERENCES "bbq_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
