-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Status" AS ENUM ('ON', 'OFF');

-- CreateTable
CREATE TABLE "areas" (
    "id" SERIAL NOT NULL,
    "state" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "area" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "comunity_updates" (
    "id" SERIAL NOT NULL,
    "name" TEXT,
    "area_id" INTEGER NOT NULL,
    "status" "Status" NOT NULL,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "schedules" (
    "id" SERIAL NOT NULL,
    "areaId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "status" "Status" NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "areas_id_key" ON "areas"("id");

-- CreateIndex
CREATE UNIQUE INDEX "areas_state_city_area_key" ON "areas"("state", "city", "area");

-- CreateIndex
CREATE UNIQUE INDEX "comunity_updates_id_key" ON "comunity_updates"("id");

-- CreateIndex
CREATE UNIQUE INDEX "schedules_id_key" ON "schedules"("id");

-- AddForeignKey
ALTER TABLE "comunity_updates" ADD CONSTRAINT "comunity_updates_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "areas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
