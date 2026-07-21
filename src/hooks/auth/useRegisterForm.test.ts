import { act, renderHook } from '@testing-library/react';
import { useRegisterForm } from './useRegisterForm';

const mockRegisterCustomer = jest.fn();
const mockSendEmailVerification = jest.fn();
const mockTrackEvent = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, def?: string) => def ?? _key }),
}));
jest.mock('@/services/authService', () => ({
  registerCustomer: (...args: unknown[]) => mockRegisterCustomer(...args),
  sendEmailVerification: (...args: unknown[]) => mockSendEmailVerification(...args),
}));
jest.mock('@/lib/analytics', () => ({ trackEvent: (...args: unknown[]) => mockTrackEvent(...args) }));

const submit = { preventDefault: jest.fn() } as unknown as React.FormEvent;
const change = (id: string, value: string) =>
  ({ target: { id, value } }) as unknown as React.ChangeEvent<HTMLInputElement>;

const fillValid = (result: { current: ReturnType<typeof useRegisterForm> }) => {
  act(() => result.current.handleChange(change('firstName', 'Ada')));
  act(() => result.current.handleChange(change('lastName', 'Lovelace')));
  act(() => result.current.handleChange(change('email', 'ada@calc.co')));
  act(() => result.current.handleChange(change('password', 'secret1')));
  act(() => result.current.handleChange(change('confirmPassword', 'secret1')));
};

beforeEach(() => jest.clearAllMocks());

describe('useRegisterForm', () => {
  it('blocks an invalid (empty) submit with field errors and no network call', async () => {
    const { result } = renderHook(() => useRegisterForm());
    await act(async () => result.current.handleSubmit(submit));
    expect(Object.keys(result.current.errors).length).toBeGreaterThan(0);
    expect(mockRegisterCustomer).not.toHaveBeenCalled();
  });

  it('flags a password mismatch on the confirmPassword field', async () => {
    const { result } = renderHook(() => useRegisterForm());
    fillValid(result);
    act(() => result.current.handleChange(change('confirmPassword', 'different')));
    await act(async () => result.current.handleSubmit(submit));
    expect(result.current.errors.confirmPassword).toBeTruthy();
    expect(mockRegisterCustomer).not.toHaveBeenCalled();
  });

  it('registers and shows the success state on a valid submit', async () => {
    mockRegisterCustomer.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useRegisterForm());
    fillValid(result);
    await act(async () => result.current.handleSubmit(submit));
    expect(mockRegisterCustomer).toHaveBeenCalledTimes(1);
    expect(result.current.registrationSuccess).toBe(true);
  });

  it('surfaces a backend failure as a general error without success', async () => {
    mockRegisterCustomer.mockResolvedValue({ success: false, errors: ['Email already used'] });
    const { result } = renderHook(() => useRegisterForm());
    fillValid(result);
    await act(async () => result.current.handleSubmit(submit));
    expect(result.current.generalError).toContain('Email already used');
    expect(result.current.registrationSuccess).toBe(false);
  });

  it('handleChange clears a field error as the user types', async () => {
    const { result } = renderHook(() => useRegisterForm());
    await act(async () => result.current.handleSubmit(submit)); // populate errors
    expect(result.current.errors.firstName).toBeTruthy();
    act(() => result.current.handleChange(change('firstName', 'A')));
    expect(result.current.errors.firstName).toBe('');
  });
});
