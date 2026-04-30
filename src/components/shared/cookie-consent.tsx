import * as React from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/useT";

const STORAGE_KEY = "cookie-consent";

export function CookieConsent() {
  const { messages } = useT();
  const cc = messages.Landing?.CookieConsent;
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
  }, []);

  if (!visible) return null;

  const accept = () => {
    localStorage.setItem(STORAGE_KEY, "accepted");
    setVisible(false);
  };
  const decline = () => {
    localStorage.setItem(STORAGE_KEY, "declined");
    setVisible(false);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background p-4 shadow-lg">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {cc?.message ?? "We use cookies to improve your experience. By continuing, you agree to our use of cookies."}
        </p>
        <div className="flex gap-2 shrink-0">
          <Button variant="ghost" size="sm" onClick={decline}>
            {cc?.decline ?? "Decline"}
          </Button>
          <Button size="sm" onClick={accept}>
            {cc?.accept ?? "Accept"}
          </Button>
        </div>
      </div>
    </div>
  );
}
