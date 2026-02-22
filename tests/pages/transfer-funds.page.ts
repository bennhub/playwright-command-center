import { Page, expect } from '@playwright/test';
import { runTransactionWait } from '../utils/network';

export class TransferFundsPage {
  constructor(private readonly page: Page) {}

  async open() {
    await this.page.getByRole('link', { name: 'Transfer Funds' }).click();
    await expect(this.page).toHaveURL(/transfer\.htm/);
  }

  async transfer(amount = '25') {
    // The transfer page has two account selectors with dynamic ids across runs;
    // use position-based selection and explicitly choose different accounts.
    const accountSelects = this.page.locator('select');
    await expect(accountSelects).toHaveCount(2);

    const fromAccount = accountSelects.nth(0);
    const toAccount = accountSelects.nth(1);
    const fromOptions = fromAccount.locator('option');
    const toOptions = toAccount.locator('option');

    await expect(fromOptions).toHaveCount(2);
    await expect(toOptions).toHaveCount(2);

    const fromValues = await fromOptions.evaluateAll((options) =>
      options.map((option) => (option as HTMLOptionElement).value)
    );
    const toValues = await toOptions.evaluateAll((options) =>
      options.map((option) => (option as HTMLOptionElement).value)
    );
    const fromValue = fromValues[0];
    const preferredToValue = toValues.find((value) => value !== fromValue) || toValues[0];

    await fromAccount.selectOption(fromValue);
    await toAccount.selectOption(preferredToValue);
    await this.page.locator('#amount').fill(amount);

    // Transaction boundary: transfer is a backend mutation. This wait gives
    // deterministic timing and better diagnostics than UI-only assertions.
    await runTransactionWait({
      page: this.page,
      name: 'transfer funds',
      urlIncludes: '/services_proxy/bank/transfer',
      action: async () => {
        await this.page.getByRole('button', { name: 'Transfer' }).click();
      }
    });
  }

  async assertTransferComplete() {
    await expect(this.page.getByRole('heading', { name: 'Transfer Complete!' })).toBeVisible();
  }
}
