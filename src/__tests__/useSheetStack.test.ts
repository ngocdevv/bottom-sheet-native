import { useSheetStack } from '../useSheetStack';

describe('useSheetStack helpers', () => {
  it('is a named hook export', () => {
    expect(typeof useSheetStack).toBe('function');
    expect(useSheetStack.name).toBe('useSheetStack');
  });
});
