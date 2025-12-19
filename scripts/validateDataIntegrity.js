#!/usr/bin/env node
/**
 * Data Integrity Validation Script
 * 
 * Checks for critical data issues before migration:
 * 1. Invalid date relationships (startDate > endDate)
 * 2. Orphaned materials (chantier with no matching project)
 * 3. Missing required fields
 * 4. Inconsistent project identifiers
 * 
 * Run: node scripts/validateDataIntegrity.js
 */

const fs = require('fs');
const path = require('path');

// Paths
const MATERIALS_PATH = path.resolve(__dirname, '..', 'data', 'materials.json');
const EDIT_HISTORY_PATH = path.resolve(__dirname, '..', 'data', 'edit-history.json');

// Storage keys (for browser localStorage simulation - these would be read from actual localStorage in browser)
// For CLI script, we'll read from a backup or have user provide data
const STORAGE_KEYS = {
  PROJECTS: 'renovationProjects',
  WORKERS: 'workers',
  SELECTED_PROJECT: 'selectedProjectId'
};

// Load data
function loadMaterials() {
  try {
    if (!fs.existsSync(MATERIALS_PATH)) {
      console.error(`❌ Materials file not found: ${MATERIALS_PATH}`);
      return null;
    }
    return JSON.parse(fs.readFileSync(MATERIALS_PATH, 'utf8'));
  } catch (e) {
    console.error(`❌ Error loading materials:`, e.message);
    return null;
  }
}

function loadEditHistory() {
  try {
    if (!fs.existsSync(EDIT_HISTORY_PATH)) {
      return [];
    }
    return JSON.parse(fs.readFileSync(EDIT_HISTORY_PATH, 'utf8'));
  } catch (e) {
    console.warn(`⚠️  Error loading edit history:`, e.message);
    return [];
  }
}

// Normalize project name for comparison (similar to WorkersCard logic)
function normalizeProjectName(name) {
  if (!name) return '';
  return name.toUpperCase()
    .replace(/^(RUE|AV|BD|PLACE|IMPASSE|CHEMIN|ROUTE)\s+/i, '')
    .trim();
}

// Validation functions
function validateProjectDates(project) {
  const issues = [];
  
  if (project.startDate && project.endDate) {
    const start = new Date(project.startDate);
    const end = new Date(project.endDate);
    
    if (isNaN(start.getTime())) {
      issues.push({ type: 'error', message: `Invalid startDate: ${project.startDate}` });
    }
    
    if (isNaN(end.getTime())) {
      issues.push({ type: 'error', message: `Invalid endDate: ${project.endDate}` });
    }
    
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      
      if (start > end) {
        issues.push({
          type: 'error',
          message: `startDate (${start.toISOString().split('T')[0]}) is after endDate (${end.toISOString().split('T')[0]})`
        });
      }
    }
  }
  
  return issues;
}

function validateProject(project) {
  const issues = [];
  
  if (!project.id) {
    issues.push({ type: 'error', message: 'Missing project ID' });
  }
  
  if (!project.name && !project.address) {
    issues.push({ type: 'error', message: 'Project must have name or address' });
  }
  
  // Validate dates
  issues.push(...validateProjectDates(project));
  
  return issues;
}

