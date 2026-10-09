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
  /** v4.121.0: never counted (restaurant dishes). */
  is_unlimited_stock?: boolean;
  /** v4.121.0: sizes / colours (or Half / Full) — the item becomes a parent with one child each. */
  variants?: { label: string; stock?: number; price?: number }[];
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

/**
 * Category-specific starter products (v4.117.0; rewritten v4.121.0 — AU-03, 08, 26, 29, 30). Paise.
 * GST rates follow the 22 Sep 2025 slabs (0 / 5 / 18 %) — the shop's CA should confirm them; a shop
 * without a GSTIN never charges them anyway (v4.120.0, `gstAllowed`). Clothing sizes and restaurant
 * Half / Full are variants; restaurant dishes are never counted.
 */
export const STARTER_PRODUCTS_BY_CATEGORY: Record<string, SeedProductDefinition[]> = {
  grocery: [
    { name: 'Aashirvaad Atta 5 kg', category: 'Atta, Rice & Dal', unit: 'packet', selling_price: 27000, mrp: 29500, purchase_price: 24000, current_stock: 20, min_stock_level: 5, tax_rate: 0, is_tax_inclusive: true },
    { name: 'India Gate Basmati Rice', category: 'Atta, Rice & Dal', unit: 'kg', selling_price: 9500, mrp: 10500, purchase_price: 8000, current_stock: 30, min_stock_level: 5, tax_rate: 0, is_tax_inclusive: true },
    { name: 'Toor Dal', category: 'Atta, Rice & Dal', unit: 'kg', selling_price: 16000, mrp: 17000, purchase_price: 14000, current_stock: 20, min_stock_level: 5, tax_rate: 0, is_tax_inclusive: true },
    { name: 'Sugar', category: 'Atta, Rice & Dal', unit: 'kg', selling_price: 4500, mrp: 4800, purchase_price: 4000, current_stock: 50, min_stock_level: 10, tax_rate: 0, is_tax_inclusive: true },
    { name: 'Tata Salt 1 kg', category: 'Atta, Rice & Dal', unit: 'packet', selling_price: 2800, mrp: 2800, purchase_price: 2300, current_stock: 40, min_stock_level: 10, tax_rate: 0, is_tax_inclusive: true },
    { name: 'Fortune Sunflower Oil 1 L', category: 'Oil & Spices', unit: 'packet', selling_price: 13500, mrp: 14500, purchase_price: 12000, current_stock: 25, min_stock_level: 5, tax_rate: 5, is_tax_inclusive: true, hsn_code: '1512' },
    { name: 'Amul Taaza Milk 500 ml', category: 'Dairy', unit: 'packet', selling_price: 2800, mrp: 2800, purchase_price: 2500, current_stock: 40, min_stock_level: 10, tax_rate: 0, is_tax_inclusive: true },
    { name: 'Maggi 2-Minute Noodles 70 g', category: 'Snacks & Biscuits', unit: 'packet', selling_price: 1500, mrp: 1500, purchase_price: 1200, current_stock: 50, min_stock_level: 15, tax_rate: 5, is_tax_inclusive: true, hsn_code: '1902' },
    { name: 'Britannia Good Day Biscuits 200 g', category: 'Snacks & Biscuits', unit: 'packet', selling_price: 3500, mrp: 4000, purchase_price: 2800, current_stock: 30, min_stock_level: 10, tax_rate: 5, is_tax_inclusive: true, hsn_code: '1905' },
    { name: 'Surf Excel Detergent Bar', category: 'Home Care', unit: 'piece', selling_price: 3000, mrp: 3500, purchase_price: 2400, current_stock: 35, min_stock_level: 10, tax_rate: 18, is_tax_inclusive: true, hsn_code: '3402' },
  ],
  pharmacy: [
    { name: 'Dolo 650 Tablet (15 tab)', category: 'Tablets & Capsules', unit: 'strip', selling_price: 3200, mrp: 3400, purchase_price: 2600, current_stock: 50, min_stock_level: 10, tax_rate: 5, is_tax_inclusive: true, hsn_code: '3004' },
    { name: 'Cetirizine 10 mg Tablet (10 tab)', category: 'Tablets & Capsules', unit: 'strip', selling_price: 2000, mrp: 2300, purchase_price: 1600, current_stock: 30, min_stock_level: 10, tax_rate: 5, is_tax_inclusive: true, hsn_code: '3004' },
    { name: 'Pantoprazole 40 mg Tablet (15 tab)', category: 'Tablets & Capsules', unit: 'strip', selling_price: 8000, mrp: 9000, purchase_price: 6500, current_stock: 25, min_stock_level: 5, tax_rate: 5, is_tax_inclusive: true, hsn_code: '3004' },
    { name: 'Azithromycin 500 mg Tablet (5 tab)', category: 'Tablets & Capsules', unit: 'strip', selling_price: 5200, mrp: 5700, purchase_price: 4300, current_stock: 20, min_stock_level: 5, tax_rate: 5, is_tax_inclusive: true, hsn_code: '3004' },
    { name: 'Disprin Regular Tablet (10 tab)', category: 'Tablets & Capsules', unit: 'strip', selling_price: 1700, mrp: 1900, purchase_price: 1300, current_stock: 40, min_stock_level: 10, tax_rate: 5, is_tax_inclusive: true, hsn_code: '3004' },
    { name: 'Benadryl Cough Syrup 100 ml', category: 'Syrups', unit: 'bottle', selling_price: 9000, mrp: 9500, purchase_price: 7600, current_stock: 20, min_stock_level: 5, tax_rate: 5, is_tax_inclusive: true, hsn_code: '3004' },
    { name: 'Electral ORS Powder 21.8 g', category: 'Syrups', unit: 'packet', selling_price: 2200, mrp: 2300, purchase_price: 1800, current_stock: 40, min_stock_level: 10, tax_rate: 5, is_tax_inclusive: true, hsn_code: '3004' },
    { name: 'Betadine 5% Ointment 20 g', category: 'Ointments & First Aid', unit: 'piece', selling_price: 5200, mrp: 5700, purchase_price: 4300, current_stock: 15, min_stock_level: 5, tax_rate: 5, is_tax_inclusive: true, hsn_code: '3004' },
    { name: 'Hansaplast Bandage (Box of 20)', category: 'Ointments & First Aid', unit: 'box', selling_price: 4300, mrp: 4800, purchase_price: 3500, current_stock: 20, min_stock_level: 5, tax_rate: 5, is_tax_inclusive: true, hsn_code: '3005' },
    { name: 'Volini Pain Relief Gel 30 g', category: 'Ointments & First Aid', unit: 'piece', selling_price: 11500, mrp: 12900, purchase_price: 9500, current_stock: 15, min_stock_level: 5, tax_rate: 5, is_tax_inclusive: true, hsn_code: '3004' },
  ],
  clothing: [
    { name: 'Men Cotton T-Shirt', category: 'Men Wear', unit: 'piece', selling_price: 39900, mrp: 59900, purchase_price: 25000, current_stock: 0, min_stock_level: 2, tax_rate: 5, is_tax_inclusive: true, hsn_code: '6109', variants: [{ label: 'S', stock: 4 }, { label: 'M', stock: 6 }, { label: 'L', stock: 5 }, { label: 'XL', stock: 3 }] },
    { name: 'Men Formal Shirt Full Sleeve', category: 'Men Wear', unit: 'piece', selling_price: 69900, mrp: 99900, purchase_price: 45000, current_stock: 0, min_stock_level: 2, tax_rate: 5, is_tax_inclusive: true, hsn_code: '6205', variants: [{ label: '38', stock: 3 }, { label: '40', stock: 4 }, { label: '42', stock: 3 }] },
    { name: 'Men Slim Fit Jeans', category: 'Men Wear', unit: 'piece', selling_price: 99900, mrp: 149900, purchase_price: 65000, current_stock: 0, min_stock_level: 2, tax_rate: 5, is_tax_inclusive: true, hsn_code: '6203', variants: [{ label: '30', stock: 4 }, { label: '32', stock: 5 }, { label: '34', stock: 3 }] },
    { name: 'Women Cotton Kurti', category: 'Women Wear', unit: 'piece', selling_price: 59900, mrp: 89900, purchase_price: 35000, current_stock: 0, min_stock_level: 2, tax_rate: 5, is_tax_inclusive: true, hsn_code: '6204', variants: [{ label: 'S', stock: 5 }, { label: 'M', stock: 8 }, { label: 'L', stock: 3 }] },
    { name: 'Designer Silk Saree', category: 'Women Wear', unit: 'piece', selling_price: 199900, mrp: 249900, purchase_price: 130000, current_stock: 8, min_stock_level: 2, tax_rate: 5, is_tax_inclusive: true, hsn_code: '5007' },
    { name: 'Women Cotton Leggings', category: 'Women Wear', unit: 'piece', selling_price: 29900, mrp: 44900, purchase_price: 18000, current_stock: 20, min_stock_level: 5, tax_rate: 5, is_tax_inclusive: true, hsn_code: '6104' },
    { name: 'Kids T-Shirt & Shorts Set', category: 'Kids Wear', unit: 'set', selling_price: 44900, mrp: 64900, purchase_price: 27000, current_stock: 12, min_stock_level: 3, tax_rate: 5, is_tax_inclusive: true, hsn_code: '6111' },
    { name: 'Cotton Socks (3 pairs)', category: 'Accessories', unit: 'set', selling_price: 19900, mrp: 29900, purchase_price: 11000, current_stock: 25, min_stock_level: 5, tax_rate: 5, is_tax_inclusive: true, hsn_code: '6115' },
    { name: 'Cotton Handkerchief (Pack of 6)', category: 'Accessories', unit: 'packet', selling_price: 14900, mrp: 19900, purchase_price: 8000, current_stock: 20, min_stock_level: 5, tax_rate: 5, is_tax_inclusive: true, hsn_code: '6213' },
    { name: 'Casual Polo T-Shirt', category: 'Men Wear', unit: 'piece', selling_price: 49900, mrp: 79900, purchase_price: 31000, current_stock: 10, min_stock_level: 3, tax_rate: 5, is_tax_inclusive: true, hsn_code: '6105' },
  ],
  hardware: [
    { name: 'USB Type-C Fast Charging Cable 1 m', category: 'Mobile Accessories', unit: 'piece', selling_price: 19900, mrp: 29900, purchase_price: 9000, current_stock: 25, min_stock_level: 5, tax_rate: 18, is_tax_inclusive: true, hsn_code: '8544' },
    { name: '20W PD Fast Charger', category: 'Mobile Accessories', unit: 'piece', selling_price: 49900, mrp: 79900, purchase_price: 26000, current_stock: 15, min_stock_level: 4, tax_rate: 18, is_tax_inclusive: true, hsn_code: '8504' },
    { name: 'Tempered Glass Screen Guard', category: 'Mobile Accessories', unit: 'piece', selling_price: 14900, mrp: 29900, purchase_price: 4000, current_stock: 40, min_stock_level: 10, tax_rate: 18, is_tax_inclusive: true, hsn_code: '7007' },
    { name: 'Power Bank 10000 mAh', category: 'Mobile Accessories', unit: 'piece', selling_price: 99900, mrp: 149900, purchase_price: 65000, current_stock: 8, min_stock_level: 2, tax_rate: 18, is_tax_inclusive: true, hsn_code: '8507' },
    { name: 'Bluetooth Neckband Earphones', category: 'Audio & Gadgets', unit: 'piece', selling_price: 89900, mrp: 149900, purchase_price: 50000, current_stock: 10, min_stock_level: 3, tax_rate: 18, is_tax_inclusive: true, hsn_code: '8518' },
    { name: 'In-Ear Wired Earphones 3.5 mm', category: 'Audio & Gadgets', unit: 'piece', selling_price: 19900, mrp: 34900, purchase_price: 9500, current_stock: 20, min_stock_level: 5, tax_rate: 18, is_tax_inclusive: true, hsn_code: '8518' },
    { name: 'Wireless Optical Mouse', category: 'Computer Accessories', unit: 'piece', selling_price: 34900, mrp: 54900, purchase_price: 18000, current_stock: 12, min_stock_level: 3, tax_rate: 18, is_tax_inclusive: true, hsn_code: '8471' },
    { name: 'HDMI Cable 1.5 m', category: 'Computer Accessories', unit: 'piece', selling_price: 29900, mrp: 49900, purchase_price: 12000, current_stock: 15, min_stock_level: 3, tax_rate: 18, is_tax_inclusive: true, hsn_code: '8544' },
    { name: '4-Socket Extension Board', category: 'Electricals', unit: 'piece', selling_price: 44900, mrp: 59900, purchase_price: 27000, current_stock: 10, min_stock_level: 3, tax_rate: 18, is_tax_inclusive: true, hsn_code: '8536' },
    { name: 'Screwdriver Tool Set (24-in-1)', category: 'Electricals', unit: 'set', selling_price: 39900, mrp: 59900, purchase_price: 22000, current_stock: 10, min_stock_level: 2, tax_rate: 18, is_tax_inclusive: true, hsn_code: '8205' },
  ],
  restaurant: [
    { name: 'Masala Chai', category: 'Hot Beverages', unit: 'piece', selling_price: 2000, mrp: 2000, purchase_price: 0, current_stock: 0, min_stock_level: 0, tax_rate: 5, is_tax_inclusive: true, is_unlimited_stock: true },
    { name: 'Filter Coffee', category: 'Hot Beverages', unit: 'piece', selling_price: 3000, mrp: 3000, purchase_price: 0, current_stock: 0, min_stock_level: 0, tax_rate: 5, is_tax_inclusive: true, is_unlimited_stock: true },
    { name: 'Veg Grilled Sandwich', category: 'Snacks', unit: 'plate', selling_price: 8000, mrp: 8000, purchase_price: 0, current_stock: 0, min_stock_level: 0, tax_rate: 5, is_tax_inclusive: true, is_unlimited_stock: true },
    { name: 'Masala Dosa', category: 'South Indian', unit: 'plate', selling_price: 7000, mrp: 7000, purchase_price: 0, current_stock: 0, min_stock_level: 0, tax_rate: 5, is_tax_inclusive: true, is_unlimited_stock: true },
    { name: 'Paneer Butter Masala', category: 'Main Course', unit: 'portion', selling_price: 18000, mrp: 18000, purchase_price: 0, current_stock: 0, min_stock_level: 0, tax_rate: 5, is_tax_inclusive: true, is_unlimited_stock: true, variants: [{ label: 'Half', price: 11000 }, { label: 'Full', price: 18000 }] },
    { name: 'Veg Biryani', category: 'Main Course', unit: 'portion', selling_price: 15000, mrp: 15000, purchase_price: 0, current_stock: 0, min_stock_level: 0, tax_rate: 5, is_tax_inclusive: true, is_unlimited_stock: true, variants: [{ label: 'Half', price: 9000 }, { label: 'Full', price: 15000 }] },
    { name: 'Butter Naan', category: 'Main Course', unit: 'piece', selling_price: 3500, mrp: 3500, purchase_price: 0, current_stock: 0, min_stock_level: 0, tax_rate: 5, is_tax_inclusive: true, is_unlimited_stock: true },
    { name: 'Deluxe Veg Thali', category: 'Thali', unit: 'plate', selling_price: 16000, mrp: 16000, purchase_price: 0, current_stock: 0, min_stock_level: 0, tax_rate: 5, is_tax_inclusive: true, is_unlimited_stock: true },
    { name: 'Fresh Lime Soda', category: 'Cold Beverages', unit: 'piece', selling_price: 4500, mrp: 4500, purchase_price: 0, current_stock: 0, min_stock_level: 0, tax_rate: 5, is_tax_inclusive: true, is_unlimited_stock: true },
    { name: 'Mineral Water 1 L', category: 'Cold Beverages', unit: 'bottle', selling_price: 2000, mrp: 2000, purchase_price: 0, current_stock: 0, min_stock_level: 0, tax_rate: 5, is_tax_inclusive: true, is_unlimited_stock: true },
  ],
  retail: [
    { name: 'Reynolds Ball Pen (Pack of 5)', category: 'Stationery', unit: 'packet', selling_price: 5000, mrp: 5000, purchase_price: 3800, current_stock: 30, min_stock_level: 5, tax_rate: 18, is_tax_inclusive: true, hsn_code: '9608' },
    { name: 'Classmate Notebook 172 Pages', category: 'Stationery', unit: 'piece', selling_price: 6000, mrp: 6500, purchase_price: 4800, current_stock: 40, min_stock_level: 10, tax_rate: 0, is_tax_inclusive: true, hsn_code: '4820' },
    { name: 'Fevicol MR 50 g', category: 'Stationery', unit: 'piece', selling_price: 2000, mrp: 2000, purchase_price: 1600, current_stock: 25, min_stock_level: 5, tax_rate: 18, is_tax_inclusive: true, hsn_code: '3506' },
    { name: 'Cello Tape 1 inch', category: 'Stationery', unit: 'piece', selling_price: 1500, mrp: 1500, purchase_price: 1000, current_stock: 30, min_stock_level: 5, tax_rate: 18, is_tax_inclusive: true, hsn_code: '3919' },
    { name: 'Duracell AA Battery (Pack of 2)', category: 'Electricals', unit: 'packet', selling_price: 9000, mrp: 9500, purchase_price: 7200, current_stock: 20, min_stock_level: 5, tax_rate: 18, is_tax_inclusive: true, hsn_code: '8506' },
    { name: 'Dettol Soap 125 g', category: 'Personal Care', unit: 'piece', selling_price: 5500, mrp: 6000, purchase_price: 4500, current_stock: 30, min_stock_level: 10, tax_rate: 5, is_tax_inclusive: true, hsn_code: '3401' },
    { name: 'Colgate Toothpaste 200 g', category: 'Personal Care', unit: 'piece', selling_price: 11000, mrp: 12000, purchase_price: 9000, current_stock: 20, min_stock_level: 5, tax_rate: 5, is_tax_inclusive: true, hsn_code: '3306' },
    { name: 'Steel Water Bottle 1 L', category: 'Household', unit: 'piece', selling_price: 45000, mrp: 59900, purchase_price: 30000, current_stock: 10, min_stock_level: 2, tax_rate: 5, is_tax_inclusive: true, hsn_code: '7323' },
    { name: 'Plastic Bucket 20 L', category: 'Household', unit: 'piece', selling_price: 25000, mrp: 29900, purchase_price: 17000, current_stock: 10, min_stock_level: 2, tax_rate: 18, is_tax_inclusive: true, hsn_code: '3924' },
    { name: 'Folding Umbrella', category: 'Household', unit: 'piece', selling_price: 35000, mrp: 45000, purchase_price: 22000, current_stock: 10, min_stock_level: 2, tax_rate: 5, is_tax_inclusive: true, hsn_code: '6601' },
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
  // v4.121.0: an item with variants becomes a parent (never sold itself) + one child per size /
  // Half-Full, each with its own stock or price; restaurant dishes are never counted.
  const stamp = Date.now();
  const productsToSeed: Product[] = seedDefs.flatMap((def, idx) => {
    const catId = categoryMap.get(def.category) || `cat_general_${businessId}`;
    const base: Product = {
      id: `prod_seed_${stamp}_${idx}`,
      business_id: businessId,
      name: def.name,
      barcode: undefined, // Barcode left blank as requested
      category_id: catId,
      category_name: def.category,
      unit: def.unit,
      selling_price: def.selling_price,
      mrp: def.mrp,
      purchase_price: def.purchase_price,
      current_stock: def.is_unlimited_stock || def.variants?.length ? 0 : def.current_stock || 10,
      min_stock_level: def.is_unlimited_stock ? 0 : def.min_stock_level || 5,
      ...(def.is_unlimited_stock ? { is_unlimited_stock: true } : {}),
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
    if (!def.variants?.length) return [base];
    const parent: Product = { ...base, has_variants: true, current_stock: 0 };
    const children: Product[] = def.variants.map((v, i) => ({
      ...base,
      id: `prod_seed_${stamp}_${idx}_${i}`,
      name: `${def.name} (${v.label})`,
      parent_id: parent.id,
      variant_label: v.label,
      ...(def.is_unlimited_stock ? {} : { size: v.label }),
      selling_price: v.price ?? def.selling_price,
      mrp: v.price ?? def.mrp,
      current_stock: def.is_unlimited_stock ? 0 : v.stock ?? 0,
      is_favorite: false,
    }));
    return [parent, ...children];
  });

  // 3. Inject directly into local Dexie database
  await db.products.bulkPut(productsToSeed);

  return productsToSeed;
}

