import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { OrderDto } from '@/types/order';
import { ApiError } from '@/utils/apiClient';
import { createOrderOperationalNote, getOrderOperationalNotes } from '@/services/orderOperationalNoteService';
import OrderDetailsNotesSection from './OrderDetailsNotesSection';

const translations: Record<string, string> = {
  'cashier.operational_notes_title': 'Operational notes',
  'cashier.operational_note_empty': 'No operational notes yet.',
  'cashier.operational_note_text_label': 'Note',
  'cashier.operational_note_audience_label': 'Audience',
  'cashier.operational_note_audience_kitchen': 'Kitchen',
  'cashier.operational_note_audience_staff': 'Staff',
  'cashier.operational_note_save': 'Save note',
  'cashier.operational_note_saving': 'Saving…',
  'cashier.operational_note_load_error': 'Could not load operational notes.',
  'cashier.operational_note_save_error': 'Could not save the note.',
};

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => translations[key] ?? key, i18n: { language: 'en' } }),
}));
jest.mock('@/services/orderOperationalNoteService', () => ({
  createOrderOperationalNote: jest.fn(),
  getOrderOperationalNotes: jest.fn(),
}));

const mockCreate = createOrderOperationalNote as jest.Mock;
const mockGet = getOrderOperationalNotes as jest.Mock;
const note = {
  id: 'n1',
  orderId: 'o1',
  text: 'Allergy handover',
  audience: 'Kitchen' as const,
  createdAt: '2026-09-10T12:00:00Z',
  createdBy: 'Mina',
  clientOperationId: 'operation-1',
};

const order = (id = 'o1') => ({ id, orderNumber: id, items: [], payments: [] }) as unknown as OrderDto;
const renderNotes = (currentOrder = order('o1')) =>
  render(<OrderDetailsNotesSection order={currentOrder} notesExpanded setNotesExpanded={jest.fn()} />);

const waitForLoaded = async () => {
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /Operational notes/ }).closest('section')).toHaveAttribute(
      'aria-busy',
      'false',
    ),
  );
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockResolvedValue([]);
  Object.defineProperty(globalThis.crypto, 'randomUUID', { configurable: true, value: jest.fn(() => 'uuid-1') });
});

describe('OrderDetailsNotesSection', () => {
  it('loads notes and saves the chosen staff audience to the separate notes endpoint', async () => {
    mockGet.mockResolvedValue([note]);
    mockCreate.mockResolvedValue({ ...note, id: 'n2', text: 'Check labels', audience: 'Staff' });
    renderNotes();

    expect(await screen.findByText('Allergy handover')).toBeInTheDocument();
    await waitForLoaded();
    fireEvent.click(screen.getByRole('radio', { name: 'Staff' }));
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Check labels' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save note' }));

    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith('o1', {
        text: 'Check labels',
        audience: 'Staff',
        clientOperationId: 'uuid-1',
      }),
    );
    await waitFor(() => expect(screen.getByLabelText('Note')).toHaveValue(''));
    expect(screen.getByText('Check labels')).toBeInTheDocument();
  });

  it('keeps a failed draft and names the failure for assistive technology', async () => {
    mockCreate.mockRejectedValue(new ApiError(503, 'Till unavailable'));
    renderNotes();

    await screen.findByText('No operational notes yet.');
    await waitForLoaded();
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Keep this' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save note' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Till unavailable');
    expect(screen.getByLabelText('Note')).toHaveValue('Keep this');
  });

  it('keeps drafts separate for each order when a cashier switches between them', async () => {
    const rendered = renderNotes(order('o1'));
    await screen.findByText('No operational notes yet.');
    await waitForLoaded();
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Draft for o1' } });

    rendered.rerender(<OrderDetailsNotesSection order={order('o2')} notesExpanded setNotesExpanded={jest.fn()} />);
    await waitFor(() => expect(mockGet).toHaveBeenLastCalledWith('o2'));
    await waitForLoaded();
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Draft for o2' } });

    rendered.rerender(<OrderDetailsNotesSection order={order('o1')} notesExpanded setNotesExpanded={jest.fn()} />);
    await waitForLoaded();
    expect(screen.getByLabelText('Note')).toHaveValue('Draft for o1');
  });

  it('uses native controls that retain Arabic audience names in an RTL container', async () => {
    translations['cashier.operational_note_audience_kitchen'] = 'المطبخ';
    translations['cashier.operational_note_audience_staff'] = 'الموظفون';
    const { container } = render(
      <div dir="rtl">
        <OrderDetailsNotesSection order={order()} notesExpanded setNotesExpanded={jest.fn()} />
      </div>,
    );

    await screen.findByRole('radio', { name: 'المطبخ' });
    await waitForLoaded();
    expect(screen.getByRole('radio', { name: 'الموظفون' })).toBeInTheDocument();
    expect(container.querySelector('button[aria-expanded="true"]')).toBeInTheDocument();
    translations['cashier.operational_note_audience_kitchen'] = 'Kitchen';
    translations['cashier.operational_note_audience_staff'] = 'Staff';
  });
});
