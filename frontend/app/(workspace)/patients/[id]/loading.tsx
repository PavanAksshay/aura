import { Skeleton } from "@/components/ui/skeleton";

export default function PatientProfileLoading() {
  return (
    <div>
      <Skeleton className="h-44 w-full rounded-3xl" />
      <Skeleton className="mt-10 h-6 w-40" />
      <div className="mt-5 space-y-4 pl-7">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
