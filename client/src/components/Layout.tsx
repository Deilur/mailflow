import { Link, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { useState } from "react";
import {
  LayoutDashboard, Mail, Megaphone, Workflow,
  ChevronLeft, ChevronRight, Moon, Sun, Users, Star
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/",            label: "Dashboard",     icon: LayoutDashboard },
  { href: "/newsletters", label: "Newsletters",    icon: Mail },
  { href: "/campaigns",   label: "Campañas",       icon: Megaphone },
  { href: "/subscribers",       label: "Suscriptores",      icon: Users },
  { href: "/super-subscribers", label: "Super Suscriptores", icon: Star },
  { href: "/funnels",           label: "Funnels",            icon: Workflow },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches
  );

  const toggleDark = () => {
    setDark(d => {
      const next = !d;
      document.documentElement.classList.toggle("dark", next);
      return next;
    });
  };

  // init dark class
  if (dark) document.documentElement.classList.add("dark");

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col border-r border-border bg-sidebar transition-all duration-200 shrink-0",
          collapsed ? "w-14" : "w-52"
        )}
      >
        {/* Logo */}
        <div className={cn(
          "flex items-center gap-2.5 h-14 px-3 border-b border-border shrink-0",
          collapsed && "justify-center"
        )}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-label="MailFlow logo">
            <rect width="28" height="28" rx="7" className="fill-primary" />
            <path d="M6 9h16M6 9l8 7 8-7M6 19h16V9" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {!collapsed && (
            <span className="font-semibold text-sm text-foreground tracking-tight">Remoteland Mail</span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? location === "/" : location.startsWith(href);
            return (
              <Link key={href} href={href}>
                <a
                  className={cn(
                    "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors",
                    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    active
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-sidebar-foreground/70",
                    collapsed && "justify-center px-0"
                  )}
                  title={collapsed ? label : undefined}
                >
                  <Icon size={16} className="shrink-0" />
                  {!collapsed && <span>{label}</span>}
                </a>
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className={cn(
          "border-t border-border p-2 flex items-center gap-1",
          collapsed ? "flex-col" : "justify-between"
        )}>
          <button
            onClick={toggleDark}
            className="p-2 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
            title={dark ? "Modo claro" : "Modo oscuro"}
          >
            {dark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <button
            onClick={() => setCollapsed(c => !c)}
            className="p-2 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
            title={collapsed ? "Expandir" : "Colapsar"}
          >
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[1200px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
