import { Loader2 } from "lucide-react";

export function DefaultPending() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center p-4">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
