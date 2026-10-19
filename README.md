# RPCCord

Custom **Rich Presence** for **Kettu** (Discord iOS/Android mod).

Shows a custom "Playing / Listening / Watching / Streaming / Competing" activity on your profile — same idea as Vencord CustomRPC, but built for mobile using Discord’s `LOCAL_ACTIVITY_UPDATE` API (works inside the modded client; no PC required).

## Install (Kettu)

Plugins → **+** → paste:

```
https://cdn.jsdelivr.net/gh/unemployedz/rpccord@main/dist/
```

Enable **RPCCord**, open its **settings**, fill fields, tap **Apply presence**.

## Features

- Activity types: Playing, Streaming, Listening, Watching, Competing
- Name, details, state, party size, elapsed timer
- Optional Application ID + image asset keys (from [Discord Developer Portal](https://discord.com/developers/applications))
- Quick game-style presets
- Clear presence on demand / on plugin unload

## Limits (honest)

| What works | What does not |
|------------|----------------|
| Custom "Playing X" others see on your profile | Auto-detecting real games running on the phone |
| Using your own Developer Portal app + assets | Full official Xbox/PlayStation/Spotify *account linking* UI |
| iOS + Android with Kettu | Desktop-only IPC / Discord Game SDK |

Linked game accounts (Xbox, etc.) are controlled by Discord’s own connections — this plugin **spoofs activity text/assets** the same way other mobile RPC plugins do, which is what most people want for "custom RPC".

## Privacy

Does not collect tokens beyond what Discord already has in the client. Only dispatches a local activity update.

## License

MIT
