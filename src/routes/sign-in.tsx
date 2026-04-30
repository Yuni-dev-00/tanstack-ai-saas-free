import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { seo } from "@/utils/seo";
import { SITE_NAME } from "@/lib/site";

export const Route = createFileRoute("/sign-in")({
  head: () => seo({ title: `登录 | ${SITE_NAME}`, noindex: true }),
  component: SignInPage,
});

// Tell the opener we're signed in, then close this popup. If the user reached
// /sign-in as a normal tab (no opener), stay put and let the navbar refresh
// itself on next mount.
function notifyOpenerAndClose() {
  if (window.opener && !window.opener.closed) {
    window.opener.postMessage({ type: "auth:signed-in" }, window.location.origin);
    window.close();
  } else {
    window.location.href = "/";
  }
}

function SignInPage() {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, setIsPending] = React.useState(false);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsPending(true);
    const { error } = await authClient.signIn.email({ email, password });
    setIsPending(false);
    if (error) {
      setError(error.message ?? "登录失败");
      return;
    }
    notifyOpenerAndClose();
  };

  const handleGoogle = async () => {
    setError(null);
    // Full-page redirect *inside the popup* to Google. After Google calls
    // back, Better Auth sets the cookie and 302s us to /auth/success, which
    // posts to the opener and closes itself.
    await authClient.signIn.social({
      provider: "google",
      callbackURL: "/auth/success",
    });
  };

  const handlePasskey = async () => {
    setError(null);
    setIsPending(true);
    const result = await authClient.signIn.passkey();
    setIsPending(false);
    if (result?.error) {
      setError(result.error.message ?? "Passkey 登录失败");
      return;
    }
    notifyOpenerAndClose();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">欢迎回来</h1>
          <p className="text-sm text-muted-foreground">登录你的账号继续</p>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleGoogle}
        >
          <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.99 10.99 0 0 0 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.12A6.6 6.6 0 0 1 5.5 12c0-.74.13-1.45.34-2.12V7.04H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.96l3.66-2.84z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.04l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z"
            />
          </svg>
          使用 Google 继续
        </Button>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handlePasskey}
          disabled={isPending}
        >
          使用 Passkey 登录
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">或</span>
          </div>
        </div>

        <form onSubmit={handleEmail} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">邮箱</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">密码</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "登录中…" : "登录"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          还没账号？{" "}
          <Link to="/sign-up" className="text-primary underline underline-offset-4">
            注册
          </Link>
        </p>
      </div>
    </div>
  );
}
