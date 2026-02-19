/**
 * Resilient subreddit verification script with caching, incremental saves,
 * request timeouts, and resume-on-restart support.
 *
 * Usage:
 *   node verify-subreddits.js [options]
 *
 * Options:
 *   --force          Ignore cache, re-fetch every subreddit
 *   --ttl <hours>    Cache TTL in hours (default: 24)
 *   --timeout <ms>   Per-request timeout in milliseconds (default: 10000)
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Configuration defaults
// ---------------------------------------------------------------------------
const CACHE_FILE = path.join(__dirname, 'verification-results.json');
const DEFAULT_TTL_HOURS = 24;
const DEFAULT_TIMEOUT_MS = 10_000;
const RATE_LIMIT_MS = 1000;

// ---------------------------------------------------------------------------
// CLI argument parsing (zero dependencies)
// ---------------------------------------------------------------------------
const parseArgs = () => {
  const args = process.argv.slice(2);
  const config = {
    force: false,
    ttlHours: DEFAULT_TTL_HOURS,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--force') {
      config.force = true;
    } else if (args[i] === '--ttl' && args[i + 1]) {
      const parsed = Number(args[i + 1]);
      if (!Number.isNaN(parsed) && parsed > 0) {
        config.ttlHours = parsed;
      }
      i++;
    } else if (args[i] === '--timeout' && args[i + 1]) {
      const parsed = Number(args[i + 1]);
      if (!Number.isNaN(parsed) && parsed > 0) {
        config.timeoutMs = parsed;
      }
      i++;
    }
  }

  return config;
};

const CONFIG = parseArgs();

// ---------------------------------------------------------------------------
// Subreddit list
// ---------------------------------------------------------------------------
const SUBREDDITS = [
  'indiansgetlaid',
  'DesiNSFWSubs',
  'Bangaloresluts',
  'DesiStree',
  'DesiSlutGW',
  'DesiGW',
  'KeralaGW',
  'KeralaFantasy',
  'Bangalorecouples',
  'DelhiGone_Wild',
  'KochiNSFW',
  'Malayali_GoneWild',
  'IndianHornypeople',
  'mumbaiGWild',
  'BengalisGoneWild',
  'desiSlimnStacked',
  'TamilGW',
  'PuneGW',
  'BangaloreGWild',
  'DesiWhoreWife',
  'DesiExhibitionistGW',
  'ExhibitionistHotWife',
  'Exhibitionistfun',
  'hotwifeindia',
  'BlouselessSaree',
];

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

/** Load the existing cache file. Returns a safe default if missing/corrupt. */
const loadCache = () => {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (data && Array.isArray(data.results)) {
        return data;
      }
    }
  } catch {
    console.log('⚠️  Cache file is corrupt or unreadable — starting fresh.');
  }

  return {
    timestamp: null,
    total: 0,
    summary: { accessible: 0, private: 0, quarantined: 0, banned: 0, notFound: 0 },
    validSubreddits: [],
    results: [],
  };
};

/** Check whether a cached result is still fresh (within the configured TTL). */
const isFresh = (result) => {
  if (!result || !result.fetchedAt) return false;
  const ageMs = Date.now() - new Date(result.fetchedAt).getTime();
  const ttlMs = CONFIG.ttlHours * 60 * 60 * 1000;
  return ageMs < ttlMs;
};

