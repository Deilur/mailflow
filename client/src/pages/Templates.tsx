import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  FileCode, Plus, Pencil, Trash2, Eye, Save, X, Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

function TemplateEditor({
  open, onClose, template,
}: { open: boolean; onClose: () => void; template?: any }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const isEdit = !!template;

  const [name, setName] = useState(template?.name ?? "");
  const defaultBody = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
  </style>
</head>
<body>
  {{ template "content" . }}
</body>
</html>`;
  const [body, setBody] = useState(template?.body ?? defaultBody);
  const [previewOpen, setPreviewOpen] = useState(false);

  const saveMut = useMutation({
    mutationFn: (data: any) =>
      isEdit
        ? apiRequest("PUT", `/api/listmonk/templates/${template.id}`, data)
        : apiRequest("POST", "/api/listmonk/templates", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/listmonk/templates"] });
      toast({ title: isEdit ? "Template actualizado" : "Template creado" });
      onClose();
    },
    onError: () => toast({ title: "Error al guardar", variant: "destructive" }),
  });

  return (
    <>
      <Dialog open={open} onOpenChange={v => !v && onClose()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">
              {isEdit ? "Editar template" : "Nuevo template"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nombre *</Label>
              <Input
                className="h-9"
                placeholder="Ej: Newsletter semanal"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">HTML del template</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => setPreviewOpen(true)}
                >
                  <Eye size={12} /> Preview
                </Button>
              </div>
              <Textarea
                className="font-mono text-xs min-h-[300px] resize-y"
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="<p>HTML aquí...</p>"
              />
            </div>
          </div>

          <div className="flex gap-2 mt-4 pt-3 border-t border-border">
            <Button variant="outline" className="flex-1 h-9 text-sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              className="flex-1 h-9 text-sm gap-1.5"
              disabled={saveMut.isPending || !name.trim()}
              onClick={() => saveMut.mutate({ name, body, type: "campaign" })}
            >
              <Save size={13} />
              {saveMut.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="text-base">Preview: {name || "Sin nombre"}</DialogTitle>
          </DialogHeader>
          <div
            className="border border-border rounded-lg p-4 bg-white text-black min-h-[300px] overflow-auto"
            dangerouslySetInnerHTML={{ __html: body }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function Templates() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [loadingId, setLoadingId] = useState<number | null>(null);

  const templatesQuery = useQuery<any>({ queryKey: ["/api/listmonk/templates"] });
  const templates: any[] = templatesQuery.data?.data ?? [];

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/listmonk/templates/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/listmonk/templates"] });
      toast({ title: "Template eliminado" });
    },
    onError: () => toast({ title: "Error al eliminar", variant: "destructive" }),
  });

  const openEditor = async (template?: any) => {
    if (template) {
      // Fetch full template with body
      setLoadingId(template.id);
      try {
        const res = await fetch(`/api/listmonk/templates/${template.id}`);
        const data = await res.json();
        setEditingTemplate(data.data);
      } catch {
        setEditingTemplate(template);
      }
      setLoadingId(null);
    } else {
      setEditingTemplate(null);
    }
    setEditorOpen(true);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Templates</h1>
          <p className="text-sm text-muted-foreground">Plantillas de email para campañas y funnels</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => openEditor()}>
          <Plus size={14} /> Nuevo template
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {templatesQuery.isLoading
          ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-lg" />)
          : templates.map((t: any) => (
            <Card key={t.id} className="group hover:border-primary/30 transition-colors">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileCode size={16} className="text-muted-foreground shrink-0" />
                    <span className="font-medium text-sm truncate">{t.name}</span>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    {t.is_default && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">default</Badge>
                    )}
                  </div>
                </div>

                {t.subject && (
                  <p className="text-xs text-muted-foreground truncate mb-3">
                    Asunto: {t.subject}
                  </p>
                )}

                <div className="flex items-center gap-1 pt-2 border-t border-border">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1 flex-1"
                    disabled={loadingId === t.id}
                    onClick={() => openEditor(t)}
                  >
                    <Pencil size={11} />
                    {loadingId === t.id ? "Cargando..." : "Editar"}
                  </Button>
                  {!t.is_default && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm(`¿Eliminar "${t.name}"?`)) deleteMut.mutate(t.id);
                      }}
                    >
                      <Trash2 size={11} />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        }
      </div>

      {editorOpen && (
        <TemplateEditor
          open={editorOpen}
          onClose={() => { setEditorOpen(false); setEditingTemplate(null); }}
          template={editingTemplate}
        />
      )}
    </div>
  );
}
