import { test, expect } from '../fixtures/user.fixture';
import { AuthPage } from '../pages/auth.page';

test('registers a new user and verifies logged-in welcome', async ({ page, testUser }) => {
  const auth = new AuthPage(page);
  await auth.gotoHome();
  await auth.openRegister();
  await auth.register(testUser);
  await auth.assertRegistrationSuccess();
  await auth.assertLoginSuccess(testUser);
  await expect(page.getByRole('link', { name: 'Log Out' })).toBeVisible();
});
