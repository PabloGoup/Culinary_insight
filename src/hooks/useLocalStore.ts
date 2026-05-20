import { useEffect, useMemo, useState } from 'react';
import { createProductionAppState } from '../data/initialState';
import { createId } from '../lib/id';
import { calculateDishCost, calculateProjectionRevenue, calculateUsefulUnitCost, getLatestProjection } from '../services/costEngine';
import { useAuth } from './useAuth';
import { supabase } from '../services/supabaseClient';
import type {
  AppState,
  BaseRecipe,
  Dish,
  FoodCostTarget,
  IndirectCost,
  Ingredient,
  InventoryMovement,
  LaborProfile,
  Menu,
  PackagingCost,
  ProductionPlan,
  Projection,
  Purchase,
  Sale,
  StaffShift,
  SanitaryCategoryConfig,
  Supplier,
  WasteRecord,
  WarehouseAuditRecord,
  YieldRecord,
} from '../types';

function parseTimeToMinutes(value: string) {
  const [hours = '0', minutes = '0'] = value.split(':');
  return Number(hours) * 60 + Number(minutes);
}

function minutesToTime(value: number) {
  const normalized = ((Math.round(value) % (24 * 60)) + (24 * 60)) % (24 * 60);
  const hours = Math.floor(normalized / 60).toString().padStart(2, '0');
  const minutes = (normalized % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

function isSunday(date: string) {
  return new Date(`${date}T12:00:00`).getDay() === 0;
}

function getSundayMorningStartTime(shift: StaffShift, laborProfiles: LaborProfile[]) {
  const profile = laborProfiles.find((item) => item.id === shift.laborProfileId);
  if (!profile) return shift.startTime;
  return profile.roleGroup === 'sous-chef' ? '10:30' : '10:00';
}

function normalizeSundayMorningOnlyShifts(staffShifts: StaffShift[], laborProfiles: LaborProfile[]) {
  return staffShifts.map((shift) => {
    if (!isSunday(shift.date)) return shift;

    const nextStartTime = getSundayMorningStartTime(shift, laborProfiles);
    const nextEndTime = '17:00';
    const needsMorningRewrite = parseTimeToMinutes(shift.startTime) >= 12 * 60;
    const needsSundayCloseClamp = parseTimeToMinutes(shift.endTime) > parseTimeToMinutes(nextEndTime);

    if (!needsMorningRewrite && !needsSundayCloseClamp) return shift;

    return {
      ...shift,
      startTime: needsMorningRewrite ? nextStartTime : shift.startTime,
      endTime: nextEndTime,
      notes: shift.notes.includes('Domingo solo AM')
        ? shift.notes
        : `${shift.notes} Domingo solo AM.`,
    };
  });
}

const activeMenuDishNames = new Set([
  'ceviche mixto',
  'camarones al pil pil',
  'ostiones a la parmesana',
  'caldillo de congrio a la nerudiana',
  'salmon a la plancha con mix de ensalada',
  'salmon con mix de ensaladas',
  'pulpo grillado con pure de camote',
  'panacota de frutos rojos',
  'pie de maracuya',
  'celestino mas helado de vainilla',
]);

const simulatedMenuUnitMixByDish: Record<string, number> = {
  'ceviche mixto': 0.15,
  'camarones al pil pil': 0.15,
  'ostiones a la parmesana': 0.10,
  'caldillo de congrio a la nerudiana': 0.17,
  'salmon a la plancha con mix de ensalada': 0.16,
  'salmon con mix de ensaladas': 0.16,
  'pulpo grillado con pure de camote': 0.12,
  'panacota de frutos rojos': 0.06,
  'pie de maracuya': 0.05,
  'celestino mas helado de vainilla': 0.04,
};

function normalizeDishName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function keepOnlyActiveMenuSales(state: AppState): AppState {
  const dishes = state.dishes.map((dish) => ({
    ...dish,
    name: dish.name.replace(/selectino/gi, 'Celestino'),
    technicalNotes: dish.technicalNotes.replace(/selectino/gi, 'celestino'),
  }));
  const activeDishIds = new Set(
    dishes
      .filter((dish) => activeMenuDishNames.has(normalizeDishName(dish.name)))
      .map((dish) => dish.id),
  );
  const sales = state.sales
    .map((sale) => ({
      ...sale,
      items: sale.items.filter((item) => activeDishIds.has(item.dishId)),
    }))
    .filter((sale) => sale.items.length > 0);

  return {
    ...state,
    dishes,
    sales,
  };
}

function simulateFullMonthSales(state: AppState): AppState {
  const latestProjection = getLatestProjection(state.projections);
  const projectedRevenue = latestProjection ? calculateProjectionRevenue(latestProjection) : 0;
  const dishes = state.dishes.filter((dish) => activeMenuDishNames.has(normalizeDishName(dish.name)));
  if (projectedRevenue <= 0 || dishes.length === 0) return state;

  const weightedDishes = dishes.map((dish) => {
    const result = calculateDishCost(state, dish);
    const unitPrice = dish.customerFacingPrice && dish.customerFacingPrice > 0 ? dish.customerFacingPrice : result.recommendedPrice;
    const weight = simulatedMenuUnitMixByDish[normalizeDishName(dish.name)] ?? 0.01;
    return { dish, unitPrice, weight };
  });
  const totalWeight = weightedDishes.reduce((sum, item) => sum + item.weight, 0);
  const averageWeightedTicket = weightedDishes.reduce(
    (sum, item) => sum + item.unitPrice * (item.weight / Math.max(totalWeight, 1)),
    0,
  );
  const targetUnits = Math.max(Math.round(projectedRevenue / Math.max(averageWeightedTicket, 1)), weightedDishes.length);
  const simulatedItems = weightedDishes.map((item) => {
    const unitShare = item.weight / Math.max(totalWeight, 1);
    return {
      id: createId('sale-item'),
      dishId: item.dish.id,
      quantity: Math.max(Math.round(targetUnits * unitShare), 1),
      unitPrice: item.unitPrice,
      discount: 0,
    };
  });
  const adjustedItems = [...simulatedItems];
  const priorityDishNames = new Set([
    'caldillo de congrio a la nerudiana',
    'salmon a la plancha con mix de ensalada',
    'salmon con mix de ensaladas',
    'pulpo grillado con pure de camote',
    'ceviche mixto',
    'camarones al pil pil',
  ]);
  const adjustmentCandidates = adjustedItems
    .filter((item) => {
      const dish = state.dishes.find((candidate) => candidate.id === item.dishId);
      return dish ? priorityDishNames.has(normalizeDishName(dish.name)) : false;
    })
    .sort((a, b) => b.unitPrice - a.unitPrice);
  let simulatedRevenue = adjustedItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  let guard = 0;
  while (simulatedRevenue < projectedRevenue && adjustmentCandidates.length > 0 && guard < 5000) {
    const item = adjustmentCandidates[guard % adjustmentCandidates.length];
    item.quantity += 1;
    simulatedRevenue += item.unitPrice;
    guard += 1;
  }

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dailySales = Array.from({ length: daysInMonth }, (_, index) => ({
    id: createId('sale'),
    soldAt: `${year}-${String(month + 1).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`,
    channel: 'Salon' as const,
    items: [] as typeof adjustedItems,
  }));

  adjustedItems.forEach((item) => {
    let remaining = item.quantity;
    for (let dayIndex = 0; dayIndex < daysInMonth; dayIndex += 1) {
      const daysLeft = daysInMonth - dayIndex;
      const quantity = dayIndex === daysInMonth - 1 ? remaining : Math.floor(remaining / daysLeft);
      remaining -= quantity;
      if (quantity <= 0) continue;
      dailySales[dayIndex].items.push({
        ...item,
        id: createId('sale-item'),
        quantity,
      });
    }
  });

  const sales = dailySales.filter((sale) => sale.items.length > 0);
  const unitsByDish = sales
    .flatMap((sale) => sale.items)
    .reduce<Record<string, number>>((acc, item) => {
      acc[item.dishId] = (acc[item.dishId] ?? 0) + item.quantity;
      return acc;
    }, {});

  return {
    ...state,
    sales,
    dishes: state.dishes.map((dish) => ({
      ...dish,
      salesCount: unitsByDish[dish.id] ?? 0,
    })),
  };
}

function mergeIngredientDefaults(ingredient: Partial<Ingredient>, fallback: Ingredient): Ingredient {
  return {
    ...fallback,
    ...ingredient,
    priceHistory: ingredient.priceHistory ?? fallback.priceHistory,
  };
}

function mergeLaborProfileDefaults(laborProfile: Partial<LaborProfile>, fallback: LaborProfile): LaborProfile {
  const roleName = laborProfile.roleName?.toLowerCase() ?? '';
  const inferredRoleGroup =
    roleName.includes('sous') ? 'sous-chef'
      : roleName.includes('chef') ? 'chef'
        : roleName.includes('ayud') ? 'ayudante'
          : roleName.includes('pastel') ? 'pasteleria'
            : roleName.includes('admin') ? 'administrativo'
              : 'cocinero';

  return {
    ...fallback,
    ...laborProfile,
    roleGroup: laborProfile.roleGroup ?? inferredRoleGroup,
    headcount: laborProfile.headcount ?? 1,
    extraMonthlyCost: laborProfile.extraMonthlyCost ?? 0,
  };
}

function syncIngredientsWithLatestYieldRecords(ingredients: Ingredient[], yieldRecords: YieldRecord[]) {
  const latestYieldByIngredient = new Map<string, YieldRecord>();

  yieldRecords.forEach((record) => {
    const current = latestYieldByIngredient.get(record.ingredientId);
    if (!current || record.recordedAt.localeCompare(current.recordedAt) >= 0) {
      latestYieldByIngredient.set(record.ingredientId, record);
    }
  });

  return ingredients.map((ingredient) => {
    const latestYield = latestYieldByIngredient.get(ingredient.id);
    if (!latestYield) return ingredient;

    return {
      ...ingredient,
      usableYieldPercent: latestYield.yieldPercent,
      usefulUnitCost: calculateUsefulUnitCost(
        ingredient.purchasePrice,
        ingredient.purchaseUnit,
        ingredient.useUnit,
        latestYield.yieldPercent,
      ),
    };
  });
}

function mergeState(parsed: Partial<AppState>, businessId?: string): AppState {
  const fallback = createProductionAppState({
    businessId: businessId ?? 'pending-business',
    businessName: 'Nuevo negocio gastronomico',
  });
  const nextState: AppState = {
    ...fallback,
    ...parsed,
    business: { ...fallback.business, ...parsed.business, ...(businessId ? { id: businessId } : {}) },
    categories: parsed.categories ?? fallback.categories,
    sanitaryCategories: parsed.sanitaryCategories ?? fallback.sanitaryCategories,
    suppliers: parsed.suppliers ?? fallback.suppliers,
    ingredients: (parsed.ingredients ?? fallback.ingredients).map((ingredient, index) =>
      mergeIngredientDefaults(
        ingredient,
        fallback.ingredients[index] ?? {
          id: '',
          name: '',
          categoryId: '',
          sanitaryCategoryId: '',
          primarySupplierId: '',
          purchaseUnit: 'kg',
          useUnit: 'g',
          purchasePrice: 0,
          usefulUnitCost: 0,
          usableYieldPercent: 0,
          currentStock: 0,
          minStock: 0,
          maxStock: 0,
          lastPurchaseDate: '',
          priceHistory: [],
          shelfLifeDays: 0,
          storageType: '',
          storageConditions: '',
          storageTemperature: '',
          recommendedMinTemp: 0,
          recommendedMaxTemp: 0,
          currentStorageTemp: 0,
          riskLevel: 'Bajo',
          colorHex: '#000000',
          colorName: '',
          internalCode: '',
          supplierCode: '',
          storageLocation: '',
          receivedDate: '',
          expiryDate: '',
          lotCode: '',
          responsible: '',
        },
      ),
    ),
    yieldRecords: parsed.yieldRecords ?? fallback.yieldRecords,
    laborProfiles: (parsed.laborProfiles ?? fallback.laborProfiles).map((laborProfile, index) =>
      mergeLaborProfileDefaults(
        laborProfile,
        fallback.laborProfiles[index] ?? {
          id: '',
          roleName: '',
          roleGroup: 'cocinero',
          headcount: 1,
          monthlySalary: 0,
          monthlyHours: 220,
          extraMonthlyCost: 0,
        },
      ),
    ),
    baseRecipes: parsed.baseRecipes ?? fallback.baseRecipes,
    dishes: parsed.dishes ?? fallback.dishes,
    foodCostTargets: parsed.foodCostTargets ?? fallback.foodCostTargets,
    indirectCosts: (parsed.indirectCosts ?? fallback.indirectCosts).map((item) => ({
      ...item,
      afecto: item.afecto !== undefined ? item.afecto : true,
    })),
    packagingCosts: parsed.packagingCosts ?? fallback.packagingCosts,
    purchases: parsed.purchases ?? fallback.purchases,
    inventoryMovements: parsed.inventoryMovements ?? fallback.inventoryMovements,
    warehouseAudits: parsed.warehouseAudits ?? fallback.warehouseAudits,
    wasteRecords: parsed.wasteRecords ?? fallback.wasteRecords,
    productionPlans: parsed.productionPlans ?? fallback.productionPlans,
    sales: parsed.sales ?? fallback.sales,
    menus: parsed.menus ?? fallback.menus,
    projections: parsed.projections ?? fallback.projections,
    staffShifts: parsed.staffShifts ?? fallback.staffShifts,
    eventQuotes: parsed.eventQuotes ?? fallback.eventQuotes,
    users: parsed.users ?? fallback.users,
  };

  const activeState = simulateFullMonthSales(keepOnlyActiveMenuSales(nextState));

  return {
    ...activeState,
    ingredients: syncIngredientsWithLatestYieldRecords(activeState.ingredients, activeState.yieldRecords),
    staffShifts: normalizeSundayMorningOnlyShifts(activeState.staffShifts, activeState.laborProfiles),
  };
}

function createRemoteFallbackState(user?: { businessId?: string; name?: string } | null) {
  return createProductionAppState({
    businessId: user?.businessId ?? 'pending-business',
    businessName: 'Nuevo negocio gastronomico',
    user: user?.businessId
      ? {
          id: 'pending-user',
          businessId: user.businessId,
          name: user.name ?? 'Usuario',
          email: '',
          role: 'Administrador general',
        }
      : undefined,
  });
}

function convertToSameUnit(quantity: number, from: string, to: string) {
  if (from === to) return quantity;
  const grams: Record<string, number> = { kg: 1000, g: 1, litro: 1000, ml: 1, unidad: 1, porcion: 1 };
  return ((grams[from] ?? 1) * quantity) / (grams[to] ?? 1);
}

type RemoteSaleRow = {
  id: string;
  sold_at: string;
  channel: Sale['channel'];
  sale_items?: Array<{
    id: string;
    dish_id: string;
    quantity: number | string;
    unit_price: number | string;
    discount: number | string;
  }>;
};

function nullableDate(value: string | undefined) {
  return value && value.trim() ? value : null;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function deterministicUuid(value: string) {
  let hashA = 0x811c9dc5;
  let hashB = 0x811c9dc5;
  let hashC = 0x811c9dc5;
  let hashD = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    hashA = Math.imul(hashA ^ code, 16777619);
    hashB = Math.imul(hashB ^ (code + index), 16777619);
    hashC = Math.imul(hashC ^ (code + index * 17), 16777619);
    hashD = Math.imul(hashD ^ (code + index * 31), 16777619);
  }

  const hex = [hashA, hashB, hashC, hashD]
    .map((part) => (part >>> 0).toString(16).padStart(8, '0'))
    .join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function toDbUuid(value: string | undefined) {
  if (!value) return '';
  if (uuidPattern.test(value)) return value;
  const uuidMatch = value.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  return uuidMatch ? uuidMatch[0] : deterministicUuid(value);
}

function nullableUuid(value: string | undefined) {
  return value && value.trim() ? toDbUuid(value) : null;
}

async function syncNormalizedState(client: NonNullable<typeof supabase>, businessId: string, state: AppState) {
  const categories = state.categories.map((category) => ({
    id: toDbUuid(category.id),
    business_id: businessId,
    type: category.type,
    name: category.name,
  }));

  const sanitaryCategories = state.sanitaryCategories.map((category) => ({
    id: toDbUuid(category.id),
    business_id: businessId,
    name: category.name,
    color_name: category.colorName,
    color_hex: category.colorHex,
    storage_type: category.storageType,
    min_temp: category.minTemp,
    max_temp: category.maxTemp,
    risk_level: category.riskLevel,
    sanitary_condition: category.sanitaryCondition,
    danger_zone_sensitive: category.dangerZoneSensitive,
    cross_contamination_group: category.crossContaminationGroup,
  }));

  const suppliers = state.suppliers.map((supplier) => ({
    id: toDbUuid(supplier.id),
    business_id: businessId,
    name: supplier.name,
    rut: supplier.rut,
    contact_name: supplier.contactName,
    phone: supplier.phone,
    email: supplier.email,
    product_category: supplier.productCategory,
    payment_terms: supplier.paymentTerms,
    lead_time_days: supplier.leadTimeDays,
    quality_score: supplier.qualityScore,
    delivery_score: supplier.deliveryScore,
    notes: supplier.notes,
  }));

  const laborProfiles = state.laborProfiles.map((profile) => ({
    id: toDbUuid(profile.id),
    business_id: businessId,
    role_name: profile.roleName,
    role_group: profile.roleGroup,
    headcount: profile.headcount,
    monthly_salary: profile.monthlySalary,
    monthly_hours: profile.monthlyHours,
    extra_monthly_cost: profile.extraMonthlyCost,
  }));

  const ingredients = state.ingredients.map((ingredient) => {
    const usefulUnitCost = calculateUsefulUnitCost(
      ingredient.purchasePrice,
      ingredient.purchaseUnit,
      ingredient.useUnit,
      ingredient.usableYieldPercent,
    );

    return {
      id: toDbUuid(ingredient.id),
      business_id: businessId,
      category_id: nullableUuid(ingredient.categoryId),
      sanitary_category_id: nullableUuid(ingredient.sanitaryCategoryId),
      primary_supplier_id: nullableUuid(ingredient.primarySupplierId),
      name: ingredient.name,
      purchase_unit: ingredient.purchaseUnit,
      use_unit: ingredient.useUnit,
      purchase_price: ingredient.purchasePrice,
      useful_unit_cost: usefulUnitCost,
      usable_yield_percent: ingredient.usableYieldPercent,
      current_stock: ingredient.currentStock,
      min_stock: ingredient.minStock,
      max_stock: ingredient.maxStock,
      last_purchase_date: nullableDate(ingredient.lastPurchaseDate),
      shelf_life_days: ingredient.shelfLifeDays,
      storage_type: ingredient.storageType,
      storage_conditions: ingredient.storageConditions,
      storage_temperature: ingredient.storageTemperature,
      recommended_min_temp: ingredient.recommendedMinTemp,
      recommended_max_temp: ingredient.recommendedMaxTemp,
      current_storage_temp: ingredient.currentStorageTemp,
      risk_level: ingredient.riskLevel,
      color_hex: ingredient.colorHex,
      color_name: ingredient.colorName,
      internal_code: ingredient.internalCode,
      supplier_code: ingredient.supplierCode,
      storage_location: ingredient.storageLocation,
      received_date: nullableDate(ingredient.receivedDate),
      expiry_date: nullableDate(ingredient.expiryDate),
      lot_code: ingredient.lotCode,
      responsible: ingredient.responsible,
    };
  });

  const priceHistory = state.ingredients.flatMap((ingredient) =>
    ingredient.priceHistory.map((price) => ({
      id: deterministicUuid(`price:${ingredient.id}:${price.date}:${price.supplierId || 'supplier'}`),
      business_id: businessId,
      ingredient_id: toDbUuid(ingredient.id),
      supplier_id: nullableUuid(price.supplierId),
      price_purchase: price.pricePurchase,
      recorded_at: price.date,
    })),
  );

  const yieldRecords = state.yieldRecords.map((record) => ({
    id: toDbUuid(record.id),
    business_id: businessId,
    ingredient_id: toDbUuid(record.ingredientId),
    recorded_at: record.recordedAt,
    purchase_weight: record.purchaseWeight,
    cleaned_weight: record.cleanedWeight,
    cooked_weight: record.cookedWeight,
    final_useful_weight: record.finalUsefulWeight,
    waste_percent: record.wastePercent,
    yield_percent: record.yieldPercent,
    waste_type: record.wasteType,
    trim_loss: record.trimLoss,
    peel_loss: record.peelLoss,
    bone_loss: record.boneLoss,
    fat_loss: record.fatLoss,
    evaporation_loss: record.evaporationLoss,
    thaw_loss: record.thawLoss,
    handling_loss: record.handlingLoss,
    notes: record.notes,
  }));

  const recipes = state.baseRecipes.map((recipe) => ({
    id: toDbUuid(recipe.id),
    business_id: businessId,
    category_id: nullableUuid(recipe.categoryId),
    kind: recipe.kind,
    name: recipe.name,
    yield_amount: recipe.yieldAmount,
    yield_unit: recipe.yieldUnit,
    item_cost_unit: recipe.itemCostUnit,
    time_minutes: recipe.timeMinutes,
    labor_profile_id: nullableUuid(recipe.laborProfileId),
    labor_minutes: recipe.laborMinutes,
    instructions: recipe.instructions,
    quality_notes: recipe.qualityNotes,
    allergens: recipe.allergens,
    observations: recipe.observations,
  }));

  const recipeItems = state.baseRecipes.flatMap((recipe) =>
    recipe.items.map((item) => ({
      id: toDbUuid(item.id),
      business_id: businessId,
      recipe_id: toDbUuid(recipe.id),
      ingredient_id: toDbUuid(item.ingredientId),
      quantity: item.quantity,
      unit: item.unit,
      waste_percent: item.wastePercent,
    })),
  );

  const packagingCosts = state.packagingCosts.map((packaging) => ({
    id: toDbUuid(packaging.id),
    business_id: businessId,
    name: packaging.name,
    channel: packaging.channel === 'General' ? null : packaging.channel,
    unit: packaging.unit,
    unit_cost: packaging.unitCost,
  }));

  const dishes = state.dishes.map((dish) => ({
    id: toDbUuid(dish.id),
    business_id: businessId,
    category_id: nullableUuid(dish.categoryId),
    name: dish.name,
    service: dish.service,
    labor_profile_id: nullableUuid(dish.laborProfileId),
    labor_minutes: dish.laborMinutes,
    indirect_cost_share: dish.indirectCostShare,
    target_food_cost: dish.targetFoodCost,
    desired_margin: dish.desiredMargin,
    allergens: dish.allergens,
    plating_notes: dish.platingNotes,
    quality_checklist: dish.qualityChecklist,
    technical_notes: dish.technicalNotes,
    shelf_life_hours: dish.shelfLifeHours,
    sales_count: dish.salesCount,
    customer_facing_price: dish.customerFacingPrice ?? null,
    image_url: dish.imageUrl ?? null,
  }));

  const dishComponents = state.dishes.flatMap((dish) =>
    dish.directItems.map((component) => ({
      id: toDbUuid(component.id),
      business_id: businessId,
      dish_id: toDbUuid(dish.id),
      component_type: component.componentType,
      ref_id: toDbUuid(component.refId),
      quantity: component.quantity,
      unit: component.unit,
      waste_percent: component.wastePercent,
    })),
  );

  const sales = state.sales.map((sale) => ({
    id: toDbUuid(sale.id),
    business_id: businessId,
    sold_at: sale.soldAt,
    channel: sale.channel,
  }));

  const saleItems = state.sales.flatMap((sale) =>
    sale.items.map((item) => ({
      id: toDbUuid(item.id),
      business_id: businessId,
      sale_id: toDbUuid(sale.id),
      dish_id: toDbUuid(item.dishId),
      quantity: item.quantity,
      unit_price: item.unitPrice,
      discount: item.discount,
    })),
  );

  const upsertIfAny = async (table: string, rows: Array<Record<string, unknown>>) => {
    if (rows.length === 0) return;
    const { error } = await client.from(table).upsert(rows);
    if (error) throw error;
  };
  const deleteMissingById = async (table: string, ids: string[]) => {
    const query = client.from(table).delete().eq('business_id', businessId);
    const { error } = ids.length > 0
      ? await query.not('id', 'in', `(${ids.join(',')})`)
      : await query;
    if (error) throw error;
  };

  await upsertIfAny('categories', categories);
  await upsertIfAny('sanitary_categories', sanitaryCategories);
  await upsertIfAny('suppliers', suppliers);
  await upsertIfAny('labor_profiles', laborProfiles);
  await upsertIfAny('ingredients', ingredients);
  await upsertIfAny('ingredient_price_history', priceHistory);
  await upsertIfAny('yield_records', yieldRecords);
  await upsertIfAny('recipes', recipes);
  await upsertIfAny('recipe_items', recipeItems);
  await upsertIfAny('packaging_costs', packagingCosts);
  await upsertIfAny('dishes', dishes);
  await upsertIfAny('dish_components', dishComponents);
  await deleteMissingById('sale_items', saleItems.map((item) => String(item.id)));
  await deleteMissingById('sales', sales.map((sale) => String(sale.id)));
  await upsertIfAny('sales', sales);
  await upsertIfAny('sale_items', saleItems);
}

function mapRemoteSales(rows: RemoteSaleRow[]): Sale[] {
  return rows.map((row) => ({
    id: row.id,
    soldAt: row.sold_at,
    channel: row.channel,
    items: (row.sale_items ?? []).map((item) => ({
      id: item.id,
      dishId: item.dish_id,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unit_price),
      discount: Number(item.discount),
    })),
  }));
}

export function useLocalStore() {
  const { user, usingSupabase } = useAuth();
  const [state, setState] = useState<AppState>(() => createRemoteFallbackState(user));
  const [isHydrating, setIsHydrating] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const businessId = user?.businessId;

  useEffect(() => {
    if (!usingSupabase) return;
    setState(createRemoteFallbackState(user));
  }, [usingSupabase, businessId]);

  useEffect(() => {
    if (!usingSupabase || !supabase || !businessId) return;
    const client = supabase;

    let cancelled = false;

    const hydrate = async () => {
      setIsHydrating(true);
      setSyncError(null);

      const [{ data, error }, { data: salesData, error: salesError }] = await Promise.all([
        client
        .from('app_snapshots')
        .select('state')
        .eq('business_id', businessId)
          .maybeSingle(),
        client
          .from('sales')
          .select('id, sold_at, channel, sale_items(id, dish_id, quantity, unit_price, discount)')
          .eq('business_id', businessId)
          .order('sold_at', { ascending: false }),
      ]);

      if (cancelled) return;

      if (error) {
        setSyncError(error.message);
        setIsHydrating(false);
        return;
      }
      if (salesError) {
        setSyncError(salesError.message);
      }

      const remoteSales = salesData ? mapRemoteSales(salesData as RemoteSaleRow[]) : [];

      if (data?.state) {
        const snapshotState = data.state as Partial<AppState>;
        setState(mergeState(snapshotState, businessId));
      } else {
        const emptyState = createProductionAppState({
          businessId,
          businessName: 'Nuevo negocio gastronomico',
          user,
        });
        setState({ ...emptyState, sales: remoteSales });
      }

      if (!cancelled) setIsHydrating(false);
    };

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [usingSupabase, businessId]);

  useEffect(() => {
    if (!usingSupabase || !supabase || !businessId || isHydrating) return;
    const client = supabase;

    const timeout = window.setTimeout(async () => {
      const remoteState = {
        ...state,
        business: {
          ...state.business,
          id: businessId,
        },
      };

      const { error } = await client.from('app_snapshots').upsert({
        business_id: businessId,
        state: remoteState,
      });

      if (error) {
        setSyncError(error.message);
        return;
      }

      try {
        await syncNormalizedState(client, businessId, remoteState);
      } catch (normalizedError) {
        setSyncError(normalizedError instanceof Error ? normalizedError.message : 'No se pudo sincronizar tablas normalizadas.');
      }
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [state, usingSupabase, businessId, isHydrating]);

  const actions = useMemo(
    () => ({
      updateBusiness: (business: AppState['business']) =>
        setState((current) => ({
          ...current,
          business,
        })),
      upsertSanitaryCategory: (category: SanitaryCategoryConfig) =>
        setState((current) => ({
          ...current,
          sanitaryCategories: current.sanitaryCategories.some((item) => item.id === category.id)
            ? current.sanitaryCategories.map((item) => (item.id === category.id ? category : item))
            : [...current.sanitaryCategories, category],
        })),
      upsertSupplier: (supplier: Supplier) =>
        setState((current) => ({
          ...current,
          suppliers: current.suppliers.some((item) => item.id === supplier.id)
            ? current.suppliers.map((item) => (item.id === supplier.id ? supplier : item))
            : [...current.suppliers, supplier],
        })),
      upsertIngredient: (ingredient: Ingredient) =>
        setState((current) => ({
          ...current,
          // Keep ingredient costs consistent with the shared cost engine.
          // Recipes and dishes read from usefulUnitCost, so it must be derived here.
          ingredients: current.ingredients.some((item) => item.id === ingredient.id)
            ? current.ingredients.map((item) => (item.id === ingredient.id ? {
              ...ingredient,
              usefulUnitCost: calculateUsefulUnitCost(
                ingredient.purchasePrice,
                ingredient.purchaseUnit,
                ingredient.useUnit,
                ingredient.usableYieldPercent,
              ),
            } : item))
            : [...current.ingredients, {
              ...ingredient,
              usefulUnitCost: calculateUsefulUnitCost(
                ingredient.purchasePrice,
                ingredient.purchaseUnit,
                ingredient.useUnit,
                ingredient.usableYieldPercent,
              ),
            }],
        })),
      registerIngredientPrice: ({
        ingredientId,
        supplierId,
        date,
        pricePurchase,
      }: {
        ingredientId: string;
        supplierId: string;
        date: string;
        pricePurchase: number;
      }) =>
        setState((current) => ({
          ...current,
          ingredients: current.ingredients.map((ingredient) => {
            if (ingredient.id !== ingredientId) return ingredient;
            return {
              ...ingredient,
              primarySupplierId: supplierId || ingredient.primarySupplierId,
              purchasePrice: pricePurchase,
              lastPurchaseDate: date,
              usefulUnitCost: calculateUsefulUnitCost(
                pricePurchase,
                ingredient.purchaseUnit,
                ingredient.useUnit,
                ingredient.usableYieldPercent,
              ),
              priceHistory: [
                ...ingredient.priceHistory,
                {
                  date,
                  supplierId: supplierId || ingredient.primarySupplierId,
                  pricePurchase,
                },
              ].sort((a, b) => a.date.localeCompare(b.date)),
            };
          }),
        })),
      upsertYieldRecord: (yieldRecord: YieldRecord) =>
        setState((current) => {
          const nextYieldRecords = current.yieldRecords.some((item) => item.id === yieldRecord.id)
            ? current.yieldRecords.map((item) => (item.id === yieldRecord.id ? yieldRecord : item))
            : [...current.yieldRecords, yieldRecord];

          return {
            ...current,
            yieldRecords: nextYieldRecords,
            ingredients: syncIngredientsWithLatestYieldRecords(current.ingredients, nextYieldRecords),
          };
        }),
      applyYieldToIngredient: ({
        ingredientId,
        yieldPercent,
      }: {
        ingredientId: string;
        yieldPercent: number;
      }) =>
        setState((current) => ({
          ...current,
          ingredients: current.ingredients.map((ingredient) =>
            ingredient.id !== ingredientId
              ? ingredient
              : {
                  ...ingredient,
                  usableYieldPercent: yieldPercent,
                  usefulUnitCost: calculateUsefulUnitCost(
                    ingredient.purchasePrice,
                    ingredient.purchaseUnit,
                    ingredient.useUnit,
                    yieldPercent,
                  ),
                },
          ),
        })),
      upsertLaborProfile: (laborProfile: LaborProfile) =>
        setState((current) => ({
          ...current,
          laborProfiles: current.laborProfiles.some((item) => item.id === laborProfile.id)
            ? current.laborProfiles.map((item) => (item.id === laborProfile.id ? laborProfile : item))
            : [...current.laborProfiles, laborProfile],
        })),
      upsertBaseRecipe: (recipe: BaseRecipe) =>
        setState((current) => ({
          ...current,
          baseRecipes: current.baseRecipes.some((item) => item.id === recipe.id)
            ? current.baseRecipes.map((item) => (item.id === recipe.id ? recipe : item))
            : [...current.baseRecipes, recipe],
        })),
      upsertDish: (dish: Dish) =>
        setState((current) => ({
          ...current,
          dishes: current.dishes.some((item) => item.id === dish.id)
            ? current.dishes.map((item) => (item.id === dish.id ? dish : item))
            : [...current.dishes, dish],
        })),
      upsertIndirectCost: (cost: IndirectCost) =>
        setState((current) => ({
          ...current,
          indirectCosts: current.indirectCosts.some((item) => item.id === cost.id)
            ? current.indirectCosts.map((item) => (item.id === cost.id ? cost : item))
            : [...current.indirectCosts, cost],
        })),
      upsertFoodCostTarget: (target: FoodCostTarget) =>
        setState((current) => ({
          ...current,
          foodCostTargets: current.foodCostTargets.some((item) => item.id === target.id)
            ? current.foodCostTargets.map((item) => (item.id === target.id ? target : item))
            : [...current.foodCostTargets, target],
        })),
      upsertPackagingCost: (packaging: PackagingCost) =>
        setState((current) => ({
          ...current,
          packagingCosts: current.packagingCosts.some((item) => item.id === packaging.id)
            ? current.packagingCosts.map((item) => (item.id === packaging.id ? packaging : item))
            : [...current.packagingCosts, packaging],
        })),
      recordPurchase: (purchase: Purchase) =>
        setState((current) => {
          const purchaseMovements: InventoryMovement[] = purchase.items.map((item) => ({
            id: createId('mov'),
            ingredientId: item.ingredientId,
            type: 'entry',
            quantity: item.receivedQuantity,
            unit: item.unit,
            date: purchase.orderedAt,
            lot: `${item.ingredientId}-${purchase.orderedAt}`,
            expiresAt: purchase.orderedAt,
            location: 'Recepcion principal',
            notes: `OC ${purchase.id}`,
          }));

          return {
            ...current,
            purchases: current.purchases.some((item) => item.id === purchase.id)
              ? current.purchases.map((item) => (item.id === purchase.id ? purchase : item))
              : [...current.purchases, purchase],
            inventoryMovements: [...current.inventoryMovements, ...purchaseMovements],
            ingredients: current.ingredients.map((ingredient) => {
              const purchaseItem = purchase.items.find((item) => item.ingredientId === ingredient.id);
              if (!purchaseItem) return ingredient;
              const receivedInPurchaseUnit = convertToSameUnit(
                purchaseItem.receivedQuantity,
                purchaseItem.unit,
                ingredient.purchaseUnit,
              );
              return {
                ...ingredient,
                purchasePrice: purchaseItem.unitPrice,
                lastPurchaseDate: purchase.orderedAt,
                usefulUnitCost: calculateUsefulUnitCost(
                  purchaseItem.unitPrice,
                  ingredient.purchaseUnit,
                  ingredient.useUnit,
                  ingredient.usableYieldPercent,
                ),
                currentStock: ingredient.currentStock + receivedInPurchaseUnit,
                priceHistory: [
                  ...ingredient.priceHistory,
                  {
                    date: purchase.orderedAt,
                    supplierId: purchase.supplierId,
                    pricePurchase: purchaseItem.unitPrice,
                  },
                ],
              };
            }),
          };
        }),
      recordWaste: (waste: WasteRecord) =>
        setState((current) => ({
          ...current,
          wasteRecords: current.wasteRecords.some((item) => item.id === waste.id)
            ? current.wasteRecords.map((item) => (item.id === waste.id ? waste : item))
            : [...current.wasteRecords, waste],
          inventoryMovements: [
            ...current.inventoryMovements,
            {
              id: createId('mov'),
              ingredientId: waste.ingredientId,
              type: 'waste',
              quantity: waste.quantity,
              unit: waste.unit,
              date: waste.date,
              lot: '',
              expiresAt: '',
              location: 'Baja por merma',
              notes: waste.reasonType,
            },
          ],
          ingredients: current.ingredients.map((ingredient) => {
            if (ingredient.id !== waste.ingredientId) return ingredient;
            const consumed = convertToSameUnit(waste.quantity, waste.unit, ingredient.purchaseUnit);
            return {
              ...ingredient,
              currentStock: Math.max(ingredient.currentStock - consumed, 0),
            };
          }),
        })),
      recordWarehouseAudit: (audit: WarehouseAuditRecord) =>
        setState((current) => ({
          ...current,
          warehouseAudits: current.warehouseAudits.some((item) => item.id === audit.id)
            ? current.warehouseAudits.map((item) => (item.id === audit.id ? audit : item))
            : [audit, ...current.warehouseAudits],
          ingredients: current.ingredients.map((ingredient) =>
            ingredient.id !== audit.ingredientId
              ? ingredient
              : {
                  ...ingredient,
                  currentStock: convertToSameUnit(audit.countedStock, audit.stockUnit, ingredient.purchaseUnit),
                  currentStorageTemp: audit.storageTemp,
                  storageTemperature: `${audit.storageTemp} C`,
                  storageLocation: audit.location || ingredient.storageLocation,
                  responsible: audit.checkedBy,
                },
          ),
        })),
      createRestockRequest: (payload: {
        ingredientId: string;
        quantity: number;
        requestedBy: string;
        notes: string;
      }) =>
        setState((current) => {
          const ingredient = current.ingredients.find((item) => item.id === payload.ingredientId);
          if (!ingredient) return current;
          const purchase: Purchase = {
            id: createId('po'),
            supplierId: ingredient.primarySupplierId,
            orderedAt: new Date().toISOString().slice(0, 10),
            status: 'draft',
            notes: payload.notes,
            items: [
              {
                id: createId('poi'),
                ingredientId: ingredient.id,
                quantity: payload.quantity,
                unit: ingredient.purchaseUnit,
                unitPrice: ingredient.purchasePrice,
                receivedQuantity: 0,
              },
            ],
          };
          return {
            ...current,
            purchases: [purchase, ...current.purchases],
          };
        }),
      updatePurchaseStatus: (purchaseId: string, status: Purchase['status']) =>
        setState((current) => ({
          ...current,
          purchases: current.purchases.map((purchase) =>
            purchase.id === purchaseId ? { ...purchase, status } : purchase,
          ),
        })),
      upsertProductionPlan: (plan: ProductionPlan) =>
        setState((current) => ({
          ...current,
          productionPlans: current.productionPlans.some((item) => item.id === plan.id)
            ? current.productionPlans.map((item) => (item.id === plan.id ? plan : item))
            : [...current.productionPlans, plan],
        })),
      upsertMenu: (menu: Menu) =>
        setState((current) => ({
          ...current,
          menus: current.menus.some((item) => item.id === menu.id)
            ? current.menus.map((item) => (item.id === menu.id ? menu : item))
            : [...current.menus, menu],
        })),
      removeMenu: (id: string) =>
        setState((current) => ({
          ...current,
          menus: current.menus.filter((item) => item.id !== id),
        })),
      recordSale: (sale: Sale) =>
        setState((current) => ({
          ...current,
          sales: current.sales.some((item) => item.id === sale.id)
            ? current.sales.map((item) => (item.id === sale.id ? sale : item))
            : [...current.sales, sale],
          dishes: current.dishes.map((dish) => {
            const sold = sale.items
              .filter((item) => item.dishId === dish.id)
              .reduce((total, item) => total + item.quantity, 0);
            return sold > 0 ? { ...dish, salesCount: dish.salesCount + sold } : dish;
          }),
        })),
      upsertProjection: (projection: Projection) =>
        setState((current) => ({
          ...current,
          projections: current.projections.some((item) => item.id === projection.id)
            ? current.projections.map((item) => (item.id === projection.id ? projection : item))
            : [...current.projections, projection],
        })),
      removeProjection: (id: string) =>
        setState((current) => ({
          ...current,
          projections: current.projections.filter((item) => item.id !== id),
        })),
      upsertStaffShift: (shift: StaffShift) =>
        setState((current) => ({
          ...current,
          staffShifts: normalizeSundayMorningOnlyShifts(
            current.staffShifts.some((item) => item.id === shift.id)
              ? current.staffShifts.map((item) => (item.id === shift.id ? shift : item))
              : [...current.staffShifts, shift],
            current.laborProfiles,
          ),
        })),
      removeIngredient: (id: string) =>
        setState((current) => ({
          ...current,
          ingredients: current.ingredients.filter((item) => item.id !== id),
        })),
      removeLaborProfile: (id: string) =>
        setState((current) => ({
          ...current,
          laborProfiles: current.laborProfiles.filter((item) => item.id !== id),
          baseRecipes: current.baseRecipes.map((recipe) =>
            recipe.laborProfileId === id ? { ...recipe, laborProfileId: '' } : recipe,
          ),
          dishes: current.dishes.map((dish) =>
            dish.laborProfileId === id ? { ...dish, laborProfileId: '' } : dish,
          ),
        })),
      removeBaseRecipe: (id: string) =>
        setState((current) => ({
          ...current,
          baseRecipes: current.baseRecipes.filter((item) => item.id !== id),
        })),
      removeIndirectCost: (id: string) =>
        setState((current) => ({
          ...current,
          indirectCosts: current.indirectCosts.filter((item) => item.id !== id),
        })),
      removeDish: (id: string) =>
        setState((current) => ({
          ...current,
          dishes: current.dishes.filter((item) => item.id !== id),
          sales: current.sales.map((sale) => ({
            ...sale,
            items: sale.items.filter((item) => item.dishId !== id),
          })),
        })),
      removeStaffShift: (id: string) =>
        setState((current) => ({
          ...current,
          staffShifts: current.staffShifts.filter((item) => item.id !== id),
        })),
    }),
    [],
  );

  return { state, actions, isHydrating, syncError };
}
