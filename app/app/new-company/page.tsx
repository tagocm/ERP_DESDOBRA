
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card"

export default function NewCompanyPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [companyName, setCompanyName] = useState("")

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            const res = await fetch("/api/onboarding", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    company_name: companyName,
                    // slug is auto-generated on server
                }),
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || "Erro ao criar empresa")
            }

            // Update localStorage immediately so context picks it up faster on redirect
            if (data.company_id) {
                localStorage.setItem("selectedCompanyId", data.company_id);
            }

            // Success - Force redirect to settings to complete registration
            window.location.href = `/app/settings/company?new=true`

        } catch (err: any) {
            console.error(err)
            setError(err.message)
            setLoading(false)
        }
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl">Nova Empresa</CardTitle>
                    <p className="text-sm text-gray-500">Crie um novo ambiente de trabalho</p>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Nome da Empresa</label>
                            <Input
                                name="companyName"
                                placeholder="Ex: Minha Empresa"
                                required
                                value={companyName}
                                onChange={(e) => setCompanyName(e.target.value)}
                            />
                            <p className="text-xs text-gray-500">O endereço do sistema será gerado automaticamente.</p>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <Button
                                type="button"
                                variant="ghost"
                                className="w-full"
                                onClick={() => router.push('/app')}
                            >
                                Cancelar
                            </Button>
                            <Button type="submit" variant="primary" className="w-full" disabled={loading}>
                                {loading ? "Criando..." : "Criar Empresa"}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
