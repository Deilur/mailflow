import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useState } from "react";
import { Users, Mail, ChevronRight, Plus, Globe, Lock, Zap } from "lucide-react";
import NewListModal from "@/components/NewListModal";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const TYPE_LABELS: Record<string, { label: string; icon: any; class: string }> = {
  public: { label: "Pública", icon: Globe, class: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  private: { label: "Privada", icon: Lock, class: "bg-slate-500/10 text-slate-600 dark:text-slate-400" },
  optin: { label: "Opt-in", icon: Zap, class: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
};

export default function Newsletters() {
  const [showNew, setShowNew] = useState(false);
  const lists = useQuery<any>({ queryKey: ["/api/listmonk/lists"] });
  const settings = useQuery<any>({ queryKey: ["/api/newsletter-settings"] });

  const listsData: any[] = lists.data?.data ?? [];
  const settingsData: any[] = settings.data?.data ?? [];

  const settingsMap = Object.fromEntries(settingsData.map((s: any) => [s.listmonkListId, s]));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Newsletters</h1>
          <p className="text-sm text-muted-foreground">
            Cada newsletter corresponde a una lista en ListMonk
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setShowNew(true)} data-testid="button-new-list">
          <Plus size={14} /> Nueva lista
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {lists.isLoading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)
          : listsData.map((list: any) => {
              const s = settingsMap[list.id];
              const typeInfo = TYPE_LABELS[list.type] ?? TYPE_LABELS.public;
              const TypeIcon = typeInfo.icon;
              const color = s?.brandColor ?? "#6366f1";

              return (
                <Link key={list.id} href={`/newsletters/${list.id}`}>
                  <a className="block">
                    <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-start gap-3">
                          {/* Brand dot */}
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                            style={{ backgroundColor: `${color}20` }}
                          >
                            <Mail size={18} style={{ color }} />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <h2 className="font-semibold text-sm truncate">
                                {s?.displayName ?? list.name}
                              </h2>
                              <span className={cn(
                                "inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0",
                                typeInfo.class
                              )}>
                                <TypeIcon size={9} />
                                {typeInfo.label}
                              </span>
                            </div>

                            {s?.description && (
                              <p className="text-xs text-muted-foreground line-clamp-1 mb-2">
                                {s.description}
                              </p>
                            )}

                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Users size={11} />
                                {list.subscriber_count.toLocaleString()} suscriptores
                              </span>
                              {s?.fromEmail && (
                                <span className="flex items-center gap-1 truncate">
                                  <Mail size={11} />
                                  <span className="truncate">{s.fromEmail}</span>
                                </span>
                              )}
                            </div>

                            {!s && (
                              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1.5 flex items-center gap-1">
                                <Zap size={10} /> Sin configurar — haz click para ajustar
                              </p>
                            )}
                          </div>

                          <ChevronRight size={15} className="text-muted-foreground shrink-0 mt-2" />
                        </div>
                      </CardContent>
                    </Card>
                  </a>
                </Link>
              );
            })}
      </div>
      <NewListModal open={showNew} onClose={() => setShowNew(false)} />
    </div>
  );
}
