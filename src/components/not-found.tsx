import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Home, Search, FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useRouteLocale } from "@/lib/i18n/use-route-locale";
import { useT } from "@/lib/i18n/useT";

export function NotFound({ children }: { children?: ReactNode }) {
  const urlLocale = useRouteLocale();
  const { messages } = useT();
  const nf = messages.notFound;
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center space-y-6">
            {/* Icon */}
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
              <FileQuestion className="h-10 w-10 text-muted-foreground" />
            </div>

            {/* Heading */}
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {nf?.title ?? "Page Not Found"}
              </h1>
              <div className="text-muted-foreground">
                {children || (
                  <p>
                    {nf?.description ?? "The page you're looking for doesn't exist or has been moved."}
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <Button 
                variant="default" 
                onClick={() => window.history.back()}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                {nf?.goBack ?? "Go Back"}
              </Button>
              <Button variant="outline" asChild>
                <Link
                  to="/{-$locale}"
                  params={{ locale: urlLocale }}
                  className="flex items-center gap-2"
                >
                  <Home className="h-4 w-4" />
                  {nf?.home ?? "Home"}
                </Link>
              </Button>
            </div>

            {/* Help text */}
            <div className="pt-4 border-t w-full">
              <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center">
                <Search className="h-4 w-4" />
                <span>
                  {nf?.helpText ?? "Try checking the URL or use the search functionality"}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
