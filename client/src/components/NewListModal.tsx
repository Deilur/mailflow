/**
 * Modal "Nueva Lista"
 * Llamado desde Newsletters.tsx con el botón "+ Nueva lista"
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Globe, Lock, Zap } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onClose: () => void;
}

type ListType = "public" | "private" | "optin";
type OptinType = "single" | "double";

const TYPE_OPTIONS: { value: ListType; label: string; desc: string; icon: any }[] = [
  { value: "public",  label: "Pública",  icon: Globe,  desc: "Visible y enlazada en la página de suscripción" },
  { value: "private", label: "Privada",  icon: Lock,   desc: "Solo accesible por API o desde el admin" },
  { value: "optin",   label: "Opt-in",   icon: Zap,    desc: "Requiere confirmación del suscriptor" },
];

export default function NewListModal({ open, onClose }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [name, setName]         = useState("");
  const [type, setType]         = useState<ListType>("public");
  const [optin, setOptin]       = useState<OptinType>("single");
  const [description, setDesc]  = useState("");
  const [tags, setTags]         = useState("");

  const createMut = useMutation({
    mutationFn: async (body: any) => apiRequest("POST", "/api/listmonk/lists", body),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["/api/listmonk/lists"] });
      const listName = data?.data?.name ?? name;
      toast({ title: "Lista creada", description: listName });
      handleClose();
    },
    onError: (e: any) => {
      toast({ title: "Error al crear lista", description: e.message, variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!name.trim()) {
      toast({ title: "El nombre es obligatorio", variant: "destructive" });
      return;
    }
    createMut.mutate({
      name: name.trim(),
      type,
      optin,
      description: description.trim() || undefined,
      tags: tags.split(",").map(t => t.trim()).filter(Boolean),
    });
  };

  const handleClose = () => {
    setName(""); setType("public"); setOptin("single"); setDesc(""); setTags("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Plus size={15} /> Nueva lista
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-1">
          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-xs">Nombre <span className="text-red-500">*</span></Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej. Vacantes Remotas"
              className="h-9"
              data-testid="input-list-name"
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
            />
          </div>

          {/* Type */}
          <div className="space-y-2">
            <Label className="text-xs">Tipo</Label>
            <div className="grid grid-cols-3 gap-2">
              {TYPE_OPTIONS.map(({ value, label, icon: Icon, desc }) => (
                <button
                  key={value}
                  onClick={() => setType(value)}
                  className={cn(
                    "flex flex-col items-start gap-1 p-3 rounded-lg border text-left transition-colors",
                    type === value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-accent/40"
                  )}
                >
                  <Icon size={14} className={type === value ? "text-primary" : "text-muted-foreground"} />
                  <span className={cn("text-xs font-medium", type === value ? "text-primary" : "")}>{label}</span>
                  <span className="text-[10px] text-muted-foreground leading-tight">{desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Opt-in type */}
          <div className="space-y-2">
            <Label className="text-xs">Opt-in</Label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: "single", label: "Single opt-in", desc: "El suscriptor entra directo sin confirmar" },
                { value: "double", label: "Double opt-in", desc: "Envía email de confirmación al suscribirse" },
              ] as const).map(({ value, label, desc }) => (
                <button
                  key={value}
                  onClick={() => setOptin(value)}
                  className={cn(
                    "flex flex-col items-start gap-0.5 p-3 rounded-lg border text-left transition-colors",
                    optin === value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-accent/40"
                  )}
                >
                  <span className={cn("text-xs font-medium", optin === value ? "text-primary" : "")}>{label}</span>
                  <span className="text-[10px] text-muted-foreground">{desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-xs">Descripción (opcional)</Label>
            <Textarea
              value={description}
              onChange={e => setDesc(e.target.value)}
              placeholder="Describe para qué es esta lista…"
              className="min-h-[70px] text-sm resize-none"
            />
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label className="text-xs">Tags (separados por coma)</Label>
            <Input
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="Ej. tech, weekly, español"
              className="h-9 text-sm"
            />
          </div>
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
            data-testid="button-create-list"
          >
            <Plus size={13} />
            {createMut.isPending ? "Creando…" : "Crear lista"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
