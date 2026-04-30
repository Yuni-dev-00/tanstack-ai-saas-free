import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { authKeys } from "@/lib/auth-store";

export function useSignout() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await qc.cancelQueries({ queryKey: [...authKeys.session] });
      qc.setQueryData([...authKeys.session], null);
      return authClient.signOut();
    },
    onSettled: () => {
      qc.removeQueries({ queryKey: [...authKeys.session] });
    },
  });
}
