import { expect, Page, Response } from '@playwright/test';

type TransactionWaitOptions = {
  page: Page;
  name: string;
  action: () => Promise<void>;
  urlIncludes: string | string[];
  method?: string;
  timeout?: number;
  expectedStatuses?: number[];
};

function toIncludesList(urlIncludes: string | string[]): string[] {
  return Array.isArray(urlIncludes) ? urlIncludes : [urlIncludes];
}

export async function runTransactionWait({
  page,
  name,
  action,
  urlIncludes,
  method = 'POST',
  timeout = 15_000,
  expectedStatuses
}: TransactionWaitOptions): Promise<Response> {
  const includes = toIncludesList(urlIncludes);

  const responsePromise = page.waitForResponse(
    (response) => {
      const matchesUrl = includes.some((fragment) => response.url().includes(fragment));
      const matchesMethod = response.request().method() === method;
      return matchesUrl && matchesMethod;
    },
    { timeout }
  );

  await action();
  const response = await responsePromise;

  if (expectedStatuses && expectedStatuses.length > 0) {
    expect(
      expectedStatuses,
      `${name} returned unexpected status ${response.status()} for ${response.url()}`
    ).toContain(response.status());
  } else {
    expect(
      response.ok(),
      `${name} failed with status ${response.status()} for ${response.url()}`
    ).toBeTruthy();
  }

  return response;
}
