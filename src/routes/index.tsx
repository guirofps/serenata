import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="max-w-xl text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        Uma música feita da história de quem você ama
      </h1>
      <p className="max-w-md text-muted-foreground">
        Conte a história, receba a letra na hora — de graça. Em breve no ar.
      </p>
    </main>
  );
}
