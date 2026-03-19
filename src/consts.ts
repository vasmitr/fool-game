export const suits = ["hearts", "diamonds", "clubs", "spades"];
export const ranks = ["6", "7", "8", "9", "10", "J", "Q", "K", "A"];

export const rankValues: Record<string, number> = {
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
  rank: (typeof ranks)[number];
  value: number;
  suit: (typeof suits)[number];
}

export interface Player {
  id: number;
  name: string;
  hand: Card[];
  isDealer: boolean;
}
