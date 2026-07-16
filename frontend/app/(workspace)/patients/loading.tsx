import { Skeleton } from "@/components/ui/skeleton";

export default function PatientsLoading() {
  return (
    <div>
      <Skeleton className="h-8 w-40" />
      <Skeleton className="mt-2 h-4 w-72" />
      <div className="mt-8 flex items-center justify-between">
        <Skeleton className="h-11 w-72" />
        <Skeleton className="h-11 w-40" />
      </div>
      <div className="mt-6 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    </div>
  );
}
