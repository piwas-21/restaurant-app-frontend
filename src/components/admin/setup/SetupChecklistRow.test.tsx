import React from 'react';
import { render, screen } from '@testing-library/react';
import SetupChecklistRow from './SetupChecklistRow';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

describe('SetupChecklistRow', () => {
  it('offers the read-only Sofra catalogue from the menu setup step', () => {
    render(
      <SetupChecklistRow
        step={{ key: 'menu', moduleId: null, isDerived: false, isDone: false }}
        isSaving={false}
        onToggle={jest.fn()}
      />,
    );

    expect(screen.getByRole('link', { name: 'browse_sofra_suggestions' })).toHaveAttribute(
      'href',
      '/admin/menu-management/catalogue',
    );
  });
});
