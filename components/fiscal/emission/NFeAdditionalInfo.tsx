
import { Card, CardContent } from '@/components/ui/Card';
import { CardHeaderStandard } from '@/components/ui/CardHeaderStandard';
import { FileText } from 'lucide-react';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/Textarea';

interface Props {
    fisco?: string;
    taxpayer?: string;
    onChange: (field: 'fisco' | 'taxpayer', value: string) => void;
}

export function NFeAdditionalInfo({ fisco, taxpayer, onChange }: Props) {
    return (
        <Card>
            <CardHeaderStandard
                title="Informações Adicionais"
                description="Observações e dados complementares da nota"
                icon={<FileText className="w-5 h-5 text-gray-500" />}
            />
            <CardContent className="grid gap-6">
                <div>
                    <Label className="text-xs uppercase text-gray-500 font-bold mb-2 block">
                        Informações Complementares (Contribuinte)
                    </Label>
                    <Textarea
                        placeholder="Observações que serão impressas no campo de dados adicionais da DANFE..."
                        className="min-h-[80px]"
                        value={taxpayer || ''}
                        onChange={(e) => onChange('taxpayer', e.target.value)}
                    />
                    <p className="text-[10px] text-gray-400 mt-1">
                        Utilize este campo para mensagens legais, referências de pedido, etc.
                    </p>
                </div>

                <div>
                    <Label className="text-xs uppercase text-gray-500 font-bold mb-2 block">
                        Informações ao Fisco
                    </Label>
                    <Textarea
                        placeholder="Observações de interesse exclusivo do Fisco..."
                        className="min-h-[80px]"
                        value={fisco || ''}
                        onChange={(e) => onChange('fisco', e.target.value)}
                    />
                    <p className="text-[10px] text-gray-400 mt-1">
                        Dados visíveis apenas para a SEFAZ (não impressos na DANFE em alguns layouts).
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
