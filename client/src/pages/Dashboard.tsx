import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from "recharts";
import { Users, Send, Eye, MousePointerClick, Workflow } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

const PALETTE = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#84cc16"];

function KpiCard({
  icon: Icon, label, value, sub, color
}: {
  icon: any; label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className="text-xl font-semibold tabular-nums">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={`p-2 rounded-lg ${color}`}>
            <Icon size={16} className="text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const kpis = useQuery<any>({ queryKey: ["/api/stats/kpis"] });
  const dailySubs = useQuery<any>({ queryKey: ["/api/stats/daily-subscribers"] });
  const emailStats = useQuery<any>({ queryKey: ["/api/stats/email-activity"] });
  const listsQuery = useQuery<any>({ queryKey: ["/api/listmonk/lists"] });
  const settingsQuery = useQuery<any>({ queryKey: ["/api/newsletter-settings"] });

  const k = kpis.data?.data;
  const lists: { id: number; name: string }[] = listsQuery.data?.data ?? [];
  const settingsData: any[] = settingsQuery.data?.data ?? [];
  const brandColorMap = Object.fromEntries(settingsData.map((s: any) => [s.listmonkListId, s.brandColor]));

  // Build dynamic name/color maps — use brandColor from settings, fallback to palette
  const listNames: Record<string, string> = {};
  const listColors: Record<string, string> = {};
  lists.forEach((l, i) => {
    const key = `list_${l.id}`;
    listNames[key] = l.name;
    listColors[key] = brandColorMap[l.id] ?? PALETTE[i % PALETTE.length];
  });

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-popover border border-border rounded-lg p-3 shadow-lg text-xs">
        <p className="font-medium mb-2 text-muted-foreground">
          {format(parseISO(label), "d MMM", { locale: es })}
        </p>
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center gap-2 mb-0.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
            <span className="text-muted-foreground">{listNames[p.dataKey] ?? p.dataKey}:</span>
            <span className="font-medium">{p.value}</span>
          </div>
        ))}
      </div>
    );
  };

  const EmailTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-popover border border-border rounded-lg p-3 shadow-lg text-xs">
        <p className="font-medium mb-2 text-muted-foreground">
          {format(parseISO(label), "d MMM", { locale: es })}
        </p>
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center gap-2 mb-0.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
            <span className="text-muted-foreground capitalize">{p.name}:</span>
            <span className="font-medium">{p.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    );
  };

  const subsData = (dailySubs.data?.data ?? []).map((d: any) => ({
    ...d,
    date: d.date,
  }));
  const emailData = emailStats.data?.data ?? [];

  const fmtDate = (d: string) => format(parseISO(d), "d MMM", { locale: es });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Resumen de actividad de tus newsletters</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
        ) : (
          <>
            <KpiCard icon={Users} label="Suscriptores totales" value={k?.total_subscribers?.toLocaleString() ?? "-"} sub={k?.subscribers_last_7d != null ? `+${k.subscribers_last_7d} esta semana` : undefined} color="bg-blue-500" />
            <KpiCard icon={Send} label="Emails enviados (30d)" value={k?.emails_sent_30d?.toLocaleString() ?? "-"} color="bg-violet-500" />
            <KpiCard icon={Eye} label="Open rate promedio" value={`${k?.avg_open_rate ?? "-"}%`} color="bg-emerald-500" />
            <KpiCard icon={MousePointerClick} label="Click rate promedio" value={`${k?.avg_click_rate ?? "-"}%`} color="bg-amber-500" />
          </>
        )}
      </div>

      {/* Suscriptores nuevos por lista */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-sm font-semibold">Suscriptores nuevos diarios</CardTitle>
          <p className="text-xs text-muted-foreground">Por newsletter — últimos 30 días</p>
        </CardHeader>
        <CardContent className="pt-4">
          {dailySubs.isLoading ? (
            <Skeleton className="h-56 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={subsData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  {Object.entries(listColors).map(([key, color]) => (
                    <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={color} stopOpacity={0.18} />
                      <stop offset="95%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  formatter={(value) => listNames[value] ?? value}
                  iconType="circle"
                  iconSize={7}
                  wrapperStyle={{ fontSize: 11 }}
                />
                {Object.entries(listColors).map(([key, color]) => (
                  <Area
                    key={key}
                    type="monotone"
                    dataKey={key}
                    name={key}
                    stroke={color}
                    strokeWidth={1.5}
                    fill={`url(#grad-${key})`}
                    dot={false}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Email activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-sm font-semibold">Actividad de email</CardTitle>
            <p className="text-xs text-muted-foreground">Enviados, abiertos y clicks — 30 días</p>
          </CardHeader>
          <CardContent className="pt-4">
            {emailStats.isLoading ? (
              <Skeleton className="h-52 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={emailData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} barSize={3}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<EmailTooltip />} />
                  <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="sent" name="Enviados" fill="#6366f1" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="opened" name="Abiertos" fill="#10b981" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="clicked" name="Clicks" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Open rate trend */}
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-sm font-semibold">Open rate diario</CardTitle>
            <p className="text-xs text-muted-foreground">% de aperturas sobre enviados</p>
          </CardHeader>
          <CardContent className="pt-4">
            {emailStats.isLoading ? (
              <Skeleton className="h-52 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart
                  data={emailData.map((d: any) => ({
                    date: d.date,
                    open_rate: d.sent > 0 ? Number(((d.opened / d.sent) * 100).toFixed(1)) : 0,
                    click_rate: d.sent > 0 ? Number(((d.clicked / d.sent) * 100).toFixed(1)) : 0,
                  }))}
                  margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="grad-open" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="grad-click" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} unit="%" />
                  <Tooltip content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="bg-popover border border-border rounded-lg p-3 shadow-lg text-xs">
                        <p className="font-medium mb-1 text-muted-foreground">{format(parseISO(label), "d MMM", { locale: es })}</p>
                        {payload.map((p: any) => (
                          <div key={p.dataKey} className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                            <span className="text-muted-foreground">{p.name}:</span>
                            <span className="font-medium">{p.value}%</span>
                          </div>
                        ))}
                      </div>
                    );
                  }} />
                  <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="open_rate" name="Open rate" stroke="#10b981" strokeWidth={1.5} fill="url(#grad-open)" dot={false} />
                  <Area type="monotone" dataKey="click_rate" name="Click rate" stroke="#f59e0b" strokeWidth={1.5} fill="url(#grad-click)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
