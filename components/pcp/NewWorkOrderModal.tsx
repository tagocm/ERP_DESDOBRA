import { useCompany } from '@/contexts/CompanyContext'
import { createClient } from '@/lib/supabaseBrowser'
import { useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { useToast } from '@/components/ui/use-toast'
import { Checkbox } from '@/components/ui/Checkbox'
import { Loader2 } from 'lucide-react'
import {
  createWorkOrderWithDependenciesAction,
  previewWorkOrderDependenciesAction,
} from '@/app/actions/pcp-work-orders'
import type {
  WorkOrderDependencyPreviewResult,
  WorkOrderDependencySelectionInput,
  WorkOrderDependencyWarning,
} from '@/lib/pcp/work-order-dependencies-service'
import { calculateRecipeCount, formatRecipeCountLabel } from '@/lib/pcp/work-order-metrics'
import { todayInBrasilia } from '@/lib/utils'

interface NewWorkOrderModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  initialDate?: string
  initialSectorId?: string | null
}

interface ProductOption {
  id: string
  name: string
  uom: string
  type: string
  default_sector_id: string | null
}

interface BomOption {
  id: string
  version: number
  yield_qty: number
  yield_uom: string
}

interface SectorOption {
  id: string
  code: string
  name: string
}

interface ProductionProfileOption {
  item_id: string
  default_sector_id: string | null
}

interface DependencySelectionState {
  componentItemId: string
  generateChild: boolean
  sectorId: string | null
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
}

function findDefaultParentSector(sectors: SectorOption[]): string | null {
  const envase = sectors.find((sector) => {
    const code = normalizeText(sector.code)
    const name = normalizeText(sector.name)
    return code === 'ENVASE' || name.includes('ENVASE')
  })

  return envase?.id ?? sectors[0]?.id ?? null
}

function formatQty(value: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 }).format(value)
}

