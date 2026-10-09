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

/** Category-specific starter products matching retail verticals (all amounts in paise) */
export const STARTER_PRODUCTS_BY_CATEGORY: Record<string, SeedProductDefinition[]> = {
  grocery: [
    { name: 'Aashirvaad Atta 5 kg', category: 'Atta, Rice & Dal', unit: 'packet', selling_price: 27000, mrp: 29500, purchase_price: 24000, current_stock: 20, min_stock_level: 5, tax_rate: 0, is_tax_inclusive: true },
    { name: 'India Gate Basmati Rice 1 kg', category: 'Atta, Rice & Dal', unit: 'kg', selling_price: 9500, mrp: 10500, purchase_price: 8000, current_stock: 30, min_stock_level: 5, tax_rate: 0, is_tax_inclusive: true },
    { name: 'Toor Dal 1 kg', category: 'Atta, Rice & Dal', unit: 'kg', selling_price: 16000, mrp: 17000, purchase_price: 14000, current_stock: 20, min_stock_level: 5, tax_rate: 0, is_tax_inclusive: true },
    { name: 'Sugar 1 kg', category: 'Atta, Rice & Dal', unit: 'kg', selling_price: 4500, mrp: 4800, purchase_price: 4000, current_stock: 50, min_stock_level: 10, tax_rate: 0, is_tax_inclusive: true },
    { name: 'Fortune Sunflower Oil 1 L', category: 'Cooking Oil & Spices', unit: 'litre', selling_price: 13500, mrp: 14500, purchase_price: 12000, current_stock: 25, min_stock_level: 5, tax_rate: 5, is_tax_inclusive: true },
    { name: 'Amul Full Cream Milk 500 ml', category: 'Dairy & Eggs', unit: 'packet', selling_price: 3400, mrp: 3400, purchase_price: 3000, current_stock: 40, min_stock_level: 10, tax_rate: 0, is_tax_inclusive: true },
    { name: 'Maggi 2-Minute Noodles 70 g', category: 'Snacks & Beverages', unit: 'packet', selling_price: 1500, mrp: 1500, purchase_price: 1200, current_stock: 50, min_stock_level: 15, tax_rate: 12, is_tax_inclusive: true },
    { name: 'Britannia Good Day Biscuits 200 g', category: 'Snacks & Beverages', unit: 'packet', selling_price: 3500, mrp: 4000, purchase_price: 2800, current_stock: 30, min_stock_level: 10, tax_rate: 18, is_tax_inclusive: true },
    { name: 'Surf Excel Detergent Bar', category: 'Home Care', unit: 'piece', selling_price: 3000, mrp: 3500, purchase_price: 2400, current_stock: 35, min_stock_level: 10, tax_rate: 18, is_tax_inclusive: true },
    { name: 'Tata Salt 1 kg', category: 'Atta, Rice & Dal', unit: 'packet', selling_price: 2800, mrp: 2800, purchase_price: 2300, current_stock: 40, min_stock_level: 10, tax_rate: 0, is_tax_inclusive: true },
  ],
  pharmacy: [
    { name: 'Dolo 650 Paracetamol (Strip of 15)', category: 'Tablets & Capsules', unit: 'box', selling_price: 3500, mrp: 3700, purchase_price: 2800, current_stock: 50, min_stock_level: 10, tax_rate: 12, is_tax_inclusive: true, hsn_code: '3004' },
    { name: 'Cetirizine 10mg (Strip of 10)', category: 'Tablets & Capsules', unit: 'box', selling_price: 2200, mrp: 2500, purchase_price: 1800, current_stock: 30, min_stock_level: 10, tax_rate: 12, is_tax_inclusive: true, hsn_code: '3004' },
    { name: 'Pantoprazole 40mg (Strip of 15)', category: 'Tablets & Capsules', unit: 'box', selling_price: 8500, mrp: 9500, purchase_price: 7000, current_stock: 25, min_stock_level: 5, tax_rate: 12, is_tax_inclusive: true, hsn_code: '3004' },
    { name: 'Azithromycin 500mg (Strip of 5)', category: 'Tablets & Capsules', unit: 'box', selling_price: 5500, mrp: 6000, purchase_price: 4500, current_stock: 20, min_stock_level: 5, tax_rate: 12, is_tax_inclusive: true, hsn_code: '3004' },
    { name: 'Benadryl Cough Syrup 100 ml', category: 'Syrups & Suspensions', unit: 'bottle', selling_price: 9500, mrp: 9900, purchase_price: 8000, current_stock: 20, min_stock_level: 5, tax_rate: 12, is_tax_inclusive: true, hsn_code: '3004' },
    { name: 'Betadine 5% Ointment 20 g', category: 'Ointments & First Aid', unit: 'piece', selling_price: 5500, mrp: 6000, purchase_price: 4500, current_stock: 15, min_stock_level: 5, tax_rate: 12, is_tax_inclusive: true, hsn_code: '3004' },
    { name: 'Hansaplast Bandage Strips (Box of 20)', category: 'Ointments & First Aid', unit: 'box', selling_price: 4500, mrp: 5000, purchase_price: 3600, current_stock: 20, min_stock_level: 5, tax_rate: 12, is_tax_inclusive: true, hsn_code: '3005' },
    { name: 'Disprin Regular (Strip of 10)', category: 'Tablets & Capsules', unit: 'box', selling_price: 1800, mrp: 2000, purchase_price: 1400, current_stock: 40, min_stock_level: 10, tax_rate: 12, is_tax_inclusive: true, hsn_code: '3004' },
    { name: 'Eno Regular Fruit Salt (5g Sachet)', category: 'Digestion & Antacid', unit: 'packet', selling_price: 900, mrp: 1000, purchase_price: 750, current_stock: 60, min_stock_level: 15, tax_rate: 12, is_tax_inclusive: true },
    { name: 'Volini Pain Relief Gel 30 g', category: 'Ointments & First Aid', unit: 'piece', selling_price: 12000, mrp: 13500, purchase_price: 9800, current_stock: 15, min_stock_level: 5, tax_rate: 12, is_tax_inclusive: true, hsn_code: '3004' },
  ],
  clothing: [
    { name: 'Men Cotton T-Shirt (Size M)', category: 'Men Wear', unit: 'piece', selling_price: 39900, mrp: 59900, purchase_price: 25000, current_stock: 15, min_stock_level: 5, tax_rate: 5, is_tax_inclusive: true, hsn_code: '6109' },
    { name: 'Men Formal Shirt Full Sleeve (Size 40)', category: 'Men Wear', unit: 'piece', selling_price: 69900, mrp: 99900, purchase_price: 45000, current_stock: 10, min_stock_level: 3, tax_rate: 5, is_tax_inclusive: true, hsn_code: '6205' },
    { name: 'Men Slim Fit Denim Jeans (Size 32)', category: 'Men Wear', unit: 'piece', selling_price: 99900, mrp: 149900, purchase_price: 65000, current_stock: 12, min_stock_level: 3, tax_rate: 5, is_tax_inclusive: true, hsn_code: '6203' },
    { name: 'Women Cotton Kurti (Size M)', category: 'Women Wear', unit: 'piece', selling_price: 59900, mrp: 89900, purchase_price: 35000, current_stock: 15, min_stock_level: 5, tax_rate: 5, is_tax_inclusive: true, hsn_code: '6204' },
    { name: 'Designer Silk Saree', category: 'Women Wear', unit: 'piece', selling_price: 199900, mrp: 299900, purchase_price: 130000, current_stock: 8, min_stock_level: 2, tax_rate: 5, is_tax_inclusive: true, hsn_code: '5208' },
    { name: 'Women Leggings Cotton Ankle Length', category: 'Women Wear', unit: 'piece', selling_price: 29900, mrp: 44900, purchase_price: 18000, current_stock: 20, min_stock_level: 5, tax_rate: 5, is_tax_inclusive: true, hsn_code: '6104' },
    { name: 'Cotton Socks (Pack of 3 Pairs)', category: 'Accessories', unit: 'pair', selling_price: 19900, mrp: 29900, purchase_price: 11000, current_stock: 25, min_stock_level: 5, tax_rate: 5, is_tax_inclusive: true, hsn_code: '6115' },
    { name: 'Kids T-Shirt & Shorts Combo', category: 'Kids Wear', unit: 'set', selling_price: 44900, mrp: 64900, purchase_price: 27000, current_stock: 12, min_stock_level: 3, tax_rate: 5, is_tax_inclusive: true, hsn_code: '6111' },
    { name: 'Leather Belt (Men)', category: 'Accessories', unit: 'piece', selling_price: 34900, mrp: 49900, purchase_price: 19000, current_stock: 15, min_stock_level: 4, tax_rate: 18, is_tax_inclusive: true, hsn_code: '4203' },
    { name: 'Casual Polo T-Shirt (Size L)', category: 'Men Wear', unit: 'piece', selling_price: 49900, mrp: 79900, purchase_price: 31000, current_stock: 10, min_stock_level: 3, tax_rate: 5, is_tax_inclusive: true, hsn_code: '6105' },
  ],
  hardware: [
    { name: 'USB Type-C Fast Charging Cable (1m)', category: 'Mobile Accessories', unit: 'piece', selling_price: 19900, mrp: 29900, purchase_price: 9000, current_stock: 25, min_stock_level: 5, tax_rate: 18, is_tax_inclusive: true, hsn_code: '8544' },
    { name: '20W PD Adapter Fast Charger', category: 'Mobile Accessories', unit: 'piece', selling_price: 49900, mrp: 79900, purchase_price: 26000, current_stock: 15, min_stock_level: 4, tax_rate: 18, is_tax_inclusive: true, hsn_code: '8504' },
    { name: '9W LED Bulb Cool Day White', category: 'Electricals', unit: 'piece', selling_price: 12000, mrp: 16000, purchase_price: 7500, current_stock: 40, min_stock_level: 10, tax_rate: 12, is_tax_inclusive: true, hsn_code: '8539' },
    { name: 'Wireless Optical Mouse 2.4GHz', category: 'Computer Accessories', unit: 'piece', selling_price: 34900, mrp: 54900, purchase_price: 18000, current_stock: 12, min_stock_level: 3, tax_rate: 18, is_tax_inclusive: true, hsn_code: '8471' },
    { name: 'Power Bank 10000mAh Dual USB', category: 'Mobile Accessories', unit: 'piece', selling_price: 99900, mrp: 149900, purchase_price: 65000, current_stock: 8, min_stock_level: 2, tax_rate: 18, is_tax_inclusive: true, hsn_code: '8507' },
    { name: '4-Socket Power Strip Extension Board', category: 'Electricals', unit: 'piece', selling_price: 44900, mrp: 59900, purchase_price: 27000, current_stock: 10, min_stock_level: 3, tax_rate: 18, is_tax_inclusive: true, hsn_code: '8536' },
    { name: 'In-Ear Wired Earphones 3.5mm Jack', category: 'Audio & Gadgets', unit: 'piece', selling_price: 19900, mrp: 34900, purchase_price: 9500, current_stock: 20, min_stock_level: 5, tax_rate: 18, is_tax_inclusive: true, hsn_code: '8518' },
    { name: 'Precision Screwdriver Tool Set (24-in-1)', category: 'Tools & Hardware', unit: 'box', selling_price: 39900, mrp: 59900, purchase_price: 22000, current_stock: 10, min_stock_level: 2, tax_rate: 18, is_tax_inclusive: true, hsn_code: '8205' },
  ],
  restaurant: [
    { name: 'Special Masala Chai', category: 'Hot Beverages', unit: 'piece', selling_price: 2000, mrp: 2000, purchase_price: 800, current_stock: 100, min_stock_level: 10, tax_rate: 5, is_tax_inclusive: true },
    { name: 'South Indian Filter Coffee', category: 'Hot Beverages', unit: 'piece', selling_price: 3000, mrp: 3000, purchase_price: 1200, current_stock: 80, min_stock_level: 10, tax_rate: 5, is_tax_inclusive: true },
    { name: 'Veg Grilled Cheese Sandwich', category: 'Snacks & Quick Bites', unit: 'piece', selling_price: 8000, mrp: 8000, purchase_price: 3500, current_stock: 50, min_stock_level: 10, tax_rate: 5, is_tax_inclusive: true },
    { name: 'Masala Dosa with Sambar & Chutney', category: 'South Indian', unit: 'piece', selling_price: 7000, mrp: 7000, purchase_price: 3000, current_stock: 50, min_stock_level: 10, tax_rate: 5, is_tax_inclusive: true },
    { name: 'Paneer Butter Masala', category: 'Main Course', unit: 'piece', selling_price: 18000, mrp: 18000, purchase_price: 8500, current_stock: 30, min_stock_level: 5, tax_rate: 5, is_tax_inclusive: true },
    { name: 'Butter Tandoori Naan', category: 'Main Course', unit: 'piece', selling_price: 3500, mrp: 3500, purchase_price: 1200, current_stock: 100, min_stock_level: 15, tax_rate: 5, is_tax_inclusive: true },
    { name: 'Special Deluxe Veg Thali', category: 'Thali & Combos', unit: 'piece', selling_price: 16000, mrp: 16000, purchase_price: 7500, current_stock: 40, min_stock_level: 5, tax_rate: 5, is_tax_inclusive: true },
    { name: 'Fresh Lime Soda (Sweet & Salt)', category: 'Cold Beverages', unit: 'piece', selling_price: 4500, mrp: 4500, purchase_price: 1500, current_stock: 60, min_stock_level: 10, tax_rate: 5, is_tax_inclusive: true },
    { name: 'Mineral Water 1 Litre', category: 'Cold Beverages', unit: 'bottle', selling_price: 2000, mrp: 2000, purchase_price: 1400, current_stock: 80, min_stock_level: 20, tax_rate: 18, is_tax_inclusive: true },
  ],
  retail: [
    ...DEFAULT_STARTER_PRODUCTS,
  ],
};

/** Back-compat alias for callers that still ask for "the default products". */
export const DEFAULT_CATEGORY_PRODUCTS: SeedProductDefinition[] = DEFAULT_STARTER_PRODUCTS;

/** Returns the starter product list, optionally tuned to the merchant's category. */
export function getDefaultProductsForCategory(categoryKey?: string): SeedProductDefinition[] {
  if (categoryKey && STARTER_PRODUCTS_BY_CATEGORY[categoryKey]) {
    return STARTER_PRODUCTS_BY_CATEGORY[categoryKey];
  }
  return DEFAULT_STARTER_PRODUCTS;
}

/**
 * Auto-populates the local Dexie products and categories tables with the starter items
 */
export async function seedCategoryDefaultProducts(businessId: string, categoryKey?: string): Promise<Product[]> {
  const seedDefs = getDefaultProductsForCategory(categoryKey);
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

