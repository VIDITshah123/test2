const { test, expect } = require('@playwright/test');
require('dotenv').config();

// Test invalidation function
function validateTestEnvironment() {
  if (!process.env.SITE_URL) throw new Error('SITE_URL is not defined in .env');
  if (!process.env.USER_NAME) throw new Error('USER_NAME is not defined in .env');
  if (!process.env.USER_PASSWORD) throw new Error('USER_PASSWORD is not defined in .env');
  
  console.log('Test environment validation passed');
}

test.describe.configure({ mode: 'parallel' });

test.describe('RSVP Website Tests', () => {
  let page;
  let context;
  
  test.beforeAll(async ({ browser }) => {
    validateTestEnvironment();
  });

  test.beforeEach(async ({ browser }, testInfo) => {
    // Create a fresh context for each test with clean storage
    context = await browser.newContext({
      permissions: ['geolocation'],
      locale: 'en-US',
      timezoneId: 'UTC',
      viewport: { width: 1920, height: 1080 },
      recordVideo: {
        dir: 'test-results/videos/'
      },
      storageState: {
        cookies: [],
        origins: []
      }
    });

    // Enable request/response logging
    context.on('request', request => 
      console.log(`>> ${request.method()} ${request.url()}`)
    );
    context.on('response', response => 
      console.log(`<< ${response.status()} ${response.url()}`)
    );

    // Create a new page
    page = await context.newPage();
    
    // Block unnecessary resources
    await page.route('**/*.{png,jpg,jpeg,svg,gif,woff,woff2,eot,ttf,otf}', route => route.abort());
    
    // Navigate to the site
    const response = await page.goto(process.env.SITE_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Verify successful navigation
    if (!response.ok()) {
      throw new Error(`Failed to load ${process.env.SITE_URL}: ${response.status()} ${response.statusText()}`);
    }

    // Clear storage after page load
    await page.evaluate(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (e) {
        console.warn('Could not clear storage:', e.message);
      }
    });
  });

  test.afterEach(async ({}, testInfo) => {
    // Capture screenshot on failure
    if (testInfo.status !== testInfo.expectedStatus) {
      const screenshot = await page.screenshot({ fullPage: true });
      await testInfo.attach('screenshot', { body: screenshot, contentType: 'image/png' });
      
      // Log console errors
      const consoleLogs = await page.evaluate(() => {
        return Array.from(window.console.getEntries())
          .filter(entry => entry.type === 'error')
          .map(entry => ({
            message: entry.message,
            stack: entry.stack
          }));
      });
      
      if (consoleLogs.length > 0) {
        console.error('Browser console errors:', JSON.stringify(consoleLogs, null, 2));
      }
    }
    
    // Close context (and all pages)
    if (context) {
      await context.close();
    }
  });

  test('should load the homepage', async ({ page }, testInfo) => {
    testInfo.annotations.push({ type: 'test', description: 'Verify homepage loads successfully' });
    
    // Basic page checks
    await expect(page).toHaveTitle(/RSVP|Hiring Tests/);
    await expect(page).toHaveURL(process.env.SITE_URL);
    
    // Check for common elements
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Error');
    expect(bodyText).not.toContain('Exception');
    
    // Log page info
    console.log(`Page title: ${await page.title()}`);
    console.log(`Current URL: ${page.url()}`);
    
    // Take a screenshot
    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach('homepage', { body: screenshot, contentType: 'image/png' });
  });

  test('should be able to login with valid credentials', async ({ page }, testInfo) => {
    testInfo.annotations.push({ type: 'test', description: 'Verify login functionality' });
    
    try {
      // Wait for login form to be visible with a more flexible selector
      const emailField = await page.waitForSelector('input[type="email"], input[name*="email"], #email', {
        state: 'visible',
        timeout: 10000
      });
      
      // Fill login form
      await emailField.fill(process.env.USER_NAME);
      
      const passwordField = await page.waitForSelector('input[type="password"], input[name*="password"], #password', {
        state: 'visible'
      });
      await passwordField.fill(process.env.USER_PASSWORD);
      
      // Find and click submit button
      const submitButton = await page.waitForSelector(
        'button[type="submit"], input[type="submit"], .login-button, button:has-text("Login")',
        { state: 'visible' }
      );
      
      // Wait for navigation after login
      const [response] = await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle' }),
        submitButton.click()
      ]);
      
      // Verify successful login
      expect(response.status()).toBe(200);
      await expect(page).not.toHaveURL(/(login|signin|auth)/i);
      
      // Take a screenshot after login
      const screenshot = await page.screenshot({ fullPage: true });
      await testInfo.attach('after-login', { body: screenshot, contentType: 'image/png' });
      
    } catch (error) {
      // Enhanced error logging
      console.error('Login test failed. Page content:', await page.content());
      console.error('Login form HTML:', await page.locator('form, [role="form"]').first().innerHTML().catch(() => 'No form found'));
      throw error;
    }
  });
  
  test('should verify all critical page elements', async ({ page }) => {
    // Check for common structural elements
    const criticalElements = [
      'body',
      'main, [role="main"], .main, .container',
      'header, [role="banner"], .header',
      'footer, [role="contentinfo"], .footer'
    ];
    
    for (const selector of criticalElements) {
      await expect(page.locator(selector).first()).toBeVisible({
        timeout: 5000,
        message: `Critical element matching '${selector}' not found on the page`
      });
    }
    
    // Check for common accessibility attributes
    const htmlElement = await page.locator('html');
    const lang = await htmlElement.getAttribute('lang');
    expect(lang).toBeTruthy();
    
    // Check for common error states
    const errorElements = await page.locator('[role="alert"], .error, .alert, .message-error').count();
    expect(errorElements).toBe(0);
  });
  // Add more test cases based on the website's functionality
  // Example:
  // test('should navigate to events page', async () => {
  //   await page.click('text=Events');
  //   await expect(page).toHaveURL(/\/events/);
  //   await page.screenshot({ path: 'screenshots/events-page.png' });
  // });
});
