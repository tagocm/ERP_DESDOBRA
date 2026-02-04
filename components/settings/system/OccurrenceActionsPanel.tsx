import { Switch } from "@/components/ui/Switch";
import { Label } from "@/components/ui/Label";
import { Badge } from "@/components/ui/Badge";

export enum OperationAction {
    RETURN_TO_SANDBOX_PENDING = "RETURN_TO_SANDBOX_PENDING",
    REGISTER_NOTE_ON_ORDER = "REGISTER_NOTE_ON_ORDER",
    GENERATE_RETURN_MOVEMENT = "GENERATE_RETURN_MOVEMENT",
    GENERATE_NEW_ORDER_PENDING = "GENERATE_NEW_ORDER_PENDING",
}

const ACTION_CONFIG: Record<OperationAction, { label: string; description: string }> = {
    [OperationAction.RETURN_TO_SANDBOX_PENDING]: {
        label: "Voltar para Sandbox (Pendente)",
        description: "O pedido sai da rota e volta para a lista de preparação."
    },
    [OperationAction.REGISTER_NOTE_ON_ORDER]: {
        label: "Registrar nota no pedido",
        description: "Adiciona uma observação interna automática com o motivo."
    },
    [OperationAction.GENERATE_RETURN_MOVEMENT]: {
        label: "Gerar devolução (movimento)",
        description: "Gera entrada de devolução de venda para os itens."
    },
    [OperationAction.GENERATE_NEW_ORDER_PENDING]: {
        label: "Gerar novo pedido (pendente)",
        description: "Cria um novo pedido de venda para os itens."
    }
};

interface OccurrenceActionsPanelProps {
    title?: string;
    mode: 'defaults' | 'operation';
    availableActions: OperationAction[];
    currentActions: Record<string, boolean>; // Keyed by OperationAction enum strings
    defaultActions?: Record<string, boolean>; // Required in operation mode
    onChange: (action: OperationAction, value: boolean) => void;
    customLabels?: Partial<Record<OperationAction, string>>;
    locked?: boolean;
}

export function OccurrenceActionsPanel({
    title = "Ações (padrão do motivo)",
    mode,
    availableActions,
    currentActions,
    defaultActions,
    onChange,
    customLabels,
    locked = false
}: OccurrenceActionsPanelProps) {
    const isDefaultsMode = mode === 'defaults';
    const panelTitle = isDefaultsMode ? "Ações Padrão (Defaults)" : title;
    const subtitle = isDefaultsMode
        ? "Estas ações virão marcadas por padrão, mas o operador pode alterar (override) no momento da ocorrência."
        : "Estas ações vêm marcadas por padrão, mas o operador pode ajustar antes de confirmar.";

    return (
        <div className="border rounded-2xl bg-gray-50/50 border-gray-100 p-4 space-y-4">
            <div>
                <h4 className="text-sm font-semibold text-gray-900">{panelTitle}</h4>
                <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
            </div>

            <div className="space-y-4">
                {availableActions.map((action) => {
                    const config = ACTION_CONFIG[action];
                    const label = customLabels?.[action] || config.label;
                    const isChecked = currentActions[action] || false;
                    const isDefault = defaultActions ? defaultActions[action] : undefined;
                    const isModified = !isDefaultsMode && isDefault !== undefined && isChecked !== isDefault;

                    return (
                        <div key={action} className="flex items-start justify-between gap-4">
                            <div className="space-y-0.5 flex-1">
                                <div className="flex items-center gap-2">
                                    <Label className="text-sm font-medium text-gray-700 cursor-pointer" onClick={() => onChange(action, !isChecked)}>
                                        {label}
                                    </Label>
                                    {!isDefaultsMode && isDefault !== undefined && isChecked === isDefault && (
                                        <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-100">
                                            Padrão
                                        </Badge>
                                    )}
                                    {isModified && (
                                        <span className="text-[10px] text-amber-600 font-medium italic">
                                            Ajustado pelo operador
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-gray-500 leading-relaxed">
                                    {config.description}
                                </p>
                            </div>
                            <Switch
                                checked={isChecked}
                                onCheckedChange={(val) => onChange(action, val)}
                                disabled={locked}
                                className="mt-0.5 scale-90 origin-right"
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
