import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/Accordion";
import { ReasonList } from "./ReasonList";
import { Truck, RotateCcw } from "lucide-react";

const SECTIONS = [
    {
        id: "expedition",
        title: "Expedição",
        icon: Truck,
        description: "Motivos para falhas ou divergências durante o carregamento.",
        types: [
            { code: "EXPEDICAO_NAO_CARREGADO", label: "Não Carregado (Total)" },
            { code: "EXPEDICAO_CARREGADO_PARCIAL", label: "Carregamento Parcial" }
        ]
    },
    {
        id: "return",
        title: "Retorno de Rota",
        icon: RotateCcw,
        description: "Motivos para ocorrências no ato da entrega (app motorista/conferente).",
        types: [
            { code: "RETORNO_NAO_ENTREGUE", label: "Não Entregue / Devolução Total" },
            { code: "RETORNO_ENTREGA_PARCIAL", label: "Entrega Parcial / Devolução Parcial" }
        ]
    }
];

export function LogisticsTab() {
    return (
        <div className="space-y-8">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h4 className="font-semibold text-blue-900 mb-1">Como funcionam as Regras Padrão?</h4>
                <p className="text-sm text-blue-800">
                    Ao definir um motivo, você escolhe quais ações o sistema deve sugerir (ex: voltar para sandbox, gerar devolução).
                    <br />
                    O operador sempre poderá alterar essas sugestões no momento da ocorrência (override).
                </p>
            </div>

            {SECTIONS.map((section) => (
                <Card key={section.id}>
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-gray-100 rounded-lg">
                                <section.icon className="w-5 h-5 text-gray-600" />
                            </div>
                            <div>
                                <CardTitle>{section.title}</CardTitle>
                                <CardDescription>{section.description}</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Accordion type="single" collapsible className="w-full">
                            {section.types.map((type) => (
                                <AccordionItem key={type.code} value={type.code}>
                                    <AccordionTrigger className="hover:no-underline hover:bg-gray-50 px-4 rounded-lg">
                                        <div className="flex items-center gap-2 text-left">
                                            <span className="font-medium text-gray-800">{type.label}</span>
                                            <span className="text-xs text-gray-400 font-mono hidden sm:inline-block">({type.code})</span>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="p-4 pt-2">
                                        <ReasonList typeCode={type.code} typeLabel={type.label} />
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
