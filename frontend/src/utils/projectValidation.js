/**
 * Validation utilities for project data integrity
 * Ensures data quality before saving to localStorage/database
 */

/**
 * Validates project dates
 * @param {Object} projectData - Project data with startDate and/or endDate
 * @returns {Object} - { isValid: boolean, errors: string[] }
 */
export function validateProjectDates(projectData) {
  const errors = [];
  
  // If both dates exist, startDate must be before endDate
  if (projectData.startDate && projectData.endDate) {
    const startDate = new Date(projectData.startDate);
    const endDate = new Date(projectData.endDate);
    
    if (isNaN(startDate.getTime())) {
      errors.push('Start date is invalid');
    }
    
    if (isNaN(endDate.getTime())) {
      errors.push('End date is invalid');
    }
    
    if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
      // Set to start of day for fair comparison
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(0, 0, 0, 0);
      
      if (startDate > endDate) {
        errors.push('Start date must be before or equal to end date');
      }
    }
  }
  
  // Validate startDate if it exists
  if (projectData.startDate && !projectData.endDate) {
    const startDate = new Date(projectData.startDate);
    if (isNaN(startDate.getTime())) {
      errors.push('Start date is invalid');
    }
  }
  
  // Validate endDate if it exists
  if (projectData.endDate && !projectData.startDate) {
    const endDate = new Date(projectData.endDate);
    if (isNaN(endDate.getTime())) {
      errors.push('End date is invalid');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates a complete project object
 * @param {Object} project - Project object
 * @returns {Object} - { isValid: boolean, errors: string[] }
 */
export function validateProject(project) {
  const errors = [];
  
  // Required fields
  if (!project.id) {
    errors.push('Project ID is required');
  }
  
  if (!project.name && !project.address) {
    errors.push('Project must have either a name or address');
  }
  
  // Validate dates
  const dateValidation = validateProjectDates(project);
  if (!dateValidation.isValid) {
    errors.push(...dateValidation.errors);
  }
  
  // Validate status
  const validStatuses = ['draft', 'ready', 'active', 'completed', 'archived'];
  if (project.status && !validStatuses.includes(project.status)) {
    errors.push(`Status must be one of: ${validStatuses.join(', ')}`);
  }
  
  // Validate percentagePaid
  if (project.percentagePaid !== undefined) {
    const percentage = Number(project.percentagePaid);
    if (isNaN(percentage) || percentage < 0 || percentage > 100) {
      errors.push('Percentage paid must be between 0 and 100');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Normalizes date to ISO string, handling edge cases
 * @param {string|Date} date - Date to normalize
 * @returns {string|null} - ISO string or null
 */
export function normalizeDate(date) {
  if (!date) return null;
  
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch (e) {
    return null;
  }
}

/**
 * Checks if two project names/addresses might be duplicates
 * Uses fuzzy matching similar to WorkersCard
 * @param {string} name1 - First project name/address
 * @param {string} name2 - Second project name/address
 * @returns {boolean} - True if likely duplicate
 */
export function mightBeDuplicate(name1, name2) {
  if (!name1 || !name2) return false;
  
  const n1 = name1.toUpperCase().trim();
  const n2 = name2.toUpperCase().trim();
  
  // Exact match
  if (n1 === n2) return true;
  
  // Remove common prefixes
  const normalize = (str) => str.replace(/^(RUE|AV|BD|PLACE|IMPASSE|CHEMIN|ROUTE)\s+/i, '').trim();
  const norm1 = normalize(n1);
  const norm2 = normalize(n2);
  
  if (norm1 === norm2) return true;
  
  // One contains the other (for partial matches)
  if (n1.includes(n2) || n2.includes(n1)) return true;
  if (norm1.includes(norm2) || norm2.includes(norm1)) return true;
  
  return false;
}


