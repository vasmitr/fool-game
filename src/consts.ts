export const suits = ["hearts", "diamonds", "clubs", "spades"];

export const rankValues = {
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

export interface Card {
  id: string;
  rank: keyof typeof rankValues;
  value: (typeof rankValues)[keyof typeof rankValues];
  suit: (typeof suits)[number];
}

export interface Player {
  id: number;
  name: string;
  hand: Card[];
  isDealer: boolean;
}

export const AI_DELAY_MS = 3000;
