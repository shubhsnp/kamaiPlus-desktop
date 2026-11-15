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
  '{productsCount} item': '{productsCount} dish',
  '{productsCount} items': '{productsCount} dishes',

  // Menu page (Products)
  '{totalProducts} products with prices & stock': '{totalProducts} dishes on your menu',
  '1 product with prices & stock': '1 dish on your menu',
  'Add Product': 'Add Dish',
  'Manage Products': 'Manage Menu', // Inventory & Stock header (inventory is on for a restaurant since v4.165.0)
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
  'Customer Directory & CRM': 'Guest List',
  'registered customers •': 'guests •',
  'Add Customer': 'Add Guest',
  'No customers found': 'No guests found',
  // v4.146.0: the last "Customer" words in Restaurant mode (the phone says Guest everywhere too)
  'Customer Udhar': 'Guest Udhar',
  'Customer Udhar (Credit):': 'Guest Udhar (Credit):',
  '+ Add First Customer': '+ Add First Guest',
  'Select a Customer': 'Select a Guest',
  // v4.147.0: Home — a restaurant has no margins or dead stock
  'Deep sales reports • Customer udhar & margins • Dead stock': 'Deep sales reports • Top dishes • Guest udhar',
  'Parties • Items • Profit': 'Guests • Dishes • Bills',

  // Bill window after paying
  '+ New Bill': 'Back to Tables',
  'Sale Completed': 'Bill paid',
  // v4.152.0: a bill without a name is the guest's (the phone says the same).
  'Cash Customer': 'Guest',
  'registered customer •': 'guest •',
  'customer with dues': 'guest with dues',
  'customers with dues': 'guests with dues',
  'Registered customers': 'Guests on your list',
  'Search by customer name or mobile number...': 'Search guest name or mobile...',
  'Transactions (': 'Bills (',
  'Product groups': 'Menu groups',
  'Variants (Size / Colour)': 'Variants (Half / Full)',
  'Sell one item in many sizes or colours, each with its own price and stock.': 'One dish in Half / Full or other portions, each with its own price.',
  'Parties ({v1})': 'Guests ({v1})',
  'Items ({v1})': 'Dishes ({v1})',
  'Filter by customer, category or product…': 'Filter by guest, category or dish…',

  // Store set-up
  'e.g. Sharma Kirana & General Store': 'e.g. Sharma Family Restaurant',
  'e.g. Always Fresh, Best Wholesale Rates': 'e.g. Pure veg · Family dining',

  // Status bar (F1)
  'New bill': 'Tables & Orders',

  // v4.184.0: WhatsApp window — the standard last line of a restaurant's messages
  'Empty = "Thank you for shopping with us! Visit again"': 'Empty = "Thank you for dining with us! Visit again"',
};
