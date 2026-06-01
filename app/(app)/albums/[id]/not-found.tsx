import Link from "next/link";
import { ArrowLeft, Disc3 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AlbumNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center animate-fade-in">
      <Disc3 className="h-16 w-16 text-muted-foreground/40" />
      <h1 className="mt-6 font-display text-2xl font-bold">Album not found</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        This album doesn&apos;t exist in your collection — it may have been
        deleted, or the URL is incorrect.
      </p>
      <Button asChild variant="outline" className="mt-6">
        <Link href="/albums">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Catalogue
        </Link>
      </Button>
    </div>
  );
}
