'use client'

import { useState, useEffect } from 'react'
import { useCompany } from '@/contexts/CompanyContext'
import { PageHeader } from '@/components/ui/PageHeader'
import { PreApprovalList } from '@/components/finance/PreApprovalList'
import { listPendingTitlesAction } from '@/app/actions/finance'
import { useToast } from '@/components/ui/use-toast'

export default function FinancialPreApprovalPage() {
    const { selectedCompany } = useCompany()
    const { toast } = useToast()
    const [titles, setTitles] = useState<any[]>([])
    const [loading, setLoading] = useState(false)

    const fetchTitles = async () => {
        setLoading(true)
        try {
            const { data, error } = await listPendingTitlesAction()
            if (error) throw error
            setTitles(data || [])
        } catch (error: any) {
            console.error(error)
            toast({ title: 'Erro', description: 'Falha ao carregar títulos.', variant: 'destructive' })
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (selectedCompany?.id) {
            fetchTitles()
        }
    }, [selectedCompany?.id])

    return (
        <div className="space-y-6 container mx-auto py-8">
            <PageHeader
                title="Pré-Aprovação Financeira"
                subtitle="Revise e aprove lançamentos gerados automaticamente por pedidos de venda e compra."
            />

            <div className="px-1">
                <PreApprovalList
                    data={titles}
                    isLoading={loading}
                    onRefresh={fetchTitles}
                />
            </div>
        </div>
    )
}
