import { useQuery, useQueryClient } from "@tanstack/react-query";
import { sessionQueryOptions, authKeys } from "@/lib/auth-store";

export function useSession() {
  return useQuery(sessionQueryOptions());
}

export function useRefreshSession() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: [...authKeys.session] });
}
