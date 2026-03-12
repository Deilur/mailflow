import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Pencil, Send, BarChart2, Clock, CheckCircle2, FileText, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

const STATUS: Record<string, { label: string; icon: any; class: string }> = {
  sent: { label: "Enviado", icon: CheckCircle2, class: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  running: { label: "Enviando", icon: Play, class: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  draft: { label: "Borrador", icon: FileText, class: "bg-slate-500/10 text-slate-500" },
  scheduled: { label: "Programado", icon: Clock, class: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
};

export default function Campaigns() {
  const [, nav] = useLocation();
  const campaigns = useQuery<any>({ queryKey: ["/api/listmonk/campaigns"] });
  const settings = useQuery<any>({ queryKey: ["/api/newsletter-settings"] });

  const data: any[] = campaigns.data?.data ?? [];
  const settingsData: any[] = settings.data?.data ?? [];
  const settingsMap = Object.fromEntries(settingsData.map(s => [s.listmonkListId, s]));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Campañas</h1>
          <p className="text-sm text-muted-foreground">Todas las campañas de tus newsletters</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => nav("/campaigns/new")} data-testid="button-new-campaign">
          <Send size={14} /> Nueva campaña
        </Button>
      </div>

      <div className="space-y-2">
        {campaigns.isLoading
          ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)
          : data.map((c: any) => {
              const st = STATUS[c.status] ?? STATUS.draft;
              const StatusIcon = st.icon;
              const ns = settingsMap[c.list_id];
              const color = ns?.brandColor ?? "#6366f1";
              const openRate = c.stats.sent > 0
                ? ((c.stats.opened / c.stats.sent) * 100).toFixed(0)
                : "—";
              const clickRate = c.stats.sent > 0
                ? ((c.stats.clicked / c.stats.sent) * 100).toFixed(1)
                : "—";

              return (
                <div
                  key={c.id}
                  className="flex items-center gap-3 p-3.5 rounded-lg border border-border bg-card hover:bg-accent/30 transition-colors group"
                >
                  {/* Color strip */}
                  <div
                    className="w-1 h-10 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-medium text-sm truncate">{c.name}</span>
                      <span className={cn(
                        "inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0",
                        st.class
                      )}>
                        <StatusIcon size={9} />
                        {st.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span
                        className="font-medium truncate"
                        style={{ color }}
                      >
                        {ns?.displayName ?? c.list_name}
                      </span>
                      {c.send_at && (
                        <span>{format(parseISO(c.send_at), "d MMM yyyy", { locale: es })}</span>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  {c.status === "sent" && (
                    <div className="hidden md:flex items-center gap-5 text-xs">
                      <div className="text-center">
                        <p className="font-semibold tabular-nums">{c.stats.sent.toLocaleString()}</p>
                        <p className="text-muted-foreground">Enviados</p>
                      </div>
                      <div className="text-center">
                        <p className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{openRate}%</p>
                        <p className="text-muted-foreground">Open</p>
                      </div>
                      <div className="text-center">
                        <p className="font-semibold tabular-nums text-amber-600 dark:text-amber-400">{clickRate}%</p>
                        <p className="text-muted-foreground">Click</p>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {(c.status === "draft" || c.status === "scheduled") && (
                      <Link href={`/campaigns/${c.id}/edit`}>
                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" title="Editar">
                          <Pencil size={13} />
                        </Button>
                      </Link>
                    )}
                    {c.status === "sent" && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" title="Ver estadísticas">
                        <BarChart2 size={13} />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
      </div>
    </div>
  );
}
