# v5 검증 순서

## A. 2-client full loop
1. Matchmaker start.
2. Shelter DS :7777.
3. Dungeon DS :7780.
4. Client A → Ain.
5. Client B → Kain.
6. Both land in same shelter.
7. Verify each sees the other's movement.
8. A creates party.
9. A looks at B and invites.
10. B accepts.
11. B presses R; A is ready by default.
12. Both physically enter shutter staging volume.
13. Leader presses G.
14. Verify gate enters Allocating → Opening → Open.
15. Both travel to same dungeon.
16. Reuse one dungeon ticket manually; it must fail.
17. Leader presses H for dev completion.
18. Both receive return tickets.
19. Both return to same shelter.
20. Party id/leader are restored.

## B. negative tests
- G outside shutter volume → denied.
- one member not ready → denied.
- one member outside gate → denied.
- expired shelter ticket → kick.
- reused shelter ticket → kick.
- wrong dungeon instance → kick.
- reused dungeon ticket → kick.

## C. performance gates
After functional loop works:
- 8 shelter bots
- 16
- 24
- 32 stress
Then mixed shelter + dungeon processes.
