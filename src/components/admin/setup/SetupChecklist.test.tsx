import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SetupChecklist from './SetupChecklist';
import { ModulesProvider } from '@/contexts/ModulesContext';
import type { SetupChecklistDto } from '@/types/setupChecklist';
import * as service from '@/services/setupChecklistService';
import { ApiError } from '@/utils/apiClient';

jest.mock('@/services/setupChecklistService');
jest.mock('react-i18next', () => ({
  // The keys ARE the assertions here — a translated string would let a wrong key pass
  // by rendering some other locale value that happens to read plausibly.
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mocked = service as jest.Mocked<typeof service>;

const checklist = (over: Partial<SetupChecklistDto> = {}): SetupChecklistDto => ({
  isDismissed: false,
  doneCount: 0,
  steps: [
    { key: 'restaurant-info', moduleId: null, isDerived: false, isDone: false },
    { key: 'menu', moduleId: null, isDerived: true, isDone: false },
    { key: 'reservations', moduleId: 'reservations', isDerived: false, isDone: false },
  ],
  ...over,
});

const renderWith = (dto: SetupChecklistDto | null, modules: string[]) => {
  mocked.getSetupChecklist.mockResolvedValue(dto ? ({ success: true, data: dto } as never) : (null as never));
  return render(
    <ModulesProvider modules={modules as never}>
      <SetupChecklist />
    </ModulesProvider>,
  );
};

beforeEach(() => jest.clearAllMocks());

describe('SetupChecklist', () => {
  it('gives a derived step no checkbox — it cannot be claimed', () => {
    // `menu` is done when the data says so, and the API refuses to acknowledge it. A
    // checkbox here would invite the owner to assert a menu they never built, which is
    // the one thing this checklist exists to prevent.
    renderWith(checklist(), ['core', 'reservations']);

    return waitFor(() => {
      const boxes = screen.getAllByRole('checkbox');
      const labels = boxes.map((b) => b.getAttribute('aria-label'));
      expect(labels).toContain('setup_step_restaurant_info_title');
      expect(labels).not.toContain('setup_step_menu_title');
    });
  });

  it('renders the online-payments row as guidance: state icon, no checkbox, no link', async () => {
    // O7 P6. The tenant is Stripe-configured (which is why the backend sent the step at
    // all) and nobody has paid them online yet, so the row must say "not done yet" out
    // loud — a derived row carries its state ONLY in the icon, and an aria-hidden icon
    // plus line-through styling announces nothing.
    //
    // No LINK either, and that is the half worth pinning: the work is the restaurant's
    // own Stripe onboarding, on Stripe's hosted pages, and this app has no payments
    // surface to send them to until P7a. A row that linked somewhere now would link to
    // a page that does not exist.
    renderWith(
      checklist({
        steps: [{ key: 'online-payments', moduleId: 'online-payments', isDerived: true, isDone: false }],
      }),
      ['core', 'online-payments'],
    );

    expect(await screen.findByText('setup_step_online_payments_title')).toBeInTheDocument();
    expect(screen.getByText('setup_step_online_payments_hint')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'setup_step_state_todo' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('drops a step whose module this instance does not run', async () => {
    // Defence in depth: the API already filters, but a checklist row is a link to a
    // route, and this is the same route map the guard and the sidebar use.
    renderWith(checklist(), ['core']);

    expect(await screen.findByText('setup_step_menu_title')).toBeInTheDocument();
    expect(screen.queryByText('setup_step_reservations_title')).not.toBeInTheDocument();
  });

  it('renders NOTHING when the checklist cannot be read', async () => {
    // Not an empty list — an empty list reads as "you are all done", which is the one
    // wrong answer on a surface whose whole job is saying what is left.
    mocked.getSetupChecklist.mockRejectedValue(new Error('offline'));
    const { container } = render(
      <ModulesProvider modules={['core'] as never}>
        <SetupChecklist />
      </ModulesProvider>,
    );

    await waitFor(() => expect(mocked.getSetupChecklist).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('offers a way back after the owner hides it — the guide is resumable', async () => {
    mocked.setSetupChecklistDismissed.mockResolvedValue({ success: true } as never);
    renderWith(checklist({ isDismissed: true }), ['core']);

    const show = await screen.findByRole('button', { name: 'setup_checklist_show' });
    fireEvent.click(show);

    await waitFor(() => expect(mocked.setSetupChecklistDismissed).toHaveBeenCalledWith(false));
  });

  it('keeps saying the write failed after the re-read succeeds', async () => {
    // The API answers 400 for a derived step, so a stale client CAN be refused. Folding
    // the save error into the load state meant the follow-up GET succeeding immediately
    // cleared the message: the owner saw a checkbox snap back and was told nothing.
    mocked.setSetupStepDone.mockRejectedValue(new Error('400'));
    renderWith(checklist(), ['core']);

    const box = await screen.findByRole('checkbox', { name: 'setup_step_restaurant_info_title' });
    fireEvent.click(box);

    expect(await screen.findByRole('alert')).toHaveTextContent('setup_checklist_save_failed');
  });

  it("shows the server's reason for the refusal, not the generic line (E9 #383)", async () => {
    // The point of the sweep. `saveFailed` was a BOOLEAN, so every cause rendered the same
    // sentence — and the cause that matters here is specific: the API answers 400 for a
    // derived step, saying it is derived. That is the only thing that explains why the
    // checkbox snapped back, and it was thrown away one line after arriving.
    mocked.setSetupStepDone.mockRejectedValue(
      new ApiError(400, 'Validation failed', ['This step is derived from your data and cannot be set manually']),
    );
    renderWith(checklist(), ['core']);

    const box = await screen.findByRole('checkbox', { name: 'setup_step_restaurant_info_title' });
    fireEvent.click(box);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('This step is derived from your data and cannot be set manually');
    expect(alert).not.toHaveTextContent('setup_checklist_save_failed');
  });

  it('keeps the panel up when a refresh fails after it has rendered once', async () => {
    // Losing the whole checklist over one failed refresh would take the error message
    // down with it — the component renders nothing without a checklist.
    mocked.setSetupChecklistDismissed.mockRejectedValue(new Error('offline'));
    renderWith(checklist(), ['core']);
    await screen.findByText('setup_step_restaurant_info_title');

    mocked.getSetupChecklist.mockRejectedValue(new Error('offline'));
    fireEvent.click(screen.getByRole('button', { name: 'setup_checklist_hide' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('setup_step_restaurant_info_title')).toBeInTheDocument();
  });

  it("announces a derived step's state, which has no checkbox to carry it", async () => {
    // `menu` and `staff` are the two steps whose completion is genuinely earned; an
    // aria-hidden icon and line-through styling would make them the two whose
    // completion is never announced.
    renderWith(checklist({ steps: [{ key: 'menu', moduleId: null, isDerived: true, isDone: true }] }), ['core']);

    expect(await screen.findByRole('img', { name: 'setup_step_state_done' })).toBeInTheDocument();
  });

  it('sends the desired state, not a toggle', async () => {
    // The PUT carries `isDone` so a request retried after a flaky connection lands on
    // the same answer instead of flipping back.
    mocked.setSetupStepDone.mockResolvedValue({ success: true } as never);
    renderWith(checklist(), ['core']);

    const box = await screen.findByRole('checkbox', { name: 'setup_step_restaurant_info_title' });
    fireEvent.click(box);

    await waitFor(() => expect(mocked.setSetupStepDone).toHaveBeenCalledWith('restaurant-info', true));
  });
});
