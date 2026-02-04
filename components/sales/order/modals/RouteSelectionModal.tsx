
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { Input } from "@/components/ui/Input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Plus, Truck } from "lucide-react";
import { createClient } from "@/lib/supabaseBrowser";
import { getTodayRoutes, createRoute } from "@/lib/data/expedition";
import { useToast } from "@/components/ui/use-toast";
import { DeliveryRoute } from "@/types/sales";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { normalizeRouteStatus } from "@/lib/constants/status";

interface RouteSelectionModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    companyId: string;
    onConfirm: (routeId: string) => Promise<void>;
}

export function RouteSelectionModal({ open, onOpenChange, companyId, onConfirm }: RouteSelectionModalProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [routes, setRoutes] = useState<DeliveryRoute[]>([]);
    const [selectedValue, setSelectedValue] = useState<string>("");
    const [newRouteName, setNewRouteName] = useState("");
    const supabase = createClient();
    const { toast } = useToast();

    useEffect(() => {
        if (open && companyId) {
            fetchRoutes();
            // Reset state
            setSelectedValue("");
            setNewRouteName(`Rota Extra - ${format(new Date(), 'HH:mm')}`);
        }
    }, [open, companyId]);

    const fetchRoutes = async () => {
        setIsLoading(true);
        try {
            const data = await getTodayRoutes(supabase, companyId);
            setRoutes(data || []);
            // Pre-select the first route if available, otherwise 'new'
            if (data && data.length > 0) {
                setSelectedValue(data[0].id);
            } else {
                setSelectedValue("new");
            }
        } catch (error) {
            console.error("Error fetching routes:", error);
            toast({ title: "Erro", description: "Falha ao buscar rotas de hoje.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const handleConfirmClick = async () => {
        if (!selectedValue) return;

        setIsSubmitting(true);
        try {
            let targetRouteId = selectedValue;

            if (selectedValue === 'new') {
                if (!newRouteName.trim()) {
                    toast({ title: "Atenção", description: "Digite o nome da nova rota.", variant: "destructive" });
                    setIsSubmitting(false);
                    return;
                }

                const today = format(new Date(), 'yyyy-MM-dd');
                // Use Server Action for Single Tenant enforcement & Audit
                const { createRouteAction } = await import("@/app/actions/logistics/create-route");
                const newRoute = await createRouteAction({
                    name: newRouteName,
                    route_date: today,
                    scheduled_date: today,
                    status: 'planned'
                });
                targetRouteId = newRoute.id;
            }

            await onConfirm(targetRouteId);
            onOpenChange(false);
        } catch (error: any) {
            console.error("Error in migration:", error);
            toast({ title: "Erro", description: error.message || "Falha ao processar.", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Truck className="h-5 w-5 text-primary" />
                        Enviar para Separação
                    </DialogTitle>
                    <DialogDescription>
                        Escolha uma rota de hoje para agrupar este pedido ou crie uma nova.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <RadioGroup value={selectedValue} onValueChange={setSelectedValue} className="gap-3">
                    <ScrollArea className="h-[200px] w-full rounded-2xl border p-2">
                                <div className="space-y-2">
                                    {routes.length === 0 && (
                                        <div className="text-sm text-center text-muted-foreground py-4">
                                            Nenhuma rota agendada para hoje.
                                        </div>
                                    )}

                                    {routes.map((route) => (
                                        <div key={route.id} className={cn(
                                            "flex items-center space-x-2 rounded-2xl border p-3 cursor-pointer transition-colors hover:bg-accent",
                                            selectedValue === route.id ? "bg-accent border-primary" : "border-transparent"
                                        )}>
                                            <RadioGroupItem value={route.id} id={route.id} />
                                            <Label htmlFor={route.id} className="flex-1 cursor-pointer font-medium">
                                                {route.name}
                                                <span className="block text-xs text-muted-foreground font-normal">
                                                    {route.orders?.length || 0} pedidos • {(normalizeRouteStatus(route.status) || route.status) === 'in_route' ? 'Em Saída' : 'Planejada'}
                                                </span>
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>

                            <div className={cn(
                                "flex flex-col space-y-3 rounded-2xl border p-3 transition-colors",
                                selectedValue === 'new' ? "bg-accent/50 border-primary" : "border-transparent hover:bg-accent/30"
                            )}>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="new" id="new-route" />
                                    <Label htmlFor="new-route" className="cursor-pointer font-medium flex items-center gap-2">
                                        <Plus className="h-4 w-4" />
                                        Criar Nova Rota para Hoje
                                    </Label>
                                </div>

                                {selectedValue === 'new' && (
                                    <div className="pl-6 animate-in slide-in-from-top-2 fade-in duration-200">
                                        <Label htmlFor="route-name" className="sr-only">Nome da Rota</Label>
                                        <Input
                                            id="route-name"
                                            value={newRouteName}
                                            onChange={(e) => setNewRouteName(e.target.value)}
                                            placeholder="Ex: Rota Extra 14:00"
                                            className="h-9 bg-background"
                                            autoFocus
                                        />
                                    </div>
                                )}
                            </div>
                        </RadioGroup>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                        Cancelar
                    </Button>
                    <Button onClick={handleConfirmClick} disabled={isSubmitting || isLoading} className="gap-2">
                        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                        Confirmar e Enviar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
