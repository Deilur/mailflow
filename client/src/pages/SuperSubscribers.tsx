import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Users, Star, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const COLORS = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#84cc16"];

export default function SuperSubscribers() {
  const [selectedLists, setSelectedLists] = useState<number[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const listsQuery = useQuery<any>({ queryKey: ["/api/listmonk/lists"] });
  const allLists: any[] = listsQuery.data?.data ?? [];

  const listParam = selectedLists.sort().join(",");
  const superQuery = useQuery<any>({
    queryKey: ["/api/stats/super-subscribers", listParam],
    queryFn: async () => {
      const res = await fetch(`/api/stats/super-subscribers?lists=${listParam}`);
      return res.json();
    },
    enabled: selectedLists.length >= 2,
  });

  const result = superQuery.data?.data;
  const subscribers: any[] = result?.subscribers ?? [];
  const counts: any[] = result?.counts ?? [];
  const total: number = result?.total ?? 0;

  const listMap = Object.fromEntries(allLists.map((l: any) => [l.id, l]));
  const listColorMap = Object.fromEntries(allLists.map((l: any, i: number) => [l.id, COLORS[i % COLORS.length]]));

  const toggleList = (id: number) => {
    setSelectedLists(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <Star size={20} className="text-amber-500" />
          Super Suscriptores
        </h1>
        <p className="text-sm text-muted-foreground">
          Descubre suscriptores que están en varias newsletters a la vez
        </p>
      </div>

      {/* List selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Selecciona newsletters a comparar</CardTitle>
          <p className="text-xs text-muted-foreground">Elige al menos 2 newsletters</p>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <button
              type="button"
              className="w-full flex items-center justify-between px-3 py-2 rounded-md border border-border bg-background text-sm hover:bg-accent/30 transition-colors"
              onClick={() => setDropdownOpen(o => !o)}
            >
              <span className="text-muted-foreground">
                {selectedLists.length === 0
                  ? "Seleccionar newsletters..."
                  : `${selectedLists.length} seleccionada${selectedLists.length > 1 ? "s" : ""}`}
              </span>
              <ChevronDown size={14} className={cn("transition-transform", dropdownOpen && "rotate-180")} />
            </button>
            {dropdownOpen && (
              <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg py-1 max-h-60 overflow-y-auto">
                {allLists.map((l: any) => {
                  const checked = selectedLists.includes(l.id);
                  return (
                    <button
                      key={l.id}
                      type="button"
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-accent/40 transition-colors text-left",
                        checked && "bg-primary/5"
                      )}
                      onClick={() => toggleList(l.id)}
                    >
                      <div className={cn(
                        "w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                        checked ? "border-primary bg-primary" : "border-muted-foreground/30"
                      )}>
                        {checked && <span className="text-white text-[10px] font-bold">✓</span>}
                      </div>
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: listColorMap[l.id] }}
                      />
                      <span className="flex-1 truncate">{l.name}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {(l.subscriber_count ?? 0).toLocaleString()}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Selected pills */}
          {selectedLists.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {selectedLists.map(id => {
                const l = listMap[id];
                if (!l) return null;
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium"
                    style={{ backgroundColor: `${listColorMap[id]}15`, color: listColorMap[id] }}
                  >
                    {l.name}
                    <button
                      type="button"
                      className="ml-0.5 hover:opacity-60"
                      onClick={() => toggleList(id)}
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {selectedLists.length < 2 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Selecciona al menos 2 newsletters para ver los suscriptores en común</p>
        </div>
      ) : superQuery.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-5 pb-4">
                <p className="text-xs text-muted-foreground mb-1">Super suscriptores</p>
                <p className="text-2xl font-bold tabular-nums">{total.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-0.5">en 2+ newsletters</p>
              </CardContent>
            </Card>
            {counts.map((c: any) => (
              <Card key={c.shared_count}>
                <CardContent className="pt-5 pb-4">
                  <p className="text-xs text-muted-foreground mb-1">En {c.shared_count} newsletters</p>
                  <p className="text-2xl font-bold tabular-nums">{c.subscriber_count.toLocaleString()}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Subscribers table */}
          <Card>
            <CardHeader className="pb-0">
              <CardTitle className="text-sm font-semibold">
                Detalle ({Math.min(subscribers.length, 500)} de {total})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {subscribers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No hay suscriptores en común entre estas newsletters
                </p>
              ) : (
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border">
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Email</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden md:table-cell">Nombre</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Newsletters</th>
                        <th className="text-center px-4 py-2.5 text-xs font-medium text-muted-foreground w-16">#</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subscribers.map((s: any) => (
                        <tr key={s.id} className="border-b border-border last:border-0 hover:bg-accent/20">
                          <td className="px-4 py-2.5 text-sm truncate max-w-[250px]">{s.email}</td>
                          <td className="px-4 py-2.5 text-sm text-muted-foreground truncate max-w-[180px] hidden md:table-cell">
                            {s.name || "—"}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex flex-wrap gap-1">
                              {(s.list_ids ?? []).map((lid: number) => {
                                const l = listMap[lid];
                                if (!l) return null;
                                return (
                                  <span
                                    key={lid}
                                    className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                                    style={{ backgroundColor: `${listColorMap[lid]}15`, color: listColorMap[lid] }}
                                  >
                                    {l.name}
                                  </span>
                                );
                              })}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/10 text-amber-600 text-xs font-bold">
                              {s.list_count}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
