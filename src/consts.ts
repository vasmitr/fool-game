export const suits = ["hearts", "diamonds", "clubs", "spades"] as const;

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
} as const;

export type Rank = keyof typeof rankValues;
export type Suit = (typeof suits)[number];

export interface Card {
  id: string;
  rank: Rank;
  value: (typeof rankValues)[Rank];
  suit: Suit;
}

export const AI_DELAY_MS = 3000;
