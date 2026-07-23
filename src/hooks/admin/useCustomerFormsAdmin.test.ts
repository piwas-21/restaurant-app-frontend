import { renderHook, waitFor, act } from '@testing-library/react';
import { useCustomerFormsAdmin, toTriState, fromTriState } from './useCustomerFormsAdmin';
import type { FormFieldsDto } from '@/types/formFieldConfig';

const mockGetAll = jest.fn();
const mockUpdate = jest.fn();
jest.mock('@/services/formFieldConfigService', () => ({
  formFieldConfigService: { getAll: () => mockGetAll(), update: (f: unknown) => mockUpdate(f) },
}));

const mockInvalidate = jest.fn();
jest.mock('@/hooks/useCustomerFormFields', () => ({
  invalidateFormFieldConfigCache: () => mockInvalidate(),
}));

const mockEnqueue = jest.fn();
jest.mock('notistack', () => ({ enqueueSnackbar: (...a: unknown[]) => mockEnqueue(...a) }));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_k: string, f?: string) => f ?? _k }),
}));

const makeForms = (): FormFieldsDto[] => [
  {
    formKey: 'reservation',
    fields: [
      { fieldKey: 'customerName', isVisible: true, isRequired: true, isLocked: true, displayOrder: 0 },
      { fieldKey: 'customerPhone', isVisible: true, isRequired: false, isLocked: false, displayOrder: 2 },
    ],
  },
  {
    formKey: 'checkout_contact',
    fields: [{ fieldKey: 'phone', isVisible: true, isRequired: false, isLocked: false, displayOrder: 2 }],
  },
];

beforeEach(() => jest.clearAllMocks());

describe('tri-state mapping', () => {
  it('maps flags to the 3 states and back (required ⇒ visible, hidden ⇒ not required)', () => {
    expect(toTriState({ isVisible: false, isRequired: false })).toBe('hidden');
    expect(toTriState({ isVisible: true, isRequired: false })).toBe('optional');
    expect(toTriState({ isVisible: true, isRequired: true })).toBe('required');
    expect(fromTriState('hidden')).toEqual({ isVisible: false, isRequired: false });
    expect(fromTriState('optional')).toEqual({ isVisible: true, isRequired: false });
    expect(fromTriState('required')).toEqual({ isVisible: true, isRequired: true });
  });
});

describe('useCustomerFormsAdmin', () => {
  it('loads the grouped configuration', async () => {
    mockGetAll.mockResolvedValue(makeForms());
    const { result } = renderHook(() => useCustomerFormsAdmin());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.forms).toHaveLength(2);
    expect(result.current.isDirty('reservation')).toBe(false);
  });

  it('toasts an error when the load fails', async () => {
    mockGetAll.mockRejectedValue(new Error('down'));
    const { result } = renderHook(() => useCustomerFormsAdmin());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockEnqueue).toHaveBeenCalledWith(expect.stringContaining('Failed to load'), { variant: 'error' });
  });

  it('applies a tri-state change to a configurable field and marks the form dirty', async () => {
    mockGetAll.mockResolvedValue(makeForms());
    const { result } = renderHook(() => useCustomerFormsAdmin());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setFieldState('reservation', 'customerPhone', 'required'));

    const phone = result.current.forms[0].fields[1];
    expect(phone).toMatchObject({ isVisible: true, isRequired: true });
    expect(result.current.isDirty('reservation')).toBe(true);
    expect(result.current.isDirty('checkout_contact')).toBe(false);
  });

  it('ignores changes to locked fields (immutability)', async () => {
    mockGetAll.mockResolvedValue(makeForms());
    const { result } = renderHook(() => useCustomerFormsAdmin());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setFieldState('reservation', 'customerName', 'hidden'));

    expect(result.current.forms[0].fields[0]).toMatchObject({ isVisible: true, isRequired: true });
    expect(result.current.isDirty('reservation')).toBe(false);
  });

  it('saves the whole form — locked fields echoed unchanged — and resets dirty from the response', async () => {
    mockGetAll.mockResolvedValue(makeForms());
    const { result } = renderHook(() => useCustomerFormsAdmin());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setFieldState('reservation', 'customerPhone', 'hidden'));

    const saved = makeForms();
    saved[0].fields[1] = { ...saved[0].fields[1], isVisible: false, isRequired: false };
    mockUpdate.mockResolvedValue(saved);

    await act(() => result.current.saveForm('reservation'));

    expect(mockUpdate).toHaveBeenCalledWith([
      { formKey: 'reservation', fieldKey: 'customerName', isVisible: true, isRequired: true },
      { formKey: 'reservation', fieldKey: 'customerPhone', isVisible: false, isRequired: false },
    ]);
    expect(result.current.isDirty('reservation')).toBe(false);
    expect(mockInvalidate).toHaveBeenCalled();
    expect(mockEnqueue).toHaveBeenCalledWith(expect.stringContaining('saved'), { variant: 'success' });
  });

  it('keeps the edits and toasts an error when the save fails', async () => {
    mockGetAll.mockResolvedValue(makeForms());
    const { result } = renderHook(() => useCustomerFormsAdmin());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setFieldState('reservation', 'customerPhone', 'required'));
    mockUpdate.mockRejectedValue(new Error('nope'));

    await act(() => result.current.saveForm('reservation'));

    expect(result.current.forms[0].fields[1]).toMatchObject({ isVisible: true, isRequired: true });
    expect(result.current.isDirty('reservation')).toBe(true);
    expect(mockEnqueue).toHaveBeenCalledWith(expect.stringContaining('Failed to save'), { variant: 'error' });
    expect(result.current.savingFormKey).toBeNull();
  });
});
