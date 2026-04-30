import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { useNavigate } from "@tanstack/react-router";

export function DeleteAccountDialog({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [confirm, setConfirm] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const nav = useNavigate();

  const ok = confirm === "DELETE";
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>永久删除账户？</DialogTitle>
          <DialogDescription>
            此操作不可逆。订阅和积分将被清除，订单记录将匿名保留。输入{" "}
            <code>DELETE</code> 确认。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="delete-confirm">输入 DELETE 确认</Label>
          <Input
            id="delete-confirm"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="DELETE"
          />
        </div>
        {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button
            variant="destructive"
            disabled={!ok || loading}
            onClick={async () => {
              setLoading(true);
              try {
                await authClient.deleteUser();
                setOpen(false);
                nav({ to: "/{-$locale}", params: { locale: undefined } });
              } catch (e) {
                setErr((e as Error).message);
              } finally {
                setLoading(false);
              }
            }}
          >
            {loading ? "删除中…" : "永久删除"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
