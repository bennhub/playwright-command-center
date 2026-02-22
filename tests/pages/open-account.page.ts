import { Page, expect } from '@playwright/test';
import { runTransactionWait } from '../utils/network';

export class OpenAccountPage {
  constructor(private readonly page: Page) {}

  async open() {
    await this.page.getByRole('link', { name: 'Open New Account' }).click();
    await expect(this.page).toHaveURL(/openaccount\.htm/);
  }

  async createCheckingAccount() {
    // Guard against racing the form before the source account is available.
    const fundingAccount = this.page.locator('#fromAccountId option');
    await expect(fundingAccount).toHaveCount(1);
    await this.page.locator('#type').selectOption('0');

    // Transaction boundary: opening an account is backend state change, so we
    // wait for the createAccount POST and validate API success.
    await runTransactionWait({
      page: this.page,
      name: 'open account',
      urlIncludes: '/services_proxy/bank/createAccount',
      action: async () => {
        await this.page.getByRole('button', { name: 'Open New Account' }).click();
      }
    });
  }

  async assertOpened() {
    // Prefer the new account id as the primary success signal; it is more
    // stable than relying on heading text alone.
    const newAccountLink = this.page.locator('#newAccountId');
    await expect(newAccountLink).toBeVisible({ timeout: 15_000 });
    await expect(this.page.getByRole('heading', { name: /Account Opened!/ })).toBeVisible();
  }
}
