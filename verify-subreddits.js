/**
 * Simple Node.js script to verify subreddit existence
 * Run with: node verify-subreddits.js
 */

const https = require('https');
const fs = require('fs');

// List of subreddits to verify (updated with corrected names)
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
  'KochiNSFW', - 
  'Malayali_GoneWild',
  'IndianHornypeople',
  'mumbaiGWild',
  'BengalisGoneWild',
  'desiSlimnStacked',
  'TamilGW',
  'PuneGW',
  'BangaloreGWild', -
  'DesiWhoreWife',
  'DesiExhibitionistGW', -
  'ExhibitionistHotWife', -
  'Exhibitionistfun', -
  'hotwifeindia', - 
  'BlouselessSaree'
];

/**
 * Check if a subreddit exists
 */
function checkSubreddit(subredditName) {
  return new Promise((resolve) => {
    const url = `https://www.reddit.com/r/${subredditName}/about.json`;
    
    const options = {
      hostname: 'www.reddit.com',
      path: `/r/${subredditName}/about.json`,
      method: 'GET',
      headers: {
        'User-Agent': 'SubredditVerifier/1.0'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const result = {
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
          statusCode: res.statusCode
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
              console.log(`✅ r/${subredditName} - ${result.subscribers?.toLocaleString()} subscribers`);
            } else {
              result.error = jsonData.error || 'Unknown error';
              console.log(`❌ r/${subredditName} - Error: ${result.error}`);
            }
          } else if (res.statusCode === 403) {
            result.exists = true;
            result.isPrivate = true;
            result.error = 'Private subreddit';
            console.log(`🔒 r/${subredditName} - Private`);
          } else if (res.statusCode === 404) {
            result.error = 'Subreddit not found';
            console.log(`❌ r/${subredditName} - Not found`);
          } else if (res.statusCode === 451) {
            result.exists = true;
            result.isBanned = true;
            result.error = 'Subreddit banned/unavailable';
            console.log(`🚫 r/${subredditName} - Banned/Unavailable`);
          } else {
            result.error = `HTTP ${res.statusCode}`;
            console.log(`⚠️ r/${subredditName} - HTTP ${res.statusCode}`);
          }
        } catch (parseError) {
          result.error = 'Failed to parse response';
          console.log(`🔥 r/${subredditName} - Parse error`);
        }
        
        resolve(result);
      });
    });

    req.on('error', (error) => {
      console.log(`🔥 r/${subredditName} - Network error: ${error.message}`);
      resolve({
        name: subredditName,
        exists: false,
        accessible: false,
        isPrivate: false,
        isQuarantined: false,
        isBanned: false,
        subscribers: null,
        over18: null,
        error: error.message,
        url: `https://www.reddit.com/r/${subredditName}`,
        statusCode: null
      });
    });

    req.end();
  });
}

/**
 * Verify all subreddits with rate limiting
 */
async function verifyAllSubreddits() {
  const results = [];
  
  console.log(`🔍 Verifying ${SUBREDDITS.length} subreddits...\n`);
  
  for (let i = 0; i < SUBREDDITS.length; i++) {
    const subreddit = SUBREDDITS[i];
    const result = await checkSubreddit(subreddit);
    results.push(result);
    
    // Rate limiting - wait 1 second between requests
    if (i < SUBREDDITS.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}

/**
 * Generate summary report
 */
function generateReport(results) {
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

  // Generate updated constants
  const validSubreddits = results.filter(r => r.accessible).map(r => r.name);
  
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

  console.log(`\n📝 VALID SUBREDDITS FOR POSTING (${validSubreddits.length}):`);
  console.log(JSON.stringify(validSubreddits, null, 2));
  
  return { results, validSubreddits };
}

/**
 * Save results to file
 */
function saveResults(data) {
  const timestamp = new Date().toISOString();
  const reportData = {
    timestamp,
    total: data.results.length,
    summary: {
      accessible: data.results.filter(r => r.accessible).length,
      private: data.results.filter(r => r.isPrivate).length,
      quarantined: data.results.filter(r => r.isQuarantined).length,
      banned: data.results.filter(r => r.isBanned).length,
      notFound: data.results.filter(r => !r.exists && !r.isPrivate && !r.isBanned).length
    },
    validSubreddits: data.validSubreddits,
    results: data.results
  };
  
  fs.writeFileSync('verification-results.json', JSON.stringify(reportData, null, 2));
  console.log(`\n💾 Results saved to: verification-results.json`);
}

/**
 * Main execution
 */
async function main() {
  try {
    const results = await verifyAllSubreddits();
    const reportData = generateReport(results);
    saveResults(reportData);
    
    console.log('\n🎉 Verification complete!');
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  }
}

// Run the verification
main();
