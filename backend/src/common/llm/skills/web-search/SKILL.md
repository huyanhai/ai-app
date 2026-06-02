---
name: web-search
description: Use DuckDuckGo for fast, low-cost web search when the task needs result discovery, basic fact finding, or a set of links and snippets.
allowed-tools:
  - read_file
  - write_file
  - bash
module: script/index.js
---

# Web Search

This skill performs web search through DuckDuckGo HTML search results.

Use this skill first when:

- The user needs general web discovery.
- A few result links and snippets are enough.
- The target page does not require JavaScript rendering, login, scrolling, or interaction.
- You want the cheapest and fastest search path.

This is the only search skill available. If search returns no useful results,
inform the user and suggest alternative approaches.

## Script

Entrypoint:

`/Users/yhh/Documents/study/ai/app/backend/src/common/llm/skills/web-search/script/index.js`

The script accepts either:

- A JSON string as the first CLI argument
- JSON from stdin

Input shape:

```json
{
  "query": "OpenAI latest API docs",
  "maxResults": 5,
  "region": "wt-wt",
  "safeSearch": "moderate"
}
```

Output shape:

```json
{
  "query": "OpenAI latest API docs",
  "engine": "duckduckgo",
  "results": [
    {
      "title": "OpenAI API Platform",
      "url": "https://platform.openai.com/docs/overview",
      "snippet": "..."
    }
  ]
}
```

## Execution

Example:

```bash
node /Users/yhh/Documents/study/ai/app/backend/src/common/llm/skills/web-search/script/index.js '{"query":"OpenAI latest API docs","maxResults":5}'
```

## Working Style

1. Use this skill when the task requires web information.
2. Inspect returned titles, URLs, and snippets.
3. If the result set is clearly enough, answer from those results or continue by opening the returned URLs with normal tooling.
