-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "fabricTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CCCSnapshot" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "dio" DOUBLE PRECISION NOT NULL,
    "dso" DOUBLE PRECISION NOT NULL,
    "dpo" DOUBLE PRECISION NOT NULL,
    "ccc" DOUBLE PRECISION NOT NULL,
    "benchmarkDio" DOUBLE PRECISION NOT NULL DEFAULT 38,
    "benchmarkDso" DOUBLE PRECISION NOT NULL DEFAULT 45,
    "benchmarkDpo" DOUBLE PRECISION NOT NULL DEFAULT 42,
    "benchmarkCcc" DOUBLE PRECISION NOT NULL DEFAULT 41,
    "recommendations" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CCCSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_userId_key" ON "Company"("userId");

-- CreateIndex
CREATE INDEX "Company_userId_idx" ON "Company"("userId");

-- CreateIndex
CREATE INDEX "CCCSnapshot_companyId_idx" ON "CCCSnapshot"("companyId");

-- CreateIndex
CREATE INDEX "CCCSnapshot_createdAt_idx" ON "CCCSnapshot"("createdAt");

-- AddForeignKey
ALTER TABLE "CCCSnapshot" ADD CONSTRAINT "CCCSnapshot_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
