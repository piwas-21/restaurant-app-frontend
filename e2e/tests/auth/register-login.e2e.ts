import { test, expect } from '@playwright/test';
import { deleteUserByEmail } from '../../helpers/db';
import { expectNoA11yViolations } from '../../helpers/a11y';
import { apiBaseUrl } from '../../helpers/config';
import { waitForVerificationLink } from '../../helpers/mailpit';

/**
 * Auth flow — register → verify (via real email link) → login → logout,
 * plus failed-login.
 *
 * The verify step drives the same path a real user would: poll Mailpit for
 * the email the backend sent, extract the /verify-email URL, navigate to it,
 * assert the success state. Requires Mailpit running on :8025 and the backend
 * configured with EmailSettings__SmtpHost=localhost (see scripts/dev-e2e.sh).
 *
 * No Page Object: per E2E-STRATEGY §Auth, this file is the only place that
 * drives the login/register UI directly — POM reuse would be zero. Every
 * other authed flow uses the customerUser/staff fixtures instead.
 *
 * Strategy: docs/E2E-STRATEGY.md (HIGH tier — auth).
 */

const PASSWORD = 'Test123!Pass'; // pragma: allowlist secret -- e2e test password, never reused outside this file

function uniqueEmail(testId: string): string {
  return `e2e-${testId}-${Date.now()}@test.local`;
}

test.describe('auth: register → verify → login → logout', () => {
  let createdEmail: string | undefined;

  test.afterEach(async () => {
    if (createdEmail) {
      try {
        await deleteUserByEmail(createdEmail);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(`[register-login.e2e] cleanup failed for ${createdEmail}:`, err);
      } finally {
        createdEmail = undefined;
      }
    }
  });

  test('customer can register, log in after verification, and log out', async ({ page }, testInfo) => {
    const email = uniqueEmail(testInfo.testId);
    createdEmail = email;

    // 1. Register
    await page.goto('/auth/register');
    await expectNoA11yViolations(page);

    await page.getByLabel(/first name/i).fill('E2E');
    await page.getByLabel(/last name/i).fill('Customer');
    await page.getByLabel(/^email$/i).fill(email);
    await page.getByLabel(/^password$/i).fill(PASSWORD);
    await page.getByLabel(/confirm password/i).fill(PASSWORD);

    await page.getByRole('button', { name: /^register$/i }).click();
    await expect(page.getByRole('heading', { name: /registration successful/i })).toBeVisible();

    // 2. Verify — fetch the email Mailpit caught and click the link.
    const verifyUrl = await waitForVerificationLink(email, { subjectIncludes: 'verif' });
    await page.goto(verifyUrl);
    await expect(page.getByRole('heading', { name: /email verified/i })).toBeVisible();

    // 3. Login — auto-redirect from verify lands at /auth/login?verified=true
    //    after a 3s timer; navigate explicitly to avoid the race.
    await page.goto('/auth/login');

    await page.getByLabel(/^email$/i).fill(email);
    await page.getByLabel(/^password$/i).fill(PASSWORD);
    await page.getByRole('button', { name: /^login$/i }).click();

    await expect(page).toHaveURL(/\/account$/);

    // 4. Logout via the user-menu dropdown
    await page.getByRole('button', { name: /user menu/i }).click();
    await page.getByRole('button', { name: /^logout$/i }).click();

    // The user-visible signals that logout completed: the avatar/user-menu
    // disappears and the route changes off /account. Token cleared in
    // localStorage is the secondary corroboration.
    await expect(page.getByRole('button', { name: /user menu/i })).toHaveCount(0);
    await expect(page).not.toHaveURL(/\/account$/);
    const tokenAfterLogout = await page.evaluate(() => window.localStorage.getItem('auth_token'));
    expect(tokenAfterLogout).toBeNull();
  });

  test('login fails with an invalid password and surfaces an error', async ({ page, request }, testInfo) => {
    // Seed a verified user via the API (this test isn't about the register UI).
    const email = uniqueEmail(testInfo.testId);
    createdEmail = email;
    const registerResponse = await request.post(`${apiBaseUrl()}/api/User/register/customer`, {
      data: {
        firstName: 'E2E',
        lastName: 'Customer',
        email,
        password: PASSWORD,
        confirmPassword: PASSWORD,
      },
    });
    expect(registerResponse.ok(), 'API register seed failed').toBeTruthy();
    // Verify via the real email-link path (same as the happy-path test).
    const verifyUrl = await waitForVerificationLink(email, { subjectIncludes: 'verif' });
    await page.goto(verifyUrl);
    await expect(page.getByRole('heading', { name: /email verified/i })).toBeVisible();

    await page.goto('/auth/login');
    await page.getByLabel(/^email$/i).fill(email);
    await page.getByLabel(/^password$/i).fill('Wrong-Pass-9999!');
    await page.getByRole('button', { name: /^login$/i }).click();

    // Scope to the login form — Next.js's hidden route-announcer also has
    // role="alert", which trips strict-mode if we match all alerts on the page.
    const alert = page.getByRole('form').getByRole('alert');
    await expect(alert).toBeVisible();
    // Backend throws `UnauthorizedAccessException("Invalid credentials")`. The
    // frontend either surfaces that text or falls back to `t('unknown_error')`
    // ("An unknown error occurred."). Match either, but nothing else.
    await expect(alert).toContainText(/Invalid credentials|An unknown error occurred/);

    // Still on /auth/login — no redirect happened.
    await expect(page).toHaveURL(/\/auth\/login$/);
    const tokenAfterFailedLogin = await page.evaluate(() => window.localStorage.getItem('auth_token'));
    expect(tokenAfterFailedLogin).toBeNull();
  });
});
