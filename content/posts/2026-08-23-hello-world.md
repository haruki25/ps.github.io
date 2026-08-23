---
title: "Hello World"
date: 2026-08-23T10:00:00.000Z
tags: [Meta]
description: "Why this site runs on a static site generator I wrote myself rather than Hexo or Astro."
---

This site runs on a static site generator I wrote myself, which is a faintly
absurd thing to do in 2026.

Hexo would have been the fastest route to something that looks like this. But
what you end up maintaining is a config file and a pile of templates, and there
is nowhere for your own abstractions to live. Astro is the sensible default, and
if I needed a real feature surface I would have taken it. I didn't.

What I needed was five page types, one kind of content, and no interactivity -
about seven hundred lines of TypeScript. "Don't reinvent the wheel" is good
advice when the wheel is large. This one is small enough that owning it costs
less than depending on someone else's.

Four dependencies. Math and syntax highlighting are resolved at build time, so
the only JavaScript that reaches you is the theme toggle in the corner.
