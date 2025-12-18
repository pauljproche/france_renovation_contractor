/**
 * Browser Console Script for Project Data Validation
 * 
 * Copy and paste this into your browser console while on your app to validate project data
 * This checks localStorage projects for date validation issues
 */

(function validateProjectsInBrowser() {
  console.log('🔍 Validating Projects in localStorage...\n');
  console.log('='.repeat(60));
  
  try {
    // Load projects from localStorage
    const projectsJson = localStorage.getItem('renovationProjects');
    if (!projectsJson) {
      console.log('⚠️  No projects found in localStorage');
      return;
    }
    
    const projects = JSON.parse(projectsJson);
    console.log(`\n📋 Found ${projects.length} projects\n`);
    
    const issues = [];
    let validCount = 0;
    
    projects.forEach((project, index) => {
      const projectIssues = [];
      
      // Check for missing required fields
      if (!project.id) {
        projectIssues.push('❌ Missing project ID');
      }
      
      if (!project.name && !project.address) {
        projectIssues.push('❌ Missing both name and address');
      }
      
      // Validate dates
      if (project.startDate && project.endDate) {
        const start = new Date(project.startDate);
        const end = new Date(project.endDate);
        
        if (isNaN(start.getTime())) {
          projectIssues.push(`❌ Invalid startDate: ${project.startDate}`);
        }
        
        if (isNaN(end.getTime())) {
          projectIssues.push(`❌ Invalid endDate: ${project.endDate}`);
        }
        
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
          start.setHours(0, 0, 0, 0);
          end.setHours(0, 0, 0, 0);
          
          if (start > end) {
            projectIssues.push(
              `❌ startDate (${start.toISOString().split('T')[0]}) is AFTER endDate (${end.toISOString().split('T')[0]})`
            );
          }
        }
      } else if (project.endDate && !project.startDate) {
        projectIssues.push('⚠️  Has endDate but no startDate');
      }
      
      // Validate status
      const validStatuses = ['draft', 'ready', 'active', 'completed', 'archived'];
      if (project.status && !validStatuses.includes(project.status)) {
        projectIssues.push(`⚠️  Invalid status: ${project.status}`);
      }
      
      // Validate percentagePaid
      if (project.percentagePaid !== undefined) {
        const percentage = Number(project.percentagePaid);
        if (isNaN(percentage) || percentage < 0 || percentage > 100) {
          projectIssues.push(`⚠️  Invalid percentagePaid: ${project.percentagePaid}`);
        }
      }
      
      if (projectIssues.length > 0) {
        issues.push({
          project: project.name || project.address || `Project #${index + 1}`,
          id: project.id,
          issues: projectIssues
        });
      } else {
        validCount++;
      }
    });
    
    // Report results
    console.log('='.repeat(60));
    console.log('\n📊 Validation Results:\n');
    console.log(`✅ Valid projects: ${validCount}`);
    console.log(`❌ Projects with issues: ${issues.length}\n`);
    
    if (issues.length > 0) {
      console.log('🔴 Issues Found:\n');
      issues.forEach((item, idx) => {
        console.log(`${idx + 1}. ${item.project} (ID: ${item.id})`);
        item.issues.forEach(issue => console.log(`   ${issue}`));
        console.log('');
      });
      
      // Summary
      const dateIssues = issues.filter(i => 
        i.issues.some(issue => issue.includes('startDate') || issue.includes('endDate'))
      );
      
      if (dateIssues.length > 0) {
        console.log('⚠️  Date Issues Summary:');
        console.log(`   ${dateIssues.length} projects have invalid date relationships`);
        console.log('   These should be fixed before migration!\n');
      }
    } else {
      console.log('✅ All projects validated successfully!\n');
    }
    
    // Check for duplicate project names/addresses
    console.log('\n🔍 Checking for potential duplicates...\n');
    const nameMap = new Map();
    projects.forEach(project => {
      const key = (project.name || project.address || '').toUpperCase().trim();
      if (key) {
        if (!nameMap.has(key)) {
          nameMap.set(key, []);
        }
        nameMap.get(key).push(project);
      }
    });
    
    const duplicates = Array.from(nameMap.entries()).filter(([_, projs]) => projs.length > 1);
    if (duplicates.length > 0) {
      console.log(`⚠️  Found ${duplicates.length} potential duplicate names:\n`);
      duplicates.forEach(([name, projs]) => {
        console.log(`   "${name}":`);
        projs.forEach(p => console.log(`     - ID: ${p.id}, Status: ${p.status}`));
      });
    } else {
      console.log('✅ No duplicate project names found');
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('\n💡 To fix date issues, edit projects in the Timeline page');
    console.log('   The validation will now prevent saving invalid dates.\n');
    
  } catch (e) {
    console.error('❌ Error validating projects:', e);
  }
})();

