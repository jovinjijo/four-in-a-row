import { GamesList } from "@/components/GamesList";

export default function Home() {
  return (
    <main className="min-h-screen mx-auto max-w-4xl p-6 space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Four in a Row – Lobby</h1>
        <p className="text-sm text-gray-500">Create or join a game. Everything updates in realtime via Convex.</p>
      </header>
      <section className="space-y-2">
        <GamesList />
      </section>
      <footer className="text-xs text-gray-500 pt-8 border-t">Built with Next.js & Convex</footer>
    </main>
  );
}
