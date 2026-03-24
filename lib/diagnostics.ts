// lib/diagnostics.ts
/**
 * Diagnostics - Debug why data is not showing
 * Run in browser console: window.__diagnose()
 */

export function runDiagnostics() {
  console.log('\n🔍 OMS Data Diagnostics\n');
  console.log('═'.repeat(50));

  // 1. Check offline mode
  console.log('\n1️⃣  Offline Mode Status:');
  const offline = (window as any).__offlineMode;
  console.log(`   Offline mode: ${offline ? '✅ ENABLED' : '❌ DISABLED'}`);

  // 2. Check localStorage data
  console.log('\n2️⃣  LocalStorage Data:');
  const lsKeys = Object.keys(localStorage).filter(k => k.startsWith('oms_data_'));
  if (lsKeys.length === 0) {
    console.log('   ❌ NO DATA IN LOCALSTORAGE!');
    console.log('   💡 Try: await window.__loadRealData()');
  } else {
    console.log(`   ✅ Found ${lsKeys.length} tables:`);
    for (const key of lsKeys) {
      const data = JSON.parse(localStorage.getItem(key) || '[]');
      const count = (data as any[]).length;
      console.log(`      • ${key}: ${count} records`);
    }
  }

  // 3. Check mock session
  console.log('\n3️⃣  Authentication:');
  const mockSession = localStorage.getItem('mock_session_offline');
  if (mockSession) {
    const session = JSON.parse(mockSession);
    console.log(`   ✅ Mock session exists:`);
    console.log(`      Email: ${session.user.email}`);
    console.log(`      ID: ${session.user.id}`);
  } else {
    console.log('   ❌ NO MOCK SESSION - Login required');
  }

  // 4. Check data-export folder
  console.log('\n4️⃣  Data Export Files:');
  fetch('/data-export/projects.json')
    .then(r => r.ok ? '✅ Accessible' : '❌ Not found')
    .then(status => console.log(`   Projects: ${status}`))
    .catch(() => console.log('   ❌ Error accessing data-export/'));

  // 5. Summary & Next Steps
  console.log('\n' + '═'.repeat(50));
  console.log('📋 Summary:');
  if (lsKeys.length === 0) {
    console.log(`❌ NO DATA LOADED`);
    console.log('\n✅ Solutions:');
    console.log('   1. Run: await window.__loadRealData()');
    console.log('   2. OR: await window.__loadSampleData()');
    console.log('   3. Then: location.reload()');
  } else {
    console.log(`✅ ${lsKeys.length} tables loaded (${lsKeys.map(k => JSON.parse(localStorage.getItem(k) || '[]').length).reduce((a, b) => a + b)} records)`);
    console.log('\n💡 If data still not showing in app:');
    console.log('   1. Check browser DevTools Network tab for fetch errors');
    console.log('   2. Check React DevTools for App state');
    console.log('   3. Try: location.reload()');
  }

  console.log('\n' + '═'.repeat(50) + '\n');
}

// Make available globally
if (typeof window !== 'undefined') {
  (window as any).__diagnose = runDiagnostics;
  console.log('%c💡 Run window.__diagnose() for troubleshooting', 'color: #667eea; font-weight: bold');
}
