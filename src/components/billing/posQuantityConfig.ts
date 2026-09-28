import { ProductUnit } from '@/types';
import { tr } from '@/lib/i18n/core';

/**
 * What the ✏️ item window offers per unit: the quantity label, the step, a hint and quick
 * chips (grams for kg, ½ / ¼ for a box or dozen, whole numbers for pieces — v4.78.0).
 * Which units may be split at all is decided in lib/billing/unitQuantity.ts.
 */
export function getQuantityConfigForUnit(unit?: ProductUnit) {
  const normUnit = (unit || '').toLowerCase() || 'piece';

  if (normUnit === 'kg') {
    return {
      unitLabel: tr('Weight (Kilograms - kg)'),
      step: 'any',
      placeholder: tr('e.g. 0.05, 0.25, 0.5, 1'),
      decimalNotice: tr('Decimals supported (Grams / Kg)'),
      chips: [
        { label: '10g', val: '0.01' },
        { label: '25g', val: '0.025' },
        { label: '50g', val: '0.05' },
        { label: '100g', val: '0.1' },
        { label: '250g', val: '0.25' },
        { label: '500g', val: '0.5' },
        { label: tr('1 kg'), val: '1' },
        { label: tr('2 kg'), val: '2' },
        { label: tr('5 kg'), val: '5' },
      ],
    };
  }

  if (normUnit === 'gram') {
    return {
      unitLabel: tr('Weight (Grams - g)'),
      step: 'any',
      placeholder: tr('e.g. 10, 25, 50, 100, 250, 500'),
      decimalNotice: tr('Grams count'),
      chips: [
        { label: '10g', val: '10' },
        { label: '25g', val: '25' },
        { label: '50g', val: '50' },
        { label: '100g', val: '100' },
        { label: '250g', val: '250' },
        { label: '500g', val: '500' },
        { label: '1000g', val: '1000' },
      ],
    };
  }

  if (normUnit === 'litre') {
    return {
      unitLabel: tr('Volume (Litres - L)'),
      step: 'any',
      placeholder: tr('e.g. 0.25, 0.5, 1, 2'),
      decimalNotice: tr('Decimals supported (ml / Litres)'),
      chips: [
        { label: '100ml', val: '0.1' },
        { label: '250ml', val: '0.25' },
        { label: '500ml', val: '0.5' },
        { label: '1 L', val: '1' },
        { label: '2 L', val: '2' },
        { label: '5 L', val: '5' },
      ],
    };
  }

  if (normUnit === 'ml') {
    return {
      unitLabel: tr('Volume (Millilitres - ml)'),
      step: '1',
      placeholder: tr('e.g. 50, 100, 250, 500'),
      decimalNotice: tr('Millilitres count'),
      chips: [
        { label: tr('50 ml'), val: '50' },
        { label: tr('100 ml'), val: '100' },
        { label: tr('200 ml'), val: '200' },
        { label: tr('250 ml'), val: '250' },
        { label: tr('500 ml'), val: '500' },
        { label: tr('1000 ml'), val: '1000' },
      ],
    };
  }

  if (normUnit === 'strip') {
    return {
      unitLabel: tr('Quantity (Strips)'),
      step: 'any',
      placeholder: tr('e.g. 1, 2, 3 or 0.5 (half strip)'),
      decimalNotice: tr('Strip counts (0.5 for loose/half strip)'),
      chips: [
        { label: tr('1 Strip'), val: '1' },
        { label: tr('2 Strips'), val: '2' },
        { label: tr('3 Strips'), val: '3' },
        { label: tr('4 Strips'), val: '4' },
        { label: tr('5 Strips'), val: '5' },
        { label: tr('10 Strips'), val: '10' },
        { label: tr('½ Strip (Loose)'), val: '0.5' },
      ],
    };
  }

  // A box / bundle can be sold in parts (v4.78.0): ¼, ½, ¾ … — the amount follows the rate per unit.
  if (normUnit === 'box' || normUnit === 'bundle' || normUnit === 'custom') {
    return {
      unitLabel: tr('Quantity ({v1})', { v1: normUnit.charAt(0).toUpperCase() + normUnit.slice(1) }),
      step: 'any',
      placeholder: tr('e.g. 0.5 (half), 1, 2'),
      decimalNotice: tr('Parts allowed: ¼, ½, ¾'),
      chips: [
        { label: '¼', val: '0.25' },
        { label: '½', val: '0.5' },
        { label: '¾', val: '0.75' },
        { label: '1', val: '1' },
        { label: '1½', val: '1.5' },
        { label: '2', val: '2' },
        { label: '3', val: '3' },
        { label: '5', val: '5' },
      ],
    };
  }

  if (normUnit === 'dozen') {
    return {
      unitLabel: tr('Quantity (Dozen)'),
      step: 'any',
      placeholder: tr('e.g. 0.5, 1, 1.5, 2'),
      decimalNotice: tr('Dozen count (0.5 = 6 pcs)'),
      chips: [
        { label: tr('¼ Dozen (3)'), val: '0.25' },
        { label: tr('½ Dozen (6)'), val: '0.5' },
        { label: tr('¾ Dozen (9)'), val: '0.75' },
        { label: tr('1 Dozen (12)'), val: '1' },
        { label: tr('1.5 Dozen (18)'), val: '1.5' },
        { label: tr('2 Dozen (24)'), val: '2' },
        { label: tr('3 Dozen (36)'), val: '3' },
        { label: tr('5 Dozen (60)'), val: '5' },
      ],
    };
  }

  if (normUnit === 'meter' || normUnit === 'foot' || normUnit === 'sqft') {
    return {
      unitLabel: tr('Length / Area ({v1})', { v1: normUnit.toUpperCase() }),
      step: 'any',
      placeholder: tr('e.g. 0.5, 1, 2.5, 5'),
      decimalNotice: tr('Decimals supported'),
      chips: [
        { label: '0.5', val: '0.5' },
        { label: '1', val: '1' },
        { label: '2', val: '2' },
        { label: '2.5', val: '2.5' },
        { label: '3', val: '3' },
        { label: '5', val: '5' },
        { label: '10', val: '10' },
      ],
    };
  }

  if (normUnit === 'plate' || normUnit === 'portion') {
    return {
      unitLabel: normUnit === 'plate' ? tr('Order Quantity (Plates)') : tr('Order Quantity (Portions)'),
      step: 'any',
      placeholder: tr('e.g. 0.5 (half), 1 (full), 2'),
      decimalNotice: tr('Plates / Portions (0.5 for Half)'),
      chips: [
        { label: tr('½ (Half)'), val: '0.5' },
        { label: tr('1 (Full)'), val: '1' },
        { label: '2', val: '2' },
        { label: '3', val: '3' },
        { label: '4', val: '4' },
        { label: '5', val: '5' },
      ],
    };
  }

  return {
    unitLabel: tr('Quantity ({v1})', { v1: normUnit.charAt(0).toUpperCase() + normUnit.slice(1) }),
    step: '1',
    placeholder: tr('e.g. 1, 2, 3, 5'),
    decimalNotice: tr('Whole count / Units'),
    chips: [
      { label: '1', val: '1' },
      { label: '2', val: '2' },
      { label: '3', val: '3' },
      { label: '4', val: '4' },
      { label: '5', val: '5' },
      { label: '6', val: '6' },
      { label: '10', val: '10' },
      { label: '12', val: '12' },
      { label: '24', val: '24' },
    ],
  };
}
