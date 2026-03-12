import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Plus, Play, Pause, Trash2, ChevronRight, Users, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
  active: { label: "Activo", class: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  paused: { label: "Pausado", class: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  draft: { label: "Borrador", class: "bg-slate-500/10 text-slate-500" },
  archived: { label: "Archivado", class: "bg-slate-500/10 text-slate-400" },
};

export default function Funnels() {
  const { toast } = useToast();
  const funnels = useQuery<any>({ queryKey: ["/api/funnels"] });
  const settings = useQuery<any>({ queryKey: ["/api/newsletter-settings"] });

  const settingsMap = Object.fromEntries(
    (settings.data?.data ?? []).map((s: any) => [s.listmonkListId, s])
  );

  const toggleStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/funnels/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/funnels"] }),
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });

  const deleteFunnel = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/funnels/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/funnels"] });
      toast({ title: "Funnel eliminado" });
    },
  });

  const data: any[] = funnels.data?.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Funnels de Automatización</h1>
          <p className="text-sm text-muted-foreground">Secuencias de emails automáticas por lista</p>
        </div>
        <Link href="/funnels/new">
          <Button size="sm" className="gap-1.5">
            <Plus size={14} /> Nuevo funnel
          </Button>
        </Link>
      </div>

      <div className="space-y-2">
        {funnels.isLoading
          ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
          : data.length === 0
            ? (
              <div className="text-center py-16 text-muted-foreground">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                  <Plus size={20} />
                </div>
                <p className="text-sm">Aún no tienes funnels</p>
                <p className="text-xs mt-1">Crea uno para automatizar tu secuencia de bienvenida</p>
              </div>
            )
            : data.map((f: any) => {
                const st = STATUS_CONFIG[f.status] ?? STATUS_CONFIG.draft;
                const ns = settingsMap[f.listmonkListId];
                const color = ns?.brandColor ?? "#6366f1";

                return (
                  <div key={f.id} className="rounded-xl border border-border bg-card p-4 group">
                    <div className="flex items-start gap-3">
                      {/* Color strip */}
                      <div
                        className="w-1.5 h-full rounded-full shrink-0 mt-1"
                        style={{ background: `linear-gradient(to bottom, ${color}, ${color}40)` }}
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <h3 className="font-semibold text-sm">{f.name}</h3>
                              <span className={cn(
                                "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                                st.class
                              )}>
                                {st.label}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mb-2 line-clamp-1">
                              {f.description ?? "Sin descripción"} · {f.stepCount} pasos · Lista #{f.listmonkListId}
                            </p>
                          </div>
                        </div>

                        {/* Stats row */}
                        {f.stats && (
                          <div className="flex items-center gap-4 text-xs">
                            <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                              <Users size={11} /> {f.stats.active} activos
                            </span>
                            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                              <Clock size={11} /> {f.stats.waiting} en espera
                            </span>
                            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 size={11} /> {f.stats.completed} completados
                            </span>
                            {f.stats.errored > 0 && (
                              <span className="flex items-center gap-1 text-red-500">
                                <AlertCircle size={11} /> {f.stats.errored} errores
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0 self-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title={f.status === "active" ? "Pausar" : "Activar"}
                          onClick={() => toggleStatus.mutate({
                            id: f.id,
                            status: f.status === "active" ? "paused" : "active",
                          })}
                          data-testid={`button-toggle-funnel-${f.id}`}
                        >
                          {f.status === "active" ? <Pause size={14} /> : <Play size={14} />}
                        </Button>
                        <Link href={`/funnels/${f.id}`}>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Ver detalle">
                            <ChevronRight size={14} />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Eliminar"
                          onClick={() => {
                            if (confirm(`¿Eliminar el funnel "${f.name}"? Esta acción no se puede deshacer.`)) {
                              deleteFunnel.mutate(f.id);
                            }
                          }}
                          data-testid={`button-delete-funnel-${f.id}`}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
      </div>
    </div>
  );
}
