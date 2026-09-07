import { fireEvent, render, screen, within } from '@testing-library/react';
import ApiTokenCreateModal from './ApiTokenCreateModal';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

function renderModal() {
  const onSubmit = jest.fn();
  render(<ApiTokenCreateModal isOpen submitting={false} error={null} onClose={jest.fn()} onSubmit={onSubmit} />);
  return onSubmit;
}

describe('ApiTokenCreateModal maintenance scope', () => {
  it('keeps the existing groups intact and offers maintenance separately, unchecked', () => {
    renderModal();

    const read = within(screen.getByRole('group', { name: 'api_tokens_scope_group_read' }));
    const write = within(screen.getByRole('group', { name: 'api_tokens_scope_group_write' }));
    const maintenance = within(screen.getByRole('group', { name: 'api_tokens_scope_group_maintenance' }));
    expect(read.getAllByRole('checkbox').map((input) => input.closest('label')?.textContent)).toEqual([
      'menu:read',
      'orders:read',
      'reservations:read',
      'tenant:read',
    ]);
    expect(write.getAllByRole('checkbox').map((input) => input.closest('label')?.textContent)).toEqual([
      'menu:write',
      'orders:write',
      'reservations:write',
    ]);
    expect(maintenance.getAllByRole('checkbox')).toHaveLength(1);
    const scope = maintenance.getByRole('checkbox', { name: 'maintenance:write' });
    expect(scope).not.toBeChecked();
    expect(scope).toHaveAccessibleDescription('api_tokens_scopes_required api_tokens_scope_desc_maintenance_write');
    expect(screen.getAllByRole('checkbox')).toHaveLength(8);
  });

  it('submits the exact maintenance scope alone and disables submission when it is removed', () => {
    const onSubmit = renderModal();
    fireEvent.change(screen.getByRole('textbox', { name: 'api_tokens_field_name' }), {
      target: { value: '  Image backfill  ' },
    });
    const submit = screen.getByRole('button', { name: 'api_tokens_create_submit' });
    expect(submit).toBeDisabled();

    const scope = screen.getByRole('checkbox', { name: 'maintenance:write' });
    fireEvent.click(scope);
    expect(scope).toBeChecked();
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Image backfill',
      scopes: ['maintenance:write'],
      expiresInDays: 30,
    });

    fireEvent.click(scope);
    expect(scope).not.toBeChecked();
    expect(submit).toBeDisabled();
    fireEvent.click(submit);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('does not grant maintenance when only an existing scope is selected', () => {
    const onSubmit = renderModal();
    fireEvent.change(screen.getByRole('textbox', { name: 'api_tokens_field_name' }), {
      target: { value: 'Menu reader' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: 'menu:read' }));
    fireEvent.click(screen.getByRole('button', { name: 'api_tokens_create_submit' }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Menu reader',
      scopes: ['menu:read'],
      expiresInDays: 30,
    });
    expect(screen.getByRole('checkbox', { name: 'maintenance:write' })).not.toBeChecked();
  });
});
