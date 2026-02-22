import { test } from '../fixtures/user.fixture';
import { AuthPage } from '../pages/auth.page';
import { OpenAccountPage } from '../pages/open-account.page';
import { TransferFundsPage } from '../pages/transfer-funds.page';

test('registered user transfers funds and sees completion state', async ({ page, testUser }) => {
  const auth = new AuthPage(page);
  const openAccount = new OpenAccountPage(page);
  const transfer = new TransferFundsPage(page);

  await auth.gotoHome();
  await auth.openRegister();
  await auth.register(testUser);

  // Ensure at least one additional account exists to make transfer scenarios robust.
  await openAccount.open();
  await openAccount.createCheckingAccount();
  await openAccount.assertOpened();

  await transfer.open();
  await transfer.transfer('10');
  await transfer.assertTransferComplete();
});
