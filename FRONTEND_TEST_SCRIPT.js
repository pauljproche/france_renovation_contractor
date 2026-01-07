// Quick test script to run in browser console on http://localhost:5173
// Open browser console (F12) and paste this:

(async function testPhase4Frontend() {
    console.log('🧪 Testing Phase 4 Frontend Integration...\n');
    
    const API_BASE = 'http://localhost:8000';
    let passed = 0;
    let failed = 0;
    
    // Test 1: Backend health
    try {
        const res = await fetch(`${API_BASE}/`);
        if (res.ok) {
            console.log('✅ Test 1: Backend health check - PASS');
            passed++;
        } else {
            throw new Error(`Status: ${res.status}`);
        }
    } catch (e) {
        console.log('❌ Test 1: Backend health check - FAIL:', e.message);
        failed++;
    }
    
    // Test 2: Projects API
    try {
        const res = await fetch(`${API_BASE}/api/projects`);
        const data = await res.json();
        if (res.status === 200) {
            console.log(`✅ Test 2: Projects API - PASS (Status: 200, Count: ${data.count || 0})`);
            passed++;
        } else if (res.status === 501) {
            console.log('❌ Test 2: Projects API - FAIL (Status: 501 - Database not enabled)');
            failed++;
        } else {
            throw new Error(`Status: ${res.status}`);
        }
    } catch (e) {
        console.log('❌ Test 2: Projects API - FAIL:', e.message);
        failed++;
    }
    
    // Test 3: Workers API
    try {
        const res = await fetch(`${API_BASE}/api/workers`);
        const data = await res.json();
        if (res.status === 200) {
            console.log(`✅ Test 3: Workers API - PASS (Status: 200, Count: ${data.count || 0})`);
            passed++;
        } else if (res.status === 501) {
            console.log('❌ Test 3: Workers API - FAIL (Status: 501 - Database not enabled)');
            failed++;
        } else {
            throw new Error(`Status: ${res.status}`);
        }
    } catch (e) {
        console.log('❌ Test 3: Workers API - FAIL:', e.message);
        failed++;
    }
    
    // Summary
    console.log(`\n📊 Results: ${passed}/${passed + failed} tests passed`);
    if (failed === 0) {
        console.log('✅ All tests passed! Phase 4 is working correctly!');
    } else {
        console.log('❌ Some tests failed. Check errors above.');
    }
})();

