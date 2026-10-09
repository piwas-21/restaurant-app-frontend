import { reportCashierRecoveryFailure } from './cashierRecoveryDiagnostics';

afterEach(() => jest.restoreAllMocks());

it('reports a recovery failure without exception names, messages or payment data', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  const error = new Error('private payment and operation data');
  error.name = 'private exception name';

  reportCashierRecoveryFailure('save account payment journal', error);

  expect(warn).toHaveBeenCalledWith(
    'Cashier recovery could not save account payment journal (Error); the recovery guard remains active.',
  );
});

it('does not serialize arbitrary thrown values', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

  reportCashierRecoveryFailure('check visit tender', { token: 'private token' });

  expect(warn).toHaveBeenCalledWith(
    'Cashier recovery could not check visit tender (UnknownError); the recovery guard remains active.',
  );
});
