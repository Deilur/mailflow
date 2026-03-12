import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useState } from "react";
import {
  ArrowLeft, Plus, Save, GripVertical, Trash2, Mail, Clock,
  Zap, Globe, Tag, ArrowUpDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const STEP_TYPES = [
  { value: "send_email", label: "Enviar Email", icon: Mail, color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  { value: "wait", label: "Esperar", icon: Clock, color: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  { value: "add_to_list", label: "Agregar a lista", icon: Plus, color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  { value: "remove_from_list", label: "Quitar de lista", icon: Trash2, color: "bg-red-500/10 text-red-500" },
  { value: "webhook", label: "Webhook", icon: Globe, color: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
];

const WAIT_UNITS = [
  { value: "minutes", label: "minutos" },
  { value: "hours", label: "horas" },
  { value: "days", label: "días" },
  { value: "weeks", label: "semanas" },
];

interface Step {
  id: string;
  position: number;
  stepType: string;
  config: Record<string, any>;
}

function newStep(position: number): Step {
  return {
    id: `new-${Date.now()}`,
    position,
    stepType: "send_email",
    config: { template_id: "", subject: "" },
  };
}

function StepIcon({ type }: { type: string }) {
  const info = STEP_TYPES.find(s => s.value === type);
  const Icon = info?.icon ?? Mail;
  return (
    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", info?.color ?? "bg-muted")}>
      <Icon size={14} />
    </div>
  );
}

function StepCard({
  step, index, total, templates, lists,
  onChange, onDelete, onMoveUp, onMoveDown
}: {
  step: Step;
  index: number;
  total: number;
  templates: any[];
  lists: any[];
  onChange: (id: string, field: string, value: any) => void;
  onDelete: (id: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
}) {
  const typeInfo = STEP_TYPES.find(t => t.value === step.stepType);

  return (
    <div className="relative">
      {/* Connector line */}
      {index < total - 1 && (
        <div className="absolute left-4 top-full w-0.5 h-4 bg-border z-10" />
      )}

      <Card className="border-border">
        <CardContent className="p-3">
          <div className="flex items-start gap-2.5">
            <StepIcon type={step.stepType} />
            <div className="flex-1 min-w-0 space-y-2.5">
              {/* Step type selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-mono w-5">#{index + 1}</span>
                <Select
                  value={step.stepType}
                  onValueChange={val => {
                    onChange(step.id, "stepType", val);
                    // Reset config on type change
                    const defaultConfig: Record<string, Record<string, any>> = {
                      send_email: { template_id: "", subject: "" },
                      wait: { duration: "2", unit: "days" },
                      add_to_list: { listmonk_list_id: "" },
                      remove_from_list: { listmonk_list_id: "" },
                      webhook: { url: "", method: "POST" },
                    };
                    onChange(step.id, "config", defaultConfig[val] ?? {});
                  }}
                >
                  <SelectTrigger className="h-7 text-xs flex-1" data-testid={`select-step-type-${index}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STEP_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value} className="text-xs">
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Config fields per type */}
              {step.stepType === "send_email" && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[11px]">Template</Label>
                      <Select
                        value={String(step.config.template_id || "")}
                        onValueChange={val => onChange(step.id, "config", { ...step.config, template_id: Number(val) })}
                      >
                        <SelectTrigger className="h-7 text-xs" data-testid={`select-template-${index}`}>
                          <SelectValue placeholder="Seleccionar..." />
                        </SelectTrigger>
                        <SelectContent>
                          {templates.map((t: any) => (
                            <SelectItem key={t.id} value={String(t.id)} className="text-xs">
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">Asunto (override)</Label>
                      <Input
                        className="h-7 text-xs"
                        placeholder="Opcional"
                        value={step.config.subject ?? ""}
                        onChange={e => onChange(step.id, "config", { ...step.config, subject: e.target.value })}
                        data-testid={`input-step-subject-${index}`}
                      />
                    </div>
                  </div>
                </div>
              )}

              {step.stepType === "wait" && (
                <div className="flex items-center gap-2">
                  <Label className="text-[11px] shrink-0">Esperar</Label>
                  <Input
                    type="number"
                    min="1"
                    className="h-7 text-xs w-20"
                    value={step.config.duration ?? "2"}
                    onChange={e => onChange(step.id, "config", { ...step.config, duration: e.target.value })}
                    data-testid={`input-wait-duration-${index}`}
                  />
                  <Select
                    value={step.config.unit ?? "days"}
                    onValueChange={val => onChange(step.id, "config", { ...step.config, unit: val })}
                  >
                    <SelectTrigger className="h-7 text-xs w-28" data-testid={`select-wait-unit-${index}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WAIT_UNITS.map(u => (
                        <SelectItem key={u.value} value={u.value} className="text-xs">{u.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {(step.stepType === "add_to_list" || step.stepType === "remove_from_list") && (
                <div className="space-y-1">
                  <Label className="text-[11px]">Lista destino</Label>
                  <Select
                    value={String(step.config.listmonk_list_id || "")}
                    onValueChange={val => onChange(step.id, "config", { ...step.config, listmonk_list_id: Number(val) })}
                  >
                    <SelectTrigger className="h-7 text-xs" data-testid={`select-list-${index}`}>
                      <SelectValue placeholder="Seleccionar lista..." />
                    </SelectTrigger>
                    <SelectContent>
                      {lists.map((l: any) => (
                        <SelectItem key={l.id} value={String(l.id)} className="text-xs">{l.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {step.stepType === "webhook" && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2 space-y-1">
                    <Label className="text-[11px]">URL</Label>
                    <Input
                      className="h-7 text-xs font-mono"
                      placeholder="https://..."
                      value={step.config.url ?? ""}
                      onChange={e => onChange(step.id, "config", { ...step.config, url: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Método</Label>
                    <Select
                      value={step.config.method ?? "POST"}
                      onValueChange={val => onChange(step.id, "config", { ...step.config, method: val })}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["GET", "POST", "PUT"].map(m => (
                          <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            {/* Step actions */}
            <div className="flex flex-col gap-0.5 shrink-0">
              <Button
                variant="ghost" size="icon" className="h-6 w-6"
                onClick={() => onMoveUp(index)} disabled={index === 0}
              >
                <ArrowUpDown size={10} className="rotate-0" />
              </Button>
              <Button
                variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive"
                onClick={() => onDelete(step.id)}
                data-testid={`button-delete-step-${index}`}
              >
                <Trash2 size={10} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function FunnelBuilder() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [, nav] = useLocation();
  const { toast } = useToast();

  const templates = useQuery<any>({ queryKey: ["/api/listmonk/templates"] });
  const lists = useQuery<any>({ queryKey: ["/api/listmonk/lists"] });
  const settings = useQuery<any>({ queryKey: ["/api/newsletter-settings"] });
  const existingFunnel = useQuery<any>({
    queryKey: ["/api/funnels", id],
    enabled: isEdit,
  });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [listId, setListId] = useState("");
  const [status, setStatus] = useState("draft");
  const [steps, setSteps] = useState<Step[]>([newStep(0)]);

  // Populate form from existing funnel
  const existingData = existingFunnel.data?.data;
  const [initialized, setInitialized] = useState(false);
  if (existingData && !initialized) {
    setName(existingData.name);
    setDescription(existingData.description ?? "");
    setListId(String(existingData.listmonkListId));
    setStatus(existingData.status);
    if (existingData.steps?.length) {
      setSteps(existingData.steps.map((s: any) => ({
        id: s.id, position: s.position,
        stepType: s.stepType, config: s.config as Record<string, any>,
      })));
    }
    setInitialized(true);
  }

  const addStep = () => {
    setSteps(prev => [...prev, newStep(prev.length)]);
  };

  const updateStep = (stepId: string, field: string, value: any) => {
    setSteps(prev => prev.map(s =>
      s.id === stepId ? { ...s, [field]: value } : s
    ));
  };

  const deleteStep = (stepId: string) => {
    setSteps(prev => prev.filter(s => s.id !== stepId).map((s, i) => ({ ...s, position: i })));
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    setSteps(prev => {
      const arr = [...prev];
      [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
      return arr.map((s, i) => ({ ...s, position: i }));
    });
  };

  const saveMutation = useMutation({
    mutationFn: (payload: any) =>
      isEdit
        ? apiRequest("PATCH", `/api/funnels/${id}`, payload)
        : apiRequest("POST", "/api/funnels", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/funnels"] });
      toast({ title: isEdit ? "Funnel actualizado" : "Funnel creado" });
      nav("/funnels");
    },
    onError: () => toast({ title: "Error al guardar", variant: "destructive" }),
  });

  const handleSave = () => {
    if (!name || !listId) {
      toast({ title: "Completa los campos requeridos", variant: "destructive" });
      return;
    }
    saveMutation.mutate({
      name, description, listmonkListId: Number(listId),
      status: status as any, entryPolicy: "once",
      steps: steps.map((s, i) => ({
        funnelId: id ?? "", position: i,
        stepType: s.stepType, config: s.config,
      })),
    });
  };

  const templatesData: any[] = templates.data?.data ?? [];
  const listsData: any[] = lists.data?.data ?? [];
  const settingsData: any[] = settings.data?.data ?? [];
  const settingsMap = Object.fromEntries(settingsData.map(s => [s.listmonkListId, s]));

  return (
    <div className="space-y-5 max-w-xl mx-auto">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => nav("/funnels")} className="gap-1">
          <ArrowLeft size={14} /> Funnels
        </Button>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium">{isEdit ? "Editar funnel" : "Nuevo funnel"}</span>
      </div>

      {/* Meta */}
      <Card>
        <CardContent className="pt-4 pb-4 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Nombre del funnel *</Label>
            <Input
              data-testid="input-funnel-name"
              placeholder="Ej: Secuencia de bienvenida"
              value={name}
              onChange={e => setName(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Newsletter / Lista *</Label>
              <Select value={listId} onValueChange={setListId}>
                <SelectTrigger className="h-8 text-xs" data-testid="select-funnel-list">
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {listsData.map(l => {
                    const ns = settingsMap[l.id];
                    return (
                      <SelectItem key={l.id} value={String(l.id)} className="text-xs">
                        {ns?.displayName ?? l.name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Estado inicial</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft" className="text-xs">Borrador</SelectItem>
                  <SelectItem value="active" className="text-xs">Activo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Descripción</Label>
            <Textarea
              placeholder="¿Qué hace este funnel?"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="text-xs resize-none"
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Steps builder */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Pasos ({steps.length})</h2>
        </div>

        {/* Trigger badge */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Zap size={14} className="text-primary" />
          </div>
          <div className="text-xs">
            <span className="font-medium">Trigger:</span>
            <span className="text-muted-foreground ml-1">
              {listId
                ? `Suscripción a "${settingsMap[Number(listId)]?.displayName ?? listsData.find(l => l.id === Number(listId))?.name ?? "lista seleccionada"}"`
                : "Selecciona una lista primero"}
            </span>
          </div>
        </div>

        {/* Connector from trigger */}
        <div className="ml-4 w-0.5 h-4 bg-border mb-0" />

        <div className="space-y-4">
          {steps.map((step, i) => (
            <StepCard
              key={step.id}
              step={step}
              index={i}
              total={steps.length}
              templates={templatesData}
              lists={listsData}
              onChange={updateStep}
              onDelete={deleteStep}
              onMoveUp={moveUp}
              onMoveDown={(idx) => moveUp(idx + 1)}
            />
          ))}
        </div>

        <div className="ml-4 w-0.5 h-4 bg-border" />

        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 w-full mt-0 h-8 text-xs border-dashed"
          onClick={addStep}
          data-testid="button-add-step"
        >
          <Plus size={13} /> Agregar paso
        </Button>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={() => nav("/funnels")}>Cancelar</Button>
        <Button
          size="sm"
          className="gap-1.5"
          onClick={handleSave}
          disabled={saveMutation.isPending}
          data-testid="button-save-funnel"
        >
          <Save size={13} />
          {saveMutation.isPending ? "Guardando..." : isEdit ? "Actualizar funnel" : "Crear funnel"}
        </Button>
      </div>
    </div>
  );
}
