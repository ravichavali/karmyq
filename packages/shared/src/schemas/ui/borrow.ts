import { UISchema } from './types';

export const borrowUISchema: UISchema = {
  type: 'borrow',
  version: 1,
  label: 'Borrow Item',
  icon: '📦',
  color: 'orange',
  description: 'Borrow tools, equipment, or items from your community',
  sections: [
    {
      id: 'item_details',
      title: 'Item Details',
      icon: '📦',
      color: 'orange',
      fields: [
        {
          key: 'item_category',
          type: 'button_group',
          label: 'Item Category',
          required: true,
          options: [
            { value: 'tools', label: 'Tools', icon: '🔧' },
            { value: 'electronics', label: 'Electronics', icon: '💻' },
            { value: 'kitchen', label: 'Kitchen', icon: '🍳' },
            { value: 'books', label: 'Books', icon: '📚' },
            { value: 'sports', label: 'Sports', icon: '⚽' },
            { value: 'camping', label: 'Camping', icon: '⛺' },
            { value: 'party', label: 'Party', icon: '🎉' },
            { value: 'other', label: 'Other', icon: '📋' },
          ],
        },
        {
          key: 'duration_days',
          type: 'number',
          label: 'Borrow Duration',
          required: true,
          min: 1,
          max: 30,
          step: 1,
          unit: 'days',
          helpText: 'How many days do you need to borrow the item?',
        },
        {
          key: 'condition_min',
          type: 'select',
          label: 'Minimum Condition',
          required: false,
          placeholder: 'Any condition',
          options: [
            { value: 'fair', label: 'Fair' },
            { value: 'good', label: 'Good' },
            { value: 'like_new', label: 'Like New' },
            { value: 'new', label: 'New' },
          ],
        },
        {
          key: 'return_date',
          type: 'datetime',
          label: 'Return Date',
          required: false,
          helpText: 'When will you return the item?',
        },
      ],
    },
  ],
  summary: {
    fields: ['item_category', 'duration_days', 'condition_min'],
    labels: {
      item_category: 'Category',
      duration_days: 'Duration',
      condition_min: 'Min Condition',
    },
  },
};
