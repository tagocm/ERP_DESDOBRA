import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { CardHeaderStandard } from '@/components/ui/CardHeaderStandard';
import { User, MapPin, ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface Props {
    recipient: any;
    onChange: (field: string, value: string) => void;
}

export function NFeRecipientCard({ recipient, onChange }: Props) {
    const [isExpanded, setIsExpanded] = useState(false);

    if (!recipient) return null;

    // Helper to safely update address fields
    const handleAddressChange = (field: string, value: string) => {
        // Assume recipient.address is the object
        const currentAddress = recipient.address || {};
        onChange('address', { ...currentAddress, [field]: value });
    };

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
                title="Destinatário"
                description="Dados do cliente para esta nota (Snapshot)"
                icon={<User className="w-5 h-5 text-gray-500" />}
                actions={toggleAction}
            />
            <CardContent className="pt-0">
                {/* Always Visible Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <Label htmlFor="rec_name">Razão Social / Nome</Label>
                        <Input
                            id="rec_name"
                            value={recipient.trade_name || recipient.legal_name || ''}
                            onChange={(e) => onChange('trade_name', e.target.value)}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="rec_doc">CNPJ / CPF</Label>
                        <Input
                            id="rec_doc"
                            value={recipient.document_number || ''}
                            onChange={(e) => onChange('document_number', e.target.value)}
                        />
                    </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                    <div className="mt-4 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label htmlFor="rec_ie">Inscrição Estadual</Label>
                                <Input
                                    id="rec_ie"
                                    value={recipient.state_registration || ''}
                                    onChange={(e) => onChange('state_registration', e.target.value)}
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="rec_email">Email</Label>
                                <Input
                                    id="rec_email"
                                    value={recipient.email || ''}
                                    onChange={(e) => onChange('email', e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="pt-2 border-t border-gray-100">
                            <div className="flex items-center gap-2 mb-3">
                                <MapPin className="w-4 h-4 text-gray-500" />
                                <span className="text-sm font-medium text-gray-700">Endereço</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="md:col-span-1 space-y-1">
                                    <Label className="text-xs">CEP</Label>
                                    <Input
                                        className="h-8 text-sm"
                                        value={recipient.address?.zip || ''}
                                        onChange={(e) => handleAddressChange('zip', e.target.value)}
                                    />
                                </div>
                                <div className="md:col-span-2 space-y-1">
                                    <Label className="text-xs">Logradouro</Label>
                                    <Input
                                        className="h-8 text-sm"
                                        value={recipient.address?.street || ''}
                                        onChange={(e) => handleAddressChange('street', e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Número</Label>
                                    <Input
                                        className="h-8 text-sm"
                                        value={recipient.address?.number || ''}
                                        onChange={(e) => handleAddressChange('number', e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Bairro</Label>
                                    <Input
                                        className="h-8 text-sm"
                                        value={recipient.address?.neighborhood || ''}
                                        onChange={(e) => handleAddressChange('neighborhood', e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Cidade</Label>
                                    <Input
                                        className="h-8 text-sm"
                                        value={recipient.address?.city || ''}
                                        onChange={(e) => handleAddressChange('city', e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">UF</Label>
                                    <Input
                                        className="h-8 text-sm"
                                        value={recipient.address?.state || ''}
                                        onChange={(e) => handleAddressChange('state', e.target.value)}
                                        maxLength={2}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
