
import { Input } from "@/components/ui/Input"

export interface AddressFormData {
    id?: string
    zip: string
    street: string
    number: string
    complement: string
    neighborhood: string
    city: string
    state: string
    country: string
}

interface AddressFormProps {
    value: AddressFormData
    onChange: (field: keyof AddressFormData, value: string) => void
    label?: string
}

export function AddressForm({ value, onChange, label }: AddressFormProps) {
    return (
        <div>
            {label && <h4 className="font-medium mb-3">{label}</h4>}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium">CEP</label>
                    <Input
                        value={value.zip}
                        onChange={(e) => onChange('zip', e.target.value)}
                        placeholder="00000-000"
                    />
                </div>
                <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium">Logradouro</label>
                    <Input
                        value={value.street}
                        onChange={(e) => onChange('street', e.target.value)}
                        placeholder="Rua, Avenida, etc."
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium">Número</label>
                    <Input
                        value={value.number}
                        onChange={(e) => onChange('number', e.target.value)}
                        placeholder="123"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium">Complemento</label>
                    <Input
                        value={value.complement}
                        onChange={(e) => onChange('complement', e.target.value)}
                        placeholder="Apto, Sala, etc."
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium">Bairro</label>
                    <Input
                        value={value.neighborhood}
                        onChange={(e) => onChange('neighborhood', e.target.value)}
                        placeholder="Centro"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium">Cidade</label>
                    <Input
                        value={value.city}
                        onChange={(e) => onChange('city', e.target.value)}
                        placeholder="São Paulo"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium">UF</label>
                    <Input
                        value={value.state}
                        onChange={(e) => onChange('state', e.target.value.toUpperCase())}
                        placeholder="SP"
                        maxLength={2}
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium">País</label>
                    <Input
                        value={value.country}
                        onChange={(e) => onChange('country', e.target.value)}
                        placeholder="BR"
                        disabled
                    />
                </div>
            </div>
        </div>
    )
}
