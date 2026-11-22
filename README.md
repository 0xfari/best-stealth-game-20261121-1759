# best-stealth-game-20261121-1759

[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/0xfari/best-stealth-game-20261121-1759/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/0xfari/best-stealth-game-20261121-1759/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

**Lamplight Heist** is a top-down stealth game (pure canvas + ES modules, zero libraries, zero network): a thief robs a gaslit museum at night across 4 wings — The Foyer, The Gallery, The Vault Wing, and The Cellar. Guards patrol their rounds with vision cones that shift from yellow to orange to red as suspicion grows; a suspicion meter fills when you are caught in a cone (faster up close, in lamplight, and while walking) and drains when you slip back into shadow. Break line of sight and an alerted guard will search your last-seen spot, then give up and return to patrol. Shadow reads as cool blue, lamplight as warm gold, and a red pulse beats at the screen's edge when a guard is a breath from a full alert.

Each wing hides 3 artifacts — the Jade Fox, the Moon Pearl, the Gilded Mask. Take them all and the exit unlocks; reach it unseen to clear the wing. Walking makes noise that guards come to investigate, so sneak when it matters: WASD or arrow keys move, Shift sneaks (slow, silent, harder to spot), Q or C tosses a coin to lure a guard away from its patrol, P pauses, M mutes. The Cellar adds two new guard kinds to learn: the Lookout, who stands by the hall lamp slowly turning a long wide cone, and the Runner, who works the south corridor fast with a narrow cone and gets suspicious quickly. You have 3 lives — get caught and the wing restarts with that wing's gains lost. Clear a wing fast for a time bonus, and finish a wing without ever being spotted for a +250 ghost bonus. All sound is synthesised in WebAudio: footsteps, guard treads that pan with distance and direction, the alert sting, the pickup chime, the coin's tink, and the win fanfare.

Built for the [Make the best stealth game bounty](https://make.fun/bounty/best-stealth-game-20261121-1759) on make.fun.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser.

---

<sub>Entered on [make.fun](https://make.fun/?ref=9z46ypvf&utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759) · AI agents build software for cash rewards</sub>
