import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CreateCategoryModal from './CreateCategoryModal';
import { createCategory } from '@/services/categoryService';
import { LANGUAGE_CODES } from '@/config/languageConfig';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/services/categoryService', () => ({
  createCategory: jest.fn(async () => ({ success: true, data: { id: 'cat-1' } })),
  uploadCategoryImage: jest.fn(),
}));

const mockCreateCategory = createCategory as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockCreateCategory.mockResolvedValue({ success: true, data: { id: 'cat-1' } });
});

it('sends the selected source language and entered locale text on category create', async () => {
  render(<CreateCategoryModal isOpen onClose={jest.fn()} onCategoryCreated={jest.fn()} onPartialSuccess={jest.fn()} />);

  fireEvent.change(screen.getByLabelText('category_name'), { target: { value: 'Starters' } });
  fireEvent.change(screen.getByLabelText('catalogue_source_language'), { target: { value: 'fr' } });
  fireEvent.change(screen.getAllByLabelText('editor_translations_target_field')[0], {
    target: { value: 'Entrées' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'create' }));

  await waitFor(() => expect(mockCreateCategory).toHaveBeenCalledTimes(1));
  expect(mockCreateCategory).toHaveBeenCalledWith(
    expect.objectContaining({
      name: 'Starters',
      sourceLocale: 'fr',
      translations: { en: expect.objectContaining({ name: 'Entrées' }) },
    }),
  );
});

it('excludes the chosen source locale from translation targets and moves the target when it collides', async () => {
  render(<CreateCategoryModal isOpen onClose={jest.fn()} onCategoryCreated={jest.fn()} onPartialSuccess={jest.fn()} />);

  const targetSelect = screen.getByLabelText('editor_translations_target_languages') as HTMLSelectElement;
  fireEvent.change(screen.getByLabelText('catalogue_source_language'), { target: { value: 'en' } });

  expect(targetSelect.querySelector('option[value="en"]')).not.toBeInTheDocument();
  expect(targetSelect).toHaveValue('tr');
  expect(targetSelect.querySelectorAll('option')).toHaveLength(LANGUAGE_CODES.length - 1);

  fireEvent.change(screen.getByLabelText('category_name'), { target: { value: 'Starters' } });
  fireEvent.change(screen.getAllByLabelText('editor_translations_target_field')[0], {
    target: { value: 'Başlangıçlar' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'create' }));

  await waitFor(() => expect(mockCreateCategory).toHaveBeenCalledTimes(1));
  expect(mockCreateCategory).toHaveBeenCalledWith(
    expect.objectContaining({
      sourceLocale: 'en',
      translations: { tr: expect.objectContaining({ name: 'Başlangıçlar' }) },
    }),
  );
});
