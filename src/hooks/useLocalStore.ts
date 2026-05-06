import { useEffect, useMemo, useState } from 'react';
import { createProductionAppState } from '../data/initialState';
import { createId } from '../lib/id';
import { calculateUsefulUnitCost } from '../services/costEngine';
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
    indirectCosts: parsed.indirectCosts ?? fallback.indirectCosts,
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

  return {
    ...nextState,
    ingredients: syncIngredientsWithLatestYieldRecords(nextState.ingredients, nextState.yieldRecords),
    staffShifts: normalizeSundayMorningOnlyShifts(nextState.staffShifts, nextState.laborProfiles),
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

export function useLocalStore() {
  const { user, usingSupabase } = useAuth();
  const [state, setState] = useState<AppState>(() => createRemoteFallbackState(user));
  const [isHydrating, setIsHydrating] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    if (!usingSupabase) return;
    setState(createRemoteFallbackState(user));
  }, [usingSupabase, user]);

  useEffect(() => {
    if (!usingSupabase || !supabase || !user?.businessId) return;
    const client = supabase;

    let cancelled = false;

    const hydrate = async () => {
      setIsHydrating(true);
      setSyncError(null);

      const { data, error } = await client
        .from('app_snapshots')
        .select('state')
        .eq('business_id', user.businessId)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        setSyncError(error.message);
        setIsHydrating(false);
        return;
      }

      if (data?.state) {
        setState(mergeState(data.state as Partial<AppState>, user.businessId));
      } else {
        const emptyState = createProductionAppState({
          businessId: user.businessId,
          businessName: 'Nuevo negocio gastronomico',
          user,
        });
        setState(emptyState);
      }

      if (!cancelled) setIsHydrating(false);
    };

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [usingSupabase, user]);

  useEffect(() => {
    if (!usingSupabase || !supabase || !user?.businessId || isHydrating) return;
    const client = supabase;

    const timeout = window.setTimeout(async () => {
      const remoteState = {
        ...state,
        business: {
          ...state.business,
          id: user.businessId,
        },
      };

      const { error } = await client.from('app_snapshots').upsert({
        business_id: user.businessId,
        state: remoteState,
      });

      if (error) setSyncError(error.message);
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [state, usingSupabase, user, isHydrating]);

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
