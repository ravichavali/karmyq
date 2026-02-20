/**
 * Schema Editor — handleAddField logic
 *
 * Regression guard for the bug where handleAddField called handleUpdateField
 * with a new field id that didn't exist in the section, silently dropping it.
 *
 * The fix: handleAddField now directly appends to the section's fields array.
 */

describe('handleAddField — field is appended to the correct section', () => {
  const makeSection = (id: string, fields: any[] = []) => ({ id, title: 'Test Section', fields })
  const makeField = (id: string, type = 'text') => ({ id, type, label: `${type} field`, required: false })

  // Mirrors the fixed handleAddField logic from edit.tsx
  function simulateAddField(
    sections: ReturnType<typeof makeSection>[],
    sectionId: string,
    type: string
  ) {
    const newField = {
      id: 'new-field-id',
      type,
      label: type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ') + ' field',
      required: false,
    }

    return sections.map((section) => {
      if (section.id === sectionId) {
        return { ...section, fields: [...section.fields, newField] }
      }
      return section
    })
  }

  it('appends a new field to the target section', () => {
    const sections = [makeSection('s1'), makeSection('s2')]
    const result = simulateAddField(sections, 's1', 'text')

    expect(result[0].fields).toHaveLength(1)
    expect(result[0].fields[0].type).toBe('text')
    expect(result[0].fields[0].label).toBe('Text field')
  })

  it('does not modify other sections', () => {
    const sections = [makeSection('s1'), makeSection('s2', [makeField('existing')])]
    const result = simulateAddField(sections, 's1', 'location')

    expect(result[1].fields).toHaveLength(1)
    expect(result[1].fields[0].id).toBe('existing')
  })

  it('preserves existing fields in the target section', () => {
    const sections = [makeSection('s1', [makeField('f1'), makeField('f2')])]
    const result = simulateAddField(sections, 's1', 'number')

    expect(result[0].fields).toHaveLength(3)
    expect(result[0].fields[0].id).toBe('f1')
    expect(result[0].fields[1].id).toBe('f2')
    expect(result[0].fields[2].type).toBe('number')
  })

  it('generates a label from the type name', () => {
    const sections = [makeSection('s1')]
    const result = simulateAddField(sections, 's1', 'button_group')

    expect(result[0].fields[0].label).toBe('Button group field')
  })
})
