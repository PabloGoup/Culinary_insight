import type {
  AppState,
  BaseRecipe,
  BaseRecipeCostResult,
  DashboardAlert,
  DashboardMetrics,
  Dish,
  DishCostResult,
  IndirectCost,
  Ingredient,
  LaborProfile,
  MenuEngineeringItem,
  Projection,
  ReportSnapshot,
  Unit,
} from '../types';

const unitsToBase: Record<Unit, number> = {
  kg: 1000,
  g: 1,
  litro: 1000,
  ml: 1,
  unidad: 1,
  porcion: 1,
};

export function getMonthlyCostAmount(cost: IndirectCost) {
  if (cost.period === 'diario') return cost.amount * 30;
  if (cost.period === 'semanal') return cost.amount * 4.33;
  return cost.amount;
}

export function convertQuantity(quantity: number, from: Unit, to: Unit) {
  if (from === to) return quantity;
  if ((from === 'unidad' || from === 'porcion') || (to === 'unidad' || to === 'porcion')) return quantity;
  return (quantity * unitsToBase[from]) / unitsToBase[to];
}

function getIngredient(state: AppState, ingredientId: string) {
  return state.ingredients.find((item) => item.id === ingredientId);
}

function getLatestSalesDate(state: AppState) {
  const dates = state.sales.map((sale) => sale.soldAt).sort();
  return dates[dates.length - 1] ?? new Date().toISOString().slice(0, 10);
}

function diffDays(from: string, to: string) {
  const start = new Date(from);
  const end = new Date(to);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.max(Math.round((end.getTime() - start.getTime()) / 86400000), 0);
}

function getTotalLaborHeadcount(state: AppState) {
  return Math.max(state.laborProfiles.reduce((sum, profile) => sum + Math.max(profile.headcount, 1), 0), 1);
}

export function calculateLaborProfileMonthlyCost(state: AppState, profile: LaborProfile) {
  const payrollBurden = profile.monthlySalary * Math.max(state.business.payrollBurdenPercent, 0);
  const sharedExtrasPerPerson = state.business.personnelSharedExtrasMonthly / getTotalLaborHeadcount(state);
  return profile.monthlySalary + payrollBurden + profile.extraMonthlyCost + sharedExtrasPerPerson;
}

export function calculateLaborProfileMonthlyTeamCost(state: AppState, profile: LaborProfile) {
  return calculateLaborProfileMonthlyCost(state, profile) * Math.max(profile.headcount, 1);
}

export function calculateTotalMonthlyLaborCost(state: AppState) {
  return state.laborProfiles.reduce((sum, profile) => sum + calculateLaborProfileMonthlyTeamCost(state, profile), 0);
}

export function calculateLaborProfileCostPerMinute(state: AppState, profile: LaborProfile) {
  if (profile.monthlyHours <= 0) return 0;
  return calculateLaborProfileMonthlyCost(state, profile) / (profile.monthlyHours * 60);
}

export function calculateLaborCostPerMinute(state: AppState, laborProfileId: string) {
  const profile = state.laborProfiles.find((item) => item.id === laborProfileId);
  if (!profile) return 0;
  return calculateLaborProfileCostPerMinute(state, profile);
}

export function calculateUsefulUnitCost(purchasePrice: number, purchaseUnit: Unit, useUnit: Unit, usableYieldPercent: number) {
  const normalizedPurchaseUnit = convertQuantity(1, purchaseUnit, useUnit);
  const usableFactor = Math.max(usableYieldPercent, 0.001) / 100;
  return purchasePrice / Math.max(normalizedPurchaseUnit * usableFactor, 0.001);
}

export function roundPriceForCustomer(price: number) {
  return Math.ceil(Math.max(price, 0) / 100) * 100;
}

export function getLatestProjection(projections: Projection[]) {
  return projections.length > 0 ? projections[projections.length - 1] : null;
}

function calculateIngredientLineCost(
  ingredient: Ingredient,
  quantity: number,
  unit: Unit,
  wastePercent = 0,
) {
  const normalized = convertQuantity(quantity, unit, ingredient.useUnit);
  return normalized * ingredient.usefulUnitCost * (1 + wastePercent / 100);
}

function getProjectedMonthlyUnits(state: AppState) {
  const historicalSales = state.sales.reduce(
    (sum, sale) => sum + sale.items.reduce((lineSum, item) => lineSum + item.quantity, 0),
    0,
  );

  const latestProjection = getLatestProjection(state.projections);
  const projectedSales = latestProjection
    ? latestProjection.days.reduce((daySum, day) => daySum + day.projectedCustomers, 0) *
      (latestProjection.period === 'dia' ? 30 : 4)
    : 0;

  return Math.max(historicalSales, projectedSales, 1);
}

