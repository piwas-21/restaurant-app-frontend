import React from 'react';
import { render, screen } from '@testing-library/react';
import SetupChecklistRow from './SetupChecklistRow';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

describe('SetupChecklistRow', () => {
  it('offers the menu-building catalogue flow from the unfinished menu setup step', () => {
    render(
      <SetupChecklistRow
        step={{ key: 'menu', moduleId: null, isDerived: false, isDone: false }}
        isSaving={false}
        onToggle={jest.fn()}
      />,
    );

    expect(screen.getByRole('link', { name: 'catalogue_build_menu_cta' })).toHaveAttribute(
      'href',
      '/admin/menu-management/catalogue?flow=onboarding',
    );
  });

  it('does not offer the onboarding flow once the server reports the menu step done', () => {
    render(
      <SetupChecklistRow
        step={{ key: 'menu', moduleId: null, isDerived: true, isDone: true }}
        isSaving={false}
        onToggle={jest.fn()}
      />,
    );

    expect(screen.queryByRole('link', { name: 'catalogue_build_menu_cta' })).not.toBeInTheDocument();
  });
});
