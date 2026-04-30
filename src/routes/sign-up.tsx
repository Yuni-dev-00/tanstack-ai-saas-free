import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { seo } from "@/utils/seo";
import { SITE_NAME } from "@/lib/site";

export const Route = createFileRoute("/sign-up")({
  head: () => seo({ title: `注册 | ${SITE_NAME}`, noindex: true }),
  component: SignUpPage,
});

function notifyOpenerAndClose() {
  if (window.opener && !window.opener.closed) {
    window.opener.postMessage({ type: "auth:signed-in" }, window.location.origin);
    window.close();
  } else {
    window.location.href = "/";
  }
}

function SignUpPage() {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, setIsPending] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsPending(true);
    const { error } = await authClient.signUp.email({ email, password, name });
    setIsPending(false);
    if (error) {
      setError(error.message ?? "注册失败");
      return;
    }
    notifyOpenerAndClose();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">创建账号</h1>
          <p className="text-sm text-muted-foreground">几秒钟开通</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">昵称</Label>
            <Input
              id="name"
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
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
              autoComplete="new-password"
              required
              minLength={8}
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
            {isPending ? "创建中…" : "创建账号"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          已有账号？{" "}
          <Link to="/sign-in" className="text-primary underline underline-offset-4">
            登录
          </Link>
        </p>
      </div>
    </div>
  );
}
