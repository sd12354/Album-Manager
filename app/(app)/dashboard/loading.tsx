import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function DashboardLoading() {
  return (
    <div className="animate-fade-in">
      <Skeleton className="h-9 w-48" />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card
            key={i}
            className={`animate-fade-in-up stagger-${i + 1}`}
          >
            <CardContent className="p-6">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-3 h-9 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8">
        <Skeleton className="h-6 w-32" />
        <div className="mt-4 flex gap-3">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-40" />
        </div>
      </div>

      <div className="mt-8">
        <Skeleton className="h-6 w-32" />
        <Card className="mt-4">
          <CardContent className="p-0">
            <div className="divide-y divide-white/8">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-6 py-4"
                >
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-56" />
                  </div>
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
