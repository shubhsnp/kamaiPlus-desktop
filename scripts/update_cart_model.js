const fs = require('fs');
const file = 'D:\\My Web Sites\\KamaiPlus Android\\lib\\models\\models.dart';
let content = fs.readFileSync(file, 'utf8');

const oldChunk = `class CartItemModel {
  final ProductModel product;
  double quantity;
  int unitPricePaise;
  double discountPercent;

  CartItemModel({
    required this.product,
    this.quantity = 1.0,
    int? unitPricePaise,
    this.discountPercent = 0.0,
  }) : unitPricePaise = unitPricePaise ?? product.sellingPricePaise;

  int get grossTotalPaise {
    final base = (unitPricePaise * quantity).round();
    if (discountPercent > 0) {
      final discount = (base * discountPercent / 100).round();
      return base - discount;
    }
    return base;
  }

  Map<String, dynamic> toMap() => {
    'product_id': product.id,
    'product_name': product.name,
    'quantity': quantity,
    'unit_price_paise': unitPricePaise,
    'gross_total_paise': grossTotalPaise,
    'tax_rate': product.taxRate,
    'is_tax_inclusive': product.isTaxInclusive ? 1 : 0,
  };
}`;

const newChunk = `class CartItemModel {
  final ProductModel product;
  double quantity;
  int unitPricePaise;
  String discountType; // 'flat' | 'percentage'
  double discountValue; // in rupees for flat, or 0..100 for percentage

  CartItemModel({
    required this.product,
    this.quantity = 1.0,
    int? unitPricePaise,
    this.discountType = 'flat',
    this.discountValue = 0.0,
    double? discountPercent,
  }) : unitPricePaise = unitPricePaise ?? product.sellingPricePaise {
    if (discountPercent != null && discountPercent > 0) {
      discountType = 'percentage';
      discountValue = discountPercent;
    }
  }

  double get discountPercent => discountType == 'percentage' ? discountValue : 0.0;
  set discountPercent(double val) {
    discountType = 'percentage';
    discountValue = val;
  }

  int get grossTotalPaise {
    final base = (unitPricePaise * quantity).round();
    if (discountType == 'percentage' && discountValue > 0) {
      final discount = (base * discountValue / 100).round();
      return base - discount;
    } else if (discountType == 'flat' && discountValue > 0) {
      final discountPaise = (discountValue * 100).round();
      return (base - discountPaise).clamp(0, base);
    }
    return base;
  }

  Map<String, dynamic> toMap() => {
    'product_id': product.id,
    'product_name': product.name,
    'quantity': quantity,
    'unit_price_paise': unitPricePaise,
    'gross_total_paise': grossTotalPaise,
    'tax_rate': product.taxRate,
    'is_tax_inclusive': product.isTaxInclusive ? 1 : 0,
    'discount_type': discountType,
    'discount_value': discountValue,
  };
}`;

if (content.includes(oldChunk)) {
  content = content.replace(oldChunk, newChunk);
  fs.writeFileSync(file, content, 'utf8');
  console.log('Successfully updated CartItemModel in models.dart');
} else {
  console.error('Could not find oldChunk in models.dart');
}
