
"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabaseBrowser"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card"
import Link from "next/link"

export default function LoginPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [formData, setFormData] = useState({
        email: "",
        password: "",
    })

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value })
    }

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        const supabase = createClient()

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email: formData.email,
                password: formData.password,
            })

            if (error) throw error

            router.push("/app")
            router.refresh()
        } catch (err: any) {
            console.error(err)
            setError(err.message === "Invalid login credentials" ? "Email ou senha incorretos" : err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl">Entrar no Desdobra</CardTitle>
                    <p className="text-sm text-gray-500">Bem-vindo de volta</p>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleLogin} className="space-y-4">
                        {error && (
                            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
                                {error}
                            </div>
                        )}

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
                            {loading ? "Entrando..." : "Entrar"}
                        </Button>

                        <div className="text-center text-sm text-gray-500 mt-4">
                            Não tem uma conta?{" "}
                            <Link href="/signup" className="text-blue-600 hover:underline">
                                Criar conta
                            </Link>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
