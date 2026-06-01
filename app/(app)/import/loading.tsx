import { Skeleton } from "@/components/ui/skeleton";

export default function ImportLoading() {
  return (
    <div className="animate-fade-in">
      <Skeleton className="h-9 w-40" />
      <div className="mx-auto mt-8 flex max-w-md items-center justify-center gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>
      <div className="mx-auto mt-10 max-w-2xl">
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </div>
  );
}
