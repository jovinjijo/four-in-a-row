import { Suspense } from "react";
import GameClient from "../../../components/GameClient";

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <Suspense fallback={<div>Loading game...</div>}>
        <GameClient gameId={id} />
      </Suspense>
    </div>
  );
}
