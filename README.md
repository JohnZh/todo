# todo

A TypeScript todo project, worked by [afkconvoy](https://github.com/sunfmin/homebrew-tap).

- `./gate.sh` — install, typecheck and test, then build and test the Mac app; the gate every change must pass.
- `mac/` — a trial SwiftUI Mac app that shows the list from the server. Start the server with `npm start`, then `swift run` in `mac/`. Set `TODO_SERVER_URL` to use an address other than `http://127.0.0.1:3000`.
- `docs/agents/afkconvoy.md` — the fleet's config.
