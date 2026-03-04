'use server'

import { createClient } from '@/utils/supabase/server'
import { getActiveCompanyId } from '@/lib/auth/get-active-company'
import {
  workOrderDependenciesService,
  CreateWorkOrderWithDependenciesResult,
  WorkOrderDependencyPreviewResult,
  WorkOrderDependencySelectionInput,
} from '@/lib/pcp/work-order-dependencies-service'

export interface WorkOrderDependencyPreviewActionInput {
  itemId: string
  bomId: string
  plannedQty: number
}

export interface CreateWorkOrderWithDependenciesActionInput {
  itemId: string
  bomId: string
  plannedQty: number
  scheduledDate: string
  notes?: string | null
  parentSectorId: string
  dependencySelections?: WorkOrderDependencySelectionInput[]
}

export async function previewWorkOrderDependenciesAction(
  input: WorkOrderDependencyPreviewActionInput
): Promise<WorkOrderDependencyPreviewResult> {
  const companyId = await getActiveCompanyId()
  const supabase = await createClient()

  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) {
    throw new Error('Unauthorized')
  }

  return workOrderDependenciesService.preview(supabase, companyId, {
    itemId: input.itemId,
    bomId: input.bomId,
    plannedQty: input.plannedQty,
  })
}

export async function createWorkOrderWithDependenciesAction(
  input: CreateWorkOrderWithDependenciesActionInput
): Promise<CreateWorkOrderWithDependenciesResult> {
  const parentSectorId = input.parentSectorId?.trim()
  if (!parentSectorId) {
    throw new Error('Selecione um setor de produção ativo para criar a OP.')
  }

  const companyId = await getActiveCompanyId()
  const supabase = await createClient()

  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) {
    throw new Error('Unauthorized')
  }

  return workOrderDependenciesService.create(supabase, {
    companyId,
    itemId: input.itemId,
    bomId: input.bomId,
    plannedQty: input.plannedQty,
    scheduledDate: input.scheduledDate,
    notes: input.notes,
    parentSectorId,
    dependencySelections: input.dependencySelections,
  })
}
