// Data access for reusable package templates (PackagePreset) — same shape
// and reasoning as lib/promotions.ts's Promotion access.
import { prisma } from '@/lib/prisma'

export async function listPackagePresets(activeOnly = true) {
  return prisma.packagePreset.findMany({
    where: activeOnly ? { active: true } : undefined,
    orderBy: { name: 'asc' },
  })
}

export interface PackagePresetInput {
  name: string
  weightOz: number
  lengthIn?: number
  widthIn?: number
  heightIn?: number
}

export async function createPackagePreset(input: PackagePresetInput) {
  return prisma.packagePreset.create({ data: input })
}

export async function updatePackagePreset(id: string, input: Partial<PackagePresetInput> & { active?: boolean }) {
  return prisma.packagePreset.update({ where: { id }, data: input })
}

export async function deletePackagePreset(id: string): Promise<void> {
  await prisma.packagePreset.delete({ where: { id } })
}
