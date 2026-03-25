# fool-game — coding conventions

## Stack
- TypeScript with `moduleResolution: nodenext` — all relative imports need `.js` extensions
- `ts-pattern` for branching (`match`, `P.nonNullable`, `.exhaustive()`)
- `underscore` for collection transforms (`_.chain().sortBy().reduce().value()`)
- RxJS for the reactive controller loop
- `vitest` for tests — run with `pnpm test`
- Lint: `pnpm lint` | Type-check: `pnpm type-check`

## Architecture
- **`selectors.ts`** — all pure read-only queries over `TableState`. If you're reading state to compute a fact, it belongs here.
- **`rules.ts`** — game logic only. Handlers consume selectors, return `ActionOutcome`.
- **`player.ts`** — AI `propose` and `canAct` logic, registered as Knowledge Sources.
- **`controller.ts`** — RxJS loop that selects and drives AI agents.

## Style rules

### Use selectors, not inline state reads
```ts
// bad
table.hands.find(h => h.playerId === table.currentDefendId)?.cards.length

// good
getDefenderHandCount(table)
```

Any derived fact about `TableState` — including compound conditions — belongs in `selectors.ts`, not inlined in rules or handlers.

```ts
// bad — complex predicate inlined in rules.ts
match({ isAtt: isAttacker(table, playerId), isDef: isDefender(table, playerId), len: table.attack.length })
  .with({ isAtt: true }, () => true)
  .with({ isDef: true }, () => true)
  .with({ len: P.number.gt(0) }, () => true)
  .otherwise(() => false)

// good — extracted to selectors.ts as isBoutParticipant(table, playerId)
```

### Match on values and shapes, not booleans

```ts
// bad — wraps a comparison in a boolean match
match(h.playerId === playerId)
  .with(true, () => ({ ...h, cards: updater(h.cards) }))
  .otherwise(() => h)

// good — match on the value directly
match(h.playerId)
  .with(playerId, () => ({ ...h, cards: updater(h.cards) }))
  .otherwise(() => h)
```

```ts
// bad — nested match just to sequence two early-returns
match(table.isGameOver)
  .with(true, () => EMPTY)
  .otherwise(() => {
    const eligible = knowledgeSources.filter((ks) => ks.canAct(table));
    return match(eligible)
      .with([], () => EMPTY)
      .otherwise(() => merge(...eligible.map((ks) => ks.propose(table))));
  })

// good — flat array pattern, both conditions in one match
const eligible = knowledgeSources.filter((ks) => ks.canAct(table));
match([table.isGameOver, eligible])
  .with([true, P._], () => EMPTY)
  .with([P._, []], () => EMPTY)
  .otherwise(() => merge(...eligible.map((ks) => ks.propose(table))))
```

```ts
// bad — nested boolean chains
match(isParticipant(table, playerId))
  .with(true, () =>
    match(isDefender(table, playerId))
      .with(false, () => true)
      .otherwise(() => false)
  )
  .otherwise(() => false)

// good — compose conditions into a single shape match
match({ len: table.attack.length, isPart: isParticipant(table, playerId), isDef: isDefender(table, playerId) })
  .with({ len: P.number.gt(0), isPart: true, isDef: false }, () => true)
  .otherwise(() => false)
```

### Use match chains, not if/switch
```ts
// bad
if (!card) return err(...)
if (!valid) return err(...)
return success(card)

// good
match(card)
  .with(P.nullish, () => err(...))
  .with(P.nonNullable, c => c.rank !== valid, () => err(...))
  .with(P.nonNullable, c => success(c))
  .exhaustive()
```

### Flatten guards into .with() — no ifs inside handlers
The three-argument form `.with(pattern, guardFn, handler)` replaces `if` inside a `.with()` body:
```ts
// bad
.with(P.nonNullable, (card) => {
  if (invalidRank) return err(...)
  return success(card)
})

// good
.with(P.nonNullable, (card) => invalidRank(card), () => err(...))
.with(P.nonNullable, (card) => success(card))
```

### Use _.chain for collection transforms
```ts
// bad
const sorted = [...hands].sort(...)
const result = sorted.reduce(...)

// good
_.chain(hands)
  .sortBy((_, i) => (i - startIndex + n) % n)
  .reduce(step, initial)
  .value()
```

### Thread state through accumulators, not mutation
```ts
type Acc = { deck: Card[]; updates: Record<number, Card[]> };

const step = (acc: Acc, hand: Hand): Acc => {
  const draw = acc.deck.slice(0, needed);
  return { deck: acc.deck.slice(needed), updates: { ...acc.updates, [hand.playerId]: draw } };
};
```
