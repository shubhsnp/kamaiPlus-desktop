import { readVerticalProfile, type VerticalId } from '@/lib/business/verticalProfile';
import { isRestaurantMode } from '@/lib/features/featureSwitches';

/**
 * The kind of shop the item forms follow (v4.176.0): Restaurant mode (the Admin switch) wins over the
 * saved category — a shop switched to Restaurant mode with a grocery / no profile got "Piece" on Add Dish.
 * Null = a shop set up before v4.118.0 with no profile (old behaviour).
 */
export function shopVertical(): VerticalId | null {
  return isRestaurantMode() ? 'restaurant' : readVerticalProfile()?.vertical ?? null;
}
