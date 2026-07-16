"use client";

/**
 * Fire-and-forget once per mount: records today's activity so the login streak
 * advances. The record_activity() RPC is idempotent per day (migration 0010),
 * so calling it on every workspace load is safe.
 */

import { useEffect, useRef } from "react";

import { createClient } from "@/lib/supabase/client";

export function ActivityPing() {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void (async () => {
      const supabase = createClient();
      await supabase.rpc("record_activity");
    })();
  }, []);
  return null;
}
