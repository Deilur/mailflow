import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import { ArrowLeft, Pencil, Clock, CheckCircle2, Users, AlertCircle, Mail, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  waiting: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  completed: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  errored: "bg-red-500/10 text-red-500",
};

const OUTCOME_STYLES: Record<string, string> = {
  success: "text-emerald-600 dark:text-emerald-400",
  failure: "text-red-500",
  scheduled: "text-amber-600 dark:text-amber-400",
  skipped: "text-muted-foreground",
};

const STEP_TYPE_LABELS: Record<string, string> = {
  send_email: "Email enviado",
  wait: "Espera programada",
  add_to_list: "Agregado a lista",
  remove_from_list: "Removido de lista",
  webhook: "Webhook",
};

export default function FunnelDetail() {
  const { id } = useParams();
  const [, nav] = useLocation();

  const funnelQ = useQuery<any>({ queryKey: ["/api/funnels", id] });
  const enrollmentsQ = useQuery<any>({ queryKey: ["/api/funnels", id, "enrollments"] });

  const funnel = funnelQ.data?.data;
  const enrollments: any[] = enrollmentsQ.data?.data ?? [];

  if (funnelQ.isLoading) {
    return (
      <div className="space-y-4 max-w-3xl">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!funnel) return <p className="text-muted-foreground">Funnel no encontrado</p>;

  const stats = funnel.stats ?? {};

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => nav("/funnels")} className="gap-1">
          <ArrowLeft size={14} /> Funnels
        </Button>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium">{funnel.name}</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{funnel.name}</h1>
          <p className="text-xs text-muted-foreground">{funnel.description}</p>
        </div>
        <Link href={`/funnels/${id}/edit`}>
          <Button size="sm" variant="outline" className="gap-1.5">
            <Pencil size={13} /> Editar pasos
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Activos", value: stats.active ?? 0, icon: Users, class: "text-blue-600 dark:text-blue-400" },
          { label: "En espera", value: stats.waiting ?? 0, icon: Clock, class: "text-amber-600 dark:text-amber-400" },
          { label: "Completados", value: stats.completed ?? 0, icon: CheckCircle2, class: "text-emerald-600 dark:text-emerald-400" },
          { label: "Con errores", value: stats.errored ?? 0, icon: AlertCircle, class: "text-red-500" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-3 pb-3">
              <div className="flex items-center gap-2">
                <s.icon size={14} className={s.class} />
                <div>
                  <p className="text-lg font-semibold tabular-nums">{s.value}</p>
                  <p className="text-[11px] text-muted-foreground">{s.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Steps list */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Pasos del funnel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {/* Trigger */}
            <div className="flex items-center gap-2 pb-1">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                <Zap size={12} className="text-primary" />
              </div>
              <span className="text-xs">Trigger: suscripción a lista #{funnel.listmonkListId}</span>
            </div>
            <div className="ml-3.5 w-0.5 h-3 bg-border" />

            {(funnel.steps ?? []).map((step: any, i: number) => {
              const isLast = i === (funnel.steps.length - 1);
              return (
                <div key={step.id}>
                  <div className="flex items-start gap-2">
                    <div className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold",
                      step.stepType === "wait" ? "bg-amber-500/10 text-amber-600" : "bg-blue-500/10 text-blue-600"
                    )}>
                      {step.stepType === "wait" ? <Clock size={12} /> : <Mail size={12} />}
                    </div>
                    <div className="pt-1">
                      <p className="text-xs font-medium">{STEP_TYPE_LABELS[step.stepType] ?? step.stepType}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {step.stepType === "wait"
                          ? `${step.config.duration} ${step.config.unit}`
                          : step.config.subject || `Template #${step.config.template_id}`}
                      </p>
                    </div>
                  </div>
                  {!isLast && <div className="ml-3.5 w-0.5 h-3 bg-border my-1" />}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Recent logs */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Actividad reciente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(funnel.logs ?? []).slice(0, 10).map((log: any) => (
                <div key={log.id} className="flex items-start gap-2 text-xs">
                  <div className={cn("w-1.5 h-1.5 rounded-full mt-1.5 shrink-0", {
                    "bg-emerald-500": log.outcome === "success",
                    "bg-red-500": log.outcome === "failure",
                    "bg-amber-500": log.outcome === "scheduled",
                    "bg-slate-400": log.outcome === "skipped",
                  })} />
                  <div className="min-w-0 flex-1">
                    <span className="text-muted-foreground">{log.subscriberEmail ?? "—"}</span>
                    <span className="mx-1 text-muted-foreground/50">·</span>
                    <span className={OUTCOME_STYLES[log.outcome]}>{STEP_TYPE_LABELS[log.stepType] ?? log.stepType}</span>
                    <span className="mx-1 text-muted-foreground/50">·</span>
                    <span className="text-muted-foreground">
                      {log.executedAt ? formatDistanceToNow(new Date(log.executedAt), { addSuffix: true, locale: es }) : "—"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enrollments table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Suscriptores en este funnel</CardTitle>
        </CardHeader>
        <CardContent>
          {enrollmentsQ.isLoading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Email</th>
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Estado</th>
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Paso</th>
                    <th className="text-left py-2 font-medium text-muted-foreground">Próxima acción</th>
                  </tr>
                </thead>
                <tbody>
                  {enrollments.slice(0, 20).map((e: any) => (
                    <tr key={e.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-2 pr-4 font-mono truncate max-w-[160px]">{e.subscriberEmail}</td>
                      <td className="py-2 pr-4">
                        <span className={cn("px-1.5 py-0.5 rounded-full text-[10px] font-medium", STATUS_STYLES[e.status] ?? "")}>
                          {e.status}
                        </span>
                      </td>
                      <td className="py-2 pr-4 tabular-nums">
                        {e.currentStepPos} / {funnel.steps?.length ?? "—"}
                      </td>
                      <td className="py-2 text-muted-foreground">
                        {e.nextRunAt
                          ? formatDistanceToNow(new Date(e.nextRunAt), { addSuffix: true, locale: es })
                          : e.status === "completed" ? "Completado" : "Inmediata"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
