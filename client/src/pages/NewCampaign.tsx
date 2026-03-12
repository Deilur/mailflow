import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  ArrowLeft, Send, Calendar, FileText, Globe, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type SendMode = "draft" | "schedule" | "now";
type ContentType = "richtext" | "html" | "markdown";

const TIMEZONES: { value: string; label: string; city: string; offset: string }[] = [
  { value: "Europe/London",       label: "London",       city: "Londres",       offset: "UTC+0/+1" },
  { value: "America/New_York",    label: "New York",     city: "Nueva York",    offset: "UTC-5/-4" },
  { value: "America/Mexico_City", label: "Mexico City",  city: "Ciudad de México", offset: "UTC-6/-5" },
  { value: "Europe/Madrid",       label: "Madrid",       city: "Madrid",        offset: "UTC+1/+2" },
  { value: "Asia/Bangkok",        label: "Bangkok",      city: "Bangkok",       offset: "UTC+7" },
];

/** Convert a datetime-local string (no TZ) + a tz name → UTC ISO string */
function localToUTC(localDT: string, tz: string): string {
  // We format the local time as if it were in `tz`, then get the UTC equivalent.
  // Trick: use Intl to find the UTC offset at that moment.
  const [datePart, timePart] = localDT.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute]     = (timePart ?? "00:00").split(":").map(Number);

  // Build a reference date in UTC (as a proxy to measure offset)
  const probe = new Date(Date.UTC(year, month - 1, day, hour, minute));

  // Get what Intl thinks the local time is in that tz
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(probe).map(p => [p.type, p.value]));
  const tzDate = new Date(
    `${parts.year}-${parts.month}-${parts.day}T${parts.hour === "24" ? "00" : parts.hour}:${parts.minute}:${parts.second}Z`
  );
  // offset in ms
  const offsetMs = probe.getTime() - tzDate.getTime();
  return new Date(probe.getTime() + offsetMs).toISOString();
}

/** Preview: show how the selected time looks in the chosen timezone */
function previewInTZ(localDT: string, tz: string): string {
  try {
    const utcISO = localToUTC(localDT, tz);
    return new Intl.DateTimeFormat("es", {
      timeZone: tz,
      weekday: "short", day: "numeric", month: "short",
      hour: "2-digit", minute: "2-digit", timeZoneName: "short",
    }).format(new Date(utcISO));
  } catch {
    return "";
  }
}

const SEND_MODES: { value: SendMode; label: string; icon: any; desc: string }[] = [
  { value: "draft",    label: "Guardar borrador", icon: FileText,  desc: "Editar y enviar después" },
  { value: "schedule", label: "Programar envío",  icon: Calendar,  desc: "Fecha y hora específica" },
  { value: "now",      label: "Enviar ahora",      icon: Send,      desc: "Inicia el envío inmediatamente" },
];

