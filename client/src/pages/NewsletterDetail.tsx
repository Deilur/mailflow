import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useState } from "react";
import { ArrowLeft, Save, Mail, Palette, FileCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function NewsletterDetail() {
  const { id } = useParams();
  const [, nav] = useLocation();
  const { toast } = useToast();

  const lists = useQuery<any>({ queryKey: ["/api/listmonk/lists"] });
  const settingsQ = useQuery<any>({ queryKey: ["/api/newsletter-settings"] });

  const list = (lists.data?.data ?? []).find((l: any) => l.id === Number(id));
  const settingsMap = Object.fromEntries(
    (settingsQ.data?.data ?? []).map((s: any) => [s.listmonkListId, s])
  );
  const existing = settingsMap[Number(id)] ?? {};

  const [form, setForm] = useState<Record<string, string>>({});
  const merged = { ...existing, ...form };

  const f = (field: string) => merged[field] ?? existing[field] ?? "";
  const set = (field: string, value: string) => setForm(p => ({ ...p, [field]: value }));

  const save = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", "/api/newsletter-settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/newsletter-settings"] });
      toast({ title: "Guardado", description: "Configuración actualizada" });
    },
    onError: () => toast({ title: "Error", description: "No se pudo guardar", variant: "destructive" }),
  });

  const handleSave = () => {
    save.mutate({
      listmonkListId: Number(id),
      displayName: f("displayName") || list?.name || "",
      fromEmail: f("fromEmail"),
      fromName: f("fromName"),
      replyTo: f("replyTo") || null,
      logoUrl: f("logoUrl") || null,
      brandColor: f("brandColor") || "#3b82f6",
      description: f("description") || null,
      templateHeader: f("templateHeader") || null,
      templateFooter: f("templateFooter") || null,
      templateCss: f("templateCss") || null,
    });
  };

  if (lists.isLoading || settingsQ.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => nav("/newsletters")} className="gap-1">
          <ArrowLeft size={14} /> Newsletters
        </Button>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium">{list?.name ?? `Lista #${id}`}</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{f("displayName") || list?.name}</h1>
          <p className="text-sm text-muted-foreground">
            {list?.subscriber_count?.toLocaleString()} suscriptores · Lista #{id} en ListMonk
          </p>
        </div>
        <Button size="sm" onClick={handleSave} disabled={save.isPending} className="gap-1.5">
          <Save size={14} /> {save.isPending ? "Guardando..." : "Guardar"}
        </Button>
      </div>

      <Tabs defaultValue="identity">
        <TabsList className="h-8">
          <TabsTrigger value="identity" className="text-xs gap-1.5"><Mail size={12} /> Identidad</TabsTrigger>
          <TabsTrigger value="branding" className="text-xs gap-1.5"><Palette size={12} /> Branding</TabsTrigger>
          <TabsTrigger value="template" className="text-xs gap-1.5"><FileCode size={12} /> Template Base</TabsTrigger>
        </TabsList>

        {/* Identity Tab */}
        <TabsContent value="identity" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Identidad del remitente</CardTitle>
              <p className="text-xs text-muted-foreground">
                Pre-llena el from address en todas las campañas de este newsletter
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nombre visible del newsletter</Label>
                  <Input
                    data-testid="input-display-name"
                    placeholder={list?.name}
                    value={f("displayName")}
                    onChange={e => set("displayName", e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Nombre del remitente (From Name)</Label>
                  <Input
                    data-testid="input-from-name"
                    placeholder="Equipo Tech Weekly"
                    value={f("fromName")}
                    onChange={e => set("fromName", e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">From Email *</Label>
                <Input
                  data-testid="input-from-email"
                  type="email"
                  placeholder="newsletter@tudominio.com"
                  value={f("fromEmail")}
                  onChange={e => set("fromEmail", e.target.value)}
                  className="h-8 text-sm"
                />
                <p className="text-[11px] text-muted-foreground">
                  Este email se usará automáticamente al crear campañas para este newsletter.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Reply-To (opcional)</Label>
                <Input
                  data-testid="input-reply-to"
                  type="email"
                  placeholder="hola@tudominio.com"
                  value={f("replyTo")}
                  onChange={e => set("replyTo", e.target.value)}
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Descripción</Label>
                <Textarea
                  data-testid="input-description"
                  placeholder="¿De qué trata este newsletter?"
                  value={f("description")}
                  onChange={e => set("description", e.target.value)}
                  className="text-sm resize-none"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Branding Tab */}
        <TabsContent value="branding" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Branding</CardTitle>
              <p className="text-xs text-muted-foreground">Color de marca y logo para identificar el newsletter en el dashboard</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Color de marca</Label>
                <div className="flex items-center gap-2">
                  <input
                    data-testid="input-brand-color"
                    type="color"
                    value={f("brandColor") || "#3b82f6"}
                    onChange={e => set("brandColor", e.target.value)}
                    className="w-9 h-8 rounded border border-border cursor-pointer bg-transparent"
                  />
                  <Input
                    value={f("brandColor") || "#3b82f6"}
                    onChange={e => set("brandColor", e.target.value)}
                    className="h-8 text-sm w-32 font-mono"
                    placeholder="#3b82f6"
                  />
                  <div
                    className="flex-1 h-8 rounded-md"
                    style={{ backgroundColor: f("brandColor") || "#3b82f6" }}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">URL del Logo</Label>
                <Input
                  data-testid="input-logo-url"
                  type="url"
                  placeholder="https://tudominio.com/logo.png"
                  value={f("logoUrl")}
                  onChange={e => set("logoUrl", e.target.value)}
                  className="h-8 text-sm"
                />
                {f("logoUrl") && (
                  <img src={f("logoUrl")} alt="Logo preview" className="h-10 object-contain rounded border border-border p-1 mt-1" />
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Template Tab */}
        <TabsContent value="template" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Template Base de Email</CardTitle>
              <p className="text-xs text-muted-foreground">
                HTML que se inserta automáticamente en el header/footer de los emails de este newsletter.
                Funciona como wrapper del template de ListMonk.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Header HTML</Label>
                <Textarea
                  data-testid="input-template-header"
                  placeholder={`<!-- Header del email -->\n<div style="background: ${f("brandColor") || "#3b82f6"}; padding: 20px; text-align: center;">\n  <img src="LOGO_URL" height="40" />\n</div>`}
                  value={f("templateHeader")}
                  onChange={e => set("templateHeader", e.target.value)}
                  className="text-xs font-mono resize-none"
                  rows={5}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Footer HTML</Label>
                <Textarea
                  data-testid="input-template-footer"
                  placeholder={`<!-- Footer con unsubscribe -->\n<div style="text-align: center; font-size: 12px; color: #888;">\n  <a href="{{ UnsubscribeURL }}">Darse de baja</a>\n</div>`}
                  value={f("templateFooter")}
                  onChange={e => set("templateFooter", e.target.value)}
                  className="text-xs font-mono resize-none"
                  rows={5}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">CSS personalizado</Label>
                <Textarea
                  data-testid="input-template-css"
                  placeholder="/* Estilos base del email */\nbody { font-family: -apple-system, sans-serif; }"
                  value={f("templateCss")}
                  onChange={e => set("templateCss", e.target.value)}
                  className="text-xs font-mono resize-none"
                  rows={4}
                />
              </div>
              <p className="text-[11px] text-muted-foreground bg-muted/50 rounded p-2">
                💡 En la implementación de producción, este HTML se inyecta al crear campañas via la API de ListMonk (<code className="font-mono">/api/campaigns</code>) usando los campos <code>template_id</code> y sobrescribiendo el body con el header/footer aplicados.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
