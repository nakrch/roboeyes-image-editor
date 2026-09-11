import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import {
  ActionButton,
  InspectorRow,
  InspectorSection,
  NumberField,
  SegmentedControl,
} from './InspectorPrimitives'

describe('Inspector primitives', () => {
  it('renders compact section and row semantics', () => {
    const html = renderToStaticMarkup(
      <InspectorSection title="Geometry">
        <InspectorRow label="Width">
          <NumberField value={36} readOnly unit="px" />
        </InspectorRow>
      </InspectorSection>,
    )

    expect(html).toContain('Geometry')
    expect(html).toContain('Width')
    expect(html).toContain('36')
    expect(html).toContain('px')
  })

  it('exposes segmented state with aria-pressed', () => {
    const html = renderToStaticMarkup(
      <SegmentedControl
        value="face"
        options={[
          { value: 'face', label: 'Face' },
          { value: 'motion', label: 'Motion' },
        ]}
        onChange={vi.fn()}
        ariaLabel="Inspector mode"
      />,
    )

    expect(html).toContain('aria-label="Inspector mode"')
    expect(html).toContain('aria-pressed="true"')
  })

  it('marks primary actions for shared editor styling', () => {
    const html = renderToStaticMarkup(<ActionButton variant="primary">Export</ActionButton>)
    expect(html).toContain('inspector-action-primary')
    expect(html).toContain('Export')
  })
})
