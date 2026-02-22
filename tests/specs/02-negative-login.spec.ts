import { test } from '@playwright/test';
import { AuthPage } from '../pages/auth.page';

test('shows error for invalid credentials', async ({ page }) => {
  const auth = new AuthPage(page);
  await auth.gotoHome();
  await auth.login({ username: 'invalid_user_qa', password: 'wrong_pw' });
  await auth.assertLoginFailure();
});
