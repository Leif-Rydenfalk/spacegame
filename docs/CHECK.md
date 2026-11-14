# CHECK

Run: 2026-11-14T08:19:10.505Z by `node tools/check.mjs` on foreman-ops-1 (arm64, Node v18.20.4).
Browser: /usr/bin/chromium headless, software GL (`--use-angle=swiftshader`). **Frame times below are software-rendering numbers, not a GPU number**; the 16.7 ms budget must be measured on a machine with a GPU.

Result: **PASS**. Property tests: `tests ok 10`.

| scenario | url | shot | console errors | p50 ms | p95 ms | max ms |
|---|---|---|---|---|---|---|
| surface | `?act=surface` | [docs/shots/surface.png](shots/surface.png) | 0 | 450 | 683 | 683 |
| factory | `?act=surface&scenario=factory&t=30` | [docs/shots/factory.png](shots/factory.png) | 0 | 583 | 717 | 717 |
| launch | `?act=space&scenario=launch` | [docs/shots/launch.png](shots/launch.png) | 0 | 400 | 600 | 600 |
| orbit | `?act=space` | [docs/shots/orbit.png](shots/orbit.png) | 0 | 333 | 817 | 817 |
| mining | `?act=space&scenario=mining&auto=1&t=20` | [docs/shots/mining.png](shots/mining.png) | 0 | 333 | 833 | 833 |
| combat | `?act=space&scenario=combat&auto=1&t=13` | [docs/shots/combat.png](shots/combat.png) | 0 | 250 | 550 | 550 |
| builder | `?act=space&scenario=builder` | [docs/shots/builder.png](shots/builder.png) | 0 | 250 | 683 | 683 |
