import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

// ES Module compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the built extension
const extensionPath = path.join(__dirname, '..', '.output', 'chrome-mv3');

// Helper function to get extension page
async function getExtensionPage(context: BrowserContext): Promise<{ page: Page; extensionId: string }> {
  let [serviceWorker] = context.serviceWorkers();
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent('serviceworker');
  }
  const extensionId = serviceWorker.url().split('/')[2];
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(500);
  return { page, extensionId };
}

// Helper to create a session via background script
async function createSession(page: Page, name: string, color?: string) {
  return await page.evaluate(async (data) => {
    return await chrome.runtime.sendMessage({ 
      type: 'CREATE_SESSION', 
      payload: data 
    });
  }, { name, color });
}

// Helper to clear all data
async function clearAllData(page: Page) {
  await page.evaluate(async () => {
    // Get all sessions and delete them
    const sessions = await chrome.runtime.sendMessage({ type: 'GET_SESSIONS' });
    for (const session of sessions) {
      await chrome.runtime.sendMessage({ type: 'DELETE_SESSION', payload: { id: session.id } });
    }
    // Reset settings
    await chrome.runtime.sendMessage({ type: 'RESET_SETTINGS' });
  });
}

test.describe('TabVault Extension - Popup', () => {
  let context: BrowserContext;

  test.beforeAll(async () => {
    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('extension popup opens and shows header', async () => {
    const { page } = await getExtensionPage(context);

    // Check that popup loaded
    await expect(page.locator('#root')).toBeVisible({ timeout: 5000 });
    
    // Check for TabVault header
    await expect(page.locator('text=TabVault')).toBeVisible();
    
    await page.screenshot({ path: 'e2e/screenshots/popup-opened.png' });
    await page.close();
  });

  test('shows search input', async () => {
    const { page } = await getExtensionPage(context);

    // Check for search input
    await expect(page.locator('input[placeholder*="Search"]')).toBeVisible();
    
    await page.close();
  });

  test('shows settings button', async () => {
    const { page } = await getExtensionPage(context);

    // Check for settings button
    await expect(page.locator('button[title="Settings"]')).toBeVisible();
    
    await page.close();
  });

  test('shows empty state when no sessions', async () => {
    const { page } = await getExtensionPage(context);
    await clearAllData(page);
    await page.reload();
    await page.waitForTimeout(500);

    // Check for empty state message
    await expect(page.locator('text=No sessions saved yet')).toBeVisible();
    
    await page.screenshot({ path: 'e2e/screenshots/sessions-empty.png' });
    await page.close();
  });

  test('shows Save Session button', async () => {
    const { page } = await getExtensionPage(context);

    // Check for Save Session button
    await expect(page.locator('button:has-text("Save Session")')).toBeVisible();
    
    await page.close();
  });
});

test.describe('TabVault Extension - Session Features', () => {
  let context: BrowserContext;

  test.beforeAll(async () => {
    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('can open Save Session modal', async () => {
    const { page } = await getExtensionPage(context);
    await clearAllData(page);

    // Click Save Session button
    await page.click('button:has-text("Save Session")');
    await page.waitForTimeout(500);

    // Modal should be visible
    await expect(page.locator('text=Save Session').first()).toBeVisible();
    await expect(page.locator('input[placeholder*="Work Research"]')).toBeVisible();
    
    await page.screenshot({ path: 'e2e/screenshots/session-modal-open.png' });
    await page.close();
  });

  test('shows session preview in modal', async () => {
    const { page } = await getExtensionPage(context);

    // Click Save Session button
    await page.click('button:has-text("Save Session")');
    await page.waitForTimeout(1000);

    // Should show preview with windows
    await expect(page.locator('text=Preview')).toBeVisible();
    await expect(page.locator('text=/Window 1/')).toBeVisible();
    
    await page.screenshot({ path: 'e2e/screenshots/session-modal-preview.png' });
    
    // Close modal
    await page.click('button:has-text("Cancel")');
    await page.close();
  });

  test('can create a new session', async () => {
    const { page } = await getExtensionPage(context);
    await clearAllData(page);

    // Open the modal - click the footer button
    await page.locator('footer button:has-text("Save Session")').click();
    await page.waitForTimeout(1000);

    // Fill in session name
    await page.fill('input[placeholder*="Work Research"]', 'Test Research Session');

    // Click a color
    await page.click('button[title="Blue"]');

    // Click Save Session button in the modal (not footer)
    await page.locator('.modal-content button:has-text("Save Session")').click();
    await page.waitForTimeout(1000);

    // Session should appear in the list
    await expect(page.locator('text=Test Research Session')).toBeVisible();
    
    await page.screenshot({ path: 'e2e/screenshots/session-created.png' });
    await page.close();
  });

  test('session shows tab count and window count', async () => {
    const { page } = await getExtensionPage(context);
    
    // First create a session if none exists
    await clearAllData(page);
    await createSession(page, 'Stats Test Session');
    await page.reload();
    await page.waitForTimeout(500);

    // Session should show stats
    await expect(page.locator('text=/\\d+ tabs? in \\d+ windows?/')).toBeVisible();
    
    await page.close();
  });

  test('can expand session to see tabs', async () => {
    const { page } = await getExtensionPage(context);
    
    // Ensure we have a session
    await clearAllData(page);
    await createSession(page, 'Expand Test Session');
    await page.reload();
    await page.waitForTimeout(500);

    // Click the chevron down to expand (it doesn't have a title, look for the button with chevron)
    const sessionCard = page.locator('.session-card').first();
    const expandButton = sessionCard.locator('button').last(); // Chevron is last button
    await expandButton.click();
    await page.waitForTimeout(300);

    // Should show window details
    await expect(page.locator('text=Window 1')).toBeVisible();
    
    await page.screenshot({ path: 'e2e/screenshots/session-expanded.png' });
    await page.close();
  });

  test('can search sessions', async () => {
    const { page } = await getExtensionPage(context);
    
    // Create a session first
    await clearAllData(page);
    await createSession(page, 'Searchable Session');
    await page.reload();
    await page.waitForTimeout(500);

    // Search for the session
    await page.fill('input[placeholder*="Search"]', 'Searchable');
    await page.waitForTimeout(300);

    // Session should be visible
    await expect(page.locator('text=Searchable Session')).toBeVisible();

    // Clear search and search for non-existent
    await page.fill('input[placeholder*="Search"]', 'NonExistent');
    await page.waitForTimeout(300);

    // Should show empty state
    await expect(page.locator('text=No sessions match your search')).toBeVisible();
    
    await page.screenshot({ path: 'e2e/screenshots/session-search.png' });
    await page.close();
  });

  test('can edit session - opens modal with session data', async () => {
    const { page } = await getExtensionPage(context);
    
    // Create a session first
    await clearAllData(page);
    await createSession(page, 'Original Name');
    await page.reload();
    await page.waitForTimeout(500);

    // Click edit button
    const editButton = page.locator('button[title="Edit"]').first();
    await editButton.click();
    await page.waitForTimeout(500);

    // Modal should open with Edit Session title
    await expect(page.locator('text=Edit Session')).toBeVisible();
    
    // Input should have the current session name
    const nameInput = page.locator('input[placeholder*="Work Research"]');
    await expect(nameInput).toBeVisible();
    
    // Save Changes button should be visible
    await expect(page.locator('button:has-text("Save Changes")')).toBeVisible();
    
    await page.screenshot({ path: 'e2e/screenshots/session-edit-modal.png' });
    
    // Close the modal
    await page.click('button:has-text("Cancel")');
    await page.waitForTimeout(300);
    
    await page.close();
  });

  test('can duplicate session', async () => {
    const { page } = await getExtensionPage(context);
    
    // Create a session first
    await clearAllData(page);
    await createSession(page, 'Original Session');
    await page.reload();
    await page.waitForTimeout(500);

    // Click duplicate button
    const duplicateButton = page.locator('button[title="Duplicate"]').first();
    await duplicateButton.click();
    await page.waitForTimeout(500);

    // Should have a copy
    await expect(page.locator('text=Original Session (Copy)')).toBeVisible();
    
    await page.screenshot({ path: 'e2e/screenshots/session-duplicated.png' });
    await page.close();
  });

  test('can delete session', async () => {
    const { page } = await getExtensionPage(context);
    
    // Create sessions first
    await clearAllData(page);
    await createSession(page, 'Session To Delete');
    await createSession(page, 'Session To Keep');
    await page.reload();
    await page.waitForTimeout(500);

    // Handle confirm dialog
    page.once('dialog', dialog => dialog.accept());

    // Click delete button on the first session
    const deleteButtons = page.locator('button[title="Delete"]');
    await deleteButtons.first().click();
    await page.waitForTimeout(500);

    // One session should be removed (we had 2, now should have 1)
    const sessionCount = await page.locator('.session-card').count();
    expect(sessionCount).toBe(1);
    
    await page.screenshot({ path: 'e2e/screenshots/session-deleted.png' });
    await page.close();
  });

  test('shows free tier slots remaining', async () => {
    const { page } = await getExtensionPage(context);

    // Footer should show slots remaining
    await expect(page.locator('text=/\\d+ of \\d+ sessions/')).toBeVisible();
    
    await page.close();
  });
});

test.describe('TabVault Extension - Settings', () => {
  let context: BrowserContext;

  test.beforeAll(async () => {
    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('can open settings modal', async () => {
    const { page } = await getExtensionPage(context);

    // Click settings button
    await page.click('button[title="Settings"]');
    await page.waitForTimeout(300);

    // Settings modal should be visible
    await expect(page.locator('h2:has-text("Settings")')).toBeVisible();
    await expect(page.locator('text=Theme')).toBeVisible();
    await expect(page.locator('text=Restore Options')).toBeVisible();
    await expect(page.locator('text=Data Backup')).toBeVisible();

    await page.screenshot({ path: 'e2e/screenshots/settings-modal.png' });
    await page.close();
  });

  test('shows upgrade to Pro section for free users', async () => {
    const { page } = await getExtensionPage(context);

    // Open settings
    await page.click('button[title="Settings"]');
    await page.waitForTimeout(300);

    // Should show upgrade section
    await expect(page.locator('text=Upgrade to Pro')).toBeVisible();
    await expect(page.locator('text=Unlimited sessions & more')).toBeVisible();

    await page.screenshot({ path: 'e2e/screenshots/settings-upgrade.png' });
    await page.close();
  });

  test('can change theme to Dark', async () => {
    const { page } = await getExtensionPage(context);

    // Open settings
    await page.click('button[title="Settings"]');
    await page.waitForTimeout(300);

    // Click Dark theme button
    await page.click('button:has-text("Dark")');
    await page.waitForTimeout(300);

    // Dark button should be selected
    await expect(page.locator('button:has-text("Dark")')).toHaveClass(/border-teal-500/);

    await page.screenshot({ path: 'e2e/screenshots/settings-theme-dark.png' });
    await page.close();
  });

  test('can toggle restore tab groups setting', async () => {
    const { page } = await getExtensionPage(context);

    // Open settings
    await page.click('button[title="Settings"]');
    await page.waitForTimeout(300);

    // Find and click the toggle for "Restore tab groups"
    const toggleRow = page.locator('text=Restore tab groups').locator('..');
    const toggle = toggleRow.locator('button.rounded-full');
    
    // Get initial state
    const initialClass = await toggle.getAttribute('class');
    
    // Click toggle
    await toggle.click();
    await page.waitForTimeout(300);

    // Class should change
    const newClass = await toggle.getAttribute('class');
    expect(newClass).not.toBe(initialClass);

    await page.screenshot({ path: 'e2e/screenshots/settings-toggle.png' });
    await page.close();
  });

  test('shows Export and Import buttons', async () => {
    const { page } = await getExtensionPage(context);

    // Open settings
    await page.click('button[title="Settings"]');
    await page.waitForTimeout(300);

    // Check for Export and Import buttons
    await expect(page.locator('button:has-text("Export")')).toBeVisible();
    await expect(page.locator('button:has-text("Import")')).toBeVisible();

    await page.screenshot({ path: 'e2e/screenshots/settings-data-buttons.png' });
    await page.close();
  });

  test('can close settings modal with Done button', async () => {
    const { page } = await getExtensionPage(context);

    // Open settings
    await page.click('button[title="Settings"]');
    await page.waitForTimeout(300);

    // Click Done
    await page.click('button:has-text("Done")');
    await page.waitForTimeout(300);

    // Modal should be closed
    await expect(page.locator('h2:has-text("Settings")')).not.toBeVisible();

    await page.close();
  });

  test('shows version number in settings footer', async () => {
    const { page } = await getExtensionPage(context);

    // Open settings
    await page.click('button[title="Settings"]');
    await page.waitForTimeout(300);

    // Check for version
    await expect(page.locator('text=TabVault v1.0.0')).toBeVisible();

    await page.close();
  });
});

test.describe('TabVault Extension - Full UI Screenshots', () => {
  let context: BrowserContext;

  test.beforeAll(async () => {
    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('capture full UI with sessions - light mode', async () => {
    const { page } = await getExtensionPage(context);
    await clearAllData(page);

    // Reset to light theme
    await page.click('button[title="Settings"]');
    await page.waitForTimeout(300);
    await page.click('button:has-text("Light")');
    await page.click('button:has-text("Done")');
    await page.waitForTimeout(300);

    // Create sample sessions via background
    await createSession(page, 'Work Research');
    await createSession(page, 'Shopping List');
    await createSession(page, 'Project Documentation');

    await page.reload();
    await page.waitForTimeout(500);

    // Screenshot main view
    await page.screenshot({ path: 'e2e/screenshots/full-ui-sessions-light.png' });

    // Screenshot settings
    await page.click('button[title="Settings"]');
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'e2e/screenshots/full-ui-settings-light.png' });

    await page.close();
  });

  test('capture full UI with sessions - dark mode', async () => {
    const { page } = await getExtensionPage(context);

    // Switch to dark theme
    await page.click('button[title="Settings"]');
    await page.waitForTimeout(300);
    await page.click('button:has-text("Dark")');
    await page.click('button:has-text("Done")');
    await page.waitForTimeout(300);

    // Screenshot main view
    await page.screenshot({ path: 'e2e/screenshots/full-ui-sessions-dark.png' });

    // Screenshot settings
    await page.click('button[title="Settings"]');
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'e2e/screenshots/full-ui-settings-dark.png' });

    await page.close();
  });
});
