import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import {
  Search, UserPlus, CheckCircle2, XCircle, AlertTriangle,
  Mail, BarChart2, List, RefreshCw, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const STATUS_META: Record<string, { label: string; class: string; icon: any }> = {
  enabled:   { label: "Activo",     class: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", icon: CheckCircle2 },
  disabled:  { label: "Desactivado", class: "bg-slate-400/10 text-slate-500",                          icon: XCircle },
  blocklisted:{ label: "Bloqueado", class: "bg-red-500/10 text-red-600 dark:text-red-400",             icon: AlertTriangle },
};

const SUB_STATUS: Record<string, { label: string; class: string }> = {
  confirmed:   { label: "Confirmado",  class: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  unconfirmed: { label: "Sin confirmar", class: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  unsubscribed:{ label: "Desuscrito",  class: "bg-slate-400/10 text-slate-500" },
};

function fmtDate(d?: string | null) {
  if (!d) return "—";
  try { return format(parseISO(d), "d MMM yyyy, HH:mm", { locale: es }); }
  catch { return d; }
}

// ── Subscriber edit modal ─────────────────────────────────────────────────────

function SubscriberModal({
  sub, open, onClose,
}: { sub: any; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState(sub?.name ?? "");
  const [email, setEmail] = useState(sub?.email ?? "");
  const [status, setStatus] = useState(sub?.status ?? "enabled");
  const [subListIds, setSubListIds] = useState<number[]>(() =>
    (sub?.lists ?? []).map((l: any) => l.id)
  );

  const allLists = useQuery<any>({ queryKey: ["/api/listmonk/lists"] });
  const availableLists: any[] = allLists.data?.data ?? [];

  const updateMut = useMutation({
    mutationFn: (body: any) => apiRequest("PUT", `/api/subscribers/${sub.id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/subscribers"] });
      toast({ title: "Suscriptor actualizado" });
      onClose();
    },
    onError: () => toast({ title: "Error al guardar", variant: "destructive" }),
  });

  if (!sub) return null;

  const lists: any[] = availableLists.filter((l: any) => subListIds.includes(l.id));
  const listsToAdd: any[] = availableLists.filter((l: any) => !subListIds.includes(l.id));
  const subscriptions: any[] = sub.subscriptions ?? sub.lists ?? [];
  const bounces: any[]       = sub.bounces ?? [];
  const activity: any        = sub.activity ?? null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle className="text-base font-semibold">{sub.name || sub.email}</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                ID: {sub.id} &nbsp;·&nbsp; UUID: {sub.uuid}
              </p>
            </div>
            <span className={cn(
              "inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium shrink-0 mt-1",
              STATUS_META[status]?.class ?? STATUS_META.enabled.class
            )}>
              {STATUS_META[status]?.label ?? status}
            </span>
          </div>
        </DialogHeader>

        {/* Edit fields */}
        <div className="grid grid-cols-2 gap-3 mt-1">
          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs">E-mail</Label>
            <Input value={email} onChange={e => setEmail(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Nombre</Label>
            <Input value={name} onChange={e => setName(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Estado</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="enabled">Activo</SelectItem>
                <SelectItem value="disabled">Desactivado</SelectItem>
                <SelectItem value="blocklisted">Bloqueado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="lists" className="mt-3">
          <TabsList className="h-8 text-xs">
            <TabsTrigger value="lists" className="text-xs gap-1">
              <List size={12} /> Listas ({lists.length})
            </TabsTrigger>
            <TabsTrigger value="subscriptions" className="text-xs gap-1">
              <Mail size={12} /> Suscripciones ({subscriptions.length})
            </TabsTrigger>
            <TabsTrigger value="bounces" className="text-xs gap-1">
              <AlertTriangle size={12} /> Bounces ({bounces.length})
            </TabsTrigger>
            <TabsTrigger value="activity" className="text-xs gap-1">
              <BarChart2 size={12} /> Actividad
            </TabsTrigger>
          </TabsList>

          {/* LISTS TAB */}
          <TabsContent value="lists" className="mt-3 space-y-3">
            {lists.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sin newsletters</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {lists.map((l: any) => (
                  <span
                    key={l.id}
                    className="inline-flex items-center gap-1.5 text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium"
                  >
                    {l.name}
                    <button
                      type="button"
                      className="ml-0.5 hover:text-destructive transition-colors"
                      onClick={() => setSubListIds(ids => ids.filter(id => id !== l.id))}
                      title={`Quitar de ${l.name}`}
                    >
                      <XCircle size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {listsToAdd.length > 0 && (
              <Select onValueChange={(v) => setSubListIds(ids => [...ids, Number(v)])}>
                <SelectTrigger className="h-8 text-xs w-[220px]">
                  <SelectValue placeholder="Agregar a newsletter…" />
                </SelectTrigger>
                <SelectContent>
                  {listsToAdd.map((l: any) => (
                    <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </TabsContent>

          {/* SUBSCRIPTIONS TAB */}
          <TabsContent value="subscriptions" className="mt-3">
            {subscriptions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Sin suscripciones</p>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border">
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Lista</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Estado</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Creado</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Actualizado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptions.map((s: any, i: number) => {
                      const sm = SUB_STATUS[s.subscription_status] ?? SUB_STATUS.confirmed;
                      return (
                        <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/20">
                          <td className="px-3 py-2.5 font-medium text-primary">{s.name}</td>
                          <td className="px-3 py-2.5">
                            <span className={cn("px-1.5 py-0.5 rounded-full text-[10px] font-medium", sm.class)}>
                              {sm.label}
                            </span>
                            {s.subscription_type && (
                              <span className="ml-1.5 text-muted-foreground">{s.subscription_type === "single" ? "Single opt-in" : s.subscription_type}</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground">{fmtDate(s.subscription_created_at)}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{fmtDate(s.subscription_updated_at)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* BOUNCES TAB */}
          <TabsContent value="bounces" className="mt-3">
            {bounces.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Sin bounces registrados</p>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border">
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Tipo</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Fuente</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bounces.map((b: any, i: number) => (
                      <tr key={i} className="border-b border-border last:border-0">
                        <td className="px-3 py-2.5 font-medium text-red-600 dark:text-red-400">{b.type}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{b.source}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{fmtDate(b.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* ACTIVITY TAB */}
          <TabsContent value="activity" className="mt-3">
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: "CAMPAIGNS", value: activity?.campaigns ?? 0 },
                { label: "VIEWS",     value: activity?.views ?? 0 },
                { label: "CLICKS",    value: activity?.clicks ?? 0 },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg border border-border p-3 text-center">
                  <p className="text-[10px] font-medium text-muted-foreground tracking-widest mb-1">{label}</p>
                  <p className="text-2xl font-bold tabular-nums">{value}</p>
                </div>
              ))}
            </div>
            {(!activity?.views_list?.length) ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nothing here</p>
            ) : (
              <div className="text-xs space-y-1">
                {activity.views_list.map((v: any, i: number) => (
                  <div key={i} className="flex justify-between py-1 border-b border-border last:border-0">
                    <span className="text-muted-foreground">{v.campaign}</span>
                    <span className="tabular-nums">{fmtDate(v.date)}</span>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="flex gap-2 mt-4 pt-3 border-t border-border">
          <Button variant="outline" className="flex-1 h-9 text-sm" onClick={onClose}>Cerrar</Button>
          <Button
            className="flex-1 h-9 text-sm"
            disabled={updateMut.isPending}
            onClick={() => updateMut.mutate({ name, email, status, lists: subListIds })}
          >
            {updateMut.isPending ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Subscribers page ─────────────────────────────────────────────────────

export default function Subscribers() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [listFilter, setListFilter] = useState("all");
  const [selected, setSelected] = useState<any>(null);
  const perPage = 25;
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [searchInput]);

  const query = useQuery<any>({
    queryKey: ["/api/subscribers", page, search, listFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(perPage),
        ...(search ? { query: search } : {}),
        ...(listFilter !== "all" ? { list_id: listFilter } : {}),
      });
      const res = await fetch(`/api/subscribers?${params}`);
      return res.json();
    },
  });

  const lists = useQuery<any>({ queryKey: ["/api/listmonk/lists"] });

  const subs: any[]  = query.data?.data?.results ?? [];
  const total: number = query.data?.data?.total ?? 0;
  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Suscriptores</h1>
          <p className="text-sm text-muted-foreground">
            {total > 0 ? `${total.toLocaleString()} suscriptores en total` : "Gestiona tus suscriptores"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost" size="icon"
            className="h-8 w-8"
            onClick={() => qc.invalidateQueries({ queryKey: ["/api/subscribers"] })}
            title="Actualizar"
          >
            <RefreshCw size={14} />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8 h-8 text-sm"
            placeholder="Buscar por email o nombre…"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
          />
        </div>
        <Select value={listFilter} onValueChange={v => { setListFilter(v); setPage(1); }}>
          <SelectTrigger className="h-8 text-sm w-[170px]">
            <SelectValue placeholder="Todas las listas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las listas</SelectItem>
            {(lists.data?.data ?? []).map((l: any) => (
              <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 border-b border-border">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Nombre / Email</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden md:table-cell">Listas</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Estado</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden lg:table-cell">Alta</th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  <td className="px-4 py-3"><Skeleton className="h-4 w-48" /></td>
                  <td className="px-4 py-3 hidden md:table-cell"><Skeleton className="h-4 w-24" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
                  <td className="px-4 py-3 hidden lg:table-cell"><Skeleton className="h-4 w-28" /></td>
                </tr>
              ))
              : subs.length === 0
                ? (
                  <tr>
                    <td colSpan={4} className="text-center py-12 text-muted-foreground text-sm">
                      {search ? "No se encontraron suscriptores" : "Sin suscriptores aún"}
                    </td>
                  </tr>
                )
                : subs.map((s: any) => {
                  const sm = STATUS_META[s.status] ?? STATUS_META.enabled;
                  const StatusIcon = sm.icon;
                  const subLists: any[] = s.lists ?? [];
                  return (
                    <tr
                      key={s.id}
                      className="border-b border-border last:border-0 hover:bg-accent/30 cursor-pointer transition-colors"
                      onClick={() => setSelected(s)}
                      data-testid={`row-subscriber-${s.id}`}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-sm truncate max-w-[220px]">{s.name || "—"}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[220px]">{s.email}</p>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {subLists.slice(0, 3).map((l: any) => (
                            <span key={l.id} className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
                              {l.name}
                            </span>
                          ))}
                          {subLists.length > 3 && (
                            <span className="text-[10px] text-muted-foreground">+{subLists.length - 3}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                          sm.class
                        )}>
                          <StatusIcon size={9} /> {sm.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">
                        {fmtDate(s.created_at)}
                      </td>
                    </tr>
                  );
                })
            }
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-xs text-muted-foreground">
            Página {page} de {totalPages} · {total.toLocaleString()} suscriptores
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline" size="icon" className="h-7 w-7"
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft size={13} />
            </Button>
            <Button
              variant="outline" size="icon" className="h-7 w-7"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              <ChevronRight size={13} />
            </Button>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {selected && (
        <SubscriberModal
          sub={selected}
          open={!!selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
