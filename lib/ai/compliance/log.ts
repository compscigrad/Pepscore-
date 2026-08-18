// AI-0B.3 -- writes to AiComplianceEvent. Follows the same
// prisma.<model>.create() shape as every other audit-log write in this
// codebase (AdminAuditLog, CustomerAccessEvent). Exercised against a real
// database the same way this repo's other DB-dependent writes are (see
// lib/invoice/numbering.test.ts's header comment for the established
// precedent) -- not mocked/re-tested here in the fast unit suite.
//
// Never accepts or persists raw prompt text (owner decision, 2026-08-18
// item 4) -- LogComplianceEventParams has no field for it, by design.
import { prisma } from '@/lib/prisma'
import type { AiPolicyCategory, AiPolicyAction } from '@prisma/client'

export interface LogComplianceEventParams {
  userId?: string
  sessionId?: string
  policyCategory: AiPolicyCategory
  policyAction: AiPolicyAction
  feature: string
  classifierConfidence?: number
  classifierMethod?: string
}

const REPEAT_WINDOW_MS = 60 * 60 * 1000

// Pure -- how far back "repeat" activity is counted from. Split out purely
// so the window boundary is unit-testable without a database.
export function repeatWindowCutoff(windowMs: number = REPEAT_WINDOW_MS, now: number = Date.now()): Date {
  return new Date(now - windowMs)
}

export async function logComplianceEvent(params: LogComplianceEventParams) {
  const repeatCount = params.userId
    ? (await prisma.aiComplianceEvent.count({
        where: {
          userId: params.userId,
          policyCategory: params.policyCategory,
          createdAt: { gte: repeatWindowCutoff() },
        },
      })) + 1
    : 1

  return prisma.aiComplianceEvent.create({
    data: {
      userId: params.userId,
      sessionId: params.sessionId,
      policyCategory: params.policyCategory,
      policyAction: params.policyAction,
      feature: params.feature,
      classifierConfidence: params.classifierConfidence,
      classifierMethod: params.classifierMethod,
      repeatCount,
    },
  })
}
