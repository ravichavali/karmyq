import React from 'react';
import { render, screen } from '@testing-library/react';
import DynamicForm from '../../src/components/requests/DynamicForm';
import type { UISchema } from '@karmyq/shared/schemas/ui';

// Mock FieldRenderer to avoid deep rendering
jest.mock('../../src/components/requests/fields/FieldRenderer', () => {
  return function MockFieldRenderer({ field }: { field: { label: string } }) {
    return <div data-testid={`field-${field.label}`}>{field.label}</div>;
  };
});

const baseSchema: UISchema = {
  type: 'test',
  version: 1,
  label: 'Test Form',
  icon: '🧪',
  color: 'blue',
  description: 'A test form',
  sections: [],
};

describe('DynamicForm — SectionHeader', () => {
  it('renders section header when section has a title', () => {
    const schema: UISchema = {
      ...baseSchema,
      sections: [
        {
          id: 'sec-1',
          title: 'Details',
          fields: [],
        },
      ],
    };

    render(<DynamicForm schema={schema} value={{}} onChange={() => {}} />);

    expect(screen.getByText('Details')).toBeInTheDocument();
  });

  it('renders section header when section has an icon but no title', () => {
    const schema: UISchema = {
      ...baseSchema,
      sections: [
        {
          id: 'sec-1',
          title: '',
          icon: '🐕',
          fields: [],
        },
      ],
    };

    render(<DynamicForm schema={schema} value={{}} onChange={() => {}} />);

    expect(screen.getByText('🐕')).toBeInTheDocument();
  });

  it('renders section header when section has a description but no title or icon', () => {
    const schema: UISchema = {
      ...baseSchema,
      sections: [
        {
          id: 'sec-1',
          title: '',
          description: 'Some helpful text',
          fields: [],
        },
      ],
    };

    render(<DynamicForm schema={schema} value={{}} onChange={() => {}} />);

    expect(screen.getByText('Some helpful text')).toBeInTheDocument();
  });

  it('renders NO section header when section has no title, icon, or description', () => {
    const schema: UISchema = {
      ...baseSchema,
      sections: [
        {
          id: 'sec-1',
          title: '',
          fields: [
            {
              key: 'notes',
              type: 'text',
              label: 'Notes',
              required: false,
            },
          ],
        },
      ],
    };

    const { container } = render(<DynamicForm schema={schema} value={{}} onChange={() => {}} />);

    // The section container (space-y-4 div) should exist but there should be no
    // bordered/colored header box — no element with border-rounded-lg styling
    const headerBox = container.querySelector('.border.rounded-lg.p-4');
    expect(headerBox).toBeNull();
  });

  it('renders NO section header for dog-walking style sections with only fields', () => {
    // Regression: Dog Walking custom form previously showed empty bordered box at top
    const schema: UISchema = {
      ...baseSchema,
      sections: [
        {
          id: 'sec-dog',
          title: '',
          // No icon, no description — just fields
          fields: [
            {
              key: 'dog_name',
              type: 'text',
              label: 'Dog Name',
              required: true,
            },
            {
              key: 'dog_breed',
              type: 'text',
              label: 'Dog Breed',
              required: false,
            },
          ],
        },
      ],
    };

    const { container } = render(<DynamicForm schema={schema} value={{}} onChange={() => {}} />);

    const headerBox = container.querySelector('.border.rounded-lg.p-4');
    expect(headerBox).toBeNull();
  });
});
