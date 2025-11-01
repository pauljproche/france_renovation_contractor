#!/usr/bin/env node
/*
 * Lightweight data check for the contractor materials dataset.
 * Ensures numeric fields stay numeric, dates use dd/mm format,
 * approval statuses are within the expected vocabulary, and
 * highlights missing optional fields (as warnings) to catch
 * potential data-entry issues before the frontend consumes them.
 */

const fs = require('fs');
const path = require('path');

const DATA_PATH = path.resolve(__dirname, '..', 'data', 'materials.json');

const allowedStatuses = new Set([
  'approved',
  'change_order',
  'pending',
  'rejected',
  'supplied_by'
]);

const datePattern = /^\d{2}\/\d{2}$/; // day/month without year for now

const raw = fs.readFileSync(DATA_PATH, 'utf8');
const materials = JSON.parse(raw);

const issues = [];
let itemCount = 0;
let totalTTC = 0;
let totalHT = 0;

function pushIssue({ section, product, message, severity = 'error' }) {
  issues.push({ section, product, message, severity });
}

function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function validateDate(value, { section, product, label }) {
  if (value === null) {
    return;
  }
  if (typeof value !== 'string' || !datePattern.test(value.trim())) {
    pushIssue({
      section,
      product,
      severity: 'error',
      message: `${label} should use dd/mm format (received: ${JSON.stringify(value)})`
    });
  }
}

materials.sections.forEach((section) => {
  section.items.forEach((item) => {
    itemCount += 1;

    const context = { section: section.label, product: item.product };

    // Prices
    if (item.price) {
      const { ttc, htQuote } = item.price;
      if (ttc !== null) {
        if (isNumber(ttc)) {
          totalTTC += ttc;
        } else {
          pushIssue({
            ...context,
            message: `Prix TTC should be a number or null (received: ${JSON.stringify(ttc)})`
          });
        }
      }
      if (htQuote !== null) {
        if (isNumber(htQuote)) {
          totalHT += htQuote;
        } else {
          pushIssue({
            ...context,
            message: `HT devis should be a number or null (received: ${JSON.stringify(htQuote)})`
          });
        }
      }
    }

    // Approvals
    if (!item.approvals) {
      pushIssue({ ...context, message: 'Approvals object is missing' });
    } else {
      ['client', 'cray'].forEach((role) => {
        const approval = item.approvals[role];
        if (!approval) {
          pushIssue({ ...context, message: `Missing ${role} approval block` });
          return;
        }
        if (!allowedStatuses.has(approval.status)) {
          pushIssue({
            ...context,
            message: `${role} approval status must be one of ${Array.from(allowedStatuses).join(', ')} (received: ${JSON.stringify(approval.status)})`
          });
        }
        if (approval.note && typeof approval.note !== 'string') {
          pushIssue({
            ...context,
            message: `${role} approval note should be a string when provided`
          });
        }
      });
    }

    // Order block
    if (!item.order) {
      pushIssue({ ...context, message: 'Order block is missing' });
    } else {
      const { ordered, orderDate, delivery, quantity } = item.order;
      if (typeof ordered !== 'boolean') {
        pushIssue({ ...context, message: 'ordered flag should be boolean' });
      }

      if (ordered) {
        if (orderDate === null) {
          pushIssue({ ...context, message: 'ordered items should include an orderDate (dd/mm)' });
        } else {
          validateDate(orderDate, { ...context, label: 'Order date' });
        }
      } else if (orderDate !== null) {
        pushIssue({ ...context, severity: 'warning', message: 'orderDate provided while ordered=false' });
      }

      if (delivery) {
        validateDate(delivery.date, { ...context, label: 'Delivery date' });
        if (delivery.status !== null && typeof delivery.status !== 'string') {
          pushIssue({ ...context, message: 'Delivery status must be a string or null' });
        }
      } else {
        pushIssue({ ...context, message: 'Delivery block is missing' });
      }

      if (quantity !== null) {
        if (!Number.isInteger(quantity) || quantity < 0) {
          pushIssue({
            ...context,
            message: `Quantity should be a positive integer or null (received: ${JSON.stringify(quantity)})`
          });
        }
      }
    }

    // Optional metadata
    if (!item.supplierLink) {
      pushIssue({
        ...context,
        severity: 'warning',
        message: 'Supplier link is missing'
      });
    }
  });
});

const errorCount = issues.filter((issue) => issue.severity !== 'warning').length;
const warningCount = issues.length - errorCount;

console.log('─'.repeat(60));
console.log('Materials data validation report');
console.log('─'.repeat(60));
console.log(`Sections: ${materials.sections.length}`);
console.log(`Items: ${itemCount}`);
console.log(`Total known TTC: €${totalTTC.toFixed(2)}`);
console.log(`Total known HT:  €${totalHT.toFixed(2)}`);
console.log('');

if (issues.length === 0) {
  console.log('✅ No issues detected');
} else {
  console.log(`⚠️  Findings: ${errorCount} errors, ${warningCount} warnings`);
  issues.forEach((issue, index) => {
    const prefix = `${index + 1}.`;
    console.log(
      `${prefix} [${issue.severity.toUpperCase()}] ${issue.section} › ${issue.product}: ${issue.message}`
    );
  });
}

console.log('');
console.log('Tip: adjust allowed statuses or validations in scripts/validateMaterials.js when the source spreadsheet changes.');


