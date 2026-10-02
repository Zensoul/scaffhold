/*
  Warnings:

  - The `followUpInputType` column on the `solve_steps` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "solve_steps" DROP COLUMN "followUpInputType",
ADD COLUMN     "followUpInputType" "InputType";
