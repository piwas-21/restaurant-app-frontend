import { sortCategoryIds } from './categoryIdProtocolOrder';

it('preserves the existing code-unit order for canonical lower-case category GUIDs', () => {
  const ids = [
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    '10000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-00000000000a',
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000001',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  ];

  expect(sortCategoryIds(ids)).toEqual([...ids].sort());
});

it('uses code-unit order rather than locale-sensitive collation', () => {
  const ids = ['a', 'A', '0', '-', '_', 'z'];

  expect(sortCategoryIds(ids)).toEqual([...ids].sort());
});
