import { Product, ProductUnit } from '@/types';
import { db } from '@/lib/db';

export interface SeedProductDefinition {
  name: string;
  category: string;
  unit: ProductUnit;
  selling_price: number; // in paise
  mrp: number; // in paise
  purchase_price: number; // in paise
  current_stock: number;
  min_stock_level: number;
  tax_rate: number;
  is_tax_inclusive?: boolean;
  hsn_code?: string;
  is_loose_item?: boolean;
}

/**
 * Starter catalogue seeded into a brand new shop so the POS grid is never empty.
 * One universal list — the app no longer keeps a separate catalogue per trade.
 */
export const DEFAULT_STARTER_PRODUCTS: SeedProductDefinition[] = [
    {
      name: 'Standard Phuljhadi (Sparklers) - 10 pcs',
      category: 'Sparklers',
      unit: 'box',
      selling_price: 15000,
      mrp: 18000,
      purchase_price: 9000,
      current_stock: 50,
      min_stock_level: 10,
      tax_rate: 18,
      is_tax_inclusive: true,
      hsn_code: '3604',
    },
    {
      name: 'Colour Smoke Fountain (Chakri) - 5 pcs',
      category: 'Ground Spinners',
      unit: 'box',
      selling_price: 25000,
      mrp: 30000,
      purchase_price: 15000,
      current_stock: 30,
      min_stock_level: 10,
      tax_rate: 18,
      is_tax_inclusive: true,
      hsn_code: '3604',
    },
    {
      name: 'Ladi (1000 Wala Mirchi Bomb)',
      category: 'Garland Crackers',
      unit: 'piece',
      selling_price: 55000,
      mrp: 65000,
      purchase_price: 35000,
      current_stock: 20,
      min_stock_level: 5,
      tax_rate: 18,
      is_tax_inclusive: true,
      hsn_code: '3604',
    },
    {
      name: 'Anar (Flower Pots) Big - 10 pcs',
      category: 'Flower Pots',
      unit: 'box',
      selling_price: 35000,
      mrp: 45000,
      purchase_price: 22000,
      current_stock: 40,
      min_stock_level: 10,
      tax_rate: 18,
      is_tax_inclusive: true,
      hsn_code: '3604',
    },
    {
      name: 'Sutli Bomb (Green Thread) - 10 pcs',
      category: 'Sound Crackers',
      unit: 'box',
      selling_price: 12000,
      mrp: 15000,
      purchase_price: 7000,
      current_stock: 100,
      min_stock_level: 20,
      tax_rate: 18,
      is_tax_inclusive: true,
      hsn_code: '3604',
    },
    {
      name: 'Rocket (Sky Lanterns) - 10 pcs',
      category: 'Aerial Fireworks',
      unit: 'box',
      selling_price: 28000,
      mrp: 35000,
      purchase_price: 18000,
      current_stock: 25,
      min_stock_level: 5,
      tax_rate: 18,
      is_tax_inclusive: true,
      hsn_code: '3604',
    },
    {
      name: '7 Shots Multi-Colour Sky Flash',
      category: 'Multi Shots',
      unit: 'piece',
      selling_price: 45000,
      mrp: 55000,
      purchase_price: 28000,
      current_stock: 15,
      min_stock_level: 5,
      tax_rate: 18,
      is_tax_inclusive: true,
      hsn_code: '3604',
    },
    {
      name: 'Kids Pop-Pop Matches (Magic Snaps) - 50 pcs',
      category: 'Kids Crackers',
      unit: 'box',
      selling_price: 5000,
      mrp: 8000,
      purchase_price: 2500,
      current_stock: 200,
      min_stock_level: 50,
      tax_rate: 18,
      is_tax_inclusive: true,
      hsn_code: '3604',
    },
    {
      name: 'Zamin Chakkar (Ground Spinner) Big - 10 pcs',
      category: 'Ground Spinners',
      unit: 'box',
      selling_price: 22000,
      mrp: 28000,
      purchase_price: 12000,
      current_stock: 35,
      min_stock_level: 10,
      tax_rate: 18,
      is_tax_inclusive: true,
      hsn_code: '3604',
    },
    {
      name: 'Butterfly Crackers (Helicopter) - 5 pcs',
      category: 'Kids Crackers',
      unit: 'box',
      selling_price: 18000,
      mrp: 22000,
      purchase_price: 9000,
      current_stock: 45,
      min_stock_level: 10,
      tax_rate: 18,
      is_tax_inclusive: true,
      hsn_code: '3604',
    }
];

/** Back-compat alias for callers that still ask for "the default products". */
export const DEFAULT_CATEGORY_PRODUCTS: SeedProductDefinition[] = DEFAULT_STARTER_PRODUCTS;

/** Returns the universal starter product list. */
export function getDefaultProductsForCategory(): SeedProductDefinition[] {
  return DEFAULT_STARTER_PRODUCTS;
}

/**
 * Auto-populates the local Dexie products and categories tables with the starter items
 */
export async function seedCategoryDefaultProducts(businessId: string): Promise<Product[]> {
  const seedDefs = getDefaultProductsForCategory();
  const now = new Date().toISOString();

  // 1. Extract unique categories and ensure they exist in db.categories
  const uniqueCategoryNames = Array.from(new Set(seedDefs.map((p) => p.category)));
  const categoryMap = new Map<string, string>();

  for (let i = 0; i < uniqueCategoryNames.length; i++) {
    const catName = uniqueCategoryNames[i];
    const catId = `cat_${Date.now()}_${i}_${catName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    
    // Check if category already exists
    const existing = await db.categories
      .where('business_id')
      .equals(businessId)
      .and((c) => c.name.toLowerCase() === catName.toLowerCase())
      .first();

    if (existing) {
      categoryMap.set(catName, existing.id);
    } else {
      await db.categories.put({
        id: catId,
        business_id: businessId,
        name: catName,
        created_at: now,
      });
      categoryMap.set(catName, catId);
    }
  }

  // 2. Map seed definitions into complete schema-compliant Product objects
  const productsToSeed: Product[] = seedDefs.map((def, idx) => {
    const catId = categoryMap.get(def.category) || `cat_general_${businessId}`;
    return {
      id: `prod_seed_${Date.now()}_${idx}`,
      business_id: businessId,
      name: def.name,
      barcode: undefined, // Barcode left blank as requested
      category_id: catId,
      category_name: def.category,
      unit: def.unit,
      selling_price: def.selling_price,
      mrp: def.mrp,
      purchase_price: def.purchase_price,
      current_stock: def.current_stock || 10, // Stock set to 10
      min_stock_level: def.min_stock_level || 5,
      tax_rate: def.tax_rate,
      is_tax_inclusive: def.is_tax_inclusive !== false,
      hsn_code: def.hsn_code,
      is_loose_item: def.is_loose_item || false,
      is_favorite: idx < 3,
      is_active: true,
      created_at: now,
      updated_at: now,
      sync_status: 'synced',
    };
  });

  // 3. Inject directly into local Dexie database
  await db.products.bulkPut(productsToSeed);

  return productsToSeed;
}

