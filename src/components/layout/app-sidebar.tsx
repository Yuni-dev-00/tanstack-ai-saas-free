import { Link, useMatchRoute } from "@tanstack/react-router";
import {
  Home,
  Loader2,
  Zap,
  Plus,
  PlusCircle,
  MoreHorizontal,
  LogOut,
  Settings,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme";
import { LanguageSwitcher } from "@/components/i18n";
import { useSession } from "@/hooks/use-session";
import { useSignout } from "@/hooks/use-signout";
import { useRouteLocale } from "@/lib/i18n/use-route-locale";
import { SignInDialog } from "@/components/auth/sign-in-dialog";

const NAV_ITEMS: { icon: typeof Home; label: string; to: "/{-$locale}"; }[] = [
  { icon: Home, label: "Home", to: "/{-$locale}" },
];

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.419 0 1.334-.956 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.419 0 1.334-.946 2.419-2.157 2.419z" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.668-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
    </svg>
  );
}

export function AppSidebar() {
  const locale = useRouteLocale();
  const matchRoute = useMatchRoute();
  const { data: session, isPending: sessionPending } = useSession();
  const signout = useSignout();

  return (
    <Sidebar collapsible="icon" className="border-r-sidebar-border/10">
      {/* Brand Logo */}
      <SidebarHeader className="px-5 pt-8 pb-0 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:justify-center">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild className="hover:bg-transparent">
              <Link to="/{-$locale}" params={{ locale }}>
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground group-data-[collapsible=icon]:size-10">
                  <Zap className="size-4 fill-current group-data-[collapsible=icon]:size-5" />
                </div>
                <h1 className="text-2xl font-black tracking-tighter uppercase text-sidebar-primary group-data-[collapsible=icon]:hidden">
                  PixShort
                </h1>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="px-5 gap-6 custom-scrollbar group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:items-center">
        {/* Create Project CTA — expanded: full button, collapsed: round icon */}
        <div className="group-data-[collapsible=icon]:hidden">
          <Link
            to="/{-$locale}"
            params={{ locale }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-sidebar-primary py-3.5 font-bold text-sidebar-primary-foreground shadow-[0_0_20px_color-mix(in_srgb,var(--sidebar-primary)_20%,transparent)] transition-all hover:brightness-110 active:scale-[0.98]"
          >
            <PlusCircle className="size-5" />
            Create Project
          </Link>
        </div>
        <div className="hidden group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:mb-4">
          <Link
            to="/{-$locale}"
            params={{ locale }}
            className="flex size-12 items-center justify-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_0_15px_color-mix(in_srgb,var(--sidebar-primary)_30%,transparent)] transition-transform active:scale-95"
          >
            <Plus className="size-5" />
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-0.5 group-data-[collapsible=icon]:gap-3 group-data-[collapsible=icon]:items-center">
          {NAV_ITEMS.map((item) => (
            <SidebarMenuItem key={item.label} className="list-none">
              <SidebarMenuButton
                asChild
                isActive={!!matchRoute({ to: item.to, params: { locale }, fuzzy: item.to === "/{-$locale}" ? false : true })}
                tooltip={item.label}
                className={[
                  "h-11 gap-3.5 rounded-lg px-4 py-3 font-medium transition-all duration-200",
                  "data-[active=true]:bg-sidebar-primary/10 data-[active=true]:text-sidebar-primary data-[active=true]:font-bold data-[active=true]:border-l-2 data-[active=true]:border-sidebar-primary",
                  "group-data-[collapsible=icon]:size-12 group-data-[collapsible=icon]:rounded-xl group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:justify-center",
                  "group-data-[collapsible=icon]:data-[active=true]:border-l-0 group-data-[collapsible=icon]:data-[active=true]:border-r-2",
                ].join(" ")}
              >
                <Link to={item.to} params={{ locale }}>
                  <item.icon className="size-5" />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}

          {/* Settings — collapsed only, with notification dot */}
          <SidebarMenuItem className="list-none hidden group-data-[collapsible=icon]:list-item">
            <SidebarMenuButton
              tooltip="Settings"
              className="size-12 rounded-xl p-0 justify-center relative"
            >
              <Settings className="size-5" />
              <div className="absolute top-2 right-2 size-2 rounded-full bg-chart-5 ring-2 ring-sidebar" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </nav>

        {/* Support & Community — expanded only */}
        <div className="group-data-[collapsible=icon]:hidden px-0">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Support & Community
          </p>
          <div className="flex items-center gap-4">
            <a href="#" className="text-muted-foreground transition-colors hover:text-sidebar-foreground">
              <XIcon className="size-5" />
            </a>
            <a href="#" className="text-muted-foreground transition-colors hover:text-sidebar-foreground">
              <DiscordIcon className="size-5" />
            </a>
            <a href="#" className="text-muted-foreground transition-colors hover:text-sidebar-foreground">
              <InstagramIcon className="size-5" />
            </a>
          </div>
        </div>

        <SidebarSeparator className="group-data-[collapsible=icon]:hidden" />

        {/* Settings — expanded only */}
        <SidebarMenu className="group-data-[collapsible=icon]:hidden">
          <SidebarMenuItem>
            <LanguageSwitcher currentLocale={locale ?? "en"} />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <ThemeToggle />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>

      {/* Expand/Collapse Toggle */}
      <SidebarTrigger className="absolute top-1/2 -right-3 z-50 size-6 -translate-y-1/2 rounded-full border border-sidebar-border bg-sidebar text-muted-foreground shadow-lg transition-colors hover:text-sidebar-primary hover:border-sidebar-primary/50" />

      {/* User Footer */}
      <SidebarFooter className="mt-auto border-t border-sidebar-border px-5 py-4 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:items-center">
        <SidebarMenu>
          <SidebarMenuItem>
            {sessionPending ? (
              <SidebarMenuButton disabled>
                <Loader2 className="size-4 animate-spin" />
                <span>Loading...</span>
              </SidebarMenuButton>
            ) : session?.user ? (
              <>
                {/* Expanded user card */}
                <SidebarMenuButton
                  className="h-auto w-full gap-3 rounded-lg p-2 transition-all hover:bg-sidebar-accent group/user group-data-[collapsible=icon]:hidden"
                  onClick={() => signout.mutate()}
                >
                  {signout.isPending ? (
                    <Loader2 className="size-9 animate-spin" />
                  ) : (
                    <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md ring-1 ring-sidebar-border group-hover/user:ring-sidebar-primary/30">
                      {session.user.image ? (
                        <img src={session.user.image} alt="" className="size-9 rounded-md object-cover" />
                      ) : (
                        <div className="flex size-9 items-center justify-center bg-sidebar-accent text-sidebar-accent-foreground">
                          <span className="text-sm font-bold">
                            {(session.user.name || session.user.email || "U").charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="grid flex-1 text-left leading-tight overflow-hidden">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-bold text-sidebar-foreground">
                        {session.user.name || session.user.email}
                      </span>
                    </div>
                  </div>
                  <MoreHorizontal className="ml-auto size-4 shrink-0 text-muted-foreground group-hover/user:text-sidebar-foreground" />
                </SidebarMenuButton>

                {/* Collapsed avatar — round with online dot */}
                <div className="hidden group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
                  <button
                    onClick={() => signout.mutate()}
                    className="relative cursor-pointer group/avatar"
                  >
                    <div className="size-10 overflow-hidden rounded-full border-2 border-sidebar-border transition-colors group-hover/avatar:border-sidebar-primary">
                      {session.user.image ? (
                        <img src={session.user.image} alt="" className="size-full object-cover" />
                      ) : (
                        <div className="flex size-full items-center justify-center bg-sidebar-accent text-sidebar-accent-foreground">
                          <span className="text-sm font-bold">
                            {(session.user.name || session.user.email || "U").charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-chart-2 ring-2 ring-sidebar" />
                  </button>
                </div>
              </>
            ) : (
              <SignInDialog
                trigger={
                  <SidebarMenuButton className="h-auto gap-3 rounded-lg p-2">
                    <LogOut className="size-5" />
                    <span>Sign In</span>
                  </SidebarMenuButton>
                }
              />
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
