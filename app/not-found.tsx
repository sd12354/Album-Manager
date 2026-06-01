import Link from "next/link";
import { Disc3 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-base px-6 text-center animate-fade-in">
      <Disc3 className="h-20 w-20 text-muted-foreground/40" />
      <h1 className="mt-6 font-display text-3xl font-bold">Page not found</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        That page doesn&apos;t exist. If you just edited code and the dev server
        is acting up, try <code className="text-accent">npm run dev:clean</code>
        {" "}to clear the .next cache.
      </p>
      <Button asChild className="mt-6">
        <Link href="/dashboard">Go to Dashboard</Link>
      </Button>
    </div>
  );
}
