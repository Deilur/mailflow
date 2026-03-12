/**
 * Modal "Nueva Campaña"
 * Llamado desde Campaigns.tsx con el botón "+ Nueva campaña"
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, Calendar, FileText } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onClose: () => void;
}

type SendMode = "draft" | "schedule" | "now";

export default function NewCampaignModal({ open, onClose }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [name, setName]         = useState("");
  const [subject, setSubject]   = useState("");
  const [listId, setListId]     = useState("");
  const [templateId, setTemplateId] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName]   = useState("");
  const [body, setBody]           = useState("");
  const [sendMode, setSendMode]   = useState<SendMode>("draft");
  const [sendAt, setSendAt]       = useState("");
  const [contentType, setContentType] = useState<"richtext" | "html" | "markdown">("richtext");

  // Load lists and their newsletter settings to pre-fill from address
  const lists = useQuery<any>({ queryKey: ["/api/listmonk/lists"] });
  const settings = useQuery<any>({ queryKey: ["/api/newsletter-settings"] });
  const templates = useQuery<any>({ queryKey: ["/api/listmonk/templates"] });

  const settingsData: any[] = settings.data?.data ?? [];
  const settingsMap = Object.fromEntries(settingsData.map(s => [String(s.listmonkListId), s]));

  // Auto-fill from address when list is selected
  const handleListChange = (val: string) => {
    setListId(val);
    const ns = settingsMap[val];
    if (ns) {
      if (ns.fromEmail) setFromEmail(ns.fromEmail);
      if (ns.fromName)  setFromName(ns.fromName);
    }
  };

  const createMut = useMutation({
    mutationFn: async (body: any) => apiRequest("POST", "/api/listmonk/campaigns", body),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["/api/listmonk/campaigns"] });
      toast({ title: "Campaña creada", description: data?.data?.name ?? "" });
      handleClose();
    },
    onError: (e: any) => {
      toast({ title: "Error al crear campaña", description: e.message, variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!name.trim() || !subject.trim() || !listId) {
      toast({ title: "Faltan campos requeridos", description: "Nombre, asunto y lista son obligatorios", variant: "destructive" });
      return;
    }
    createMut.mutate({
      name, subject,
      lists: [Number(listId)],
      from_email: fromEmail || undefined,
      from_name: fromName || undefined,
      template_id: templateId ? Number(templateId) : undefined,
      body: body || " ",
      content_type: contentType,
      type: "regular",
      status: sendMode === "now" ? "running" : sendMode === "schedule" ? "scheduled" : "draft",
      ...(sendMode === "schedule" && sendAt ? { send_at: new Date(sendAt).toISOString() } : {}),
    });
  };

  const handleClose = () => {
    setName(""); setSubject(""); setListId(""); setTemplateId("");
    setFromEmail(""); setFromName(""); setBody("");
    setSendMode("draft"); setSendAt("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Send size={15} /> Nueva campaña
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-1">
          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-xs">Nombre de la campaña <span className="text-red-500">*</span></Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej. Newsletter Marzo 2026"
              className="h-9"
              data-testid="input-campaign-name"
            />
          </div>

          {/* Subject */}
          <div className="space-y-1.5">
            <Label className="text-xs">Asunto del email <span className="text-red-500">*</span></Label>
            <Input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Ej. Lo mejor de esta semana en {{list.name}}"
              className="h-9"
              data-testid="input-campaign-subject"
            />
          </div>

          {/* List + Template */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Lista <span className="text-red-500">*</span></Label>
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
              <Label className="text-xs">Template</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Sin template…" />
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

          {/* From address */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">From Name</Label>
              <Input
                value={fromName}
                onChange={e => setFromName(e.target.value)}
                placeholder="Newsletter"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">From Email</Label>
              <Input
                value={fromEmail}
                onChange={e => setFromEmail(e.target.value)}
                placeholder="newsletter@tudominio.com"
                className="h-9"
              />
            </div>
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Contenido</Label>
              <div className="flex gap-1">
                {(["richtext", "html", "markdown"] as const).map(ct => (
                  <button
                    key={ct}
                    onClick={() => setContentType(ct)}
                    className={cn(
                      "text-[10px] px-2 py-0.5 rounded font-medium transition-colors",
                      contentType === ct
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {ct}
                  </button>
                ))}
              </div>
            </div>
            <Textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder={contentType === "html"
                ? "<h1>Hola {{ .Subscriber.FirstName }}</h1>"
                : "Escribe el contenido de tu campaña aquí…"
              }
              className="min-h-[160px] font-mono text-xs resize-none"
            />
          </div>

          {/* Send mode */}
          <div className="space-y-2">
            <Label className="text-xs">¿Qué hacer después de crear?</Label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: "draft",    label: "Borrador",   icon: FileText,  desc: "Guardar y editar después" },
                { value: "schedule", label: "Programar",  icon: Calendar,  desc: "Enviar en fecha/hora específica" },
                { value: "now",      label: "Enviar ya",  icon: Send,      desc: "Iniciar envío inmediatamente" },
              ] as const).map(({ value, label, icon: Icon, desc }) => (
                <button
                  key={value}
                  onClick={() => setSendMode(value)}
                  className={cn(
                    "flex flex-col items-start gap-1 p-3 rounded-lg border text-left transition-colors",
                    sendMode === value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-accent/40"
                  )}
                >
                  <Icon size={14} className={sendMode === value ? "text-primary" : "text-muted-foreground"} />
                  <span className={cn("text-xs font-medium", sendMode === value ? "text-primary" : "")}>{label}</span>
                  <span className="text-[10px] text-muted-foreground leading-tight">{desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Schedule date */}
          {sendMode === "schedule" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Fecha y hora de envío</Label>
              <Input
                type="datetime-local"
                value={sendAt}
                onChange={e => setSendAt(e.target.value)}
                className="h-9"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 mt-5 pt-4 border-t border-border">
          <Button variant="outline" className="flex-1 h-9 text-sm" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            className="flex-1 h-9 text-sm gap-1.5"
            disabled={createMut.isPending}
            onClick={handleSubmit}
            data-testid="button-create-campaign"
          >
            <Send size={13} />
            {createMut.isPending ? "Creando…"
              : sendMode === "now" ? "Crear y enviar"
              : sendMode === "schedule" ? "Crear y programar"
              : "Crear borrador"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
