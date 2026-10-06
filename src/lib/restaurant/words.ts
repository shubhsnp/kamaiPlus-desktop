/*
 * Restaurant words (v4.107.0). In Restaurant mode the same screens speak a restaurant's language:
 * "Products" → "Menu", "Customers" → "Guests", "Transactions" → "Bills"… Only WORDS change here —
 * every screen works exactly as before, and nothing branches on the shop type (Bible §9).
 *
 * How it works: `tr()` (lib/i18n/core.ts) looks a text up here first while Restaurant mode is on,
 * then translates the result to Hindi / Marathi as usual — so every replacement below also has a
 * hi / mr translation in src/locales. Keys are the exact English texts used in the app (a Suite 21
 * check fails if one of them no longer exists anywhere in src/).
 */
export const RESTAURANT_WORDS: Record<string, string> = {
  // Menu (sidebar) and Home
  'POS & Counter': 'Restaurant',
  'Billing POS': 'Tables & Orders',
  'Stock & Sourcing': 'Menu & Kitchen',
  'Ledger & Customers': 'Guests & Khata',
  'Transactions': 'Bills',
  'Customers': 'Guests',
  'Products': 'Menu',
  '+ New Bill (POS)': '+ New Order',
  'Fast Barcode Checkout': 'Tables, takeaway & KOT',
  'F1 opens a new bill from any screen': 'F1 opens Tables & Orders from any screen',
  '{productsCount} SKUs': '{productsCount} dishes',

  // Menu page (Products)
  '{totalProducts} registered products with barcodes, pricing & instant stock tracking': '{totalProducts} dishes on your menu',
  'Add Product': 'Add Dish',
  'Import Excel': 'Import menu (Excel)',
  'Add or update many items from an Excel / CSV price list': 'Add or update many dishes from an Excel menu',
  'Catalog Items': 'Dishes',
  'Registered products': 'On the menu',
  'All Items': 'All dishes',
  'No products found': 'No dishes found',
  'Try adjusting your filters or click "Add Product".': 'Try another search, or click "Add Dish".',
  'Search by product name, barcode, HSN, size, color...': 'Search dishes by name or category…',

  // Add / Edit dish
  'Add New Item to Catalog': 'Add a dish to the menu',
  'Enter product details, barcode, selling price, and initial stock.': 'Dish name, category and price. Half / Full go in Variants.',
  'Edit Item: {name}': 'Edit dish: {name}',
  'Update pricing, barcode and inventory levels.': 'Change the name, category or price.',
  'Product / Item Full Name *': 'Dish name *',
  'e.g. Fortune Sunflower Oil 1L': 'e.g. Paneer Butter Masala',
  'MRP (₹) *': 'Price (₹) *',
  'Save Product': 'Save Dish',
  'Update Product': 'Update Dish',
  'General Products': 'Menu',

  // Guests (Customers page)
  'Add Customer': 'Add Guest',
  'No customers found': 'No guests found',

  // Bill window after paying
  '+ New Bill': 'Back to Tables',
  'Sale Completed': 'Bill paid',

  // Store set-up
  'e.g. Sharma Kirana & General Store': 'e.g. Sharma Family Restaurant',
};
