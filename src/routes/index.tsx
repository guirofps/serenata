import { createFileRoute, Link } from "@tanstack/react-router";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="max-w-xl text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        Uma música feita da história de quem você ama
      </h1>
      <p className="max-w-md text-muted-foreground">
        Conte a história de alguém querido e receba a letra de uma música
        personalizada na hora, de graça.
      </p>
      <Link to="/criar" className={cn(buttonVariants({ size: "lg" }))}>
        Criar meu presente
      </Link>
    </main>
  );
}
