export const optionCount = async (locator) => locator.locator('option').count();

export const selectFirstRealOption = async (locator) => {
  const options = locator.locator('option');
  const count = await options.count();
  for (let index = 1; index < count; index += 1) {
    const value = String(await options.nth(index).getAttribute('value') || '').trim();
    if (value) {
      await locator.selectOption(value);
      return value;
    }
  }
  throw new Error('No selectable option found.');
};

