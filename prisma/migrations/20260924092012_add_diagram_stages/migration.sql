-- CreateTable
CREATE TABLE "diagram_stages" (
    "id" TEXT NOT NULL,
    "diagramId" TEXT NOT NULL,
    "stageIndex" INTEGER NOT NULL,
    "videoUrl" TEXT,
    "label" TEXT NOT NULL,

    CONSTRAINT "diagram_stages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "diagram_stages_diagramId_stageIndex_key" ON "diagram_stages"("diagramId", "stageIndex");

-- AddForeignKey
ALTER TABLE "diagram_stages" ADD CONSTRAINT "diagram_stages_diagramId_fkey" FOREIGN KEY ("diagramId") REFERENCES "problem_diagrams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
