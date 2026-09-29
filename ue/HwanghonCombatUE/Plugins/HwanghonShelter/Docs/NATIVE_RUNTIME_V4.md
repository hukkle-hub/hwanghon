# Native runtime decision

Production game entry point:

```text
Unreal packaged client
→ Loading map
→ Character select map
→ HTTPS matchmaker
→ Unreal UDP Dedicated Server
```

Do not route players through:
- game3d.html
- Three.js main game loop
- WebView-hosted combat

Old HTML files can remain in a `/Tools` or separate web deployment for:
- animation QA
- asset comparisons
- internal debug
- operations panels
