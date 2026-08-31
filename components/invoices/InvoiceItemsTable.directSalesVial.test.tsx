// @vitest-environment jsdom
//
// Owner-reported defect verification (2026-08-31 sprint): "the product
// selector currently appears to allow case/box selection but does not
// consistently allow the owner to select an INDIVIDUAL VIAL." The static
// code audit (lib/pricing/sellUnits.ts, this component's own
// getAvailableSellUnits(product, { adminContext: true }) call sites) found
// the backend logic already correct -- this test renders the ACTUAL
// InvoiceItemsTable component (real DOM via @testing-library/react, not a
// mock of the sell-unit logic) to verify the rendered <select> genuinely
// offers "Single Vial" in the three scenarios the owner's own diagnostic
// request named: a product with individual sales publicly ENABLED, one with
// it DISABLED (the Tesamorelin-style hidden-price case), and a multi-strength
// product (same name, different size, must resolve independently per row).
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, afterEach } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react'
import { InvoiceItemsTable } from './InvoiceItemsTable'
import { formatProductLabel } from '@/lib/invoice/format'
import type { InvoiceItemDraft } from './types'
import type { Product } from '@prisma/client'

afterEach(cleanup)

// InvoiceItemsTable is fully controlled (mirrors how InvoiceBuilder actually
// owns `items` state) -- a no-op onChange would make "+ Add Product" a
// visible no-op, since the component never manages its own items array.
function ControlledHarness({ products }: { products: Product[] }) {
  const [items, setItems] = useState<InvoiceItemDraft[]>([])
  return (
    <InvoiceItemsTable
      items={items}
      onChange={setItems}
      products={products}
      onProductPriceUpdated={() => {}}
      proEligible={false}
    />
  )
}

// Minimal fixtures -- only the fields InvoiceItemsTable/getAvailableSellUnits
// actually read (sellUnits.ts's SellUnitAvailabilityInput + this component's
// own direct field accesses). Cast through `unknown` rather than hand-filling
// every other real Prisma column, matching how this file is actually used
// (a plain object satisfying the read surface, not a full DB row).
function makeProduct(overrides: Partial<Product>): Product {
  return {
    id: 'prod-1',
    name: 'TestProduct',
    size: '10mg',
    sku: 'TEST-SKU',
    price: 100,
    costOfGoods: 0,
    activeStandardCasePrice: 500,
    activeProCasePrice: null,
    activeBulkPrice: null,
    activeIndividualVialPrice: 80,
    individualSalesEnabled: false,
    unitsPerCase: null,
    ...overrides,
  } as unknown as Product
}

function renderWithOneProduct(products: Product[]) {
  const utils = render(<ControlledHarness products={products} />)
  fireEvent.click(screen.getByText('+ Add Product'))
  return utils
}

function pickProductByLabel(product: Product) {
  const input = screen.getByPlaceholderText('Product name')
  fireEvent.change(input, { target: { value: formatProductLabel(product) } })
}

function getSellUnitSelect(): HTMLSelectElement {
  const selects = screen.getAllByRole('combobox')
  const select = selects.find((el) => within(el).queryByText(/Select sell unit/)) as HTMLSelectElement
  if (!select) throw new Error('sell-unit <select> not found in rendered output')
  return select
}

describe('Direct Sales individual vial selector -- rendered UI', () => {
  it('A. product with individual storefront sales ENABLED: Single Vial is offered and marked visible', () => {
    const product = makeProduct({ id: 'p-a', name: 'PublicVialProduct', individualSalesEnabled: true, activeIndividualVialPrice: 50 })
    renderWithOneProduct([product])
    pickProductByLabel(product)

    const select = getSellUnitSelect()
    const option = within(select).getByRole('option', { name: /Single Vial/ })
    expect(option).toBeInTheDocument()
    expect(option.textContent).not.toMatch(/not on storefront/)
  })

  it('B. product with individual storefront sales DISABLED: Single Vial is STILL offered (admin-only), flagged not-on-storefront', () => {
    const product = makeProduct({ id: 'p-b', name: 'HiddenVialProduct', individualSalesEnabled: false, activeIndividualVialPrice: 80 })
    renderWithOneProduct([product])
    pickProductByLabel(product)

    const select = getSellUnitSelect()
    const option = within(select).getByRole('option', { name: /Single Vial/ })
    expect(option).toBeInTheDocument()
    expect(option.textContent).toMatch(/not on storefront/)

    // Confirm it's genuinely selectable, not just present/disabled.
    fireEvent.change(select, { target: { value: 'INDIVIDUAL_VIAL' } })
    expect(select.value).toBe('INDIVIDUAL_VIAL')
  })

  it('C. multi-strength product (same name, different size): each row resolves its own strength independently', () => {
    const low = makeProduct({ id: 'p-c-5mg', name: 'MultiStrengthProduct', size: '5mg', individualSalesEnabled: false, activeIndividualVialPrice: 40 })
    const high = makeProduct({ id: 'p-c-10mg', name: 'MultiStrengthProduct', size: '10mg', individualSalesEnabled: false, activeIndividualVialPrice: 80 })
    renderWithOneProduct([low, high])
    pickProductByLabel(high)

    const select = getSellUnitSelect()
    const option = within(select).getByRole('option', { name: /Single Vial/ })
    expect(option.textContent).toMatch(/\$80\.00/)
    expect(option.textContent).not.toMatch(/\$40\.00/)
  })

  it('a product with NO stored individual-vial price offers no Single Vial option at all (never fabricated)', () => {
    const product = makeProduct({ id: 'p-d', name: 'NoVialProduct', individualSalesEnabled: false, activeIndividualVialPrice: null })
    renderWithOneProduct([product])
    pickProductByLabel(product)

    const select = getSellUnitSelect()
    expect(within(select).queryByRole('option', { name: /Single Vial/ })).toBeNull()
  })
})
