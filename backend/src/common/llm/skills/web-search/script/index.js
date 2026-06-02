const DEFAULT_MAX_RESULTS = 5;
const DEFAULT_REGION = 'wt-wt';
const DEFAULT_SAFE_SEARCH = 'moderate';

function normalizeWhitespace(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtml(value) {
  return String(value ?? '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x2F;/g, '/');
}

function stripTags(value) {
  return normalizeWhitespace(decodeHtml(String(value ?? '').replace(/<[^>]+>/g, ' ')));
}

function resolveDuckDuckGoUrl(rawUrl) {
  const decoded = decodeHtml(String(rawUrl ?? ''));

  if (!decoded) {
    return '';
  }

  try {
    const absolute = decoded.startsWith('//') ? `https:${decoded}` : decoded;
    const url = new URL(absolute);

    if (
      (url.hostname === 'duckduckgo.com' || url.hostname.endsWith('.duckduckgo.com')) &&
      url.pathname.startsWith('/l/')
    ) {
      const target = url.searchParams.get('uddg');
      return target ? decodeURIComponent(target) : absolute;
    }

    return absolute;
  } catch {
    return decoded;
  }
}

function extractResults(html, maxResults) {
  const results = [];
  const pattern =
    /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>|<div[^>]*class="[^"]*result__snippet[^"]*"[^>]*>)([\s\S]*?)(?:<\/a>|<\/div>)/g;

  let match;
  while ((match = pattern.exec(html)) !== null && results.length < maxResults) {
    const url = resolveDuckDuckGoUrl(match[1]);
    const title = stripTags(match[2]);
    const snippet = stripTags(match[3]);

    if (!url || !title) {
      continue;
    }

    results.push({ title, url, snippet });
  }

  return results;
}

async function readInput() {
  if (process.argv[2]) {
    return process.argv[2];
  }

  if (process.stdin.isTTY) {
    return '';
  }

  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function parseInput(raw) {
  if (!raw) {
    throw new Error('Missing search input. Provide JSON via argv[2] or stdin.');
  }

  const parsed = JSON.parse(raw);
  const query = normalizeWhitespace(parsed.query);

  if (!query) {
    throw new Error('`query` is required.');
  }

  return {
    query,
    maxResults: Math.max(1, Math.min(Number(parsed.maxResults) || DEFAULT_MAX_RESULTS, 10)),
    region: normalizeWhitespace(parsed.region) || DEFAULT_REGION,
    safeSearch: normalizeWhitespace(parsed.safeSearch) || DEFAULT_SAFE_SEARCH,
  };
}

async function searchDuckDuckGo(options) {
  const params = new URLSearchParams({
    q: options.query,
    kl: options.region,
    kp: options.safeSearch === 'off' ? '-2' : options.safeSearch === 'strict' ? '1' : '-1',
  });

  const response = await fetch(`https://html.duckduckgo.com/html/?${params.toString()}`, {
    method: 'GET',
    headers: {
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      accept: 'text/html,application/xhtml+xml',
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`DuckDuckGo request failed with status ${response.status}.`);
  }

  const html = await response.text();
  const results = extractResults(html, options.maxResults);

  return {
    query: options.query,
    engine: 'duckduckgo',
    region: options.region,
    safeSearch: options.safeSearch,
    results,
  };
}

async function main() {
  try {
    const raw = await readInput();
    const options = parseInput(raw);
    const result = await searchDuckDuckGo(options);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify({ error: error instanceof Error ? error.message : String(error) })}\n`,
    );
    process.exitCode = 1;
  }
}

module.exports = {
  searchDuckDuckGo,
  extractResults,
  parseInput,
  resolveDuckDuckGoUrl,
};

if (require.main === module) {
  void main();
}
