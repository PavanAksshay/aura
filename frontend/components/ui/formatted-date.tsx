"use client";

import { useEffect, useState } from "react";

export function FormattedDate({
  iso,
  format = "full",
  className,
}: {
  iso: string;
  format?: "full" | "date" | "time";
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const date = new Date(iso);

  if (!mounted) {
    // Initial server render (suppress hydration mismatch)
    return (
      <span className={className} suppressHydrationWarning>
        {date.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}
      </span>
    );
  }

  let formatted = "";
  if (format === "full") {
    formatted = date.toLocaleString(undefined, {
      month: "numeric",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  } else if (format === "date") {
    formatted = date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } else if (format === "time") {
    formatted = date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  return <span className={className}>{formatted}</span>;
}
