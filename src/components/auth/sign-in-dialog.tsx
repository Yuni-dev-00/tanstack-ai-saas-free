import * as React from "react";
import { Loader2, Mail, KeyRound, UserCircle2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { authClient } from "@/lib/auth-client";
import { track } from "@/lib/tracking/client";
import { recordSignupSource } from "@/_server-fns/record-signup-source";
import { TurnstileWidget } from "@/components/auth/turnstile-widget";
import { useSiteConfig } from "@/lib/hooks/use-site-config";

interface SignInDialogProps {
  trigger?: React.ReactNode;
  onSuccess?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

type Action = "google" | "passkey" | "email" | "magic" | "otp-send" | "otp-verify" | "anon" | null;

// Open Google's OAuth page in a new browser window. Better Auth gives us the
// URL via `disableRedirect: true`; we open it ourselves so the host page and
// its state stay put. /auth/success picks up the session cookie and posts
// {type:"auth:signed-in"} back here — the navbar's existing listener reacts.
function openOAuthWindow(url: string) {
  const width = 520;
  const height = 640;
  const top = window.top?.outerHeight
    ? Math.max(0, (window.top.outerHeight - height) / 2 + (window.top.screenY ?? 0))
    : 100;
  const left = window.top?.outerWidth
    ? Math.max(0, (window.top.outerWidth - width) / 2 + (window.top.screenX ?? 0))
    : 100;
  return window.open(
    url,
    "oauth",
    `popup=yes,width=${width},height=${height},left=${left},top=${top}`,
  );
}

export function SignInDialog({ trigger, onSuccess, open: controlledOpen, onOpenChange: controlledOnOpenChange }: SignInDialogProps) {
  const recordSource = useServerFn(recordSignupSource);
  // Single helper so every successful auth flow records attribution
  // identically (and any future change — error reporting, retry, etc.
  // — is one edit). recordSignupSource is idempotent server-side.
  const fireRecordSource = React.useCallback(() => {
    recordSource().catch(() => {
      /* server-logged */
    });
  }, [recordSource]);

  // Site-config drives which optional auth flows show their UI. Each
  // matching server plugin only loads when its env is set; the UI mirrors
  // that gate so we never present a button that would 404 on submit.
  const { turnstileSiteKey, anonymousEnabled } = useSiteConfig();

  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  const [mode, setMode] = React.useState<"sign-in" | "sign-up">("sign-in");
  // Email/password is the default form. Switch to "otp" to show the
  // 6-digit-code flow, "magic" once a magic link has been emailed.
  const [emailMode, setEmailMode] = React.useState<"password" | "otp" | "magic-sent">("password");
  const [otpCode, setOtpCode] = React.useState("");
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [action, setAction] = React.useState<Action>(null);
  // Captcha token from Turnstile widget (when enabled). null = not yet
  // verified OR expired; the form's primary submit is disabled until
  // non-null. Turnstile will call onVerified(null) on expire / error.
  const [captchaToken, setCaptchaToken] = React.useState<string | null>(null);

  // OAuth popup finishes → /auth/success broadcasts over the "auth" channel.
  // We use BroadcastChannel (not opener.postMessage) because Google's OAuth
  // pages set COOP: same-origin, severing the opener relationship for good.
  // BroadcastChannel is same-origin cross-window and doesn't need opener.
  React.useEffect(() => {
    const onSignedIn = () => {
      setAction(null);
      setOpen(false);
      // Snapshot attribution → user_sources via server fn (idempotent).
      // /auth/success also calls this; doubling up is intentional defence
      // since BroadcastChannel can drop messages on slow tabs.
      fireRecordSource();
    };

    if (typeof BroadcastChannel === "undefined") return;
    const bc = new BroadcastChannel("auth");
    const handler = (event: MessageEvent) => {
      if ((event.data as { type?: string } | null)?.type === "auth:signed-in") {
        onSignedIn();
      }
    };
    bc.addEventListener("message", handler);
    return () => {
      bc.removeEventListener("message", handler);
      bc.close();
    };
    // fireRecordSource depends on recordSource (stable serverFn binding),
    // so exhaustive-deps is satisfied without re-subscribing per render.
  }, [fireRecordSource]);

  const busy = action !== null;

  // Pass the captcha token through the BetterAuth `fetchOptions` headers
  // (the captcha plugin reads it from `x-captcha-response`). When
  // Turnstile isn't configured (`turnstileSiteKey === null`) the field
  // is empty and the captcha plugin isn't loaded server-side either.
  const captchaHeaders = (): Record<string, string> | undefined =>
    captchaToken ? { "x-captcha-response": captchaToken } : undefined;

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setAction("email");
    if (mode === "sign-up") track("signup_started", { method: "email" });
    const { error } =
      mode === "sign-in"
        ? await authClient.signIn.email(
            { email, password },
            { headers: captchaHeaders() },
          )
        : await authClient.signUp.email(
            { email, password, name },
            { headers: captchaHeaders() },
          );
    setAction(null);
    if (error) {
      setError(error.message ?? (mode === "sign-in" ? "登录失败" : "注册失败"));
      return;
    }
    // Server-side `signup_completed` fires from inside recordSignupSource
    // — only on the FIRST insert into user_sources for this user. Email
    // signup with verification will land /api/auth/verify-email; we still
    // call recordSource here for sign-in's auto-login path (no /auth/success).
    fireRecordSource();
    onSuccess?.();
    setOpen(false);
  };

  const handleMagicLink = async () => {
    if (!email) {
      setError("请先填写邮箱");
      return;
    }
    if (turnstileSiteKey && !captchaToken) {
      setError("请先完成人机验证");
      return;
    }
    setError(null);
    setAction("magic");
    track("signup_started", { method: "magic-link" });
    const { error } = await authClient.signIn.magicLink(
      { email, callbackURL: "/auth/success" },
      { headers: captchaHeaders() },
    );
    setAction(null);
    if (error) {
      setError(error.message ?? "魔法链接发送失败");
      return;
    }
    setEmailMode("magic-sent");
  };

  const handleOtpSend = async () => {
    if (!email) {
      setError("请先填写邮箱");
      return;
    }
    if (turnstileSiteKey && !captchaToken) {
      setError("请先完成人机验证");
      return;
    }
    setError(null);
    setAction("otp-send");
    const { error } = await authClient.emailOtp.sendVerificationOtp(
      {
        email,
        type: mode === "sign-up" ? "email-verification" : "sign-in",
      },
      { headers: captchaHeaders() },
    );
    setAction(null);
    if (error) {
      setError(error.message ?? "验证码发送失败");
      return;
    }
    setEmailMode("otp");
  };

  const handleOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode) return;
    setError(null);
    setAction("otp-verify");
    const { error } = await authClient.signIn.emailOtp({ email, otp: otpCode });
    setAction(null);
    if (error) {
      setError(error.message ?? "验证码错误");
      return;
    }
    fireRecordSource();
    onSuccess?.();
    setOpen(false);
  };

  const handleAnonymous = async () => {
    if (turnstileSiteKey && !captchaToken) {
      setError("请先完成人机验证");
      return;
    }
    setError(null);
    setAction("anon");
    const { error } = await authClient.signIn.anonymous({
      fetchOptions: { headers: captchaHeaders() },
    });
    setAction(null);
    if (error) {
      setError(error.message ?? "匿名登录失败");
      return;
    }
    fireRecordSource();
    onSuccess?.();
    setOpen(false);
  };

  const handleGoogle = async () => {
    setError(null);
    setAction("google");
    if (mode === "sign-up") track("signup_started", { method: "google" });
    // Open the popup *synchronously* in the same tick as the click. If we
    // awaited signIn.social first, the browser would consider the user
    // gesture consumed and Google's OAuth page would refuse to render (a
    // blank popup is the symptom). We open to about:blank now, then
    // navigate the popup once we have the URL from Better Auth.
    const popup = openOAuthWindow("about:blank");
    if (!popup) {
      setAction(null);
      setError("弹出窗口被浏览器拦截，请允许本站弹出窗口后重试");
      return;
    }
    // Fill the blank popup with a loading screen while we round-trip to our
    // server for the Google OAuth URL. Without this the popup looks frozen.
    try {
      popup.document.write(
        `<!doctype html><html><head><meta charset="utf-8"><title>正在跳转到 Google…</title><meta name="color-scheme" content="light dark"><style>
          :root { color-scheme: light dark; }
          body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; font: 14px -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; background: Canvas; color: CanvasText; }
          .wrap { display: flex; flex-direction: column; align-items: center; gap: 14px; opacity: 0.85; }
          .spin { width: 22px; height: 22px; border: 2px solid color-mix(in srgb, CanvasText 25%, transparent); border-top-color: CanvasText; border-radius: 50%; animation: r 0.8s linear infinite; }
          @keyframes r { to { transform: rotate(360deg); } }
        </style></head><body><div class="wrap"><div class="spin"></div><div>正在跳转到 Google…</div></div></body></html>`,
      );
      popup.document.close();
    } catch {
      // document.write failed (rare, e.g. popup already navigated) — not fatal
    }
    const { data, error } = await authClient.signIn.social({
      provider: "google",
      callbackURL: "/auth/success",
      disableRedirect: true,
    });
    if (error || !data?.url) {
      popup.close();
      setAction(null);
      setError(error?.message ?? "无法启动 Google 登录");
      return;
    }
    try {
      popup.location.href = data.url;
    } catch {
      // Extremely rare — if navigation fails, send user via top-level fallback.
      popup.close();
      window.location.href = data.url;
    }
    // Success is signaled over BroadcastChannel from /auth/success. No
    // popup.closed polling (blocked by Google's COOP anyway).
  };

  const handlePasskey = async () => {
    setError(null);
    setAction("passkey");
    const result = await authClient.signIn.passkey();
    setAction(null);
    if (result?.error) {
      setError(result.error.message ?? "Passkey 登录失败");
      return;
    }
    // Passkey is sign-in only (no signup mode in BetterAuth's passkey flow),
    // but recordSource is idempotent so calling on first-time-passkey-user
    // is safe.
    fireRecordSource();
    onSuccess?.();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{mode === "sign-in" ? "欢迎回来" : "创建账号"}</DialogTitle>
          <DialogDescription>
            {mode === "sign-in" ? "登录你的账号继续" : "几秒钟开通"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogle}
            disabled={busy}
          >
            {action === "google" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
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
            )}
            使用 Google 继续
          </Button>

          {mode === "sign-in" ? (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handlePasskey}
              disabled={busy}
            >
              {action === "passkey" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              使用 Passkey 登录
            </Button>
          ) : null}
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">或</span>
          </div>
        </div>

        <form onSubmit={handleEmail} className="space-y-4">
          {mode === "sign-up" ? (
            <div className="space-y-2">
              <Label htmlFor="name">昵称</Label>
              <Input
                id="name"
                type="text"
                autoComplete="name"
                required
                disabled={busy}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="email">邮箱</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              disabled={busy}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">密码</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
              required
              disabled={busy}
              minLength={mode === "sign-up" ? 8 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {turnstileSiteKey ? (
            <div className="flex justify-center">
              <TurnstileWidget
                siteKey={turnstileSiteKey}
                onVerified={setCaptchaToken}
              />
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <Button
            type="submit"
            className="w-full"
            disabled={busy || (turnstileSiteKey !== null && captchaToken === null)}
          >
            {action === "email" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            {mode === "sign-in" ? "登录" : "创建账号"}
          </Button>

          <div className="flex justify-between gap-2 text-xs">
            <button
              type="button"
              onClick={handleMagicLink}
              disabled={busy || !email}
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              {action === "magic" ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Mail className="size-3" />
              )}
              发送邮件登录链接
            </button>
            <button
              type="button"
              onClick={handleOtpSend}
              disabled={busy || !email}
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              {action === "otp-send" ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <KeyRound className="size-3" />
              )}
              用验证码登录
            </button>
          </div>
        </form>

        {emailMode === "magic-sent" ? (
          <p className="text-sm text-center text-muted-foreground">
            登录链接已发送到 {email}，请查收邮件
          </p>
        ) : null}

        {emailMode === "otp" ? (
          <form onSubmit={handleOtpVerify} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="otp">验证码</Label>
              <Input
                id="otp"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                maxLength={6}
                required
                disabled={busy}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                placeholder="6 位数字"
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy || otpCode.length < 6}>
              {action === "otp-verify" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              验证
            </Button>
          </form>
        ) : null}

        {anonymousEnabled ? (
          <Button
            type="button"
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={handleAnonymous}
            disabled={busy}
          >
            {action === "anon" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <UserCircle2 className="size-4" />
            )}
            先试用，不创建账号
          </Button>
        ) : null}

        <p className="text-center text-sm text-muted-foreground">
          {mode === "sign-in" ? (
            <>
              还没账号？{" "}
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode("sign-up");
                }}
                className="text-primary underline underline-offset-4 disabled:opacity-50"
                disabled={busy}
              >
                注册
              </button>
            </>
          ) : (
            <>
              已有账号？{" "}
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode("sign-in");
                }}
                className="text-primary underline underline-offset-4 disabled:opacity-50"
                disabled={busy}
              >
                登录
              </button>
            </>
          )}
        </p>
      </DialogContent>
    </Dialog>
  );
}
