import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LANGUAGE_CODES } from '@/config/languageConfig';
import type { OptionSetDetail } from '@/types/optionSet';
import type { TranslationWorkbenchRequest } from '@/services/translationWorkbenchService';
import { translationWorkbenchService } from '@/services/translationWorkbenchService';
import { useOptionSetEditor } from '@/hooks/admin/useOptionSetEditor';
import OptionSetEditorWorkspace from './OptionSetEditorWorkspace';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('next/navigation', () => ({ useRouter: () => ({ replace: jest.fn() }) }));
jest.mock('@/hooks/admin/useOptionSetEditor', () => ({ useOptionSetEditor: () => mockEditorState }));
jest.mock('@/services/translationWorkbenchService', () => ({
  translationWorkbenchService: { preview: jest.fn(), suggest: jest.fn(), review: jest.fn() },
}));

const savedDetail: OptionSetDetail = {
  id: 'set-1',
  kind: 'sauce',
  name: 'Aioli',
  sourceLocale: 'fr',
  translations: { fr: 'Aioli', de: 'Knoblauchmayonnaise' },
  status: 'active',
  version: 2,
  entryCount: 0,
  attachmentCount: 0,
  entries: [],
  attachments: [],
};
const mockSave = jest.fn();
const mockSetTranslation = jest.fn();
const mockEditorState = {
  detail: null,
  kind: 'sauce',
  setKind: jest.fn(),
  name: 'Aioli',
  setName: jest.fn(),
  sourceLocale: 'fr',
  setSourceLocale: jest.fn(),
  translations: { en: 'Garlic sauce' },
  setTranslation: mockSetTranslation,
  entries: [],
  isLoading: false,
  referencesError: null,
  error: null,
  errorMessage: null,
  saved: false,
  isDirty: true,
  isSaving: false,
  canSave: true,
  addEntry: jest.fn(),
  updateEntry: jest.fn(),
  removeEntry: jest.fn(),
  moveEntry: jest.fn(),
  markReferenceVerified: jest.fn(),
  markVariationValidity: jest.fn(),
  referenceIsAvailable: jest.fn(() => true),
  save: mockSave,
  reload: jest.fn(),
  reloadReferences: jest.fn(),
} as unknown as ReturnType<typeof useOptionSetEditor>;
const workbench = translationWorkbenchService as jest.Mocked<typeof translationWorkbenchService>;

function suggestionResponse(request: TranslationWorkbenchRequest) {
  return {
    suggestions: [
      {
        suggestionId: 'suggestion-option-set-de',
        fieldRef: request.fields[0].fieldRef,
        locale: 'de' as const,
        sourceHash: 'option-set-source-hash',
        text: 'Knoblauchmayonnaise',
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
  mockSave.mockResolvedValue(savedDetail);
  workbench.preview.mockImplementation(async (request) => ({
    rows: request.fields.map((field) => ({
      fieldRef: field.fieldRef,
      sourceLocale: field.sourceLocale,
      sourceHash: 'option-set-source-hash',
      sourceText: field.sourceText,
      targets: LANGUAGE_CODES.map((locale) => ({
        locale,
        status: locale === field.sourceLocale ? 'sourceCopy' : 'missing',
        text: locale === field.sourceLocale ? field.sourceText : null,
      })),
    })),
  }));
  workbench.suggest.mockImplementation(async (request) => suggestionResponse(request));
  workbench.review.mockResolvedValue({
    decisions: [
      {
        suggestionId: 'suggestion-option-set-de',
        decision: 'accept',
        status: 'accepted',
        text: 'Knoblauchmayonnaise',
      },
    ],
  });
});

it('sends an accepted option-set translation in TranslationMetadata on Save', async () => {
  render(<OptionSetEditorWorkspace initialKind="sauce" />);
  fireEvent.click(screen.getByText('translation_review_title', { selector: 'summary' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'translation_review_accept_field' })).toBeInTheDocument(),
  );
  fireEvent.click(screen.getByRole('button', { name: 'translation_review_accept_field' }));
  fireEvent.click(screen.getByRole('button', { name: 'option_set_save' }));

  await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(1));
  expect(mockSetTranslation).toHaveBeenCalledWith('de', 'Knoblauchmayonnaise');
  expect(mockSave).toHaveBeenCalledWith({
    sourceLocales: { name: 'fr' },
    acceptedSuggestionIds: { 'name.de': 'suggestion-option-set-de' },
  });
});
