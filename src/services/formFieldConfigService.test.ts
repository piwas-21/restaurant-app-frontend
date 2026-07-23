import { formFieldConfigService } from './formFieldConfigService';
import { apiClient } from '@/utils/apiClient';
import type { FormFieldsDto } from '@/types/formFieldConfig';

jest.mock('@/utils/apiClient');

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

const grouped: FormFieldsDto[] = [
  {
    formKey: 'reservation',
    fields: [
      { fieldKey: 'customerName', isVisible: true, isRequired: true, isLocked: true, displayOrder: 0 },
      { fieldKey: 'customerPhone', isVisible: true, isRequired: false, isLocked: false, displayOrder: 2 },
    ],
  },
];

beforeEach(() => jest.clearAllMocks());

describe('formFieldConfigService', () => {
  it('getAll unwraps the grouped configuration from the ApiResponse envelope', async () => {
    mockApiClient.get.mockResolvedValue({ success: true, data: grouped });

    const result = await formFieldConfigService.getAll();

    expect(mockApiClient.get).toHaveBeenCalledWith('/api/FormFieldConfiguration');
    expect(result).toEqual(grouped);
  });

  it('getAll propagates fetch errors to the caller (the hook owns the fallback)', async () => {
    mockApiClient.get.mockRejectedValue(new Error('down'));
    await expect(formFieldConfigService.getAll()).rejects.toThrow('down');
  });

  it('update PUTs the flat field list wrapped in { fields } and returns the post-update grouping', async () => {
    mockApiClient.put.mockResolvedValue({ success: true, data: grouped });
    const fields = [
      { formKey: 'reservation', fieldKey: 'customerName', isVisible: true, isRequired: true },
      { formKey: 'reservation', fieldKey: 'customerPhone', isVisible: true, isRequired: true },
    ];

    const result = await formFieldConfigService.update(fields);

    expect(mockApiClient.put).toHaveBeenCalledWith('/api/FormFieldConfiguration', { fields });
    expect(result).toEqual(grouped);
  });
});