function allocateIndirectCost(
  state: AppState,
  allocationHint: { categoryId?: string; salesCount?: number; hours?: number; manualMultiplier?: number },
) {
  const totalSalesCount = getProjectedMonthlyUnits(state);
  const averageMinutes =
    state.dishes.length + state.baseRecipes.length > 0
      ? (
        state.dishes.reduce((sum, dish) => sum + Math.max(dish.laborMinutes, 1), 0) +
        state.baseRecipes.reduce((sum, recipe) => sum + Math.max(recipe.laborMinutes, 1), 0)
      ) / Math.max(state.dishes.length + state.baseRecipes.length, 1)
      : 12;
  const totalHours = totalSalesCount * Math.max(averageMinutes, 1);

  return state.indirectCosts.reduce<number>((sum, cost) => {
    const monthly = getMonthlyCostAmount(cost);
    switch (cost.allocationMethod) {
      case 'manual':
        return sum + (monthly / totalSalesCount) * cost.allocationValue * (allocationHint.manualMultiplier ?? 1);
      case 'hours':
        return sum + (monthly / Math.max(totalHours, 1)) * Math.max(allocationHint.hours ?? 0, 0) * cost.allocationValue;
      case 'sales':
        return sum + (monthly / Math.max(totalSalesCount, 1)) * cost.allocationValue;
      case 'category':
      case 'product':
      case 'recipe':
      default:
        return sum + (monthly / Math.max(totalSalesCount, 1)) * cost.allocationValue;
    }
  }, 0);
}

const PRACTICAL_KITCHEN_CAPACITY_FACTOR = 0.72;

function getOperationalKitchenProfiles(state: AppState) {
  return state.laborProfiles.filter((profile) => profile.roleGroup !== 'administrativo');
}

function getMonthlyKitchenAvailableMinutes(state: AppState) {
  return getOperationalKitchenProfiles(state).reduce(
    (sum, profile) => sum + Math.max(profile.monthlyHours, 0) * 60 * Math.max(profile.headcount, 1),
    0,
  );
}

function getMonthlyKitchenPracticalMinutes(state: AppState) {
  return Math.max(getMonthlyKitchenAvailableMinutes(state) * PRACTICAL_KITCHEN_CAPACITY_FACTOR, 1);
}

function getFixedStructureMonthlyCost(state: AppState) {
  return state.business.fixedCostsMonthly;
}

function isCommissionIndirectCost(cost: IndirectCost) {
  const token = `${cost.name} ${cost.category}`.toLowerCase();
  return token.includes('comision');
}

function allocateDishIndirectCostLine(
  state: AppState,
  cost: IndirectCost,
  laborMinutes: number,
) {
  const practicalKitchenMinutes = getMonthlyKitchenPracticalMinutes(state);
  const monthly = getMonthlyCostAmount(cost);

  switch (cost.allocationMethod) {
    case 'hours':
      return (monthly / practicalKitchenMinutes) * Math.max(laborMinutes, 0) * cost.allocationValue;
    case 'manual':
    case 'sales':
    case 'category':
    case 'product':
    case 'recipe':
    default:
      return (monthly / practicalKitchenMinutes) * Math.max(laborMinutes, 0) * cost.allocationValue;
  }
}

export function getDishOperationalCapacitySnapshot(state: AppState, dish: Dish) {
  const assemblyMinutes = Math.max(dish.laborMinutes, 0.1);
  const availableMinutes = getMonthlyKitchenAvailableMinutes(state);
  const practicalMinutes = getMonthlyKitchenPracticalMinutes(state);
  const monthlyCapacityPlates = Math.floor(practicalMinutes / assemblyMinutes);
  const fixedStructureMonthlyCost = getFixedStructureMonthlyCost(state);
  const fixedCostPerDish = fixedStructureMonthlyCost / Math.max(monthlyCapacityPlates, 1);

  return {
    availableMinutes,
    practicalMinutes,
    practicalFactor: PRACTICAL_KITCHEN_CAPACITY_FACTOR,
    assemblyMinutes,
    monthlyCapacityPlates,
    fixedStructureMonthlyCost,
    fixedCostPerDish,
  };
}

export function getEffectiveFoodCostTarget(state: AppState, dish: Dish) {
  const dishTarget = state.foodCostTargets.find((target) => target.scopeType === 'dish' && target.scopeId === dish.id);
  if (dishTarget) return dishTarget.targetPercent;
  const categoryTarget = state.foodCostTargets.find(
    (target) => target.scopeType === 'category' && target.scopeId === dish.categoryId,
  );
  if (categoryTarget) return categoryTarget.targetPercent;
  const serviceTarget = state.foodCostTargets.find(
    (target) => target.scopeType === 'service' && target.scopeId === dish.service,
  );
  if (serviceTarget) return serviceTarget.targetPercent;
  return state.business.targetFoodCost;
}

