import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';

/**
 * Calculate totals for facture with exact prices and ranges for uncertain prices
 */
export function calculateFactureTotals(items) {
  let exactTotal = 0;
  const uncertainItems = [];
  
  items.forEach((item) => {
    // Handle both nested and flat price structures
    const priceTTC = item.price?.ttc ?? item.priceTTC;
    const htQuote = item.price?.htQuote ?? item.htQuote;
    
    // Check if item has exact price
    if (priceTTC !== null && priceTTC !== undefined && priceTTC !== '' && !isNaN(parseFloat(priceTTC))) {
      exactTotal += parseFloat(priceTTC);
    } else {
      // Item has uncertain price - check if there's a range in comments or multiple price options
      // For now, we'll check htQuote as fallback or mark as uncertain
      if (htQuote !== null && htQuote !== undefined && htQuote !== '' && !isNaN(parseFloat(htQuote))) {
        // Use HT quote as estimate (convert to TTC with 10% VAT)
        const estimatedTTC = parseFloat(htQuote) * 1.1;
        uncertainItems.push({
          product: item.product || 'Unknown',
          section: item.sectionLabel || item.section || 'Unknown',
          min: estimatedTTC * 0.9, // 10% variance
          max: estimatedTTC * 1.1
        });
      } else {
        // Completely uncertain - no price info
        uncertainItems.push({
          product: item.product || 'Unknown',
          section: item.sectionLabel || item.section || 'Unknown',
          min: null,
          max: null
        });
      }
    }
  });
  
  // Calculate range for uncertain items
  let minRange = 0;
  let maxRange = 0;
  const hasUncertainItems = uncertainItems.length > 0;
  
  uncertainItems.forEach((item) => {
    if (item.min !== null && item.max !== null) {
      minRange += item.min;
      maxRange += item.max;
    }
  });
  
  return {
    exactTotal,
    uncertainItems,
    minRange,
    maxRange,
    hasUncertainItems,
    totalMin: exactTotal + minRange,
    totalMax: exactTotal + maxRange
  };
}

/**
 * Export facture as PDF
 */
export function exportFacturePDF(items, projectName = 'Project') {
  const totals = calculateFactureTotals(items);
  const doc = new jsPDF();
  
  // Title
  doc.setFontSize(18);
  doc.text('Facture / Invoice', 14, 20);
  
  // Project info
  doc.setFontSize(12);
  doc.text(`Project: ${projectName}`, 14, 30);
  doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 36);
  
  let yPos = 50;
  
  // Summary section
  doc.setFontSize(14);
  doc.text('Summary / Résumé', 14, yPos);
  yPos += 10;
  
  doc.setFontSize(11);
  doc.text(`Exact Total: €${totals.exactTotal.toFixed(2)}`, 14, yPos);
  yPos += 7;
  
  if (totals.hasUncertainItems) {
    if (totals.minRange === totals.maxRange) {
      doc.text(`Estimated Additional: €${totals.minRange.toFixed(2)}`, 14, yPos);
    } else {
      doc.text(`Estimated Range: €${totals.minRange.toFixed(2)} - €${totals.maxRange.toFixed(2)}`, 14, yPos);
    }
    yPos += 7;
    
    // Total range
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    if (totals.minRange === totals.maxRange) {
      doc.text(`Total: €${totals.exactTotal.toFixed(2)} + €${totals.minRange.toFixed(2)} = €${totals.totalMin.toFixed(2)}`, 14, yPos);
    } else {
      doc.text(`Total: €${totals.exactTotal.toFixed(2)} + (€${totals.minRange.toFixed(2)} to €${totals.maxRange.toFixed(2)})`, 14, yPos);
      yPos += 7;
      doc.text(`= €${totals.totalMin.toFixed(2)} - €${totals.totalMax.toFixed(2)}`, 14, yPos);
    }
    doc.setFont(undefined, 'normal');
  } else {
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(`Total: €${totals.exactTotal.toFixed(2)}`, 14, yPos);
    doc.setFont(undefined, 'normal');
  }
  
  yPos += 15;
  
  // Items breakdown
  if (items.length > 0) {
    doc.setFontSize(14);
    doc.text('Items Breakdown / Détail des Articles', 14, yPos);
    yPos += 10;
    
    // Prepare table data
    const tableData = items.map((item) => {
      const section = item.sectionLabel || item.section || '';
      const product = item.product || '';
      const priceTTC = item.price?.ttc ?? item.priceTTC;
      const priceDisplay = (priceTTC !== null && priceTTC !== undefined && priceTTC !== '' && !isNaN(parseFloat(priceTTC)))
        ? `€${parseFloat(priceTTC).toFixed(2)}`
        : 'TBD';
      
      return [section, product, priceDisplay];
    });
    
    autoTable(doc, {
      startY: yPos,
      head: [['Section', 'Product', 'Price TTC']],
      body: tableData,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [66, 139, 202] },
      margin: { left: 14, right: 14 }
    });
  }
  
  // Save PDF
  doc.save(`facture_${projectName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
}

/**
 * Export devis (table) as PDF
 */
export function exportDevisPDF(items, columns, columnLabels, projectName = 'Project') {
  const doc = new jsPDF('landscape'); // Landscape for wider table
  
  // Title
  doc.setFontSize(18);
  doc.text('Devis / Quote', 14, 20);
  
  // Project info
  doc.setFontSize(12);
  doc.text(`Project: ${projectName}`, 14, 30);
  doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 36);
  
  // Prepare table data
  const tableData = items.map((item) => {
    return columns.map((column) => {
      let value = '';
      
      switch (column) {
        case 'section':
          value = item.sectionLabel || item.section || '—';
          break;
        case 'product':
          value = item.product || '—';
          break;
        case 'reference':
          value = item.reference || '—';
          break;
        case 'laborType':
          value = item.laborType || '—';
          break;
        case 'priceTTC':
          const priceTTC = item.price?.ttc ?? item.priceTTC;
          value = (priceTTC !== null && priceTTC !== undefined && priceTTC !== '' && !isNaN(parseFloat(priceTTC)))
            ? `€${parseFloat(priceTTC).toFixed(2)}`
            : '—';
          break;
        case 'htQuote':
          const htQuote = item.price?.htQuote ?? item.htQuote;
          value = (htQuote !== null && htQuote !== undefined && htQuote !== '' && !isNaN(parseFloat(htQuote)))
            ? `€${parseFloat(htQuote).toFixed(2)}`
            : '—';
          break;
        case 'clientValidation':
          value = item.approvals?.client?.status || '—';
          break;
        case 'crayValidation':
          value = item.approvals?.cray?.status || '—';
          break;
        case 'ordered':
          value = item.order?.ordered ? 'Yes' : 'No';
          break;
        case 'orderDate':
          value = item.order?.orderDate || '—';
          break;
        case 'deliveryDate':
          value = item.order?.delivery?.date || '—';
          break;
        case 'deliveryStatus':
          value = item.order?.delivery?.status || '—';
          break;
        case 'quantity':
          value = item.order?.quantity || '—';
          break;
        case 'comments':
          value = item.comments?.cray || item.comments?.client || '—';
          break;
        default:
          value = '—';
      }
      
      return value;
    });
  });
  
  // Get column headers
  const headers = columns.map(col => columnLabels[col] || col);
  
  autoTable(doc, {
    startY: 45,
    head: [headers],
    body: tableData,
    styles: { fontSize: 7 },
    headStyles: { fillColor: [66, 139, 202] },
    margin: { left: 14, right: 14 },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 'auto' },
    }
  });
  
  // Save PDF
  doc.save(`devis_${projectName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
}

