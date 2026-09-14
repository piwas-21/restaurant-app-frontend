import { act, renderHook } from '@testing-library/react';
import { usePaymentOperationKey } from './usePaymentOperationKey';

beforeEach(() => {
  let sequence = 0;
  jest
    .spyOn(crypto, 'randomUUID')
    .mockImplementation(() => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`);
});

afterEach(() => jest.restoreAllMocks());

it('retains an operation until the caller marks the payload changed or committed', () => {
  const { result } = renderHook(() => usePaymentOperationKey());
  const first = result.current.operationFor();
  expect(result.current.operationFor()).toBe(first);

  act(() => result.current.resetOperation());
  expect(result.current.operationFor()).not.toBe(first);
});