export function calculateBaseRecipeCost(state: AppState, recipe: BaseRecipe): BaseRecipeCostResult {
  const lines = recipe.items.flatMap((item) => {
    const ingredient = getIngredient(state, item.ingredientId);
    if (!ingredient) return [];
    const normalizedQuantity = convertQuantity(item.quantity, item.unit, ingredient.useUnit);
    const lineCost = calculateIngredientLineCost(ingredient, item.quantity, item.unit, item.wastePercent);
    return [{
      recipeItemId: item.id,
      ingredientId: ingredient.id,
      ingredientName: ingredient.name,
      quantity: item.quantity,
      unit: item.unit,
      wastePercent: item.wastePercent,
      normalizedQuantity,
      useUnit: ingredient.useUnit,
      purchasePrice: ingredient.purchasePrice,
      usefulUnitCost: ingredient.usefulUnitCost,
      lineCost,
    }];
  });

  const ingredientCost = lines.reduce((sum, line) => sum + line.lineCost, 0);
  const effectiveLaborMinutes = recipe.laborMinutes > 0 ? recipe.laborMinutes : recipe.timeMinutes;

  const laborCost = calculateLaborCostPerMinute(state, recipe.laborProfileId) * effectiveLaborMinutes;
  const indirectCost = allocateIndirectCost(state, {
    categoryId: recipe.categoryId,
    hours: effectiveLaborMinutes,
    manualMultiplier: 0.25,
  });
  const totalCost = ingredientCost + laborCost + indirectCost;

  return {
    lines,
    ingredientCost,
    laborCost,
    indirectCost,
    totalCost,
    costPerYieldUnit: totalCost / Math.max(recipe.yieldAmount, 0.001),
  };
}

export function calculateDishCost(state: AppState, dish: Dish): DishCostResult {
  const componentLines: DishCostResult['componentLines'] = [];
  let ingredientCost = 0;
  let baseRecipeCost = 0;
  let packagingCost = 0;
  let directMaterialCost = 0;
  let wasteCost = 0;
  const baseRecipeLaborCost = 0;
  const baseRecipeIndirectCost = 0;

  dish.directItems.forEach((component) => {
    if (component.componentType === 'ingredient') {
      const ingredient = getIngredient(state, component.refId);
      if (!ingredient) return;
      const normalized = convertQuantity(component.quantity, component.unit, ingredient.useUnit);
      const netLineCost = normalized * ingredient.usefulUnitCost;
      const lineWasteCost = netLineCost * (component.wastePercent / 100);
      const lineCost = netLineCost + lineWasteCost;
      ingredientCost += lineCost;
      directMaterialCost += netLineCost;
      wasteCost += lineWasteCost;
      componentLines.push({
        componentId: component.id,
        componentType: component.componentType,
        refId: component.refId,
        componentName: ingredient.name,
        quantity: component.quantity,
        unit: component.unit,
        wastePercent: component.wastePercent,
        unitCost: ingredient.usefulUnitCost,
        lineCost,
      });
      return;
    }
    if (component.componentType === 'baseRecipe') {
      const recipe = state.baseRecipes.find((item) => item.id === component.refId);
      if (!recipe) return;
      const result = calculateBaseRecipeCost(state, recipe);
      const normalized = convertQuantity(component.quantity, component.unit, recipe.itemCostUnit);
      const recipeFactor = normalized / Math.max(recipe.yieldAmount, 0.001);
      const scaledIngredientCost = result.ingredientCost * recipeFactor;
      const lineWasteCost = scaledIngredientCost * (component.wastePercent / 100);
      const lineCost = scaledIngredientCost + lineWasteCost;
      baseRecipeCost += lineCost;
      directMaterialCost += scaledIngredientCost;
      wasteCost += lineWasteCost;
      componentLines.push({
        componentId: component.id,
        componentType: component.componentType,
        refId: component.refId,
        componentName: recipe.name,
        quantity: component.quantity,
        unit: component.unit,
        wastePercent: component.wastePercent,
        unitCost: (result.ingredientCost / Math.max(recipe.yieldAmount, 0.001)) * (1 + component.wastePercent / 100),
        lineCost,
        nestedLines: result.lines.map((line) => ({
          ingredientId: line.ingredientId,
          ingredientName: line.ingredientName,
          quantity: line.normalizedQuantity * recipeFactor * (1 + component.wastePercent / 100),
          unit: line.useUnit,
          purchasePrice: line.purchasePrice,
          usefulUnitCost: line.usefulUnitCost,
          lineCost: line.lineCost * recipeFactor * (1 + component.wastePercent / 100),
        })),
      });
      return;
    }
    const packaging = state.packagingCosts.find((item) => item.id === component.refId);
    if (!packaging) return;
    const normalized = convertQuantity(component.quantity, component.unit, packaging.unit);
    const lineCost = normalized * packaging.unitCost;
    packagingCost += lineCost;
    componentLines.push({
      componentId: component.id,
      componentType: component.componentType,
      refId: component.refId,
      componentName: packaging.name,
      quantity: component.quantity,
      unit: component.unit,
      wastePercent: component.wastePercent,
      unitCost: packaging.unitCost,
      lineCost,
    });
  });

  const laborCost = calculateLaborCostPerMinute(state, dish.laborProfileId) * dish.laborMinutes;
  let variableCost = 0;
  let fixedAllocatedCost = 0;
  let commissionCost = 0;
  const capacitySnapshot = getDishOperationalCapacitySnapshot(state, dish);

  state.indirectCosts.forEach((cost) => {
    const allocated = allocateDishIndirectCostLine(state, cost, dish.laborMinutes) * dish.indirectCostShare;
    if (isCommissionIndirectCost(cost)) {
      commissionCost += allocated;
      return;
    }
    if (cost.allocationMethod === 'hours') {
      variableCost += allocated;
      return;
    }
    fixedAllocatedCost += allocated;
  });

  fixedAllocatedCost += capacitySnapshot.fixedCostPerDish * dish.indirectCostShare;

  const materialCost = directMaterialCost;
  const directCost = materialCost + wasteCost + packagingCost;
  const productionCost =
    materialCost +
    wasteCost +
    baseRecipeLaborCost +
    baseRecipeIndirectCost +
    packagingCost +
    laborCost;
  const indirectCost = variableCost + fixedAllocatedCost + commissionCost;
  const subtotalWithoutSafety =
    materialCost +
    wasteCost +
    baseRecipeLaborCost +
    baseRecipeIndirectCost +
    laborCost +
    variableCost +
    fixedAllocatedCost +
    commissionCost +
    packagingCost;
  const safetyBufferCost = subtotalWithoutSafety * 0.03;
  const subtotalBeforeMargin = subtotalWithoutSafety + safetyBufferCost;
  const totalCost = subtotalBeforeMargin;
  const targetFoodCost = Math.max(getEffectiveFoodCostTarget(state, dish), 0.01);
  const suggestedPriceByFoodCost = directCost / targetFoodCost;
  const formulaPrice = subtotalBeforeMargin / Math.max(1 - dish.desiredMargin, 0.01);
  const suggestedPriceByMargin = formulaPrice;
  const recommendedPrice = Math.max(suggestedPriceByFoodCost, formulaPrice);
  const grossMarginPercent = recommendedPrice === 0 ? 0 : (recommendedPrice - directCost) / recommendedPrice;
  const netMarginPercent = recommendedPrice === 0 ? 0 : (recommendedPrice - subtotalBeforeMargin) / recommendedPrice;
  const foodCostPercent = recommendedPrice === 0 ? 0 : (materialCost + wasteCost + packagingCost) / recommendedPrice;

  return {
    componentLines,
    ingredientCost,
    baseRecipeCost,
    packagingCost,
    materialCost,
    wasteCost,
    baseRecipeLaborCost,
    baseRecipeIndirectCost,
    variableCost,
    fixedAllocatedCost,
    commissionCost,
    safetyBufferCost,
    directCost,
    laborCost,
    productionCost,
    indirectCost,
    totalCost,
    subtotalBeforeMargin,
    formulaPrice,
    suggestedPriceByFoodCost,
    suggestedPriceByMargin,
    recommendedPrice,
    grossMarginPercent,
    netMarginPercent,
    foodCostPercent,
  };
}

