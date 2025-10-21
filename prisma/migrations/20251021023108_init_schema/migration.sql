/*
  Warnings:

  - You are about to drop the column `createdAt` on the `RefreshToken` table. All the data in the column will be lost.
  - You are about to drop the column `ip` on the `RefreshToken` table. All the data in the column will be lost.
  - You are about to drop the column `tokenHash` on the `RefreshToken` table. All the data in the column will be lost.
  - You are about to drop the column `userAgent` on the `RefreshToken` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[token]` on the table `RefreshToken` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `token` to the `RefreshToken` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."RefreshToken_tokenHash_key";

-- AlterTable
ALTER TABLE "RefreshToken" DROP COLUMN "createdAt",
DROP COLUMN "ip",
DROP COLUMN "tokenHash",
DROP COLUMN "userAgent",
ADD COLUMN     "token" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");
