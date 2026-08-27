import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { CREDIT_PLANS } from "../lib/credits/catalog.ts";

const pricingPage = await readFile(new URL("../app/pricing/page.tsx", import.meta.url), "utf8");
const orderPanel = await readFile(new URL("../components/pricing/order-panel.tsx", import.meta.url), "utf8");
const successPage = await readFile(new URL("../app/payments/toss-test/success/page.tsx", import.meta.url), "utf8");
const failPage = await readFile(new URL("../app/payments/toss-test/fail/page.tsx", import.meta.url), "utf8");
const bankOrderRoute = await readFile(new URL("../app/api/orders/route.ts", import.meta.url), "utf8");
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")) as { dependencies: Record<string, string> };

test("pricing은 기존 계좌이체와 분리된 TossPayments SDK v2 테스트 카드결제를 제공한다", () => {
  assert.equal(packageJson.dependencies["@tosspayments/tosspayments-sdk"], "2.7.1");
  assert.match(pricingPage, /NEXT_PUBLIC_TOSS_TEST_CLIENT_KEY/);
  assert.match(orderPanel, /loadTossPayments/);
  assert.match(orderPanel, /method: "CARD"/);
  assert.match(orderPanel, /amount: \{ currency: "KRW", value: plan\.price \}/);
  assert.match(orderPanel, /카드결제 <small>테스트<\/small>/);
  assert.match(orderPanel, /paymentMethod === "bank"/);
  assert.match(bankOrderRoute, /createBankTransferOrder/);
});

test("테스트 결제는 세 Credit 플랜의 기존 가격 데이터를 그대로 사용한다", () => {
  assert.deepEqual(CREDIT_PLANS.map(({ id, price }) => ({ id, price })), [
    { id: "starter", price: 14_900 },
    { id: "standard", price: 29_900 },
    { id: "studio", price: 59_000 },
  ]);
  assert.match(orderPanel, /MOLIVE_TEST_\$\{plan\.id\}_/);
  assert.match(orderPanel, /\/payments\/toss-test/);
});

test("성공·실패 화면은 승인이나 Credit 지급 없이 테스트 결과만 안내한다", () => {
  assert.match(successPage, /테스트 결제입니다\. 실제 Credit은 지급되지 않습니다\./);
  assert.match(successPage, /결제 승인 API와 Credit 지급 로직은 호출하지 않았습니다\./);
  assert.match(failPage, /실제 결제와 Credit 지급은 진행되지 않았습니다\./);
  const resultCode = `${successPage}\n${failPage}`;
  assert.doesNotMatch(resultCode, /fulfillCreditOrder|fulfill_credit_order|createBankTransferOrder|api\.tosspayments\.com|payments\/confirm/);
});
