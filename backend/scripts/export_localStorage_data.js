/**
 * Browser console script to export localStorage data for migration.
 * 
 * Usage:
 *   1. Open browser console (F12 or Cmd+Option+I)
 *   2. Copy-paste this entire script
 *   3. Run: exportLocalStorageData()
 *   4. Copy the output JSON and save to files:
 *      - projects.json
 *      - workers.json
 * 
 * Example:
 *   const result = exportLocalStorageData();
 *   console.log(JSON.stringify(result.projects, null, 2));
 *   console.log(JSON.stringify(result.workers, null, 2));
 */

function exportLocalStorageData() {
  const result = {
    projects: [],
    workers: [],
    timestamp: new Date().toISOString()
  };
  
  // Export projects
  try {
    const projectsJson = localStorage.getItem('renovationProjects');
    if (projectsJson) {
      result.projects = JSON.parse(projectsJson);
      console.log(`✅ Exported ${result.projects.length} projects`);
    } else {
      console.log('ℹ️  No projects found in localStorage');
    }
  } catch (e) {
    console.error('❌ Error exporting projects:', e);
  }
  
  // Export workers
  try {
    const workersJson = localStorage.getItem('workers');
    if (workersJson) {
      result.workers = JSON.parse(workersJson);
      console.log(`✅ Exported ${result.workers.length} workers`);
    } else {
      console.log('ℹ️  No workers found in localStorage');
    }
  } catch (e) {
    console.error('❌ Error exporting workers:', e);
  }
  
  return result;
}

// Auto-run if in browser console
if (typeof window !== 'undefined') {
  console.log('='.repeat(80));
  console.log('LocalStorage Data Export Script');
  console.log('='.repeat(80));
  console.log();
  console.log('Run: exportLocalStorageData()');
  console.log();
  console.log('Or use:');
  console.log('  const data = exportLocalStorageData();');
  console.log('  console.log(JSON.stringify(data.projects, null, 2));');
  console.log('  console.log(JSON.stringify(data.workers, null, 2));');
  console.log();
}
