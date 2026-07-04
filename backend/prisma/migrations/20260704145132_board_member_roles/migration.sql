-- CreateEnum
CREATE TYPE "BoardRole" AS ENUM ('ADMIN', 'EDITOR', 'VIEWER');

-- AlterTable
ALTER TABLE "BoardMember" ADD COLUMN     "role" "BoardRole" NOT NULL DEFAULT 'EDITOR';