// Main validation
function validateDataIntegrity() {
  console.log('🔍 Validating Data Integrity...\n');
  console.log('=' .repeat(60));
  
  const allIssues = [];
  let projectCount = 0;
  let materialsItemCount = 0;
  let orphanedMaterialsCount = 0;
  
  // 1. Validate Materials JSON
  console.log('\n📦 Validating Materials Data...');
  const materials = loadMaterials();
  if (!materials) {
    console.error('❌ Cannot proceed without materials data');
    process.exit(1);
  }
  
  const chantierNames = new Set();
  materials.sections?.forEach(section => {
    section.items?.forEach(item => {
      materialsItemCount++;
      if (item.chantier) {
        chantierNames.add(item.chantier);
      } else {
        allIssues.push({
          type: 'warning',
          section: section.label,
          product: item.product,
          message: 'Item missing chantier field'
        });
      }
    });
  });
  
  console.log(`   ✓ Found ${materialsItemCount} items in ${materials.sections?.length || 0} sections`);
  console.log(`   ✓ Found ${chantierNames.size} unique chantier values`);
  
  // 2. Note: Projects are in localStorage (browser only)
  // This script would need to be run in browser context or data exported
  console.log('\n📋 Project Validation:');
  console.log('   ⚠️  Projects are stored in localStorage (browser only)');
  console.log('   ⚠️  Run this validation in browser console or export localStorage data');
  
  // Instructions for browser validation
  console.log('\n   To validate projects in browser:');
  console.log('   1. Open browser console on your app');
  console.log('   2. Run:');
  console.log('      const projects = JSON.parse(localStorage.getItem("renovationProjects") || "[]");');
  console.log('      projects.forEach(p => {');
  console.log('        if (p.startDate && p.endDate) {');
  console.log('          const start = new Date(p.startDate);');
  console.log('          const end = new Date(p.endDate);');
  console.log('          if (start > end) console.error("Invalid dates:", p.name, p.startDate, p.endDate);');
  console.log('        }');
  console.log('      });');
  
  // 3. Validate Edit History
  console.log('\n📝 Validating Edit History...');
  const editHistory = loadEditHistory();
  console.log(`   ✓ Found ${editHistory.length} edit history entries`);
  
  // 4. Check for orphaned materials (chantier with no matching project)
  console.log('\n🔗 Checking Material-Project Relationships...');
  console.log(`   ⚠️  Cannot validate without project data from localStorage`);
  console.log(`   ⚠️  Found ${chantierNames.size} unique chantier values in materials:`);
  Array.from(chantierNames).slice(0, 10).forEach(name => {
    console.log(`      - ${name}`);
  });
  if (chantierNames.size > 10) {
    console.log(`      ... and ${chantierNames.size - 10} more`);
  }
  
  // 5. Summary
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Validation Summary:\n');
  
  if (allIssues.length === 0) {
    console.log('✅ No critical issues found in JSON files!');
    console.log('\n⚠️  Note: Project validation requires browser localStorage data.');
    console.log('   Please run the browser console snippet above to validate projects.');
  } else {
    const errors = allIssues.filter(i => i.type === 'error');
    const warnings = allIssues.filter(i => i.type === 'warning');
    
    if (errors.length > 0) {
      console.log(`❌ Found ${errors.length} errors:`);
      errors.forEach(issue => {
        console.log(`   - ${issue.message}`);
        if (issue.section) console.log(`     Section: ${issue.section}`);
        if (issue.product) console.log(`     Product: ${issue.product}`);
      });
    }
    
    if (warnings.length > 0) {
      console.log(`\n⚠️  Found ${warnings.length} warnings:`);
      warnings.slice(0, 10).forEach(issue => {
        console.log(`   - ${issue.message}`);
        if (issue.section) console.log(`     Section: ${issue.section}`);
        if (issue.product) console.log(`     Product: ${issue.product}`);
      });
      if (warnings.length > 10) {
        console.log(`   ... and ${warnings.length - 10} more warnings`);
      }
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('\n💡 Recommendations:');
  console.log('   1. Fix all date validation errors before migration');
  console.log('   2. Ensure all materials have valid chantier values');
  console.log('   3. Verify project names match chantier values (case-insensitive)');
  console.log('   4. Run browser validation to check localStorage projects');
  console.log('   5. Export localStorage data before migration for backup\n');
  
  return allIssues.length === 0 ? 0 : 1;
}

// Run validation
if (require.main === module) {
  const exitCode = validateDataIntegrity();
  process.exit(exitCode);
}

module.exports = { validateDataIntegrity, validateProject, validateProjectDates };


