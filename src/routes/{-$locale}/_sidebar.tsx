import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
export const Route = createFileRoute("/{-$locale}/_sidebar")({
  component: SidebarLayout,
});

function SidebarLayout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="custom-scrollbar">
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
