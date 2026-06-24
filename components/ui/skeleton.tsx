import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Skeleton({ className, ...props }: SkeletonProps) {
  // `animate-shimmer` sets both a base background-color and a gradient overlay
  // that's theme-aware (see app/globals.css), so we don't need bg-input here —
  // adding it would override the gradient in light mode and hide the shimmer.
  return (
    <div
      className={cn(
        "animate-shimmer rounded-md",
        className
      )}
      {...props}
    />
  );
}
