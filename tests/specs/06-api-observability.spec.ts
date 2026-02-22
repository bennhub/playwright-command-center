import { test, expect } from '../fixtures/user.fixture';
import { AuthPage } from '../pages/auth.page';
import { OpenAccountPage } from '../pages/open-account.page';
import { TransferFundsPage } from '../pages/transfer-funds.page';

test('captures transfer endpoint response as API observability signal', async ({ page, testUser }) => {
  const auth = new AuthPage(page);
  const openAccount = new OpenAccountPage(page);
  const transfer = new TransferFundsPage(page);

  await auth.gotoHome();
  await auth.openRegister();
  await auth.register(testUser);
  await openAccount.open();
  await openAccount.createCheckingAccount();
  await openAccount.assertOpened();

  await transfer.open();

  const transferResponsePromise = page.waitForResponse((response) =>
    response.url().includes('/services_proxy/bank/transfer') && response.request().method() === 'POST'
  );

  await transfer.transfer('12');

  const transferResponse = await transferResponsePromise;
  expect(transferResponse.status()).toBe(200);
  await transfer.assertTransferComplete();
});