export function NewWorkOrderModal({ isOpen, onClose, onSuccess, initialDate, initialSectorId }: NewWorkOrderModalProps) {
  const { selectedCompany } = useCompany()
  const supabase = createClient()
  const { toast } = useToast()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [products, setProducts] = useState<ProductOption[]>([])
  const [boms, setBoms] = useState<BomOption[]>([])
  const [sectors, setSectors] = useState<SectorOption[]>([])

  const [selectedProduct, setSelectedProduct] = useState('')
  const [selectedBom, setSelectedBom] = useState('')
  const [selectedSectorId, setSelectedSectorId] = useState<string>('')
  const [plannedQty, setPlannedQty] = useState<number | string>('')
  const [notes, setNotes] = useState('')
  const [scheduledDate, setScheduledDate] = useState(initialDate || todayInBrasilia())

  const [preview, setPreview] = useState<WorkOrderDependencyPreviewResult | null>(null)
  const [dependencySelections, setDependencySelections] = useState<Record<string, DependencySelectionState>>({})
  const [isDependenciesModalOpen, setIsDependenciesModalOpen] = useState(false)
  const [dependencyWarnings, setDependencyWarnings] = useState<WorkOrderDependencyWarning[]>([])

  const selectedProductData = useMemo(
    () => products.find((product) => product.id === selectedProduct) ?? null,
    [products, selectedProduct]
  )
  const filteredProducts = useMemo(() => {
    if (!selectedSectorId) {
      return products
    }

    return products.filter(
      (product) => !product.default_sector_id || product.default_sector_id === selectedSectorId
    )
  }, [products, selectedSectorId])
  const selectedBomData = useMemo(
    () => boms.find((bom) => bom.id === selectedBom) ?? null,
    [boms, selectedBom]
  )
  const plannedQtyNumber = useMemo(() => Number(plannedQty || 0), [plannedQty])
  const recipeCount = useMemo(
    () => calculateRecipeCount(plannedQtyNumber, selectedBomData?.yield_qty),
    [plannedQtyNumber, selectedBomData]
  )

  useEffect(() => {
    if (isOpen && initialDate) {
      setScheduledDate(initialDate)
      return
    }

    if (isOpen && !initialDate) {
      setScheduledDate(todayInBrasilia())
    }
  }, [isOpen, initialDate])

  const resolvePreferredSectorId = (
    productId: string,
    productsList: ProductOption[],
    sectorsList: SectorOption[],
  ): string | null => {
    const product = productsList.find((entry) => entry.id === productId)
    if (product?.default_sector_id && sectorsList.some((sector) => sector.id === product.default_sector_id)) {
      return product.default_sector_id
    }

    return findDefaultParentSector(sectorsList)
  }

  useEffect(() => {
    const fetchBaseData = async () => {
      if (!isOpen || !selectedCompany) {
        return
      }

      const [
        { data: productsData, error: productsError },
        { data: sectorsData, error: sectorsError },
      ] = await Promise.all([
        supabase
          .from('items')
          .select('id, name, uom, type')
          .eq('company_id', selectedCompany.id)
          .in('type', ['finished_good', 'wip'])
          .eq('is_active', true)
          .is('deleted_at', null)
          .order('name'),
        supabase
          .from('production_sectors')
          .select('id, code, name')
          .eq('company_id', selectedCompany.id)
          .is('deleted_at', null)
          .eq('is_active', true)
          .order('name'),
      ])

      const profilesQuery = await supabase
        .from('item_production_profiles')
        .select('item_id, default_sector_id')
        .eq('company_id', selectedCompany.id)

      if (profilesQuery.error) {
        toast({
          title: 'Erro',
          description: `Falha ao carregar setor padrão dos itens: ${profilesQuery.error.message}`,
          variant: 'destructive',
        })
        return
      }

      if (productsError) {
        toast({
          title: 'Erro',
          description: `Falha ao carregar itens: ${productsError.message}`,
          variant: 'destructive',
        })
        return
      }

      if (sectorsError) {
        toast({
          title: 'Erro',
          description: `Falha ao carregar setores: ${sectorsError.message}`,
          variant: 'destructive',
        })
        return
      }

      const nextSectors = (sectorsData ?? []) as SectorOption[]
      const profilesByItemId = new Map(
        ((profilesQuery.data ?? []) as ProductionProfileOption[]).map((profile) => [profile.item_id, profile.default_sector_id])
      )
      const nextProducts = ((productsData ?? []) as Omit<ProductOption, 'default_sector_id'>[]).map((product) => ({
        ...product,
        default_sector_id: profilesByItemId.get(product.id) ?? null,
      }))

      setProducts(nextProducts)
      setSectors(nextSectors)

      setSelectedSectorId((current) => {
        const isCurrentValid = Boolean(current) && nextSectors.some((sector) => sector.id === current)
        if (isCurrentValid) {
          return current
        }

        const isInitialValid =
          Boolean(initialSectorId) && nextSectors.some((sector) => sector.id === initialSectorId)
        if (isInitialValid) {
          return initialSectorId as string
        }

        return findDefaultParentSector(nextSectors) ?? ''
      })
    }

    void fetchBaseData()
  }, [initialSectorId, isOpen, selectedCompany, supabase, toast])

  const handleProductChange = (productId: string) => {
    setSelectedProduct(productId)
    const preferredSectorId = resolvePreferredSectorId(productId, products, sectors)
    if (!selectedSectorId && preferredSectorId) {
      setSelectedSectorId(preferredSectorId)
    }
  }

  useEffect(() => {
    const fetchBoms = async () => {
      if (!selectedProduct || !selectedCompany) {
        setBoms([])
        setSelectedBom('')
        return
      }

      const { data, error } = await supabase
        .from('bom_headers')
        .select('id, version, yield_qty, yield_uom')
        .eq('company_id', selectedCompany.id)
        .eq('item_id', selectedProduct)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('version', { ascending: false })

      if (error) {
        toast({
          title: 'Erro',
          description: `Falha ao carregar receitas: ${error.message}`,
          variant: 'destructive',
        })
        setBoms([])
        setSelectedBom('')
        return
      }

      const nextBoms = (data ?? []) as BomOption[]
      setBoms(nextBoms)
      setSelectedBom(nextBoms[0]?.id ?? '')
    }

    void fetchBoms()
  }, [selectedProduct, selectedCompany, supabase, toast])

  useEffect(() => {
    if (!selectedProduct) return
    const isAllowed = filteredProducts.some((product) => product.id === selectedProduct)
    if (!isAllowed) {
      setSelectedProduct('')
      setSelectedBom('')
      setBoms([])
    }
  }, [filteredProducts, selectedProduct])

  const resetState = () => {
    setProducts([])
    setBoms([])
    setSectors([])
    setSelectedProduct('')
    setSelectedBom('')
    setSelectedSectorId('')
    setPlannedQty('')
    setNotes('')
    setScheduledDate(todayInBrasilia())
    setPreview(null)
    setDependencySelections({})
    setIsDependenciesModalOpen(false)
    setDependencyWarnings([])
  }

  const handleClose = () => {
    resetState()
    onClose()
  }

  const ensureFormValid = (): number | null => {
    const parsedQty = Number(plannedQty)

    if (!selectedSectorId) {
      toast({
        title: 'Setor obrigatório',
        description: 'Selecione um setor de produção ativo para criar a OP.',
        variant: 'destructive',
      })
      return null
    }

    if (!selectedProduct || !selectedBom || !scheduledDate || !Number.isFinite(parsedQty) || parsedQty <= 0) {
      toast({
        title: 'Inválido',
        description: 'Preencha produto, receita, quantidade e data com valores válidos.',
        variant: 'destructive',
      })
      return null
    }

    return parsedQty
  }

  const executeCreate = async (selectionList: WorkOrderDependencySelectionInput[]) => {
    const parsedQty = ensureFormValid()
    if (!parsedQty) {
      return
    }

    setIsSubmitting(true)
    try {
      const result = await createWorkOrderWithDependenciesAction({
        itemId: selectedProduct,
        bomId: selectedBom,
        plannedQty: parsedQty,
        scheduledDate,
        notes: notes || null,
        parentSectorId: selectedSectorId,
        dependencySelections: selectionList,
      })

      const childrenInfo =
        result.createdChildrenCount > 0
          ? ` e ${result.createdChildrenCount} OP(s) filha(s)`
          : ''

      toast({
        title: 'Sucesso',
        description: `OP criada${childrenInfo}.`,
        variant: 'default',
      })

      if (result.warnings.length > 0) {
        toast({
          title: 'Atenção na estrutura da receita',
          description: result.warnings[0].message,
          variant: 'destructive',
        })
      }

      onSuccess()
      handleClose()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao criar ordem de produção.'
      toast({ title: 'Erro', description: message, variant: 'destructive' })
    } finally {
      setIsSubmitting(false)
      setIsPreviewing(false)
      setIsDependenciesModalOpen(false)
    }
  }

  const handleContinue = async () => {
    const parsedQty = ensureFormValid()
    if (!parsedQty) {
      return
    }

    setIsPreviewing(true)
    try {
      const previewResponse = await previewWorkOrderDependenciesAction({
        itemId: selectedProduct,
        bomId: selectedBom,
        plannedQty: parsedQty,
      })

      setPreview(previewResponse)
      setDependencyWarnings(previewResponse.warnings)

      if (!selectedSectorId && previewResponse.suggestedParentSectorId) {
        setSelectedSectorId(previewResponse.suggestedParentSectorId)
      }

      if (!previewResponse.shouldPromptDependencies || previewResponse.dependencies.length === 0) {
        await executeCreate([])
        return
      }

      const initialSelections: Record<string, DependencySelectionState> = {}
      for (const dependency of previewResponse.dependencies) {
        initialSelections[dependency.componentItemId] = {
          componentItemId: dependency.componentItemId,
          generateChild: true,
          sectorId: dependency.suggestedSectorId,
        }
      }

      setDependencySelections(initialSelections)
      setIsDependenciesModalOpen(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao calcular dependências.'
      toast({ title: 'Erro', description: message, variant: 'destructive' })
    } finally {
      setIsPreviewing(false)
    }
  }

  const toggleDependency = (componentItemId: string, nextValue: boolean) => {
    setDependencySelections((previous) => {
      const current = previous[componentItemId]
      if (!current) {
        return previous
      }

      return {
        ...previous,
        [componentItemId]: {
          ...current,
          generateChild: nextValue,
        },
      }
    })
  }

  const updateDependencySector = (componentItemId: string, nextSectorId: string) => {
    setDependencySelections((previous) => {
      const current = previous[componentItemId]
      if (!current) {
        return previous
      }

      return {
        ...previous,
        [componentItemId]: {
          ...current,
          sectorId: nextSectorId,
        },
      }
    })
  }

  const handleConfirmDependencies = async () => {
    if (!preview) {
      return
    }

    const selectionList: WorkOrderDependencySelectionInput[] = preview.dependencies.map((dependency) => {
      const selection = dependencySelections[dependency.componentItemId]
      return {
        componentItemId: dependency.componentItemId,
        generateChild: selection?.generateChild ?? true,
        sectorId: selection?.sectorId ?? dependency.suggestedSectorId,
        notes: null,
      }
    })

    await executeCreate(selectionList)
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Ordem de Produção</DialogTitle>
            <DialogDescription>Planeje uma nova produção baseada em ficha técnica.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Produto</Label>
              <Select value={selectedProduct} onValueChange={handleProductChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o produto..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredProducts.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedSectorId && filteredProducts.length === 0 && (
                <p className="text-xs text-amber-600">
                  Nenhum item disponível para este setor. Serão exibidos apenas itens com setor padrão igual ao setor selecionado ou sem setor padrão.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Receita / Ficha Técnica</Label>
              <Select value={selectedBom} onValueChange={setSelectedBom} disabled={!selectedProduct || boms.length === 0}>
                <SelectTrigger>
                  <SelectValue placeholder={boms.length === 0 ? 'Sem receita ativa' : 'Selecione a versão...'} />
                </SelectTrigger>
                <SelectContent>
                  {boms.map((bom) => (
                    <SelectItem key={bom.id} value={bom.id}>
                      v{bom.version} • Rendimento: {formatQty(bom.yield_qty)} {bom.yield_uom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedProduct && boms.length === 0 && (
                <p className="text-xs text-amber-600">Este item não possui receita ativa.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Setor da OP (mãe)</Label>
              <Select value={selectedSectorId} onValueChange={setSelectedSectorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o setor..." />
                </SelectTrigger>
                <SelectContent>
                  {sectors.map((sector) => (
                    <SelectItem key={sector.id} value={sector.id}>
                      {sector.code} • {sector.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {sectors.length === 0 && (
                <p className="text-xs text-amber-600">Nenhum setor ativo. Cadastre em "Preferências do Sistema &gt; Produção".</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Qtd. Planejada</Label>
                <Input
                  type="number"
                  min={0}
                  value={plannedQty}
                  onChange={(event) => setPlannedQty(event.target.value)}
                  className="text-right"
                />
                <p className="text-xs text-gray-500">
                  {selectedBomData
                    ? `Receitas: ${formatRecipeCountLabel(recipeCount)}`
                    : 'Selecione uma receita para ver o número de receitas.'}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Data Programada</Label>
                <Input type="date" value={scheduledDate} onChange={(event) => setScheduledDate(event.target.value)} />
              </div>
            </div>

            {selectedProductData && (
              <div className="text-right text-xs text-gray-400 -mt-2">Unidade: {selectedProductData.uom}</div>
            )}

            {dependencyWarnings.length > 0 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <p className="font-semibold">Atenção na modelagem da receita</p>
                <p>{dependencyWarnings[0].message}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Instruções adicionais..."
                className="h-20"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button onClick={handleContinue} disabled={isSubmitting || isPreviewing || !selectedBom || sectors.length === 0}>
              {(isSubmitting || isPreviewing) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDependenciesModalOpen} onOpenChange={setIsDependenciesModalOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Dependências de Produção (WIP)</DialogTitle>
            <DialogDescription>
              Foi identificado saldo insuficiente de itens produzidos. Selecione quais OPs filhas deseja gerar.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[420px] overflow-y-auto rounded-2xl border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left">Gerar</th>
                  <th className="px-3 py-2 text-left">Item</th>
                  <th className="px-3 py-2 text-right">Necessário</th>
                  <th className="px-3 py-2 text-right">Disponível</th>
                  <th className="px-3 py-2 text-right">Falta</th>
                  <th className="px-3 py-2 text-right">Rendimento</th>
                  <th className="px-3 py-2 text-right">Sugestão</th>
                  <th className="px-3 py-2 text-left">Setor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {preview?.dependencies.map((dependency) => {
                  const selection = dependencySelections[dependency.componentItemId]
                  const checked = selection?.generateChild ?? true
                  const sectorValue = selection?.sectorId ?? ''

                  return (
                    <tr key={dependency.componentItemId} className="hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(nextValue) => toggleDependency(dependency.componentItemId, nextValue)}
                        />
                      </td>
                      <td className="px-3 py-2 font-medium text-gray-900">{dependency.componentName}</td>
                      <td className="px-3 py-2 text-right">
                        {formatQty(dependency.requiredQty)} {dependency.componentUom}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-700">
                        {formatQty(dependency.availableQty)} {dependency.componentUom}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-red-600">
                        {formatQty(dependency.missingQty)} {dependency.componentUom}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-700">
                        {formatQty(dependency.childYieldQty)} {dependency.childYieldUom}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-brand-700">
                        {dependency.suggestedBatches} receita(s) = {formatQty(dependency.suggestedPlannedQty)}{' '}
                        {dependency.childYieldUom}
                      </td>
                      <td className="px-3 py-2">
                        <Select
                          value={sectorValue}
                          onValueChange={(value) => updateDependencySector(dependency.componentItemId, value)}
                        >
                          <SelectTrigger className="h-8 min-w-40">
                            <SelectValue placeholder="Setor" />
                          </SelectTrigger>
                          <SelectContent>
                            {sectors.map((sector) => (
                              <SelectItem key={sector.id} value={sector.id}>
                                {sector.code}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDependenciesModalOpen(false)}>
              Voltar
            </Button>
            <Button onClick={handleConfirmDependencies} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar Criação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
