export type WorkOrderDragStatus = 'planned' | 'in_progress' | 'done' | 'cancelled'

export interface WorkOrderDragInput {
  id: string
  status: WorkOrderDragStatus
  scheduledDate: string
  sectorId: string | null
}

export interface WorkOrderDropTarget {
  scheduledDate: string
  sectorId: string | null
}

export interface WorkOrderMovePatch {
  scheduledDate: string
  sectorId: string | null
}

const UNASSIGNED_SECTOR_TOKEN = '__no_sector__'
const DROP_ID_SEPARATOR = '__@__'

export function buildProductionDropId(target: WorkOrderDropTarget): string {
  return `${target.sectorId ?? UNASSIGNED_SECTOR_TOKEN}${DROP_ID_SEPARATOR}${target.scheduledDate}`
}

export function parseProductionDropId(dropId: string): WorkOrderDropTarget | null {
  const [sectorToken, scheduledDate] = dropId.split(DROP_ID_SEPARATOR)
  if (!sectorToken || !scheduledDate) {
    return null
  }

  return {
    sectorId: sectorToken === UNASSIGNED_SECTOR_TOKEN ? null : sectorToken,
    scheduledDate,
  }
}

export function computeWorkOrderMovePatch(
  order: WorkOrderDragInput,
  target: WorkOrderDropTarget
): WorkOrderMovePatch | null {
  if (order.status !== 'planned') {
    throw new Error('Apenas OPs planejadas podem ser reagendadas.')
  }

  if (target.sectorId === null && order.sectorId !== null) {
    throw new Error('Não é permitido mover OP com setor para a lane "Sem Setor".')
  }

  if (order.scheduledDate === target.scheduledDate && order.sectorId === target.sectorId) {
    return null
  }

  return {
    scheduledDate: target.scheduledDate,
    sectorId: target.sectorId,
  }
}

