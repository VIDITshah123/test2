const { test, expect } = require('@playwright/test');
require('dotenv').config();

test.describe('RSVP Website Tests', () => {
  let page;
  
  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto(process.env.SITE_URL);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should load the homepage', async () => {
    const title = await page.title();
    expect(title).toBeTruthy();
    console.log(`Page title: ${title}`);
    await page.screenshot({ path: 'screenshots/homepage.png' });
  });

  test('should be able to login with valid credentials', async () => {
    // Update these selectors based on the actual website's HTML structure
    await page.fill('input[name="email"]', process.env.USER_NAME);
    await page.fill('input[name="password"]', process.env.USER_PASSWORD);
    await page.click('button[type="submit"]');
    
    // Wait for navigation or a success element
    await page.waitForLoadState('networkidle');
    
    // Add assertions for successful login
    // Example: await expect(page.locator('.welcome-message')).toBeVisible();
    await page.screenshot({ path: 'screenshots/after-login.png' });
  });

  // Add more test cases based on the website's functionality
  // Example:
  // test('should navigate to events page', async () => {
  //   await page.click('text=Events');
  //   await expect(page).toHaveURL(/\/events/);
  //   await page.screenshot({ path: 'screenshots/events-page.png' });
  // });
});