/** Write the full cache object to disk (atomic-ish: write tmp then rename). */
const writeCache = (cacheData) => {
  const tmpFile = `${CACHE_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(cacheData, null, 2));
  fs.renameSync(tmpFile, CACHE_FILE);
};

/**
 * Persist a single result into the cache file immediately.
 * Reads the current file, merges/overwrites the entry, and writes back.
 */
const saveResultIncremental = (result) => {
  const cache = loadCache();
  const idx = cache.results.findIndex((r) => r.name === result.name);

  if (idx >= 0) {
    cache.results[idx] = result;
  } else {
    cache.results.push(result);
  }

  cache.timestamp = new Date().toISOString();
  cache.total = cache.results.length;
  cache.summary = buildSummary(cache.results);
  cache.validSubreddits = cache.results.filter((r) => r.accessible).map((r) => r.name);

  writeCache(cache);
};

/** Build the summary object from a results array. */
const buildSummary = (results) => ({
  accessible: results.filter((r) => r.accessible).length,
  private: results.filter((r) => r.isPrivate).length,
  quarantined: results.filter((r) => r.isQuarantined).length,
  banned: results.filter((r) => r.isBanned).length,
  notFound: results.filter((r) => !r.exists && !r.isPrivate && !r.isBanned).length,
});

// ---------------------------------------------------------------------------
// HTTP fetch with timeout
// ---------------------------------------------------------------------------

/** Fetch subreddit info from Reddit with a configurable timeout. */
const checkSubreddit = (subredditName) => {
  return new Promise((resolve) => {
    const errorResult = {
      name: subredditName,
      exists: false,
      accessible: false,
      isPrivate: false,
      isQuarantined: false,
      isBanned: false,
      subscribers: null,
      over18: null,
      error: null,
      url: `https://www.reddit.com/r/${subredditName}`,
      statusCode: null,
      fetchedAt: new Date().toISOString(),
    };

    const options = {
      hostname: 'www.reddit.com',
      path: `/r/${subredditName}/about.json`,
      method: 'GET',
      headers: { 'User-Agent': 'SubredditVerifier/2.0' },
    };

    let settled = false;

    const settle = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const result = {
          ...errorResult,
          statusCode: res.statusCode,
          fetchedAt: new Date().toISOString(),
        };

        try {
          if (res.statusCode === 200) {
            const jsonData = JSON.parse(data);

            if (jsonData.data && !jsonData.error) {
              result.exists = true;
              result.accessible = true;
              result.subscribers = jsonData.data.subscribers;
              result.over18 = jsonData.data.over18;
              result.isQuarantined = jsonData.data.quarantine || false;
              console.log(`  ✅ r/${subredditName} - ${result.subscribers?.toLocaleString()} subscribers`);
            } else {
              result.error = jsonData.error || 'Unknown error';
              console.log(`  ❌ r/${subredditName} - Error: ${result.error}`);
            }
          } else if (res.statusCode === 403) {
            result.exists = true;
            result.isPrivate = true;
            result.error = 'Private subreddit';
            console.log(`  🔒 r/${subredditName} - Private`);
          } else if (res.statusCode === 404) {
            result.error = 'Subreddit not found';
            console.log(`  ❌ r/${subredditName} - Not found`);
          } else if (res.statusCode === 451) {
            result.exists = true;
            result.isBanned = true;
            result.error = 'Subreddit banned/unavailable';
            console.log(`  🚫 r/${subredditName} - Banned/Unavailable`);
          } else {
            result.error = `HTTP ${res.statusCode}`;
            console.log(`  ⚠️  r/${subredditName} - HTTP ${res.statusCode}`);
          }
        } catch {
          result.error = 'Failed to parse response';
          console.log(`  🔥 r/${subredditName} - Parse error`);
        }

        settle(result);
      });
    });

    req.on('error', (error) => {
      if (settled) return;
      console.log(`  🔥 r/${subredditName} - Network error: ${error.message}`);
      settle({ ...errorResult, error: error.message });
    });

    // Timeout guard — prevents a single hung request from blocking everything
    const timer = setTimeout(() => {
      if (settled) return;
      console.log(`  ⏱️  r/${subredditName} - Request timed out (${CONFIG.timeoutMs}ms)`);
      req.destroy();
      settle({ ...errorResult, error: `Request timed out after ${CONFIG.timeoutMs}ms` });
    }, CONFIG.timeoutMs);

    req.end();
  });
};

// ---------------------------------------------------------------------------
// Main verification loop (cache-aware, incremental save)
// ---------------------------------------------------------------------------

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function verifyAllSubreddits() {
  const cache = loadCache();
  const results = [];
  let fetchedCount = 0;
  let cachedCount = 0;

  console.log(`🔍 Verifying ${SUBREDDITS.length} subreddits...`);

  if (CONFIG.force) {
    console.log('   --force flag set: ignoring cache, re-fetching all.\n');
  } else {
    console.log(`   Cache TTL: ${CONFIG.ttlHours}h | Timeout: ${CONFIG.timeoutMs}ms\n`);
  }

  for (let i = 0; i < SUBREDDITS.length; i++) {
    const subreddit = SUBREDDITS[i];
    const existing = cache.results.find((r) => r.name === subreddit);

    // Use cache if available and fresh (unless --force)
    if (!CONFIG.force && existing && isFresh(existing)) {
      const age = Math.round((Date.now() - new Date(existing.fetchedAt).getTime()) / 60_000);
      console.log(`  📦 r/${subreddit} — cached (${age}m ago)`);
      results.push(existing);
      cachedCount++;
      continue;
    }

    // Fetch from Reddit
    const result = await checkSubreddit(subreddit);
    results.push(result);
    fetchedCount++;

    // Save immediately after each fetch
    saveResultIncremental(result);

    // Rate limiting between Reddit requests
    if (i < SUBREDDITS.length - 1) {
      await delay(RATE_LIMIT_MS);
    }
  }

  console.log(`\n📊 Fetch summary: ${fetchedCount} fetched, ${cachedCount} from cache`);

  return results;
}

