// Pure planning logic for syncing a client-submitted array (invoice items or
// discounts) against the rows that already exist in the database, by id,
// instead of blindly deleting everything and recreating it on every save.
//
// Why this matters: a plain deleteMany+create (the previous approach) gives
// every row a brand-new id on every single invoice save, which silently
// breaks anything that ever needs to reference a specific row -- e.g. a
// BackorderCondition pointing at the line item it was applied to, or a
// BackorderCompensation's linked InvoiceDiscount. Preserving existing rows'
// ids by updating them in place (only creating genuinely new rows, only
// deleting genuinely removed ones) is what makes those references durable
// across ordinary, unrelated edits to the same invoice.
export interface RowWithId {
  id: string
}

export interface PayloadRow {
  id?: string | null
}

export interface RowSyncPlan<TExisting extends RowWithId, TPayload extends PayloadRow> {
  toUpdate: Array<{ id: string; payload: TPayload }>
  toCreate: TPayload[]
  toDeleteIds: string[]
}

// Never trusts a client-supplied id blindly: `existingRows` must be the rows
// that actually belong to this invoice (queried server-side), so a payload
// id referencing some other invoice's row -- or a stale/spoofed id -- falls
// through to `toCreate` rather than silently updating an unrelated row.
export function planRowSync<TExisting extends RowWithId, TPayload extends PayloadRow>(
  existingRows: TExisting[],
  payloadRows: TPayload[]
): RowSyncPlan<TExisting, TPayload> {
  const existingIds = new Set(existingRows.map((row) => row.id))
  const claimedIds = new Set<string>()

  const toUpdate: Array<{ id: string; payload: TPayload }> = []
  const toCreate: TPayload[] = []

  for (const row of payloadRows) {
    if (row.id && existingIds.has(row.id) && !claimedIds.has(row.id)) {
      claimedIds.add(row.id)
      toUpdate.push({ id: row.id, payload: row })
    } else {
      toCreate.push(row)
    }
  }

  const toDeleteIds = existingRows.map((row) => row.id).filter((id) => !claimedIds.has(id))

  return { toUpdate, toCreate, toDeleteIds }
}
