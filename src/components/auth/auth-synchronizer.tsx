import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authKeys } from "@/lib/auth-store";

export function AuthSynchronizer() {
  const qc = useQueryClient();

  useEffect(() => {
    let lastRefetch = 0;
    const refresh = () => {
      const now = Date.now();
      if (now - lastRefetch < 1000) return;
      lastRefetch = now;
      qc.invalidateQueries({ queryKey: [...authKeys.session] });
    };

    const bc =
      typeof BroadcastChannel === "undefined"
        ? null
        : new BroadcastChannel("auth");

    const onBc = (event: MessageEvent) => {
      if ((event.data as { type?: string } | null)?.type === "auth:signed-in") {
        refresh();
      }
    };
    bc?.addEventListener("message", onBc);

    const onStorage = (e: StorageEvent) => {
      if (e.key === "auth:signed-in-at") refresh();
    };
    window.addEventListener("storage", onStorage);

    return () => {
      bc?.removeEventListener("message", onBc);
      bc?.close();
      window.removeEventListener("storage", onStorage);
    };
  }, [qc]);

  return null;
}