// ---------------------------------------------------------------------------
// Report generation (unchanged logic)
// ---------------------------------------------------------------------------

const generateReport = (results) => {
  const accessible = results.filter((r) => r.accessible);
  const privateSubs = results.filter((r) => r.isPrivate);
  const quarantined = results.filter((r) => r.isQuarantined);
  const banned = results.filter((r) => r.isBanned);
  const notFound = results.filter((r) => !r.exists && !r.isPrivate && !r.isBanned);

  console.log('\n📊 VERIFICATION REPORT');
  console.log('='.repeat(50));
  console.log(`Total subreddits checked: ${results.length}`);
  console.log(`✅ Existing & accessible: ${accessible.length}`);
  console.log(`🔒 Private: ${privateSubs.length}`);
  console.log(`⚠️  Quarantined: ${quarantined.length}`);
  console.log(`🚫 Banned/Unavailable: ${banned.length}`);
  console.log(`❌ Not found: ${notFound.length}`);

  if (accessible.length > 0) {
    console.log('\n✅ ACCESSIBLE SUBREDDITS:');
    accessible.forEach((sub) => {
      console.log(`  • r/${sub.name} - ${sub.subscribers?.toLocaleString()} subscribers`);
    });
  }

  if (privateSubs.length > 0) {
    console.log('\n🔒 PRIVATE SUBREDDITS:');
    privateSubs.forEach((sub) => {
      console.log(`  • r/${sub.name}`);
    });
  }

  if (quarantined.length > 0) {
    console.log('\n⚠️  QUARANTINED SUBREDDITS:');
    quarantined.forEach((sub) => {
      console.log(`  • r/${sub.name}`);
    });
  }

  if (banned.length > 0) {
    console.log('\n🚫 BANNED/UNAVAILABLE SUBREDDITS:');
    banned.forEach((sub) => {
      console.log(`  • r/${sub.name}`);
    });
  }

  if (notFound.length > 0) {
    console.log('\n❌ NOT FOUND SUBREDDITS:');
    notFound.forEach((sub) => {
      console.log(`  • r/${sub.name}`);
    });
  }

  const validSubreddits = results.filter((r) => r.accessible).map((r) => r.name);

  console.log('\n💡 RECOMMENDATIONS:');
  if (notFound.length > 0) {
    console.log('  • Remove non-existent subreddits from your list');
  }
  if (banned.length > 0) {
    console.log('  • Remove banned subreddits from your list');
  }
  if (privateSubs.length > 0) {
    console.log('  • Private subreddits may require approval to post');
  }
  if (quarantined.length > 0) {
    console.log('  • Quarantined subreddits have posting restrictions');
  }

  console.log(`\n📝 VALID SUBREDDITS FOR POSTING (${validSubreddits.length}):`);
  console.log(JSON.stringify(validSubreddits, null, 2));

  return { results, validSubreddits };
};

// ---------------------------------------------------------------------------
// Final save (writes the complete report with summary)
// ---------------------------------------------------------------------------

const saveFinalResults = (data) => {
  const reportData = {
    timestamp: new Date().toISOString(),
    total: data.results.length,
    summary: buildSummary(data.results),
    validSubreddits: data.validSubreddits,
    results: data.results,
  };

  writeCache(reportData);
  console.log(`\n💾 Results saved to: ${CACHE_FILE}`);
};

// ---------------------------------------------------------------------------
// Graceful shutdown handler
// ---------------------------------------------------------------------------

let shutdownRequested = false;

const handleShutdown = (signal) => {
  if (shutdownRequested) return;
  shutdownRequested = true;
  console.log(`\n\n⛔ Received ${signal} — shutting down gracefully.`);
  console.log('   All fetched results have already been saved incrementally.');
  console.log(`   Re-run the script to resume from where it left off.\n`);
  process.exit(0);
};

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

// ---------------------------------------------------------------------------
// Main execution
// ---------------------------------------------------------------------------

async function main() {
  try {
    const results = await verifyAllSubreddits();
    const reportData = generateReport(results);
    saveFinalResults(reportData);

    console.log('\n🎉 Verification complete!');
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  }
}

main();
