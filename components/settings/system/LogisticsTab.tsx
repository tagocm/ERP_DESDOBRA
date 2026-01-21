import { Card, CardContent } from "@/components/ui/Card";
import { CardHeaderStandard } from "@/components/ui/CardHeaderStandard";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/Accordion";
import { ReasonList } from "./ReasonList";
import { RotateCcw } from "lucide-react";

import { DELIVERY_REASON_GROUPS } from "@/types/reasons";

const SECTIONS = [
    {
        id: "return",
        title: "Ocorrências Logísticas",
        icon: RotateCcw,
        description: "Motivos utilizados para registrar ocorrências logísticas quando o carregamento ou a entrega não ocorrem conforme o planejado.",
        types: DELIVERY_REASON_GROUPS
    }
];

export function LogisticsTab() {
    return (
        <div className="space-y-8">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h4 className="font-semibold text-blue-900 mb-1">Como funcionam as Ocorrências Logísticas?</h4>
                <p className="text-sm text-blue-800">
                    Ao definir um motivo, você configura exigências e sinalizações que o sistema utilizará para registrar a ocorrência e gerar pendências para outras áreas.
                    <br />
                    Nenhuma ação é executada automaticamente no pedido. As decisões comerciais e financeiras são tratadas posteriormente.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {SECTIONS.map((section) => (
                    <Card key={section.id} className="h-full">
                        <CardHeaderStandard
                            icon={<section.icon className="w-5 h-5" />}
                            title={section.title}
                            description={section.description}
                        />
                        <CardContent>
                            <Accordion type="single" collapsible className="w-full">
                                {section.types.map((type) => (
                                    <AccordionItem key={type.code} value={type.code}>
                                        <AccordionTrigger className="hover:no-underline hover:bg-gray-50 px-4 rounded-lg">
                                            <div className="flex items-center gap-2 text-left">
                                                <span className="font-medium text-gray-800">{type.label}</span>
                                                <span className="text-xs text-gray-400 font-mono hidden xl:inline-block">({type.code})</span>
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
        </div>
    );
}
