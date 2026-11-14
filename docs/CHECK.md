# CHECK

Run: 2026-11-14T10:03:16.738Z by `node tools/check.mjs` on foreman-ops-1 (arm64, Node v18.20.4).
Browser: /usr/bin/chromium headless, software GL (`--use-angle=swiftshader`). **Frame times below are software-rendering numbers, not a GPU number**; the 16.7 ms budget must be measured on a machine with a GPU.

Result: **PASS**. Property tests: `tests ok 31`.

Save round-trip (save, reload the page, compare the state hash):
- surface: explicit save 705440b2, stored blob 705440b2, state after reload 705440b2: identical
- space: explicit save 610bb271, stored blob 610bb271, state after reload 610bb271: identical

| scenario | url | shot | console errors | p50 ms | p95 ms | max ms |
|---|---|---|---|---|---|---|
| title | `` | [docs/shots/title.png](shots/title.png) | 0 | 700 | 700 | 700 |
| surface | `?act=surface` | [docs/shots/surface.png](shots/surface.png) | 0 | 1450 | 1450 | 1450 |
| forest | `?act=surface&scenario=forest` | [docs/shots/forest.png](shots/forest.png) | 0 | 600 | 1317 | 1317 |
| drill | `?act=surface&scenario=drill&auto=1&t=3` | [docs/shots/drill.png](shots/drill.png) | 0 | 700 | 833 | 833 |
| inventory | `?act=surface&scenario=inventory` | [docs/shots/inventory.png](shots/inventory.png) | 0 | 767 | 817 | 817 |
| factory | `?act=surface&scenario=factory&t=30` | [docs/shots/factory.png](shots/factory.png) | 0 | 900 | 900 | 900 |
| blueprint | `?act=surface&scenario=blueprint&t=3.5` | [docs/shots/blueprint.png](shots/blueprint.png) | 0 | 1083 | 1083 | 1083 |
| combat | `?act=surface&scenario=combat&auto=1&t=2.5` | [docs/shots/combat.png](shots/combat.png) | 0 | 1533 | 1533 | 1533 |
| ruins | `?act=surface&scenario=ruins` | [docs/shots/ruins.png](shots/ruins.png) | 0 | 1817 | 1817 | 1817 |
| base | `?act=surface&scenario=base` | [docs/shots/base.png](shots/base.png) | 0 | 1550 | 1550 | 1550 |
| hive | `?act=surface&scenario=hive&t=6` | [docs/shots/hive.png](shots/hive.png) | 0 | - | - | - |
| launch | `?act=space&scenario=launch` | [docs/shots/launch.png](shots/launch.png) | 0 | - | - | - |
| orbit | `?act=space` | [docs/shots/orbit.png](shots/orbit.png) | 0 | 983 | 1000 | 1000 |
| mining | `?act=space&scenario=mining&auto=1&t=20` | [docs/shots/mining.png](shots/mining.png) | 0 | 717 | 983 | 983 |
| combat-space | `?act=space&scenario=combat&auto=1&t=13` | [docs/shots/combat-space.png](shots/combat-space.png) | 0 | 533 | 933 | 933 |
| builder | `?act=space&scenario=builder` | [docs/shots/builder.png](shots/builder.png) | 0 | 333 | 983 | 983 |
