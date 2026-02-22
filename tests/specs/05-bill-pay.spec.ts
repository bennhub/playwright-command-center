import { test } from '../fixtures/user.fixture';
import { AuthPage } from '../pages/auth.page';
import { BillPayPage } from '../pages/bill-pay.page';

test('registered user submits bill payment', async ({ page, testUser }) => {
  const auth = new AuthPage(page);
  const billPay = new BillPayPage(page);

  await auth.gotoHome();
  await auth.openRegister();
  await auth.register(testUser);

  await billPay.open();
  await billPay.payBill();
  await billPay.assertBillPaymentComplete();
});
