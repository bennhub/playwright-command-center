import { Page, expect } from '@playwright/test';
import { runTransactionWait } from '../utils/network';

export class BillPayPage {
  constructor(private readonly page: Page) {}

  async open() {
    await this.page.getByRole('link', { name: 'Bill Pay' }).click();
    await expect(this.page).toHaveURL(/billpay\.htm/);
  }

  async payBill() {
    await this.page.locator('input[name="payee.name"]').fill('Hydro Utility');
    await this.page.locator('input[name="payee.address.street"]').fill('10 Power St');
    await this.page.locator('input[name="payee.address.city"]').fill('Toronto');
    await this.page.locator('input[name="payee.address.state"]').fill('ON');
    await this.page.locator('input[name="payee.address.zipCode"]').fill('A1A1A1');
    await this.page.locator('input[name="payee.phoneNumber"]').fill('5555550000');
    await this.page.locator('input[name="payee.accountNumber"]').fill('123456');
    await this.page.locator('input[name="verifyAccount"]').fill('123456');
    await this.page.locator('input[name="amount"]').fill('15');

    // Transaction boundary: bill pay submits to backend. Wait for the POST so
    // failures show whether the issue is API/state vs rendering timing.
    await runTransactionWait({
      page: this.page,
      name: 'bill pay',
      urlIncludes: '/services_proxy/bank/billpay',
      action: async () => {
        await this.page.getByRole('button', { name: 'Send Payment' }).click();
      }
    });
  }

  async assertBillPaymentComplete() {
    await expect(this.page.getByRole('heading', { name: 'Bill Payment Complete' })).toBeVisible();
  }
}
