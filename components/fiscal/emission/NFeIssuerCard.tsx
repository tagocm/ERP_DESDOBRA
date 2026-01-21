import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { CardHeaderStandard } from '@/components/ui/CardHeaderStandard';
import { Building2, ChevronDown, ChevronUp, MapPin } from 'lucide-react';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

interface Props {
    company: any;
}

export function NFeIssuerCard({ company }: Props) {
    const [isExpanded, setIsExpanded] = useState(false);

    if (!company) return null;

    const fiscal = company.fiscal_profile?.[0] || company.fiscal_profile;

    // Build address from fiscal.address_* fields (correct source for NF-e)
    const address = fiscal ? {
        zip: fiscal.address_zip,
        street: fiscal.address_street,
        number: fiscal.address_number,
        neighborhood: fiscal.address_neighborhood,
        city: fiscal.address_city,
        state: fiscal.address_state
    } : null;

    // Validation - only show warning for truly missing data
    const ieValue = fiscal?.ie || '';
    const isIsentoIE = ieValue.toLowerCase() === 'isento';

    const missingCRT = !fiscal?.tax_regime;
    const missingIE = !ieValue && !isIsentoIE;

    const toggleAction = (
        <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-8 w-8 p-0"
        >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </Button>
    );

    return (
        <Card>
            <CardHeaderStandard
                title="Emitente"
                description="Dados da sua empresa emissora da nota"
                icon={<Building2 className="w-5 h-5 text-gray-500" />}
                actions={toggleAction}
            />
            <CardContent className="pt-0">
                {/* Always Visible Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <Label>Razão Social</Label>
                        <div className="text-sm font-medium py-2">
                            {fiscal?.legal_name || company.legal_name || company.trade_name || company.name}
                        </div>
                    </div>
                    <div className="space-y-1">
                        <Label>CNPJ</Label>
                        <div className="text-sm py-2">
                            {fiscal?.cnpj || company.document_number}
                        </div>
                    </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                    <div className="mt-4 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label>Inscrição Estadual</Label>
                                <div className="text-sm py-2">
                                    {fiscal?.ie || 'Isento'}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label>Regime Tributário</Label>
                                <div className="text-sm py-2">
                                    {fiscal?.tax_regime === 'simples_nacional' ? 'Simples Nacional' :
                                        fiscal?.tax_regime === 'lucro_presumido' ? 'Lucro Presumido' :
                                            fiscal?.tax_regime === 'lucro_real' ? 'Lucro Real' :
                                                fiscal?.tax_regime || 'Não informado'}
                                </div>
                            </div>
                        </div>

                        {address && address.street && (
                            <div className="pt-2 border-t border-gray-100">
                                <div className="flex items-center gap-2 mb-3">
                                    <MapPin className="w-4 h-4 text-gray-500" />
                                    <span className="text-sm font-medium text-gray-700">Endereço</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div className="md:col-span-1 space-y-1">
                                        <Label className="text-xs">CEP</Label>
                                        <div className="text-sm py-1">{address.zip}</div>
                                    </div>
                                    <div className="md:col-span-2 space-y-1">
                                        <Label className="text-xs">Logradouro</Label>
                                        <div className="text-sm py-1">{address.street}</div>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Número</Label>
                                        <div className="text-sm py-1">{address.number}</div>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Bairro</Label>
                                        <div className="text-sm py-1">{address.neighborhood}</div>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Cidade</Label>
                                        <div className="text-sm py-1">{address.city}</div>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">UF</Label>
                                        <div className="text-sm py-1">{address.state}</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {(missingCRT || missingIE) && (
                            <Alert variant="warning">
                                Dados fiscais incompletos. Verifique o cadastro da empresa.
                            </Alert>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
