// Labor type categories for renovation work
export const LABOR_TYPES = [
  'Démolition & Dépose',
  'Gros œuvre & structure',
  'Façade, Couverture & ITE',
  'Menuiseries extérieures',
  'Plâtrerie & ITI',
  'Plomberie & CVC',
  'Électricité',
  'Revêtement mur & plafond',
  'Menuiseries intérieures',
  'Cuisine',
  'Espaces verts & Extérieurs',
  'Révision de prix'
];

// Function to determine labor type based on product name, section, and context
export function determineLaborType(product, sectionLabel, sectionId) {
  if (!product) return null;
  
  const productLower = product.toLowerCase();
  const sectionLower = sectionLabel?.toLowerCase() || '';
  
  // Electrical work
  if (
    productLower.includes('suspension') ||
    productLower.includes('électricité') ||
    productLower.includes('électrique') ||
    productLower.includes('éclairage') ||
    productLower.includes('lumière') ||
    productLower.includes('led') ||
    productLower.includes('lampe') ||
    productLower.includes('plafonnier')
  ) {
    return 'Électricité';
  }
  
  // Plumbing & HVAC
  if (
    productLower.includes('mitigeur') ||
    productLower.includes('robinet') ||
    productLower.includes('évier') ||
    productLower.includes('lavabo') ||
    productLower.includes('lave-mains') ||
    productLower.includes('wc') ||
    productLower.includes('toilette') ||
    productLower.includes('douche') ||
    productLower.includes('baignoire') ||
    productLower.includes('corps d\'encastrement') ||
    productLower.includes('ibox') ||
    productLower.includes('plomberie') ||
    productLower.includes('cvc') ||
    productLower.includes('chauffage')
  ) {
    return 'Plomberie & CVC';
  }
  
  // Kitchen work
  if (
    sectionId === 'kitchen' ||
    sectionLower.includes('cuisine')
  ) {
    // Kitchen-specific items that aren't plumbing
    if (
      productLower.includes('évier') ||
      productLower.includes('mitigeur') ||
      productLower.includes('robinet')
    ) {
      return 'Plomberie & CVC';
    }
    return 'Cuisine';
  }
  
  // Interior joinery (cabinets, furniture)
  if (
    productLower.includes('meuble') ||
    productLower.includes('armoire') ||
    productLower.includes('placard') ||
    productLower.includes('étagère') ||
    productLower.includes('menuiserie') ||
    productLower.includes('cabinet')
  ) {
    return 'Menuiseries intérieures';
  }
  
  // Wall and ceiling coverings
  if (
    productLower.includes('papier peint') ||
    productLower.includes('peinture') ||
    productLower.includes('enduit') ||
    productLower.includes('carrelage') ||
    productLower.includes('faïence') ||
    productLower.includes('revêtement') ||
    productLower.includes('sol') ||
    productLower.includes('parquet')
  ) {
    return 'Revêtement mur & plafond';
  }
  
  // Demolition
  if (
    productLower.includes('démolition') ||
    productLower.includes('dépose') ||
    productLower.includes('démontage')
  ) {
    return 'Démolition & Dépose';
  }
  
  // Structural work
  if (
    productLower.includes('béton') ||
    productLower.includes('maçonnerie') ||
    productLower.includes('structure') ||
    productLower.includes('mur porteur')
  ) {
    return 'Gros œuvre & structure';
  }
  
  // Exterior joinery
  if (
    productLower.includes('fenêtre') ||
    productLower.includes('porte extérieure') ||
    productLower.includes('volet') ||
    productLower.includes('baie vitrée')
  ) {
    return 'Menuiseries extérieures';
  }
  
  // Facade, roofing, insulation
  if (
    productLower.includes('façade') ||
    productLower.includes('couverture') ||
    productLower.includes('toit') ||
    productLower.includes('ite') ||
    productLower.includes('isolation')
  ) {
    return 'Façade, Couverture & ITE';
  }
  
  // Plastering
  if (
    productLower.includes('plâtre') ||
    productLower.includes('plâtrerie') ||
    productLower.includes('cloison') ||
    productLower.includes('iti')
  ) {
    return 'Plâtrerie & ITI';
  }
  
  // Default for bathroom/kitchen sections if not matched above
  if (sectionLower.includes('salle de bain') || sectionLower.includes('bain')) {
    return 'Plomberie & CVC';
  }
  
  // Default fallback
  return null;
}


