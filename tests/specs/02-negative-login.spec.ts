import { test } from '@playwright/test';
import { AuthPage } from '../pages/auth.page';

test('shows error for invalid credentials', async ({ page }) => {
  const auth = new AuthPage(page);
  await auth.gotoHome();
  await auth.ensureLoggedOut();
  const nonce = Date.now();
  await auth.login({ username: `invalid_user_${nonce}`, password: `wrong_pw_${nonce}` });
  await auth.assertLoginFailure();
});
