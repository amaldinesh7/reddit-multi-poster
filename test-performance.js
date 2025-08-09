// Performance test for /api/me endpoint
const axios = require('axios');

async function testMeAPI() {
  const baseURL = 'http://localhost:3000'; // Adjust if different
  
  console.log('🚀 Testing /api/me performance...\n');
  
  try {
    // Test without subreddits (new fast version)
    console.log('⚡ Testing /api/me (without subreddits)...');
    const start1 = Date.now();
    const response1 = await axios.get(`${baseURL}/api/me`);
    const time1 = Date.now() - start1;
    
    console.log(`✅ Fast version: ${time1}ms`);
    console.log(`   - User: ${response1.data.me?.name}`);
    console.log(`   - Subreddits: ${response1.data.subs?.length || 0} (skipped)`);
    
    // Test with subreddits (old slow version)
    console.log('\n🐌 Testing /api/me?include_subs=true (with subreddits)...');
    const start2 = Date.now();
    const response2 = await axios.get(`${baseURL}/api/me?include_subs=true`);
    const time2 = Date.now() - start2;
    
    console.log(`⏱️  With subreddits: ${time2}ms`);
    console.log(`   - User: ${response2.data.me?.name}`);
    console.log(`   - Subreddits: ${response2.data.subs?.length || 0} fetched`);
    
    // Calculate improvement
    const improvement = ((time2 - time1) / time2 * 100).toFixed(1);
    console.log(`\n📊 Performance improvement: ${improvement}% faster (${time2 - time1}ms saved)`);
    
    if (time1 < 1000) {
      console.log('🎉 App now loads in under 1 second!');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n💡 Make sure:');
    console.log('   1. App is running (npm run dev)');
    console.log('   2. You are logged in to Reddit');
  }
}

testMeAPI(); 