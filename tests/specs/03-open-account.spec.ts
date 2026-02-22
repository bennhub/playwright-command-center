import { test } from '../fixtures/user.fixture';
import { AuthPage } from '../pages/auth.page';
import { OpenAccountPage } from '../pages/open-account.page';

test('registered user opens a new checking account', async ({ page, testUser }) => {
  const auth = new AuthPage(page);
  const openAccount = new OpenAccountPage(page);

  await auth.gotoHome();
  await auth.openRegister();
  await auth.register(testUser);
  await openAccount.open();
  await openAccount.createCheckingAccount();
  await openAccount.assertOpened();
});
