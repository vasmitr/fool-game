/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect } from '@playwright/test';

test.describe('Fool Game Mechanics', () => {
  test.beforeEach(async ({ page }) => {
    // Listen for console logs and errors
    page.on('console', msg => console.log(`BROWSER [${msg.type()}]: ${msg.text()}`));
    page.on('pageerror', err => console.log(`BROWSER ERROR: ${err.message}`));

    await page.goto('/?fast=1');

    // Wait for the app to be hydrated and state to be available
    await page.waitForFunction(() => (window as any).table$ !== undefined, { timeout: 15000 });
    await expect(page.getByText('DURAK')).toBeVisible({ timeout: 15000 });

    // Silence AI by clearing the knowledgeSources array
    await page.evaluate(() => {
      const ksList = (window as any).knowledgeSources;
      if (ksList) {
        ksList.length = 0; // Empty the array to remove all AI
      }
    });
  });

  test('human can play a starting attack', async ({ page }) => {
    await page.evaluate(() => {
      (window as any).table$.next({
        ...(window as any).table$.value,
        currentTurnId: 0,
        currentDefendId: 1,
        attack: [],
        defense: [],
        trumps: { id: 't', rank: '6', suit: 'clubs', value: 6 },
      });
    });

    const handCards = page.locator('.cursor-pointer');
    await expect(handCards.first()).toBeVisible();
    await handCards.first().click();

    // Verify one card moved to the table area specifically
    const tableCards = page.getByTestId('table-cards').locator('[data-card-id]');
    await expect(tableCards).toHaveCount(1);
  });

  test('human can defend against AI attack', async ({ page }) => {
    await page.evaluate(() => {
      const current = (window as any).table$.value;
      (window as any).table$.next({
        ...current,
        trumps: { id: 't', rank: '6', suit: 'clubs', value: 6 },
        attack: [{ id: 'ai-card', rank: '7', suit: 'hearts', value: 7 }],
        defense: [],
        currentTurnId: 1,
        currentDefendId: 0,
        hands: current.hands.map((h: any, i: number) =>
          i !== 0 ? h : {
            ...h,
            cards: [
              { id: 'test-trump', rank: 'A', suit: 'clubs', value: 14 },
              ...h.cards.slice(1),
            ],
          }
        ),
      });
    });

    const handCards = page.locator('.cursor-pointer');
    await handCards.first().click();

    // Verify defense card appears in the table area (there should be 2 cards total)
    const tableCards = page.getByTestId('table-cards').locator('[data-card-id]');
    await expect(tableCards).toHaveCount(2);
  });

  test('human can take cards when defending', async ({ page }) => {
    await page.evaluate(() => {
      (window as any).table$.next({
        ...(window as any).table$.value,
        trumps: { id: 't', rank: '6', suit: 'clubs', value: 6 },
        currentTurnId: 1,
        currentDefendId: 0,
        attack: [{ id: 'ai-card', rank: '7', suit: 'hearts', value: 7 }],
        defense: [],
      });
    });

    const takeButton = page.locator('button:has-text("Take Cards")');
    await expect(takeButton).toBeVisible();
    await takeButton.click();

    // Table area should be cleared after taking
    const tableCards = page.getByTestId('table-cards').locator('[data-card-id]');
    await expect(tableCards).toHaveCount(0);
  });

  test('human can end bout (Bito)', async ({ page }) => {
    await page.evaluate(() => {
      const cardA = { id: 'a', rank: '6', suit: 'hearts', value: 6 };
      const cardD = { id: 'd', rank: '7', suit: 'hearts', value: 7 };
      (window as any).table$.next({
        ...(window as any).table$.value,
        trumps: { id: 't', rank: '6', suit: 'clubs', value: 6 },
        currentTurnId: 0,
        currentDefendId: 1,
        attack: [cardA],
        defense: [cardD],
      });
    });

    const beatenButton = page.locator('button:has-text("End Turn / Bito")');
    await expect(beatenButton).toBeVisible();
    await beatenButton.click();

    // Table area should be cleared after Bito
    const tableCards = page.getByTestId('table-cards').locator('[data-card-id]');
    await expect(tableCards).toHaveCount(0);
  });
});