export function calculateProjectionRevenue(projection: Projection) {
  return projection.days.reduce(
    (sum, day) => sum + day.projectedCustomers * (day.avgFoodTicket + day.avgBeverageTicket),
    0,
  ) * (projection.period === 'mes' ? 4 : 1);
}

function getWasteValue(state: AppState) {
  return state.wasteRecords.reduce((sum, item) => sum + item.costImpact, 0);
}

function daysUntil(date: string) {
  if (!date) return Number.POSITIVE_INFINITY;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function getAverageUnitPrice(state: AppState, dishId: string) {
  const saleItems = state.sales.flatMap((sale) => sale.items.filter((item) => item.dishId === dishId));
  if (saleItems.length === 0) {
    const dish = state.dishes.find((item) => item.id === dishId);
    return dish ? calculateDishCost(state, dish).recommendedPrice : 0;
  }
  const revenue = saleItems.reduce((sum, item) => sum + item.quantity * item.unitPrice * (1 - item.discount), 0);
  const quantity = saleItems.reduce((sum, item) => sum + item.quantity, 0);
  return revenue / Math.max(quantity, 1);
}

function accumulateBaseRecipeIngredients(
  state: AppState,
  recipeId: string,
  batchFactor: number,
  bucket: Record<string, number>,
) {
  const recipe = state.baseRecipes.find((item) => item.id === recipeId);
  if (!recipe) return;
  recipe.items.forEach((item) => {
    const ingredient = getIngredient(state, item.ingredientId);
    if (!ingredient) return;
    const quantityInPurchaseUnit = convertQuantity(item.quantity * batchFactor, item.unit, ingredient.purchaseUnit);
    bucket[ingredient.id] = (bucket[ingredient.id] ?? 0) + quantityInPurchaseUnit;
  });
}

function accumulateDishIngredients(
  state: AppState,
  dishId: string,
  multiplier: number,
  bucket: Record<string, number>,
) {
  const dish = state.dishes.find((item) => item.id === dishId);
  if (!dish) return;
  dish.directItems.forEach((component) => {
    if (component.componentType === 'ingredient') {
      const ingredient = getIngredient(state, component.refId);
      if (!ingredient) return;
      const quantityInPurchaseUnit = convertQuantity(component.quantity * multiplier, component.unit, ingredient.purchaseUnit);
      bucket[ingredient.id] = (bucket[ingredient.id] ?? 0) + quantityInPurchaseUnit;
      return;
    }
    if (component.componentType === 'baseRecipe') {
      const recipe = state.baseRecipes.find((item) => item.id === component.refId);
      if (!recipe) return;
      const requestedInYieldUnit = convertQuantity(component.quantity, component.unit, recipe.yieldUnit);
      accumulateBaseRecipeIngredients(
        state,
        component.refId,
        (requestedInYieldUnit / Math.max(recipe.yieldAmount, 0.001)) * multiplier,
        bucket,
      );
    }
  });
}

export function getIngredientUsageForecast(state: AppState, ingredientId: string) {
  const usageBucket: Record<string, number> = {};
  state.sales.forEach((sale) => {
    sale.items.forEach((item) => {
      accumulateDishIngredients(state, item.dishId, item.quantity, usageBucket);
    });
  });

  const latestSalesDate = getLatestSalesDate(state);
  const earliestSalesDate = [...state.sales.map((sale) => sale.soldAt)].sort()[0] ?? latestSalesDate;
  const salesWindowDays = Math.max(diffDays(earliestSalesDate, latestSalesDate) + 1, 7);
  const salesDrivenUsage = usageBucket[ingredientId] ?? 0;
  const avgDailyUsage = salesDrivenUsage / salesWindowDays;

  const plannedBucket: Record<string, number> = {};
  state.productionPlans
    .filter((plan) => plan.status !== 'Finalizado' && plan.status !== 'Cancelado')
    .forEach((plan) => {
      plan.items.forEach((item) => {
        if (item.refType === 'baseRecipe') {
          accumulateBaseRecipeIngredients(state, item.refId, item.quantity, plannedBucket);
          return;
        }
        accumulateDishIngredients(state, item.refId, item.quantity, plannedBucket);
      });
    });

  return {
    avgDailyUsage,
    plannedUsage: plannedBucket[ingredientId] ?? 0,
    salesWindowDays,
  };
}

export function getWarehouseAuditSummary(state: AppState) {
  const items = state.ingredients.map((ingredient) => {
    const supplier = state.suppliers.find((entry) => entry.id === ingredient.primarySupplierId);
    const category = state.categories.find((entry) => entry.id === ingredient.categoryId);
    const sanitaryCategory = state.sanitaryCategories.find((entry) => entry.id === ingredient.sanitaryCategoryId);
    const { avgDailyUsage, plannedUsage } = getIngredientUsageForecast(state, ingredient.id);
    const projectedDaysRemaining = avgDailyUsage > 0 ? ingredient.currentStock / avgDailyUsage : Number.POSITIVE_INFINITY;
    const projectedStockAtLeadTime = ingredient.currentStock - avgDailyUsage * Math.max(supplier?.leadTimeDays ?? 1, 1) - plannedUsage;
    const suggestedOrderQty = projectedStockAtLeadTime < ingredient.minStock
      ? Math.max(ingredient.maxStock - projectedStockAtLeadTime, ingredient.minStock - projectedStockAtLeadTime, 0)
      : 0;
    const tempOk = ingredient.currentStorageTemp >= ingredient.recommendedMinTemp &&
      ingredient.currentStorageTemp <= ingredient.recommendedMaxTemp;
    const expiryDays = daysUntil(ingredient.expiryDate);
    const hasMissingTraceability = !ingredient.internalCode || !ingredient.lotCode || !ingredient.receivedDate || !ingredient.expiryDate;
    const alerts = [
      ingredient.currentStock <= ingredient.minStock ? 'Stock bajo' : '',
      projectedStockAtLeadTime < ingredient.minStock ? 'Quiebre proyectado' : '',
      !tempOk ? 'Temperatura fuera de rango' : '',
      ingredient.currentStorageTemp >= 5 && ingredient.currentStorageTemp <= 65 && ingredient.riskLevel !== 'Bajo' ? 'Zona de peligro' : '',
      expiryDays <= 2 ? 'Cerca de vencimiento' : '',
      hasMissingTraceability ? 'Trazabilidad incompleta' : '',
    ].filter(Boolean);

    return {
      ingredient,
      supplier,
      category,
      sanitaryCategory,
      avgDailyUsage,
      plannedUsage,
      projectedDaysRemaining,
      projectedStockAtLeadTime,
      suggestedOrderQty,
      tempOk,
      expiryDays,
      hasMissingTraceability,
      alerts,
    };
  });

  return {
    totalItems: items.length,
    lowStockCount: items.filter((item) => item.ingredient.currentStock <= item.ingredient.minStock).length,
    projectedBreakCount: items.filter((item) => item.projectedStockAtLeadTime < item.ingredient.minStock).length,
    temperatureIssueCount: items.filter((item) => !item.tempOk).length,
    nearExpiryCount: items.filter((item) => item.expiryDays <= 2).length,
    openDraftPurchases: state.purchases.filter((purchase) => purchase.status === 'draft').length,
    items,
  };
}

export function getDashboardAlerts(state: AppState): DashboardAlert[] {
  const alerts: DashboardAlert[] = [];
  const sanitaryCategories = state.sanitaryCategories ?? [];

  state.ingredients.forEach((ingredient) => {
    if (ingredient.currentStock <= ingredient.minStock) {
      alerts.push({
        id: `stock-${ingredient.id}`,
        severity: 'critical',
        title: 'Inventario bajo',
        description: `${ingredient.name} esta bajo minimo operativo.`,
      });
    }
    if (ingredient.priceHistory.length >= 2) {
      const sorted = [...ingredient.priceHistory].sort((a, b) => a.date.localeCompare(b.date));
      const previous = sorted[sorted.length - 2];
      const current = sorted[sorted.length - 1];
      if (previous && current && current.pricePurchase > previous.pricePurchase * 1.08) {
        alerts.push({
          id: `price-${ingredient.id}`,
          severity: 'warning',
          title: 'Ingrediente con alza de precio',
          description: `${ingredient.name} subio ${(current.pricePurchase / previous.pricePurchase - 1) * 100}% vs compra anterior.`,
        });
      }
    }
    if (ingredient.currentStorageTemp < ingredient.recommendedMinTemp || ingredient.currentStorageTemp > ingredient.recommendedMaxTemp) {
      alerts.push({
        id: `temp-${ingredient.id}`,
        severity: 'critical',
        title: 'Temperatura fuera de rango',
        description: `${ingredient.name} esta a ${ingredient.currentStorageTemp} C y deberia estar entre ${ingredient.recommendedMinTemp} C y ${ingredient.recommendedMaxTemp} C.`,
        context: 'haccp',
      });
    }
    if (ingredient.currentStorageTemp >= 5 && ingredient.currentStorageTemp <= 65 && ingredient.riskLevel !== 'Bajo') {
      alerts.push({
        id: `danger-zone-${ingredient.id}`,
        severity: 'critical',
        title: 'Producto en zona de peligro',
        description: `${ingredient.name} quedo registrado dentro de la zona de peligro microbiologico.`,
        context: 'haccp',
      });
    }
    if (daysUntil(ingredient.expiryDate) <= 2) {
      alerts.push({
        id: `expiry-${ingredient.id}`,
        severity: 'warning',
        title: 'Producto cerca de vencimiento',
        description: `${ingredient.name} vence el ${ingredient.expiryDate}. Revisar rotacion FIFO y salida prioritaria.`,
        context: 'fifo',
      });
    }
  });

  const readyOrCooked = state.ingredients.filter((item) => item.sanitaryCategoryId === 'san-ready');
  const rawAnimal = state.ingredients.filter((item) => {
    const category = sanitaryCategories.find((entry) => entry.id === item.sanitaryCategoryId);
    return category?.crossContaminationGroup === 'raw-animal';
  });
  readyOrCooked.forEach((ready) => {
    rawAnimal.forEach((raw) => {
      if (ready.storageLocation && raw.storageLocation && ready.storageLocation === raw.storageLocation) {
        alerts.push({
          id: `cross-${ready.id}-${raw.id}`,
          severity: 'critical',
          title: 'Riesgo de contaminacion cruzada',
          description: `${ready.name} comparte ubicacion con ${raw.name}. Separar crudos de listos para consumo.`,
          context: 'haccp',
        });
      }
    });
  });

  const chemicalProducts = state.ingredients.filter((item) => item.sanitaryCategoryId === 'san-chemical');
  const foodProducts = state.ingredients.filter((item) => item.sanitaryCategoryId !== 'san-chemical');
  chemicalProducts.forEach((chemical) => {
    foodProducts.forEach((food) => {
      if (chemical.storageLocation && food.storageLocation && chemical.storageLocation === food.storageLocation) {
        alerts.push({
          id: `chemical-${chemical.id}-${food.id}`,
          severity: 'critical',
          title: 'Quimico almacenado con alimentos',
          description: `${chemical.name} no puede compartir zona con ${food.name}.`,
          context: 'haccp',
        });
      }
    });
  });

  state.dishes.forEach((dish) => {
    const result = calculateDishCost(state, dish);
    const target = getEffectiveFoodCostTarget(state, dish);
    if (result.foodCostPercent > target) {
      alerts.push({
        id: `fc-${dish.id}`,
        severity: 'warning',
        title: 'Food cost sobre objetivo',
        description: `${dish.name} opera en ${(result.foodCostPercent * 100).toFixed(1)}% vs objetivo ${(target * 100).toFixed(1)}%.`,
      });
    }
    if (result.netMarginPercent < 0.18) {
      alerts.push({
        id: `margin-${dish.id}`,
        severity: 'critical',
        title: 'Margen neto bajo',
        description: `${dish.name} necesita ajuste de precio o receta.`,
      });
    }
  });

  const wasteByIngredient = state.wasteRecords.reduce<Record<string, number>>((acc, item) => {
    acc[item.ingredientId] = (acc[item.ingredientId] ?? 0) + item.costImpact;
    return acc;
  }, {});
  Object.entries(wasteByIngredient).forEach(([ingredientId, value]) => {
    if (value > 25000) {
      const ingredient = state.ingredients.find((item) => item.id === ingredientId);
      alerts.push({
        id: `waste-${ingredientId}`,
        severity: 'warning',
        title: 'Merma excesiva',
        description: `${ingredient?.name ?? 'Ingrediente'} acumula ${Math.round(value)} en merma valorizada.`,
      });
    }
  });

  return alerts.slice(0, 10);
}

export function getDashboardMetrics(state: AppState): DashboardMetrics {
  const salesRevenue = state.sales.reduce(
    (sum, sale) =>
      sum +
      sale.items.reduce((saleSum, item) => saleSum + item.quantity * item.unitPrice * (1 - item.discount), 0),
    0,
  );

  const salesCosts = state.sales.reduce(
    (sum, sale) =>
      sum +
      sale.items.reduce((saleSum, item) => {
        const dish = state.dishes.find((candidate) => candidate.id === item.dishId);
        if (!dish) return saleSum;
        return saleSum + calculateDishCost(state, dish).totalCost * item.quantity;
      }, 0),
    0,
  );

  const foodCostPercent = salesRevenue === 0 ? 0 : salesCosts / salesRevenue;
  const grossMarginPercent = salesRevenue === 0 ? 0 : (salesRevenue - salesCosts) / salesRevenue;
  const wasteValue = getWasteValue(state);
  const indirectMonthly = state.indirectCosts.reduce((sum, item) => sum + getMonthlyCostAmount(item), 0);
  const estimatedProfit = salesRevenue - salesCosts - wasteValue - indirectMonthly / 4;
  const netMarginPercent = salesRevenue === 0 ? 0 : estimatedProfit / salesRevenue;
  const latestProjection = getLatestProjection(state.projections);
  const monthlyProjection = latestProjection ? calculateProjectionRevenue(latestProjection) : 0;
  const contributionMarginRatio = salesRevenue === 0 ? 0 : (salesRevenue - salesCosts - wasteValue) / salesRevenue;
  const totalMonthlyStructure =
    state.business.fixedCostsMonthly +
    indirectMonthly +
    calculateTotalMonthlyLaborCost(state);
  const projectedProfit = monthlyProjection * contributionMarginRatio - totalMonthlyStructure;
  const projectedNetMarginPercent = monthlyProjection === 0 ? 0 : projectedProfit / monthlyProjection;

  const ranked = state.dishes
    .map((dish) => ({
      dish,
      result: calculateDishCost(state, dish),
      unitsSold: state.sales.flatMap((sale) => sale.items).filter((item) => item.dishId === dish.id).reduce((sum, item) => sum + item.quantity, 0),
    }))
    .sort((a, b) => b.result.netMarginPercent - a.result.netMarginPercent);

  return {
    totalSales: salesRevenue,
    totalCosts: salesCosts + wasteValue,
    foodCostPercent,
    grossMarginPercent,
    netMarginPercent,
    estimatedProfit,
    monthlyProjection,
    projectedNetMarginPercent,
    projectedProfit,
    topDishes: ranked.slice(0, 3),
    lowDishes: ranked.slice(-3).reverse(),
    alerts: getDashboardAlerts(state),
  };
}

export function getMenuEngineering(state: AppState): MenuEngineeringItem[] {
  const items = state.dishes.map((dish) => {
    const result = calculateDishCost(state, dish);
    const saleItems = state.sales.flatMap((sale) => sale.items.filter((item) => item.dishId === dish.id));
    const unitsSold = saleItems.reduce((sum, item) => sum + item.quantity, 0);
    const revenue = saleItems.reduce((sum, item) => sum + item.quantity * item.unitPrice * (1 - item.discount), 0);
    const contribution = revenue - result.totalCost * unitsSold;
    return { dish, result, unitsSold, revenue, contribution };
  });

  const averagePopularity =
    items.reduce((sum, item) => sum + item.unitsSold, 0) / Math.max(items.length, 1);
  const averageContribution =
    items.reduce((sum, item) => sum + item.contribution, 0) / Math.max(items.length, 1);

  return items.map((item) => {
    const highPopularity = item.unitsSold >= averagePopularity;
    const highContribution = item.contribution >= averageContribution;
    const quadrant = highContribution && highPopularity
      ? 'Estrella'
      : !highContribution && highPopularity
        ? 'Vaca'
        : highContribution && !highPopularity
          ? 'Puzzle'
          : 'Perro';
    const recommendedAction =
      quadrant === 'Estrella'
        ? 'Mantener posicion, proteger calidad y no tocar gramaje.'
        : quadrant === 'Vaca'
          ? 'Reducir costo oculto o subir precio con cuidado.'
          : quadrant === 'Puzzle'
            ? 'Reposicionar en carta y reforzar venta consultiva.'
            : 'Rediseñar, simplificar o retirar del menu.';

    return {
      ...item,
      popularityIndex: averagePopularity === 0 ? 0 : item.unitsSold / averagePopularity,
      quadrant,
      recommendedAction,
    };
  });
}

export function getInventoryValue(state: AppState) {
  return state.ingredients.reduce((sum, ingredient) => {
    return sum + ingredient.currentStock * ingredient.purchasePrice;
  }, 0);
}

export function getReportSnapshot(state: AppState): ReportSnapshot {
  const metrics = getDashboardMetrics(state);
  const averageContribution =
    state.dishes.reduce((sum, dish) => {
      const result = calculateDishCost(state, dish);
      const avgPrice = getAverageUnitPrice(state, dish.id);
      return sum + Math.max(avgPrice - result.totalCost, 0);
    }, 0) / Math.max(state.dishes.length, 1);

  const averageDishSellingPrice =
    state.dishes.reduce((sum, dish) => sum + (getAverageUnitPrice(state, dish.id) || roundPriceForCustomer(calculateDishCost(state, dish).recommendedPrice)), 0) /
    Math.max(state.dishes.length, 1);

  const latestProjection = getLatestProjection(state.projections);
  const projectedGuests = latestProjection
    ? latestProjection.days.reduce((daySum, day) => {
      const multiplier = latestProjection.period === 'mes' ? 4 : latestProjection.period === 'semana' ? 4 : 30;
      return daySum + day.projectedCustomers * multiplier;
    }, 0)
    : 0;
  const projectedAverageFoodTicket = projectedGuests > 0 ? metrics.monthlyProjection / projectedGuests : 0;
  const totalMonthlyStructure =
    state.business.fixedCostsMonthly +
    state.indirectCosts.reduce((sum, item) => sum + getMonthlyCostAmount(item), 0) +
    calculateTotalMonthlyLaborCost(state);

  const contributionMargin = metrics.totalSales === 0
    ? 0
    : (metrics.totalSales - metrics.totalCosts) / metrics.totalSales;

  const breakEvenSales = contributionMargin > 0 ? totalMonthlyStructure / contributionMargin : totalMonthlyStructure;
  const breakEvenUnits = averageContribution > 0 ? Math.ceil(totalMonthlyStructure / averageContribution) : 0;
  const breakEvenGuestTickets = projectedAverageFoodTicket > 0 ? Math.ceil(breakEvenSales / projectedAverageFoodTicket) : 0;

  return {
    inventoryValue: getInventoryValue(state),
    wasteValue: getWasteValue(state),
    breakEvenSales,
    breakEvenUnits,
    breakEvenGuestTickets,
    totalMonthlyStructure,
    averageDishSellingPrice,
    projectedAverageFoodTicket,
    contributionMargin: averageContribution,
    contributionMarginRatio: contributionMargin,
    projectedProfit: metrics.monthlyProjection - totalMonthlyStructure,
  };
}

export function simulateDishScenario(
  state: AppState,
  dishId: string,
  adjustments: {
    ingredientIncreasePercent: number;
    salePriceChangePercent: number;
    yieldImprovementPercent: number;
    extraUnits: number;
  },
) {
  const dish = state.dishes.find((item) => item.id === dishId);
  if (!dish) return null;

  const baseResult = calculateDishCost(state, dish);
  const materialFactor = 1 + adjustments.ingredientIncreasePercent / 100 - adjustments.yieldImprovementPercent / 100;
  const adjustedCost = Math.max(
    baseResult.totalCost + (baseResult.ingredientCost + baseResult.baseRecipeCost) * (materialFactor - 1),
    0,
  );
  const currentPrice = getAverageUnitPrice(state, dish.id) || baseResult.recommendedPrice;
  const adjustedPrice = currentPrice * (1 + adjustments.salePriceChangePercent / 100);
  const adjustedMargin = adjustedPrice === 0 ? 0 : (adjustedPrice - adjustedCost) / adjustedPrice;
  const projectedUnits = dish.salesCount + adjustments.extraUnits;

  return {
    adjustedCost,
    adjustedPrice,
    adjustedMargin,
    projectedContribution: (adjustedPrice - adjustedCost) * projectedUnits,
  };
}
