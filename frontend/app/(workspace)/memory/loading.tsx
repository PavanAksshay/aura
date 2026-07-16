import { Skeleton } from "@/components/ui/skeleton";

export default function MemoryLoading() {
  return (
    <div className="mx-auto max-w-3xl">
      <Skeleton className="mx-auto h-8 w-56" />
      <Skeleton className="mx-auto mt-2 h-4 w-80" />
      <Skeleton className="mt-8 h-20 w-full rounded-3xl" />
      <Skeleton className="mx-auto mt-10 h-40 w-full rounded-2xl" />
    </div>
  );
}
