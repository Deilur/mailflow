import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useState } from "react";
import { ArrowLeft, Send, FlaskConical, Save, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

export default function CampaignEditor() {
  const { id } = useParams();
  const [, nav] = useLocation();
  const { toast } = useToast();

  const campaigns = useQuery<any>({ queryKey: ["/api/listmonk/campaigns"] });
  const settings = useQuery<any>({ queryKey: ["/api/newsletter-settings"] });
  const templates = useQuery<any>({ queryKey: ["/api/listmonk/templates"] });

  const campaign = (campaigns.data?.data ?? []).find((c: any) => c.id === Number(id));
  const settingsData: any[] = settings.data?.data ?? [];
  const settingsMap = Object.fromEntries(settingsData.map(s => [s.listmonkListId, s]));
  const ns = campaign ? settingsMap[campaign.list_id] : null;

  const [form, setForm] = useState<Record<string, string>>({});
  const f = (field: string) => form[field] ?? campaign?.[field] ?? ns?.[field] ?? "";
  const set = (field: string, val: string) => setForm(p => ({ ...p, [field]: val }));

  // Prefill from newsletter settings when campaign loads
  const fromEmail = form.fromEmail ?? ns?.fromEmail ?? "";
  const fromName = form.fromName ?? ns?.fromName ?? "";

  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testEmail, setTestEmail] = useState("");

  const saveMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/listmonk/campaigns/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/listmonk/campaigns"] });
      toast({ title: "Guardado", description: "Campaña actualizada" });
    },
  });

  const testMutation = useMutation({
    mutationFn: (email: string) => apiRequest("POST", `/api/listmonk/campaigns/${id}/test`, { email }),
    onSuccess: () => {
      setTestDialogOpen(false);
      toast({ title: "Enviado", description: `Correo de prueba enviado a ${testEmail}` });
    },
    onError: () => toast({ title: "Error", description: "No se pudo enviar", variant: "destructive" }),
  });

  if (campaigns.isLoading || settings.isLoading) {
    return (
      <div className="space-y-4 max-w-2xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const color = ns?.brandColor ?? "#6366f1";

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => nav("/campaigns")} className="gap-1">
          <ArrowLeft size={14} /> Campañas
        </Button>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium truncate max-w-[220px]">{campaign?.name ?? `Campaña #${id}`}</span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: color }} />
          <span className="text-sm text-muted-foreground">
            {ns?.displayName ?? campaign?.list_name}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setTestDialogOpen(true)}
            data-testid="button-send-test"
          >
            <FlaskConical size={13} /> Enviar prueba
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => saveMutation.mutate({ subject: f("subject"), from_email: fromEmail, from_name: fromName })}
            disabled={saveMutation.isPending}
            data-testid="button-save-campaign"
          >
            <Save size={13} /> {saveMutation.isPending ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Detalles de envío</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Asunto *</Label>
            <Input
              data-testid="input-subject"
              value={f("subject")}
              onChange={e => set("subject", e.target.value)}
              placeholder="El asunto que verán los suscriptores"
              className="h-8 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">From Name</Label>
              <Input
                data-testid="input-from-name"
                value={fromName}
                onChange={e => set("fromName", e.target.value)}
                placeholder={ns?.fromName ?? "Tu nombre"}
                className="h-8 text-sm"
              />
              {ns?.fromName && !form.fromName && (
                <p className="text-[11px] text-primary">← Pre-llenado desde el newsletter</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">From Email</Label>
              <Input
                data-testid="input-from-email"
                type="email"
                value={fromEmail}
                onChange={e => set("fromEmail", e.target.value)}
                placeholder={ns?.fromEmail ?? "email@dominio.com"}
                className="h-8 text-sm"
              />
              {ns?.fromEmail && !form.fromEmail && (
                <p className="text-[11px] text-primary">← Pre-llenado desde el newsletter</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Preheader (texto de vista previa)</Label>
            <Input
              data-testid="input-preheader"
              placeholder="Texto corto visible en la bandeja antes de abrir..."
              className="h-8 text-sm"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Contenido</CardTitle>
          <p className="text-xs text-muted-foreground">
            En producción, este campo conecta con el editor WYSIWYG de ListMonk via iframe o redirección.
          </p>
        </CardHeader>
        <CardContent>
          <Textarea
            data-testid="input-content"
            placeholder="Contenido del email en HTML o Markdown..."
            className="min-h-[200px] text-sm font-mono resize-none"
          />
          <p className="text-[11px] text-muted-foreground mt-2">
            El header/footer del newsletter se aplicará automáticamente al enviar.
          </p>
        </CardContent>
      </Card>

      {/* Test send dialog */}
      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Enviar correo de prueba</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              Se enviará una copia de esta campaña a la dirección indicada usando la configuración actual.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs">Email de destino</Label>
              <Input
                data-testid="input-test-email"
                type="email"
                placeholder="tu@email.com"
                value={testEmail}
                onChange={e => setTestEmail(e.target.value)}
                className="h-8 text-sm"
                onKeyDown={e => e.key === "Enter" && testMutation.mutate(testEmail)}
              />
            </div>
            {ns && (
              <div className="bg-muted/50 rounded p-2 text-[11px] text-muted-foreground space-y-0.5">
                <p>From: <span className="text-foreground">{ns.fromName} &lt;{ns.fromEmail}&gt;</span></p>
                <p>Asunto: <span className="text-foreground">{f("subject") || "(sin asunto)"}</span></p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setTestDialogOpen(false)}>Cancelar</Button>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => testMutation.mutate(testEmail)}
              disabled={!testEmail || testMutation.isPending}
              data-testid="button-confirm-test"
            >
              <FlaskConical size={13} />
              {testMutation.isPending ? "Enviando..." : "Enviar prueba"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
