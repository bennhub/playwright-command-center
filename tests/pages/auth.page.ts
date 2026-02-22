import { Page, expect } from '@playwright/test';
import { runTransactionWait } from '../utils/network';
import { uniqueUser } from '../utils/random';

export class AuthPage {
  constructor(private readonly page: Page) {}

  async gotoHome() {
    await this.page.goto('/');
    await expect(this.page).toHaveURL(/parabank\/index\.htm/);
  }

  async openRegister() {
    await this.page.getByRole('link', { name: 'Register' }).click();
    await expect(this.page).toHaveURL(/register\.htm/);
  }

  async register(user: { username: string; password: string }) {
    const successMessage = this.page.getByText('Your account was created successfully. You are now logged in.');

    // Parabank occasionally rejects generated usernames due to truncation/
    // collision behavior. Retry with regenerated credentials when that exact
    // validation message appears.
    for (let attempt = 0; attempt < 3; attempt++) {
      await this.page.locator('input[name="customer.firstName"]').fill('QA');
      await this.page.locator('input[name="customer.lastName"]').fill('Engineer');
      await this.page.locator('input[name="customer.address.street"]').fill('1 Test St');
      await this.page.locator('input[name="customer.address.city"]').fill('Toronto');
      await this.page.locator('input[name="customer.address.state"]').fill('ON');
      await this.page.locator('input[name="customer.address.zipCode"]').fill('A1A1A1');
      await this.page.locator('input[name="customer.phoneNumber"]').fill('5555555555');
      await this.page.locator('input[name="customer.ssn"]').fill('123-45-6789');
      await this.page.locator('input[name="customer.username"]').fill(user.username);
      await this.page.locator('input[name="customer.password"]').fill(user.password);
      await this.page.locator('input[name="repeatedPassword"]').fill(user.password);
      await runTransactionWait({
        page: this.page,
        name: 'register user',
        urlIncludes: 'register.htm',
        expectedStatuses: [200, 302],
        action: async () => {
          await this.page.getByRole('button', { name: 'Register' }).click();
        }
      });

      if (await successMessage.isVisible({ timeout: 2_000 }).catch(() => false)) {
        return;
      }

      const userExists = await this.page
        .getByText('This username already exists.')
        .isVisible({ timeout: 1_000 })
        .catch(() => false);

      if (!userExists) {
        return;
      }

      const refreshed = uniqueUser('qauser', `retry${attempt + 1}`);
      user.username = refreshed.username;
      user.password = refreshed.password;
    }
  }

  async assertRegistrationSuccess() {
    await expect(this.page.getByText('Your account was created successfully. You are now logged in.')).toBeVisible();
  }

  async logoutIfPresent() {
    const logout = this.page.getByRole('link', { name: 'Log Out' });
    if (await logout.count()) {
      await logout.click();
    }
  }

  async login(user: { username: string; password: string }) {
    await this.page.locator('input[name="username"]').fill(user.username);
    await this.page.locator('input[name="password"]').fill(user.password);
    await runTransactionWait({
      page: this.page,
      name: 'login user',
      urlIncludes: 'login.htm',
      expectedStatuses: [200, 302],
      action: async () => {
        await this.page.getByRole('button', { name: 'Log In' }).click();
      }
    });
  }

  async assertLoginSuccess(user: { username: string }) {
    await expect(this.page.getByText(`Welcome ${user.username}`)).toBeVisible();
  }

  async assertLoginFailure() {
    await expect(this.page.getByText('The username and password could not be verified.')).toBeVisible();
  }
}
