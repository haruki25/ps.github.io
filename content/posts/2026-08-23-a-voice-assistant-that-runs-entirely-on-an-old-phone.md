---
title: "A Voice Assistant That Runs Entirely on an Old Phone"
date: 2026-08-23T18:48:48.717Z
description: Turning a three-year-old Galaxy A73 into an always-on local LLM server and Alexa-style voice assistant. What worked, what Android refused to allow, and what I'd do differently.
tags: [systems, llm, android]
---

There is a Samsung Galaxy A73 on my desk running a language model, a speech 
recogniser, an SSH server and a voice assistant. You say a wake word, it
beeps, you ask it something, and it answers out loud through a Bluetooth
speaker. Nothing leaves the house except the Spotify calls.

The phone was three years old and doing nothing, which is most of the
justification for the project. The rest is that I wanted to know where the
actual difficulty in a voice assistant lives. I assumed it would be the models.
It was not the models.

## The constraints

A Snapdragon 778G, four performance cores, 7.2 GiB of RAM, no usable GPU
compute, and an operating system that considers long-running background
processes to be a bug it should fix. Everything runs under
[Termux](https://termux.dev/), with Ubuntu 24.04 in a PRoot container for the
parts of development that want a normal filesystem.

The design rule was that the phone does all of it i.e. microphone, transcription,
inference, tool execution, speech synthesis, and that it has to survive being
ignored. An appliance you have to nurse is not an appliance.

## Architecture

Seven supervised services, each independently restartable:

<figure class="themed-image">
  <img class="light-only" src="/images/a73/arch_light.svg" alt="arch overview">
  <img class="dark-only" src="/images/a73/arch_dark.svg" alt="arch overview">
  <figcaption>Signal flow from microphone to speaker. Everything inside the
  box runs on the phone.</figcaption>
</figure>

The orchestrator is about 200 lines of Python using nothing but the standard
library. That was not a purity exercise, more on why below.

## The GPU is a dead end

The Adreno 642L is right there, Vulkan finds it, and the open-source Turnip
driver loads cleanly. `vulkaninfo` reports an Adreno 7c+ Gen 3. After patching
shader optimisation, `llama.cpp` built against it.

The output was fluent and wrong, plausible tokens in plausible grammar,
describing nothing. Disabling cooperative matrices changed nothing. It also ran
at 3.5 tokens/sec, which is *slower than the CPU path it was meant to replace*.

OpenCL failed earlier and more honestly. Qualcomm ships an OpenCL 2.0 driver;
the current backend wants `clCreateBufferWithProperties`, which is a 3.0 symbol.

```
Platform Name:  QUALCOMM Snapdragon(TM)
Device Version: OpenCL 2.0 Adreno(TM) 642L
```

So: CPU only, four threads. Three models, measured on the same prompts:

| Model | Quant | Tokens/sec | Notes |
|---|---|---|---|
| SmolLM3 3B | Q4_K_M | 4.6 – 5.4 | Good answers, too slow to use |
| Qwen3 1.7B | Q4_K_M | ~9.4 | Best instruction-following |
| Gemma 3 1B | Q4_0 QAT | 12 – 15 | Weakest, and the one I shipped |

Gemma won because of what the model is actually asked to do. It picks a tool
name from a list and phrases one sentence. Neither task rewards a larger model,
and both punish latency. Qwen stays available on `:8080` for anything harder.

## Supervision, not launching

My first boot script started the SSH server and walked away. It worked
perfectly until the server died on its own several hours later and stayed dead,
while Termux itself carried on, cheerfully alive and serving nothing.

The bug was one flag:

```bash
proot-distro run --detach ubuntu -- ...   # nothing is watching this
```

Termux has no systemd but it has [runit](https://smarden.org/runit/) via
`termux-services`. Each service gets a directory and a `run` script, and the
supervisor restarts anything that exits. The important part is that the process
must stay in the *foreground* so the supervisor is its actual parent:

```sh
#!/data/data/com.termux/files/usr/bin/sh
exec 2>&1
exec proot-distro login ubuntu -- /bin/bash -lc \
  'mkdir -p /run/sshd && ssh-keygen -A && exec /usr/sbin/sshd -D -e'
```

Both `exec` calls matter. Without them you supervise a shell that has already
handed off its work and exited.

Verification is one line, and worth running on everything:

```bash
pkill -9 -f llama-server; sleep 3; sv status llama-gemma
```

If the uptime resets to a few seconds, supervision is real. If not, you have a
launcher wearing a supervisor's clothes.

## Android is not neutral about this

Three separate mechanisms tried to stop the project, and each one failed
silently rather than loudly.

**Phantom process killing.** Android caps how many child processes an app may
own and culls the excess. A supervisor, three loggers, a four-thread model
server and a Linux container reach that cap easily. Disable it over ADB before
building anything on top:

```bash
adb shell settings put global settings_enable_monitor_phantom_procs false
adb shell device_config set_sync_disabled_for_tests persistent
adb shell device_config put activity_manager max_phantom_processes 2147483647
```

**File-based encryption.** `BOOT_COMPLETED` is not delivered until the device
is unlocked once, because app data lives in credential-encrypted storage until
then. No app can start earlier. If you want genuinely unattended boot, the
lock screen has to go.

**Background microphone access.** This one cost the most time. After a reboot
everything came up green and the assistant transcribed forty-six consecutive
seconds of nothing. Permission was granted. The capture device opened. Every
sample was zero:

```
RMS     amplitude:     0.000000
```

An app without a qualifying foreground presence gets *zero-filled buffers*
rather than a denial, so nothing anywhere logs an error. The fix is holding a
wake lock so Termux keeps a foreground service; the lesson is more general.

> Anything that can return silence should be probed for signal, not for an exit
> code.

The pattern that ended up in the service script is a loop that loads the audio
source, records a second, checks the peak amplitude, and retries if it is
exactly zero.

## Gating before routing

This is the part I'd keep if I threw everything else away.

The first orchestrator asked the model, on every input, whether a tool was
needed. Two calls per query: one to route, one to phrase. It called a tool for
a cat joke. It called a tool for the capital of France. It invented arguments
for tools declared as taking none:

```json
{"tool": "get_time", "args": {"time": "10:30 AM"}}
```

Improving the prompt helped less than it should have (partly because Gemma 3
has no system role at all) and folds system messages into the first user turn.

What fixed it was not asking. Each tool declares trigger words, and the model
is consulted only if one appears in the transcript:

<figure class="themed-image">
  <img class="light-only" src="/images/a73/flow_light.svg" alt="decision flow">
  <img class="dark-only" src="/images/a73/flow_dark.svg" alt="decision flow">
  <figcaption>orchestrator decision flow</figcaption>
</figure>

Let $p$ be the fraction of queries containing a trigger word and $q$ the
fraction of those resolving to a single zero-argument tool. Expected model
calls per query drop from a flat $2$ to

$$
\mathbb{E}[\text{calls}] = (1-p)\cdot 1 \;+\; p\,q\cdot 0 \;+\; p(1-q)\cdot 2
$$

For my tool set most commands are unambiguous, so $q$ is high and the common
path [*pause*, *next*, *what's the battery*] costs no inference at all. Those
replies are also deterministic strings, which matters for a reason I'll get to.

The gate is a dozen lines of regex. It outperformed every prompt engineering
attempt I made, and it fails in a direction I can debug.

## Two guardrails worth building before you need them

**The model never gets a shell.** It emits a tool *name*, a separate runner
looks that name up in a registry and validates the arguments. This is not
theoretical hygiene. When I asked about the weather, my assistant confidently 
selected a tool called `get_weather`, which has never existed:

```json
{"gate": ["get_time"], "router_raw": "{\"tool\": \"get_weather\"}",
 "error": "rejected tool: get_weather"}
```

A hallucinated name matches nothing, so the allow-list caught it structurally.

**A small model will fabricate rather than fail.** When that tool was rejected,
the model answered anyway: sunny, 75 degrees. It had no data. It simply
preferred an answer to a gap. Later, given a load average of 1.93, it reported
"a load of 2.01 megabytes", a unit that does not exist for that quantity.

Both fixes are the same shape. If a tool fails, refuse. If the phrasing is
predictable, precompute it and keep the model away from the numbers:

```python
speak = (f"Up {uptime}. Load {load}. {used} of {total} megabytes of RAM in use. "
         f"{disk_free} storage free. {svc_txt}.")
return {"_speak": speak, ...}   # returned verbatim, no inference
```

Spoken aloud by a machine you have decided to trust, a confident fabrication is
considerably worse than an error.

## Speech, and the thirty-second tax

[whisper.cpp](https://github.com/ggerganov/whisper.cpp) builds cleanly on
aarch64 and gets ARM dotprod. The interesting cost is structural: the encoder
processes a fixed 30-second window regardless of how long your clip is. A
six-second command pays for twenty-four seconds of padding.

Halving the audio context recovers most of it:

```bash
whisper-cli -m models/ggml-base.en.bin -f in.wav \
  -nt -t 4 -ac 768 -bs 1 --temperature-inc 0
```

Measured on short commands, with $T_{\text{audio}}$ the clip length:

| Model | Encode/run | 6 s clip, warm | RTF |
|---|---|---|---|
| `tiny.en` | ~0.9 s | 0.79 s | $\approx 0.13$ |
| `base.en` | ~2.2 s | 2.2 s | $\approx 0.37$ |

`tiny.en` is fast and mishears. It gave me *"how is the seller doing"* for *how
is the server doing*, and *"storage soil"* for *storage status*. Amusingly this
mattered less than it should have (accent, pace and other factors affect the outcome 
a lot), the gate matches on keywords, and "storage" survived. Architecture that depends 
only on keywords tolerates a transcriber that only gets keywords right.

The full round trip is the sum you'd expect:

$$
T_{\text{total}} = T_{\text{stt}} + T_{\text{route}} + T_{\text{tool}} + T_{\text{phrase}} + T_{\text{tts}}
$$

with $T_{\text{route}}$ and $T_{\text{phrase}}$ frequently zero because of the
gate. In practice it lands near four seconds, most of it transcription.

### Getting a continuous audio stream

`termux-microphone-record` writes files and cannot stream, and its encoder list
is `aac, amr_wb, amr_nb, opus` i.e. no PCM, so everything needs an ffmpeg pass.
I assumed for a while that continuous listening was therefore impossible
without writing a small android app.

It isn't. PulseAudio has a module that exposes the Android microphone through
OpenSL ES as an ordinary source:

```bash
pactl load-module module-sles-source
```

With that loaded, SDL2 finds a normal capture device, `whisper-stream` runs
with voice-activity detection, and transcription happens only when someone
actually speaks. That single module is the difference between this being a
shell project and an Android project (thank god! I really didn't want to load 
android studio in my college laptop again).

Two things I got wrong on the way. SDL2 is not missing from Termux, it lives
in `x11-repo`, because it's maintained alongside the X11 packages, and I spent
an hour designing around its absence before searching properly. And running
two PulseAudio daemons produces intermittent timeouts rather than an obvious
conflict, because clients bind to whichever socket they find:

```bash
echo "autospawn = no" > ~/.config/pulse/client.conf
```

Intermittent audio bugs are almost always two of something where you assumed
one.

## What Android would not let me build

Timers and alarms should use Android's own alarm manager, so they fire even if
every service I wrote is dead. That means dispatching an intent, and an app UID
is not permitted to:

```
java.lang.SecurityException: Permission Denial:
package=com.android.shell does not belong to uid=10338
```

`termux-am` is meant to route around this through the Termux app itself; on my
build the socket it needs does not exist. So the assistant does everything
except the one function every kitchen timer has performed since 1949. I find
this genuinely funny and have not solved it (probably won't as well).

## Spotify

Playback control is the Web API, which is straightforward, plus two surprises.
The Android Spotify client reports `supports_volume: false`, so volume goes
through Android's own media stream instead. And the API only sees devices that
are currently running, so if we background the app long enough then *pause* starts
reporting that Spotify is unavailable.

The failure mode worth flagging is one I wrote myself. My first implementation
returned a success string whenever the HTTP call didn't raise:

```python
_call(method, path, {"device_id": dev})
return {"_speak": ok_text}          # claims success unconditionally
```

I said "stop the music." It said "Paused." The music kept playing. Reading the
state back afterwards costs one request and removes an entire category of lie.

Searching needed care too. `limit=1` returns whatever ranks first, which for
*hotel california* was a cover by an artist I'd never heard of; sorting ten
results by popularity fixes it. And my genre detector never fired, because it
inspected the query for words like "some", which the model had already
stripped before my code saw it. Make decisions on values you control, not on
text an LLM has normalised.

## What's still broken

- **No timers or alarms.** Blocked at the OS level, as above.
- **Range is mediocre.** Capture gain at 200% takes the signal from 0.006 to
  0.028 RMS at two metres, which helps, but this is one phone microphone
  against a room. Real smart speakers use an array and dedicated echo
  cancellation.
- **It hears itself.** Music through the speaker returns to the microphone. It
  mostly copes.

## In a nutshell

The models were the easy part, which is a strange sentence to write. Gemma 3 1B
at Q4_0 does everything asked of it, and the pipeline that surrounds it was
about a day's work.

Everything else, like process supervision, audio routing, a mobile OS with strong
opinions about what a background app deserves, was the actual project. The
errors that cost the most were the ones that returned success: zero-filled
audio buffers, a fabricated weather report, an API call that reported OK and
did nothing. Loud failures are cheap. Quiet ones are the ones to design
against (I'm saying a lot of bold quotes in this blog).

My old phone had four CPU cores, eight gigabytes of RAM, a microphone, a
speaker, a battery-backed power supply and a Wi-Fi radio. That was a
workstation once. It still is; it has just been told otherwise.

Peak temperature across all of this was 30.4°C. It was never working hard. I
was ><.