export default function NewCampaign() {
  const [, nav] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [name, setName]           = useState("");
  const [subject, setSubject]     = useState("");
  const [preheader, setPreheader] = useState("");
  const [listId, setListId]       = useState("");
  const [templateId, setTemplateId] = useState("none");
  const [fromName, setFromName]   = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [replyTo, setReplyTo]     = useState("");
  const [body, setBody]           = useState("");
  const [contentType, setContentType] = useState<ContentType>("richtext");
  const [sendMode, setSendMode]   = useState<SendMode>("draft");
  const [sendAt, setSendAt]       = useState("");
  const [timezone, setTimezone]   = useState("Asia/Bangkok");

  const lists     = useQuery<any>({ queryKey: ["/api/listmonk/lists"] });
  const settings  = useQuery<any>({ queryKey: ["/api/newsletter-settings"] });
  const templates = useQuery<any>({ queryKey: ["/api/listmonk/templates"] });

  const settingsMap = Object.fromEntries(
    (settings.data?.data ?? []).map((s: any) => [String(s.listmonkListId), s])
  );
  const ns = listId ? settingsMap[listId] : null;

  const handleListChange = (val: string) => {
    setListId(val);
    const s = settingsMap[val];
    if (s) {
      if (s.fromEmail && !fromEmail) setFromEmail(s.fromEmail);
      if (s.fromName  && !fromName)  setFromName(s.fromName);
      if (s.replyTo   && !replyTo)   setReplyTo(s.replyTo);
    }
  };

  const createMut = useMutation({
    mutationFn: (payload: any) => apiRequest("POST", "/api/listmonk/campaigns", payload),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["/api/listmonk/campaigns"] });
      toast({ title: "Campaña creada", description: data?.data?.name ?? name });
      nav("/campaigns");
    },
    onError: (e: any) => {
      toast({ title: "Error al crear campaña", description: e?.message, variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!name.trim() || !subject.trim() || !listId) {
      toast({
        title: "Faltan campos requeridos",
        description: "Nombre, asunto y lista son obligatorios.",
        variant: "destructive",
      });
      return;
    }
    if (sendMode === "schedule" && !sendAt) {
      toast({ title: "Selecciona fecha y hora de envío", variant: "destructive" });
      return;
    }
    createMut.mutate({
      name:         name.trim(),
      subject:      subject.trim(),
      lists:        [Number(listId)],
      template_id:  templateId && templateId !== "none" ? Number(templateId) : undefined,
      from_email:   fromEmail  || undefined,
      from_name:    fromName   || undefined,
      headers:      replyTo ? [{ "Reply-To": replyTo }] : undefined,
      body:         body || " ",
      content_type: contentType,
      type:         "regular",
      status:       sendMode === "now" ? "running" : sendMode === "schedule" ? "scheduled" : "draft",
      ...(sendMode === "schedule" && sendAt ? { send_at: localToUTC(sendAt, timezone) } : {}),
    });
  };

  // color strip derived from selected newsletter
  const brandColor = ns?.brandColor ?? "#6366f1";

  return (
    <div className="max-w-2xl space-y-5">

      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <button onClick={() => nav("/campaigns")} className="hover:text-foreground transition-colors flex items-center gap-1">
          <ArrowLeft size={13} /> Campañas
        </button>
        <ChevronRight size={12} />
        <span className="text-foreground font-medium">Nueva campaña</span>
      </div>

      {/* Page title + action buttons */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Nueva campaña</h1>
          <p className="text-sm text-muted-foreground">
            {ns ? (
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full" style={{ background: brandColor }} />
                {ns.displayName}
              </span>
            ) : "Completa los datos para crear la campaña"}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => nav("/campaigns")}>
            Cancelar
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={handleSubmit}
            disabled={createMut.isPending}
            data-testid="button-create-campaign"
          >
            <Send size={13} />
            {createMut.isPending ? "Creando…"
              : sendMode === "now"      ? "Crear y enviar"
              : sendMode === "schedule" ? "Crear y programar"
              : "Crear borrador"}
          </Button>
        </div>
      </div>

      {/* ── CARD 1: Identidad ─────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Identificación</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-xs">
              Nombre interno <span className="text-red-500">*</span>
            </Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej. Newsletter Marzo 2026 — Tech Weekly"
              className="h-9"
              data-testid="input-campaign-name"
            />
            <p className="text-[11px] text-muted-foreground">
              Solo visible en el dashboard, no lo ven los suscriptores.
            </p>
          </div>

          {/* List + Template */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">
                Lista <span className="text-red-500">*</span>
              </Label>
              <Select value={listId} onValueChange={handleListChange}>
                <SelectTrigger className="h-9" data-testid="select-campaign-list">
                  <SelectValue placeholder="Selecciona lista…" />
                </SelectTrigger>
                <SelectContent>
                  {(lists.data?.data ?? []).map((l: any) => (
                    <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Template de email</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Ninguno" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin template</SelectItem>
                  {(templates.data?.data ?? []).map((t: any) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── CARD 2: Detalles de envío ────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Detalles de envío</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Subject */}
          <div className="space-y-1.5">
            <Label className="text-xs">
              Asunto del email <span className="text-red-500">*</span>
            </Label>
            <Input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Ej. Lo mejor de esta semana en {{ .List.Name }}"
              className="h-9"
              data-testid="input-campaign-subject"
            />
          </div>

          {/* Preheader */}
          <div className="space-y-1.5">
            <Label className="text-xs">Preheader (texto de vista previa)</Label>
            <Input
              value={preheader}
              onChange={e => setPreheader(e.target.value)}
              placeholder="Texto corto visible en la bandeja antes de abrir…"
              className="h-9"
            />
          </div>

          {/* From + Reply-To */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">From Name</Label>
              <Input
                value={fromName}
                onChange={e => setFromName(e.target.value)}
                placeholder={ns?.fromName ?? "Tu newsletter"}
                className="h-9"
                data-testid="input-from-name"
              />
              {ns?.fromName && !fromName && (
                <p className="text-[11px] text-primary">← Desde configuración del newsletter</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">From Email</Label>
              <Input
                type="email"
                value={fromEmail}
                onChange={e => setFromEmail(e.target.value)}
                placeholder={ns?.fromEmail ?? "newsletter@tudominio.com"}
                className="h-9"
                data-testid="input-from-email"
              />
              {ns?.fromEmail && !fromEmail && (
                <p className="text-[11px] text-primary">← Desde configuración del newsletter</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Reply-To (opcional)</Label>
            <Input
              type="email"
              value={replyTo}
              onChange={e => setReplyTo(e.target.value)}
              placeholder={ns?.replyTo ?? "respuestas@tudominio.com"}
              className="h-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* ── CARD 3: Contenido ────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Contenido</CardTitle>
            {/* Content type switcher */}
            <div className="flex gap-0.5 bg-muted rounded-md p-0.5">
              {(["richtext", "html", "markdown"] as const).map(ct => (
                <button
                  key={ct}
                  onClick={() => setContentType(ct)}
                  className={cn(
                    "text-[11px] px-2.5 py-1 rounded font-medium transition-colors",
                    contentType === ct
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {ct}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder={
              contentType === "html"
                ? "<h1>Hola {{ .Subscriber.FirstName }},</h1>\n<p>Esta semana…</p>"
                : contentType === "markdown"
                ? "# Hola {{ .Subscriber.FirstName }}\n\nEsta semana…"
                : "Escribe el contenido de tu campaña aquí…"
            }
            className="min-h-[280px] font-mono text-xs resize-none"
            data-testid="input-campaign-body"
          />
          {ns && (
            <p className="text-[11px] text-muted-foreground mt-2">
              El header/footer del newsletter <strong>{ns.displayName}</strong> se aplicará automáticamente al enviar.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── CARD 4: Envío ────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Cuándo enviar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {SEND_MODES.map(({ value, label, icon: Icon, desc }) => (
              <button
                key={value}
                onClick={() => setSendMode(value)}
                className={cn(
                  "flex flex-col items-start gap-1.5 p-3 rounded-lg border text-left transition-colors",
                  sendMode === value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-accent/40"
                )}
              >
                <Icon size={14} className={sendMode === value ? "text-primary" : "text-muted-foreground"} />
                <span className={cn("text-xs font-medium", sendMode === value ? "text-primary" : "")}>
                  {label}
                </span>
                <span className="text-[10px] text-muted-foreground leading-tight">{desc}</span>
              </button>
            ))}
          </div>

          {sendMode === "schedule" && (
            <div className="space-y-3">
              {/* Timezone selector */}
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <Globe size={11} /> Huso horario
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {TIMEZONES.map(tz => (
                    <button
                      key={tz.value}
                      onClick={() => setTimezone(tz.value)}
                      className={cn(
                        "flex flex-col items-start px-3 py-2 rounded-lg border text-left transition-colors",
                        timezone === tz.value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-accent/40"
                      )}
                    >
                      <span className={cn("text-xs font-medium", timezone === tz.value ? "text-primary" : "")}>
                        {tz.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{tz.offset}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Datetime input */}
              <div className="space-y-1.5">
                <Label className="text-xs">Fecha y hora de envío</Label>
                <Input
                  type="datetime-local"
                  value={sendAt}
                  onChange={e => setSendAt(e.target.value)}
                  className="h-9 max-w-xs"
                />
                {sendAt && (
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Globe size={10} />
                    {previewInTZ(sendAt, timezone)}
                    &nbsp;·&nbsp; UTC: {localToUTC(sendAt, timezone).replace("T", " ").replace(".000Z", " UTC")}
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Bottom action bar ─────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-2 pb-8">
        <Button variant="outline" size="sm" onClick={() => nav("/campaigns")}>
          Cancelar
        </Button>
        <Button
          size="sm"
          className="gap-1.5"
          onClick={handleSubmit}
          disabled={createMut.isPending}
        >
          <Send size={13} />
          {createMut.isPending ? "Creando…"
            : sendMode === "now"      ? "Crear y enviar"
            : sendMode === "schedule" ? "Crear y programar"
            : "Crear borrador"}
        </Button>
      </div>
    </div>
  );
}
