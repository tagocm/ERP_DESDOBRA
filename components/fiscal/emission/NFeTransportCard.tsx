
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { CardHeaderStandard } from '@/components/ui/CardHeaderStandard';
import { Truck, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { Label } from '@/components/ui/Label';
import { Input } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { DecimalInput } from '@/components/ui/DecimalInput';
import { NFeTransport } from '@/lib/fiscal/nfe-emission-actions';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';

interface Props {
    transport: NFeTransport;
    totals: {
        freight: number;
        insurance: number;
        others: number;
    };
    onTransportChange: (field: keyof NFeTransport, value: any) => void;
    onTotalChange: (field: 'freight' | 'insurance' | 'others', value: number) => void;
}

export function NFeTransportCard({ transport, totals, onTransportChange, onTotalChange }: Props) {
    const [isExpanded, setIsExpanded] = useState(false);

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
                title="Transporte e Volumes"
                description="Dados de logística e despesas acessórias"
                icon={<Truck className="w-5 h-5 text-gray-500" />}
                actions={toggleAction}
            />
            <CardContent className="pt-0">
                {/* Always Visible Row: Modality, Carrier Name, CNPJ */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    {/* Modality - 3 Cols */}
                    <div className="md:col-span-3 space-y-1">
                        <Label>Modalidade</Label>
                        <Select
                            value={transport.modality}
                            onValueChange={(val) => onTransportChange('modality', val)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="0">0 - Remetente (CIF)</SelectItem>
                                <SelectItem value="1">1 - Destinatário (FOB)</SelectItem>
                                <SelectItem value="9">9 - Sem Frete</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Carrier Name - 6 Cols */}
                    <div className="md:col-span-6 space-y-1">
                        <Label>Razão Social</Label>
                        <Input
                            value={transport.carrier?.name || ''}
                            onChange={(e) => onTransportChange('carrier', { ...transport.carrier, name: e.target.value })}
                            placeholder="Nome da Transportadora"
                        />
                    </div>

                    {/* Carrier CNPJ - 3 Cols */}
                    <div className="md:col-span-3 space-y-1">
                        <Label>CNPJ</Label>
                        <Input
                            value={transport.carrier?.document || ''}
                            onChange={(e) => onTransportChange('carrier', { ...transport.carrier, document: e.target.value })}
                            placeholder="00.000.000/0000-00"
                        />
                    </div>
                </div>

                {/* Always Visible Values & Volumes */}
                <div className="mt-6 border-t border-gray-100 pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Values Group */}
                        <div className="space-y-3">
                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Valores</h4>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-1">
                                    <Label className="text-xs">Valor Frete</Label>
                                    <DecimalInput
                                        value={totals.freight}
                                        onChange={(val) => onTotalChange('freight', Number(val))}
                                        prefix="R$ "
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Seguro</Label>
                                    <DecimalInput
                                        value={totals.insurance}
                                        onChange={(val) => onTotalChange('insurance', Number(val))}
                                        prefix="R$ "
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Outras</Label>
                                    <DecimalInput
                                        value={totals.others}
                                        onChange={(val) => onTotalChange('others', Number(val))}
                                        prefix="R$ "
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Volumes Group */}
                        <div className="space-y-3">
                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Volumes</h4>
                            <div className="grid grid-cols-4 gap-3">
                                <div className="space-y-1">
                                    <Label className="text-xs">Qtd</Label>
                                    <Input
                                        type="number"
                                        className="text-center"
                                        value={transport.volumes_qty || ''}
                                        onChange={(e) => onTransportChange('volumes_qty', Number(e.target.value))}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Espécie</Label>
                                    <Input
                                        value={transport.species || ''}
                                        onChange={(e) => onTransportChange('species', e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Peso Líq.</Label>
                                    <DecimalInput
                                        precision={3}
                                        value={transport.weight_net || 0}
                                        onChange={(val) => onTransportChange('weight_net', Number(val))}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Peso Bruto</Label>
                                    <DecimalInput
                                        precision={3}
                                        value={transport.weight_gross || 0}
                                        onChange={(val) => onTransportChange('weight_gross', Number(val))}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Expanded Content: Address */}
                {isExpanded && (
                    <div className="mt-6 space-y-3 pt-6 border-t border-gray-100 animate-in slide-in-from-top-2 duration-200">
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Endereço da Transportadora</h4>
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                            <div className="md:col-span-3 space-y-1">
                                <Label className="text-xs">Inscrição Estadual</Label>
                                <Input
                                    value={transport.carrier?.ie || ''}
                                    onChange={(e) => onTransportChange('carrier', { ...transport.carrier, ie: e.target.value })}
                                />
                            </div>
                            <div className="md:col-span-5 space-y-1">
                                <Label className="text-xs">Endereço</Label>
                                <Input
                                    value={transport.carrier?.address || ''}
                                    onChange={(e) => onTransportChange('carrier', { ...transport.carrier, address: e.target.value })}
                                />
                            </div>
                            <div className="md:col-span-3 space-y-1">
                                <Label className="text-xs">Cidade</Label>
                                <Input
                                    value={transport.carrier?.city || ''}
                                    onChange={(e) => onTransportChange('carrier', { ...transport.carrier, city: e.target.value })}
                                />
                            </div>
                            <div className="md:col-span-1 space-y-1">
                                <Label className="text-xs">UF</Label>
                                <Input
                                    value={transport.carrier?.uf || ''}
                                    onChange={(e) => onTransportChange('carrier', { ...transport.carrier, uf: e.target.value })}
                                    maxLength={2}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
