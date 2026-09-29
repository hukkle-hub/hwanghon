# CCU / load test v4

The 24-player shelter value is a **target**, not a measured guarantee.

## Gate 1 — one shelter

Bots:
- 8
- 16
- 24
- 32
- 48 (failure-characterization only)

Record:
- server game-thread ms
- server tick rate
- outbound bandwidth/player
- inbound bandwidth/player
- process RAM
- CPU core utilization
- replication actor count
- packet loss / RTT
- join/leave spike
- NPC interaction latency
- party invite latency

Pass target at 24:
- 30 Hz server tick stable
- p95 server frame < 33.3 ms
- no sustained packet loss from server saturation
- interaction/party commands < 150 ms server-side processing excluding internet RTT
- no runaway memory growth over 60 minutes

## Gate 2 — dungeon

Run simultaneous:
- 1 player
- 2 players
- 4 players

Then multiple dungeon processes on one host until CPU/RAM limit is found.

## Gate 3 — mixed service

Example:
- 10 shelter instances × 24 = 240 shelter players
- 60 dungeon instances × 4 = 240 dungeon players
- total simulated 480 CCU

Scale horizontally after per-host safe process counts are measured.
