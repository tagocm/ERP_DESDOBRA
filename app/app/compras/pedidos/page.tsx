'use client'

import { useState, useEffect } from 'react'
import { useCompany } from '@/contexts/CompanyContext'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/Button'
import { Plus, List, ArrowDownToLine, Factory, Download } from 'lucide-react'
import { listPurchaseOrdersAction } from '@/app/actions/purchases'
import { QuickEntryModal } from '@/components/purchases/QuickEntryModal'
import { PageHeader } from '@/components/ui/PageHeader'
import { PurchasesFiltersWrapper } from '@/components/purchases/PurchasesFiltersWrapper'
import { PurchasesTable } from '@/components/purchases/PurchasesTable'
import { useSearchParams, useRouter } from 'next/navigation'
import { ItemsBelowMinCard } from '@/components/purchases/ItemsBelowMinCard'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'

export default function PurchaseOrdersPage() {
    const { selectedCompany } = useCompany()
    const { toast } = useToast()
    const searchParams = useSearchParams()
    const router = useRouter()

    const [orders, setOrders] = useState<any[]>([])
    const [loading, setLoading] = useState(false)

    // Modals State
    const [isQuickEntryOpen, setIsQuickEntryOpen] = useState(false)

    // Filters from URL
    const filters = {
        search: searchParams?.get('search') || undefined,
        status: searchParams?.get('status') || undefined,
        dateFrom: searchParams?.get('dateFrom') || undefined,
        dateTo: searchParams?.get('dateTo') || undefined,
        showArchived: searchParams?.get('showArchived') === 'true'
    }

    const fetchOrders = async () => {
        setLoading(true)
        try {
            const { data, error } = await listPurchaseOrdersAction(filters)
            if (error) throw error
            setOrders(data || [])
        } catch (error: any) {
            console.error(error)
            toast({ title: 'Erro', description: 'Falha ao carregar pedidos.', variant: 'destructive' })
        } finally {
            setLoading(false)
        }
    };

    useEffect(() => {
        if (selectedCompany?.id) {
            fetchOrders()
        }
    }, [selectedCompany?.id, searchParams]) // Re-fetch when params change

    const handleEdit = (order: any) => {
        router.push(`/app/compras/pedidos/${order.id}`)
    }

    const handleNewOrder = () => {
        router.push('/app/compras/pedidos/novo')
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Compras"
                subtitle="Dashboard operacional de suprimentos e aquisições."
                actions={
                    <div className="flex gap-2">
                        <Button variant="outline" className="font-medium bg-white" onClick={() => router.push('/app/compras/necessidades')}>
                            <Factory className="w-4 h-4 mr-2" /> Necessidades de Compra
                        </Button>
                        <Button variant="secondary" className="font-medium">
                            <Download className="w-4 h-4 mr-2" /> Exportar
                        </Button>
                        <Button onClick={handleNewOrder}>
                            <Plus className="w-4 h-4 mr-2" /> Nova Ordem de Compra
                        </Button>
                    </div>
                }
            />

            <div className="px-6">
                {/* Top Statistics / Insights */}
                <div className="mb-6">
                    <ItemsBelowMinCard />
                </div>

                {/* Filters */}
                <PurchasesFiltersWrapper initialFilters={filters} />

                {/* Main Table */}
                <div className="mt-6">
                    <PurchasesTable
                        data={orders}
                        isLoading={loading}
                        onEdit={handleEdit}
                        onRefresh={fetchOrders}
                    />
                </div>

                {/* Additional Action Buttons Context (previously separate or in card header) 
                    Re-adding them as a toolbar or secondary actions if they are important. 
                    The user wanted "Exactly these margins", implying the clean layout.
                    The extra buttons (Necessidades PCP, Registro Entrada) were prominent.
                    I will add them as a small toolbar above the table or below the filters if they don't fit in PageHeader.
                    OR, I can put them in the PageHeader actions group if there's space. 
                    Let's put them in PageHeader for consistency with "Actions".
                */}
            </div>

            {/* Modals */}
            <QuickEntryModal
                isOpen={isQuickEntryOpen}
                onClose={() => setIsQuickEntryOpen(false)}
                onSuccess={fetchOrders}
            />
        </div>
    )
}