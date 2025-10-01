/**
 * Script to verify the existence and accessibility of subreddits
 * This script checks each subreddit in our constants to ensure they exist
 */

import { INDIAN_NSFW_SUBREDDIT_NAMES } from '../constants/subreddits';

interface SubredditStatus {
  name: string;
  exists: boolean;
  accessible: boolean;
  isPrivate: boolean;
  isQuarantined: boolean;
  isBanned: boolean;
  subscribers?: number;
  over18?: boolean;
  error?: string;
  url: string;
}

/**
 * Verify a single subreddit using Reddit's public API
 */
async function verifySubreddit(subredditName: string): Promise<SubredditStatus> {
  const url = `https://www.reddit.com/r/${subredditName}/about.json`;
  
  const status: SubredditStatus = {
    name: subredditName,
    exists: false,
    accessible: false,
    isPrivate: false,
    isQuarantined: false,
    isBanned: false,
    url: `https://www.reddit.com/r/${subredditName}`
  };

  try {
    console.log(`Checking r/${subredditName}...`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'SubredditVerifier/1.0'
      }
    });

    if (response.status === 200) {
      const data = await response.json();
      
      if (data.data && !data.error) {
        status.exists = true;
        status.accessible = true;
        status.subscribers = data.data.subscribers;
        status.over18 = data.data.over18;
        status.isQuarantined = data.data.quarantine || false;
        
        console.log(`✅ r/${subredditName} - ${status.subscribers} subscribers`);
      } else {
        status.error = data.error || 'Unknown error';
        console.log(`❌ r/${subredditName} - Error: ${status.error}`);
      }
    } else if (response.status === 403) {
      status.exists = true;
      status.isPrivate = true;
      status.error = 'Private subreddit';
      console.log(`🔒 r/${subredditName} - Private`);
    } else if (response.status === 404) {
      status.error = 'Subreddit not found';
      console.log(`❌ r/${subredditName} - Not found`);
    } else if (response.status === 451) {
      status.exists = true;
      status.isBanned = true;
      status.error = 'Subreddit banned/unavailable';
      console.log(`🚫 r/${subredditName} - Banned/Unavailable`);
    } else {
      status.error = `HTTP ${response.status}`;
      console.log(`⚠️ r/${subredditName} - HTTP ${response.status}`);
    }
  } catch (error) {
    status.error = error instanceof Error ? error.message : 'Network error';
    console.log(`🔥 r/${subredditName} - Network error: ${status.error}`);
  }

  return status;
}

/**
 * Verify all subreddits with rate limiting
 */
async function verifyAllSubreddits(): Promise<SubredditStatus[]> {
  const results: SubredditStatus[] = [];
  
  console.log(`🔍 Verifying ${INDIAN_NSFW_SUBREDDIT_NAMES.length} subreddits...\n`);
  
  for (let i = 0; i < INDIAN_NSFW_SUBREDDIT_NAMES.length; i++) {
    const subreddit = INDIAN_NSFW_SUBREDDIT_NAMES[i];
    const result = await verifySubreddit(subreddit);
    results.push(result);
    
    // Rate limiting - wait 1 second between requests to be respectful
    if (i < INDIAN_NSFW_SUBREDDIT_NAMES.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}

/**
 * Generate a summary report
 */
function generateReport(results: SubredditStatus[]): void {
  const existing = results.filter(r => r.exists);
  const accessible = results.filter(r => r.accessible);
  const private_subs = results.filter(r => r.isPrivate);
  const quarantined = results.filter(r => r.isQuarantined);
  const banned = results.filter(r => r.isBanned);
  const notFound = results.filter(r => !r.exists && !r.isPrivate && !r.isBanned);

  console.log('\n📊 VERIFICATION REPORT');
  console.log('='.repeat(50));
  console.log(`Total subreddits checked: ${results.length}`);
  console.log(`✅ Existing & accessible: ${accessible.length}`);
  console.log(`🔒 Private: ${private_subs.length}`);
  console.log(`⚠️ Quarantined: ${quarantined.length}`);
  console.log(`🚫 Banned/Unavailable: ${banned.length}`);
  console.log(`❌ Not found: ${notFound.length}`);
  
  if (accessible.length > 0) {
    console.log('\n✅ ACCESSIBLE SUBREDDITS:');
    accessible.forEach(sub => {
      console.log(`  • r/${sub.name} - ${sub.subscribers?.toLocaleString()} subscribers`);
    });
  }
  
  if (private_subs.length > 0) {
    console.log('\n🔒 PRIVATE SUBREDDITS:');
    private_subs.forEach(sub => {
      console.log(`  • r/${sub.name}`);
    });
  }
  
  if (quarantined.length > 0) {
    console.log('\n⚠️ QUARANTINED SUBREDDITS:');
    quarantined.forEach(sub => {
      console.log(`  • r/${sub.name}`);
    });
  }
  
  if (banned.length > 0) {
    console.log('\n🚫 BANNED/UNAVAILABLE SUBREDDITS:');
    banned.forEach(sub => {
      console.log(`  • r/${sub.name}`);
    });
  }
  
  if (notFound.length > 0) {
    console.log('\n❌ NOT FOUND SUBREDDITS:');
    notFound.forEach(sub => {
      console.log(`  • r/${sub.name}`);
    });
  }
  
  console.log('\n💡 RECOMMENDATIONS:');
  if (notFound.length > 0) {
    console.log('  • Remove non-existent subreddits from your list');
  }
  if (banned.length > 0) {
    console.log('  • Remove banned subreddits from your list');
  }
  if (private_subs.length > 0) {
    console.log('  • Private subreddits may require approval to post');
  }
  if (quarantined.length > 0) {
    console.log('  • Quarantined subreddits have posting restrictions');
  }
}

/**
 * Save results to JSON file
 */
function saveResults(results: SubredditStatus[]): void {
  const fs = require('fs');
  const path = require('path');
  
  const outputPath = path.join(__dirname, '../verification-results.json');
  const reportData = {
    timestamp: new Date().toISOString(),
    total: results.length,
    summary: {
      accessible: results.filter(r => r.accessible).length,
      private: results.filter(r => r.isPrivate).length,
      quarantined: results.filter(r => r.isQuarantined).length,
      banned: results.filter(r => r.isBanned).length,
      notFound: results.filter(r => !r.exists && !r.isPrivate && !r.isBanned).length
    },
    results
  };
  
  fs.writeFileSync(outputPath, JSON.stringify(reportData, null, 2));
  console.log(`\n💾 Results saved to: ${outputPath}`);
}

/**
 * Main execution function
 */
async function main() {
  try {
    const results = await verifyAllSubreddits();
    generateReport(results);
    saveResults(results);
    
    console.log('\n🎉 Verification complete!');
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  }
}

// Export for use in other files
export { verifySubreddit, verifyAllSubreddits, type SubredditStatus };

// Run if called directly
if (require.main === module) {
  main();
}
