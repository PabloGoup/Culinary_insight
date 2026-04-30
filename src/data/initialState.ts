import type { AppState, BusinessSettings, Category, UserProfile } from '../types';
import { defaultSanitaryCategories } from './sanitaryCatalog';

const baseCategories: Category[] = [
  { id: 'cat-ing-proteinas', type: 'ingredient', name: 'Proteinas' },
  { id: 'cat-ing-secos', type: 'ingredient', name: 'Secos y despensa' },
  { id: 'cat-ing-lacteos', type: 'ingredient', name: 'Lacteos' },
  { id: 'cat-ing-verduras', type: 'ingredient', name: 'Verduras' },
  { id: 'cat-dish-entradas', type: 'dish', name: 'Entradas' },
  { id: 'cat-dish-fondos', type: 'dish', name: 'Fondos' },
  { id: 'cat-dish-postres', type: 'dish', name: 'Postres' },
  { id: 'cat-menu-degustacion', type: 'menu', name: 'Degustacion' },
];

export function createInitialBusinessSettings(businessId: string, businessName: string): BusinessSettings {
  return {
    id: businessId,
    name: businessName,
    businessType: 'Restaurante',
    currency: 'CLP',
    taxRate: 0.19,
    targetFoodCost: 0.3,
    targetMargin: 0.7,
    fixedCostsMonthly: 0,
    payrollBurdenPercent: 0.32,
    personnelSharedExtrasMonthly: 0,
    maxLeadershipMinutes: 20,
    openingHours: '',
    workerCount: 0,
    internalCategories: ['Entradas', 'Fondos', 'Postres', 'Bebidas'],
  };
}

export function createProductionAppState(params: {
  businessId: string;
  businessName: string;
  user?: UserProfile;
}): AppState {
  return {
    users: params.user ? [params.user] : [],
    business: createInitialBusinessSettings(params.businessId, params.businessName),
    categories: baseCategories,
    sanitaryCategories: defaultSanitaryCategories,
    suppliers: [],
    ingredients: [],
    yieldRecords: [],
    laborProfiles: [],
    baseRecipes: [],
    dishes: [],
    foodCostTargets: [],
    indirectCosts: [],
    packagingCosts: [],
    purchases: [],
    inventoryMovements: [],
    warehouseAudits: [],
    wasteRecords: [],
    productionPlans: [],
    sales: [],
    menus: [],
    projections: [],
    staffShifts: [],
    eventQuotes: [],
  };
}
