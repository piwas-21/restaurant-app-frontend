import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CreateCategoryModal from './CreateCategoryModal';
import { createCategory } from '@/services/categoryService';
import { LANGUAGE_CODES, type LanguageCode } from '@/config/languageConfig';
import { translationWorkbenchService } from '@/services/translationWorkbenchService';
import type { TranslationWorkbenchRequest } from '@/services/translationWorkbenchService';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/services/categoryService', () => ({
  createCategory: jest.fn(async () => ({ success: true, data: { id: 'cat-1' } })),
  uploadCategoryImage: jest.fn(),
}));
jest.mock('@/services/translationWorkbenchService', () => ({
  translationWorkbenchService: { preview: jest.fn(), suggest: jest.fn(), review: jest.fn() },
}));

const mockCreateCategory = createCategory as jest.Mock;
const workbench = translationWorkbenchService as jest.Mocked<typeof translationWorkbenchService>;

function stubTranslationSuggestions(request: TranslationWorkbenchRequest) {
  const field = request.fields[0];
  return {
    suggestions: [
      {
        suggestionId: 'suggestion-category-de',
        fieldRef: field.fieldRef,
        locale: 'de' as LanguageCode,
        sourceHash: 'category-source-hash',
        text: 'Vorspeisen',
        provider: 'stub',
        model: 'stub',
        status: 'suggested' as const,
      },
    ],
    skipped: [],
    providerStatus: 'ready' as const,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCreateCategory.mockResolvedValue({ success: true, data: { id: 'cat-1' } });
  workbench.preview.mockImplementation(async (request) => ({
    rows: request.fields.map((field) => ({
      fieldRef: field.fieldRef,
      sourceLocale: field.sourceLocale,
      sourceHash: 'category-source-hash',
      sourceText: field.sourceText,
      targets: LANGUAGE_CODES.map((locale) => ({
        locale,
        status: locale === field.sourceLocale ? 'sourceCopy' : 'missing',
        text: locale === field.sourceLocale ? field.sourceText : null,
      })),
    })),
  }));
  workbench.suggest.mockImplementation(async (request) => stubTranslationSuggestions(request));
  workbench.review.mockResolvedValue({
    decisions: [
      {
        suggestionId: 'suggestion-category-de',
        decision: 'accept',
        status: 'accepted',
        text: 'Vorspeisen',
      },
    ],
  });
});

it('reviews and saves an accepted category suggestion with source-locale metadata', async () => {
  render(<CreateCategoryModal isOpen onClose={jest.fn()} onCategoryCreated={jest.fn()} onPartialSuccess={jest.fn()} />);

  fireEvent.change(screen.getByLabelText('category_name'), { target: { value: 'Starters' } });
  fireEvent.change(screen.getByLabelText('catalogue_source_language'), { target: { value: 'fr' } });
  fireEvent.click(screen.getByText('translation_review_title', { selector: 'summary' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'translation_review_accept_field' })).toBeInTheDocument(),
  );
  fireEvent.click(screen.getByRole('button', { name: 'translation_review_accept_field' }));
  fireEvent.click(screen.getByRole('button', { name: 'create' }));

  await waitFor(() => expect(mockCreateCategory).toHaveBeenCalledTimes(1));
  expect(workbench.review).toHaveBeenCalledWith([{ suggestionId: 'suggestion-category-de', decision: 'accept' }]);
  expect(mockCreateCategory).toHaveBeenCalledWith(
    expect.objectContaining({
      sourceLocale: 'fr',
      translations: expect.objectContaining({ de: expect.objectContaining({ name: 'Vorspeisen' }) }),
      translationMetadata: {
        sourceLocales: { name: 'fr' },
        acceptedSuggestionIds: { 'name.de': 'suggestion-category-de' },
      },
    }),
  );
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
