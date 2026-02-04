
"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabaseBrowser"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card"

export default function SignupPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [formData, setFormData] = useState({
        email: "",
        password: "",
        fullName: "",
        companyName: "",
        slug: ""
    })

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value })
    }

    // Auto-generate slug from company name
    const handleCompanyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const name = e.target.value
        const slug = name.toLowerCase()
            .replace(/[^\w\s-]/g, '') // remove special chars
            .replace(/\s+/g, '-')     // replace spaces with hyphens

        setFormData({
            ...formData,
            companyName: name,
            slug: slug
        })
    }

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        const supabase = createClient()

        try {
            // 1. Sign Up
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
            })

            if (authError) throw authError
            if (!authData.user) throw new Error("Erro ao criar usuário")

            // 2. Call Onboarding API to create Company & Membership
            const res = await fetch("/api/onboarding", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    company_name: formData.companyName,
                    slug: formData.slug,
                    full_name: formData.fullName
                }),
            })

            const onboardingData = await res.json()

            if (!res.ok) {
                throw new Error(onboardingData.error || "Erro no onboarding da empresa")
            }

            // Success
            router.push("/app")

        } catch (err: any) {
            console.error(err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl">Criar Conta no Desdobra</CardTitle>
                    <p className="text-sm text-gray-500">Crie sua empresa e comece a usar</p>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSignup} className="space-y-4">
                        {error && (
                            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-2xl">
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Nome Completo</label>
                            <Input
                                name="fullName"
                                placeholder="Seu nome"
                                required
                                value={formData.fullName}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Nome da Empresa</label>
                            <Input
                                name="companyName"
                                placeholder="Ex: Martigran"
                                required
                                value={formData.companyName}
                                onChange={handleCompanyChange}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Slug (URL)</label>
                            <Input
                                name="slug"
                                placeholder="martigran"
                                required
                                value={formData.slug}
                                readOnly
                                className="bg-gray-100 text-gray-500 cursor-not-allowed"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Email</label>
                            <Input
                                type="email"
                                name="email"
                                placeholder="voce@empresa.com"
                                required
                                value={formData.email}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Senha</label>
                            <Input
                                type="password"
                                name="password"
                                placeholder="******"
                                required
                                value={formData.password}
                                onChange={handleChange}
                            />
                        </div>

                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? "Criando conta..." : "Criar Conta e Empresa"}
                        </Button>

                        <div className="text-center text-sm text-gray-500 mt-4">
                            Já tem uma conta?{" "}
                            <a href="/login" className="text-blue-600 hover:underline">
                                Entrar
                            </a>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
