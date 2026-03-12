import { useQuery } from "@tanstack/react-query";
import { Users, Star, BarChart3, Layers } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface BreakdownRow {
  list_count: number;
  subscriber_count: number;
}

interface CombinationRow {
  list_ids: number[];
  list_names: string[];
  subscriber_count: number;
}

interface SuperSubscribersData {
  total_unique_subscribers: number;
  breakdown: BreakdownRow[];
  top_combinations: CombinationRow[];
}

const COLORS = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#84cc16"];

export default function SuperSubscribers() {
  const superQuery = useQuery<{ data: SuperSubscribersData }>({
    queryKey: ["/api/stats/super-subscribers"],
    queryFn: async () => {
      const res = await fetch("/api/stats/super-subscribers");
      return res.json();
    },
  });

  const data = superQuery.data?.data;
  const breakdown = data?.breakdown ?? [];
  const combinations = data?.top_combinations ?? [];
  const totalUnique = data?.total_unique_subscribers ?? 0;

  const multiListCount = breakdown
    .filter(b => b.list_count >= 2)
    .reduce((sum, b) => sum + b.subscriber_count, 0);

  const maxListCount = breakdown.length > 0
    ? Math.max(...breakdown.map(b => b.list_count))
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <Star size={20} className="text-amber-500" />
          Super Suscriptores
        </h1>
        <p className="text-sm text-muted-foreground">
          Resumen de suscriptores en varias listas a la vez
        </p>
      </div>

      {superQuery.isLoading ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
          </div>
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users size={16} className="text-blue-500" />
                  <p className="text-xs text-muted-foreground font-medium">
                    Suscriptores totales
                  </p>
                </div>
                <p className="text-3xl font-bold tabular-nums">
                  {totalUnique.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  en al menos 1 lista
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Star size={16} className="text-amber-500" />
                  <p className="text-xs text-muted-foreground font-medium">
                    En 2+ listas
                  </p>
                </div>
                <p className="text-3xl font-bold tabular-nums">
                  {multiListCount.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {totalUnique > 0
                    ? `${((multiListCount / totalUnique) * 100).toFixed(1)}% del total`
                    : "sin datos"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Layers size={16} className="text-purple-500" />
                  <p className="text-xs text-muted-foreground font-medium">
                    Maximo de listas
                  </p>
                </div>
                <p className="text-3xl font-bold tabular-nums">
                  {maxListCount}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  listas por un mismo suscriptor
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Breakdown by list count */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BarChart3 size={16} className="text-muted-foreground" />
                Desglose por cantidad de listas
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Cuantos suscriptores estan en exactamente N listas
              </p>
            </CardHeader>
            <CardContent>
              {breakdown.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No hay datos disponibles
                </p>
              ) : (
                <div className="space-y-2">
                  {breakdown.map((row) => {
                    const pct = totalUnique > 0
                      ? (row.subscriber_count / totalUnique) * 100
                      : 0;
                    return (
                      <div key={row.list_count} className="flex items-center gap-3">
                        <div className="w-24 text-sm text-muted-foreground shrink-0">
                          {row.list_count === 1
                            ? "1 lista"
                            : `${row.list_count} listas`}
                        </div>
                        <div className="flex-1 h-7 bg-muted/40 rounded-md overflow-hidden relative">
                          <div
                            className="h-full rounded-md transition-all duration-500"
                            style={{
                              width: `${Math.max(pct, 1)}%`,
                              backgroundColor: COLORS[(row.list_count - 1) % COLORS.length],
                              opacity: 0.75,
                            }}
                          />
                          <span className="absolute inset-0 flex items-center px-2.5 text-xs font-medium">
                            {row.subscriber_count.toLocaleString()} suscriptores
                          </span>
                        </div>
                        <div className="w-16 text-right text-xs text-muted-foreground tabular-nums shrink-0">
                          {pct.toFixed(1)}%
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top combinations */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Star size={16} className="text-amber-500" />
                Combinaciones mas comunes
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Que listas comparten mas suscriptores entre si
              </p>
            </CardHeader>
            <CardContent>
              {combinations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No hay suscriptores en multiples listas
                </p>
              ) : (
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border">
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">
                          Combinacion de listas
                        </th>
                        <th className="text-center px-4 py-2.5 text-xs font-medium text-muted-foreground w-20">
                          Listas
                        </th>
                        <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground w-32">
                          Suscriptores
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {combinations.map((combo, idx) => (
                        <tr
                          key={combo.list_ids.join("-")}
                          className="border-b border-border last:border-0 hover:bg-accent/20"
                        >
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1.5">
                              {combo.list_names.map((name, i) => (
                                <Badge
                                  key={i}
                                  variant="secondary"
                                  className="text-[11px] font-medium"
                                  style={{
                                    backgroundColor: `${COLORS[i % COLORS.length]}15`,
                                    color: COLORS[i % COLORS.length],
                                    borderColor: `${COLORS[i % COLORS.length]}30`,
                                  }}
                                >
                                  {name}
                                </Badge>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/10 text-amber-600 text-xs font-bold">
                              {combo.list_ids.length}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-medium">
                            {combo.subscriber_count.toLocaleString()}
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
