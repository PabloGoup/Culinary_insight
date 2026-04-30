import { Fragment, Suspense, lazy, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Beef,
  Boxes,
  BriefcaseBusiness,
  ChefHat,
  ClipboardList,
  Factory,
  FlaskConical,
  Lock,
  LogIn,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Save,
  Scale,
  ShoppingCart,
  Sparkles,
  Store,
  Trash2,
  TrendingDown,
  TrendingUp,
  Truck,
  Users,
} from 'lucide-react';
import { useAuth } from './hooks/useAuth';
import type { LoginOptions } from './auth/AuthContext';
import { useLocalStore } from './hooks/useLocalStore';
import udlaLogo from './images/logo.png';
import { decimal, money, percent } from './lib/format';
import { createId } from './lib/id';
import {
  calculateLaborCostPerMinute,
  calculateLaborProfileCostPerMinute,
  calculateLaborProfileMonthlyCost,
  calculateLaborProfileMonthlyTeamCost,
  calculateTotalMonthlyLaborCost,
  calculateBaseRecipeCost,
  calculateDishCost,
  getDishOperationalCapacitySnapshot,
  calculateProjectionRevenue,
  getLatestProjection,
  calculateUsefulUnitCost,
  roundPriceForCustomer,
  getMonthlyCostAmount,
  getWarehouseAuditSummary,
} from './services/costEngine';
import { isSupabaseConfigured } from './services/supabaseClient';
import type {
  BaseRecipe,
  Dish,
  DishComponent,
  FoodCostTarget,
  IndirectCost,
  Ingredient,
  InventoryMovement,
  LaborProfile,
  LaborRoleGroup,
  PackagingCost,
  ProductionPlan,
  Projection,
  Purchase,
  RiskLevel,
  Role,
  Sale,
  SalesChannel,
  SanitaryCategoryConfig,
  StaffShift,
  Supplier,
  Unit,
  WasteRecord,
  YieldRecord,
} from './types';

const DashboardModule = lazy(() => import('./modules/insights').then((module) => ({ default: module.DashboardModule })));
const AnalyticsModule = lazy(() => import('./modules/insights').then((module) => ({ default: module.AnalyticsModule })));
const SimulationsModule = lazy(() => import('./modules/insights').then((module) => ({ default: module.SimulationsModule })));
const ReportsModule = lazy(() => import('./modules/insights').then((module) => ({ default: module.ReportsModule })));

type View =
  | 'dashboard'
  | 'ingredients'
  | 'yields'
  | 'baseRecipes'
  | 'dishes'
  | 'sheets'
  | 'procurement'
  | 'inventory'
  | 'waste'
  | 'production'
  | 'sales'
  | 'expenses'
  | 'planning'
  | 'analytics'
  | 'simulations'
  | 'reports'
  | 'settings';

const units: Unit[] = ['kg', 'g', 'litro', 'ml', 'unidad', 'porcion'];
const channels: SalesChannel[] = ['Salon', 'Delivery', 'Retiro', 'Hotel', 'Eventos', 'Banqueteria', 'Room service'];

const navItems: Array<{
  id: View;
  label: string;
  icon: typeof Store;
  roles: Role[];
}> = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: Store,
    roles: ['Administrador general', 'Gerente', 'Chef ejecutivo', 'Sous chef', 'Jefe de compras', 'Bodega', 'Finanzas', 'Operador'],
  },
  {
    id: 'ingredients',
    label: 'Materias primas',
    icon: Beef,
    roles: ['Administrador general', 'Gerente', 'Chef ejecutivo', 'Sous chef', 'Jefe de compras', 'Bodega'],
  },
  {
    id: 'yields',
    label: 'Rendimientos',
    icon: Scale,
    roles: ['Administrador general', 'Gerente', 'Chef ejecutivo', 'Sous chef', 'Bodega'],
  },
  {
    id: 'baseRecipes',
    label: 'Recetas base',
    icon: FlaskConical,
    roles: ['Administrador general', 'Gerente', 'Chef ejecutivo', 'Sous chef'],
  },
  {
    id: 'dishes',
    label: 'Platos finales',
    icon: ChefHat,
    roles: ['Administrador general', 'Gerente', 'Chef ejecutivo', 'Sous chef'],
  },
  {
    id: 'sheets',
    label: 'Planillas',
    icon: ClipboardList,
    roles: ['Administrador general', 'Gerente', 'Chef ejecutivo', 'Sous chef', 'Jefe de compras', 'Bodega', 'Finanzas'],
  },
  {
    id: 'procurement',
    label: 'Compras',
    icon: ShoppingCart,
    roles: ['Administrador general', 'Gerente', 'Jefe de compras', 'Bodega', 'Finanzas'],
  },
  {
    id: 'inventory',
    label: 'Bodega y stock',
    icon: Boxes,
    roles: ['Administrador general', 'Gerente', 'Jefe de compras', 'Bodega', 'Chef ejecutivo', 'Sous chef'],
  },
  {
    id: 'waste',
    label: 'Mermas',
    icon: TrendingDown,
    roles: ['Administrador general', 'Gerente', 'Chef ejecutivo', 'Sous chef', 'Bodega'],
  },
  {
    id: 'production',
    label: 'Produccion',
    icon: Factory,
    roles: ['Administrador general', 'Gerente', 'Chef ejecutivo', 'Sous chef', 'Operador'],
  },
  {
    id: 'sales',
    label: 'Ventas',
    icon: TrendingUp,
    roles: ['Administrador general', 'Gerente', 'Finanzas', 'Operador'],
  },
  {
    id: 'expenses',
    label: 'Gastos',
    icon: BriefcaseBusiness,
    roles: ['Administrador general', 'Gerente', 'Finanzas'],
  },
  {
    id: 'planning',
    label: 'Planificacion',
    icon: Users,
    roles: ['Administrador general', 'Gerente', 'Chef ejecutivo', 'Sous chef', 'Finanzas'],
  },
  {
    id: 'analytics',
    label: 'Menu engineering',
    icon: BarChart3,
    roles: ['Administrador general', 'Gerente', 'Chef ejecutivo', 'Finanzas'],
  },
  {
    id: 'simulations',
    label: 'Simulaciones',
    icon: Sparkles,
    roles: ['Administrador general', 'Gerente', 'Chef ejecutivo', 'Finanzas'],
  },
  {
    id: 'reports',
    label: 'Reportes',
    icon: ClipboardList,
    roles: ['Administrador general', 'Gerente', 'Finanzas'],
  },
  {
    id: 'settings',
    label: 'Configuracion',
    icon: BriefcaseBusiness,
    roles: ['Administrador general', 'Gerente', 'Finanzas'],
  },
];

function parseNumericInput(value: string, fallback = 0) {
  if (value.trim() === '') return fallback;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
}

const laborRoleGroupLabels: Record<LaborRoleGroup, string> = {
  chef: 'Chef ejecutivo',
  'sous-chef': 'Sous chef',
  cocinero: 'Cocinero',
  ayudante: 'Ayudante de cocina',
  pasteleria: 'Pasteleria',
  administrativo: 'Administrativo',
};

function getLaborPolicy(
  state: ReturnType<typeof useLocalStore>['state'],
  laborProfileId: string,
  laborMinutes: number,
) {
  const profile = state.laborProfiles.find((item) => item.id === laborProfileId);
  const maxMinutes = Math.max(state.business.maxLeadershipMinutes, 1);

  if (!profile) {
    return { tone: 'warning' as const, text: 'Sin perfil laboral', detail: 'Asigna un perfil para validar la politica de tiempos.' };
  }

  if (laborMinutes > maxMinutes && profile.roleGroup !== 'ayudante') {
    return {
      tone: 'danger' as const,
      text: 'Debe pasar a ayudante',
      detail: `${profile.roleName} supera ${decimal.format(maxMinutes)} min. Todo trabajo sobre ese umbral debe quedar en ayudante de cocina.`,
    };
  }

  if (laborMinutes > maxMinutes && profile.roleGroup === 'ayudante') {
    return {
      tone: 'ok' as const,
      text: 'Correcto para ayudante',
      detail: `La tarea excede ${decimal.format(maxMinutes)} min y ya esta asignada a ayudante de cocina.`,
    };
  }

  return {
    tone: 'ok' as const,
    text: 'Dentro de politica',
    detail: `${profile.roleName} queda dentro del umbral de ${decimal.format(maxMinutes)} min.`,
  };
}

function getEffectiveLaborMinutes(timeMinutes: number, laborMinutes: number) {
  return laborMinutes > 0 ? laborMinutes : Math.max(timeMinutes, 0);
}

function getDishAssemblyPolicy(
  state: ReturnType<typeof useLocalStore>['state'],
  laborMinutes: number,
) {
  const maxMinutes = Math.max(state.business.maxLeadershipMinutes, 1);

  if (laborMinutes <= 0) {
    return {
      tone: 'warning' as const,
      text: 'Define minutos de armado final',
      detail: 'El plato debe registrar un tiempo real de armado para calcular mano de obra e indirectos.',
    };
  }

  if (laborMinutes > maxMinutes) {
    return {
      tone: 'danger' as const,
      text: 'Armado final fuera de politica',
      detail: `El plato final no puede superar ${decimal.format(maxMinutes)} min de armado. Lleva trabajo a recetas base o simplifica el montaje.`,
    };
  }

  return {
    tone: 'ok' as const,
    text: 'Armado final dentro de politica',
    detail: `El plato queda dentro del maximo operativo de ${decimal.format(maxMinutes)} min.`,
  };
}

function getSanitaryCategory(state: ReturnType<typeof useLocalStore>['state'], sanitaryCategoryId: string) {
  return state.sanitaryCategories.find((item) => item.id === sanitaryCategoryId);
}

function normalizeCodePart(value: string, fallback: string) {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toUpperCase();
  return (normalized || fallback).slice(0, 3).padEnd(3, 'X');
}

function findIngredientCategoryByName(state: ReturnType<typeof useLocalStore>['state'], patterns: string[]) {
  return state.categories.find((category) => {
    if (category.type !== 'ingredient') return false;
    const normalizedName = category.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    return patterns.some((pattern) => normalizedName.includes(pattern));
  });
}

function getLinkedIngredientCategoryId(
  state: ReturnType<typeof useLocalStore>['state'],
  sanitaryCategoryId: string,
  fallbackCategoryId: string,
) {
  const sanitary = getSanitaryCategory(state, sanitaryCategoryId);
  if (!sanitary) return fallbackCategoryId;
  const name = sanitary.name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const group = sanitary.crossContaminationGroup.toLowerCase();
  const storage = sanitary.storageType
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (name.includes('fruta')) return findIngredientCategoryByName(state, ['fruta'])?.id ?? fallbackCategoryId;
  if (name.includes('verdura') || group === 'produce') return findIngredientCategoryByName(state, ['verdura', 'hortaliza'])?.id ?? fallbackCategoryId;
  if (name.includes('lacteo') || name.includes('huevo')) return findIngredientCategoryByName(state, ['lacteo'])?.id ?? fallbackCategoryId;
  if (name.includes('panaderia') || name.includes('pasteleria')) return findIngredientCategoryByName(state, ['panaderia'])?.id ?? fallbackCategoryId;
  if (name.includes('carne') || name.includes('ave') || name.includes('pescado') || name.includes('marisco') || name.includes('embutido') || group === 'raw-animal') {
    return findIngredientCategoryByName(state, ['proteina'])?.id ?? fallbackCategoryId;
  }
  if (name.includes('vino') || name.includes('bebida')) return findIngredientCategoryByName(state, ['bebida', 'vino'])?.id ?? fallbackCategoryId;
  if (storage.includes('seco') || group === 'dry') return findIngredientCategoryByName(state, ['seco', 'despensa'])?.id ?? fallbackCategoryId;

  return fallbackCategoryId;
}

function generateIngredientInternalCode(
  state: ReturnType<typeof useLocalStore>['state'],
  ingredient: Pick<Ingredient, 'id' | 'name' | 'categoryId'>,
) {
  const category = state.categories.find((item) => item.id === ingredient.categoryId);
  const prefix = normalizeCodePart(category?.name ?? ingredient.name, 'MP');
  const usedNumbers = state.ingredients
    .filter((item) => item.id !== ingredient.id && item.internalCode.startsWith(`${prefix}-`))
    .map((item) => Number(item.internalCode.split('-')[1]))
    .filter(Number.isFinite);
  const nextNumber = Math.max(0, ...usedNumbers) + 1;
  return `${prefix}-${String(nextNumber).padStart(3, '0')}`;
}

function getSupplierCodeOptions(state: ReturnType<typeof useLocalStore>['state'], supplierId: string) {
  return Array.from(new Set(
    state.ingredients
      .filter((ingredient) => ingredient.primarySupplierId === supplierId && ingredient.supplierCode.trim())
      .map((ingredient) => ingredient.supplierCode.trim()),
  )).sort((a, b) => a.localeCompare(b));
}

function generateSupplierCode(state: ReturnType<typeof useLocalStore>['state'], ingredient: Ingredient) {
  const supplier = state.suppliers.find((item) => item.id === ingredient.primarySupplierId);
  const supplierPrefix = normalizeCodePart(supplier?.name ?? 'PRO', 'PRO');
  const ingredientPrefix = normalizeCodePart(ingredient.name || state.categories.find((item) => item.id === ingredient.categoryId)?.name || 'MP', 'MP');
  const usedNumbers = state.ingredients
    .filter((item) => item.id !== ingredient.id && item.primarySupplierId === ingredient.primarySupplierId)
    .map((item) => {
      const parts = item.supplierCode.split('-');
      return Number(parts[parts.length - 1]);
    })
    .filter(Number.isFinite);
  const nextNumber = Math.max(0, ...usedNumbers) + 1;
  return `${supplierPrefix}-${ingredientPrefix}-${String(nextNumber).padStart(2, '0')}`;
}

function generateLotCode(ingredient: Ingredient) {
  const date = (ingredient.receivedDate || new Date().toISOString().slice(0, 10)).replace(/-/g, '');
  const productCode = (ingredient.internalCode || normalizeCodePart(ingredient.name, 'MP')).replace(/[^A-Z0-9]/gi, '').slice(0, 6).toUpperCase();
  const supplierCode = (ingredient.supplierCode || 'PRO').replace(/[^A-Z0-9]/gi, '').slice(0, 4).toUpperCase();
  return `LOT-${date}-${productCode}-${supplierCode}`;
}

function getStorageTypeOptions(state: ReturnType<typeof useLocalStore>['state'], currentStorageType: string) {
  return Array.from(new Set(
    [
      currentStorageType,
      ...state.sanitaryCategories.map((category) => category.storageType),
    ].filter(Boolean),
  )).sort((a, b) => a.localeCompare(b));
}

function applySanitaryCategory(
  state: ReturnType<typeof useLocalStore>['state'],
  ingredient: Ingredient,
  sanitaryCategoryId: string,
) {
  const sanitary = getSanitaryCategory(state, sanitaryCategoryId);
  if (!sanitary) return ingredient;
  const categoryId = getLinkedIngredientCategoryId(state, sanitaryCategoryId, ingredient.categoryId);
  return {
    ...ingredient,
    categoryId,
    sanitaryCategoryId,
    storageType: sanitary.storageType,
    recommendedMinTemp: sanitary.minTemp,
    recommendedMaxTemp: sanitary.maxTemp,
    currentStorageTemp: sanitary.minTemp,
    riskLevel: sanitary.riskLevel,
    colorHex: sanitary.colorHex,
    colorName: sanitary.colorName,
    storageConditions: sanitary.sanitaryCondition,
    storageTemperature: `${sanitary.minTemp} C a ${sanitary.maxTemp} C`,
  };
}

function emptyIngredient(state: ReturnType<typeof useLocalStore>['state']): Ingredient {
  const baseIngredient: Ingredient = {
    id: createId('ing'),
    name: '',
    categoryId: state.categories.find((item) => item.type === 'ingredient')?.id ?? '',
    sanitaryCategoryId: state.sanitaryCategories[0]?.id ?? '',
    primarySupplierId: state.suppliers[0]?.id ?? '',
    purchaseUnit: 'kg',
    useUnit: 'g',
    purchasePrice: 0,
    usefulUnitCost: 0,
    usableYieldPercent: 100,
    currentStock: 0,
    minStock: 0,
    maxStock: 0,
    lastPurchaseDate: new Date().toISOString().slice(0, 10),
    priceHistory: [],
    shelfLifeDays: 0,
    storageType: '',
    storageConditions: '',
    storageTemperature: '',
    recommendedMinTemp: 0,
    recommendedMaxTemp: 0,
    currentStorageTemp: 0,
    riskLevel: 'Bajo',
    colorHex: '#CBD5E1',
    colorName: 'Sin categoria',
    internalCode: '',
    supplierCode: '',
    storageLocation: '',
    receivedDate: new Date().toISOString().slice(0, 10),
    expiryDate: '',
    lotCode: '',
    responsible: '',
  };
  return applySanitaryCategory(state, baseIngredient, baseIngredient.sanitaryCategoryId);
}

function getIngredientPriceTrend(ingredient: Ingredient) {
  if (ingredient.priceHistory.length < 2) return null;
  const sorted = [...ingredient.priceHistory].sort((a, b) => a.date.localeCompare(b.date));
  const previous = sorted[sorted.length - 2];
  const current = sorted[sorted.length - 1];
  if (!previous || !current || previous.pricePurchase === 0) return null;
  const delta = current.pricePurchase - previous.pricePurchase;
  const percentDelta = delta / previous.pricePurchase;
  return { delta, percentDelta };
}

function emptyYieldRecord(state: ReturnType<typeof useLocalStore>['state']): YieldRecord {
  return {
    id: createId('yield'),
    ingredientId: state.ingredients[0]?.id ?? '',
    recordedAt: new Date().toISOString().slice(0, 10),
    purchaseWeight: 1,
    cleanedWeight: 1,
    cookedWeight: 1,
    finalUsefulWeight: 1,
    wastePercent: 0,
    yieldPercent: 100,
    wasteType: 'Operacional',
    trimLoss: 0,
    peelLoss: 0,
    boneLoss: 0,
    fatLoss: 0,
    evaporationLoss: 0,
    thawLoss: 0,
    handlingLoss: 0,
    notes: '',
  };
}

function getYieldTone(yieldPercent: number): 'ok' | 'warning' | 'danger' {
  if (yieldPercent >= 85 && yieldPercent <= 105) return 'ok';
  if (yieldPercent >= 65 && yieldPercent <= 110) return 'warning';
  return 'danger';
}

function getYieldStatusText(yieldPercent: number) {
  if (yieldPercent > 105) return 'Revisar captura';
  if (yieldPercent >= 85) return 'Controlado';
  if (yieldPercent >= 65) return 'Merma alta';
  return 'Critico';
}

function calculateYieldLossTotal(record: YieldRecord) {
  return record.trimLoss + record.peelLoss + record.boneLoss + record.fatLoss + record.evaporationLoss + record.thawLoss + record.handlingLoss;
}

function applyYieldLosses(record: YieldRecord): YieldRecord {
  const totalLoss = calculateYieldLossTotal(record);
  const finalUsefulWeight = Math.max(record.purchaseWeight - totalLoss, 0);
  const cleanedWeight = Math.max(record.purchaseWeight - record.trimLoss - record.peelLoss - record.boneLoss - record.fatLoss, 0);
  const cookedWeight = Math.max(cleanedWeight - record.evaporationLoss - record.thawLoss, 0);
  const yieldPercent = record.purchaseWeight > 0 ? (finalUsefulWeight / record.purchaseWeight) * 100 : 0;
  return {
    ...record,
    cleanedWeight,
    cookedWeight,
    finalUsefulWeight,
    yieldPercent,
    wastePercent: Math.max(100 - yieldPercent, 0),
  };
}

const yieldWasteTypes = ['Operacional', 'Produccion', 'Vencimiento', 'Manipulacion', 'Coccion', 'Limpieza', 'Error humano', 'Devolucion'];

function emptyBaseRecipe(state: ReturnType<typeof useLocalStore>['state']): BaseRecipe {
  return {
    id: createId('base'),
    name: '',
    categoryId: state.categories.find((item) => item.type === 'dish')?.id ?? '',
    kind: 'base',
    yieldAmount: 1000,
    yieldUnit: 'g',
    itemCostUnit: 'g',
    items: state.ingredients[0]
      ? [{ id: createId('item'), ingredientId: state.ingredients[0].id, quantity: 100, unit: 'g', wastePercent: 0 }]
      : [],
    timeMinutes: 0,
    laborProfileId: state.laborProfiles[0]?.id ?? '',
    laborMinutes: 0,
    instructions: '',
    qualityNotes: '',
    allergens: [],
    observations: '',
  };
}

function emptyDish(state: ReturnType<typeof useLocalStore>['state']): Dish {
  return {
    id: createId('dish'),
    name: '',
    categoryId: state.categories.find((item) => item.type === 'dish')?.id ?? '',
    service: 'Almuerzo',
    directItems: state.ingredients[0]
      ? [{ id: createId('cmp'), componentType: 'ingredient', refId: state.ingredients[0].id, quantity: 100, unit: 'g', wastePercent: 0 }]
      : [],
    garnishes: [],
    decorations: [],
    laborProfileId: state.laborProfiles[0]?.id ?? '',
    laborMinutes: 0,
    indirectCostShare: 1,
    targetFoodCost: state.business.targetFoodCost,
    desiredMargin: state.business.targetMargin,
    allergens: [],
    platingNotes: '',
    qualityChecklist: [],
    technicalNotes: '',
    shelfLifeHours: 12,
    salesCount: 0,
  };
}

function emptySupplier(): Supplier {
  return {
    id: createId('sup'),
    name: '',
    rut: '',
    contactName: '',
    phone: '',
    email: '',
    productCategory: '',
    paymentTerms: '',
    leadTimeDays: 0,
    qualityScore: 4,
    deliveryScore: 4,
    notes: '',
  };
}

function emptyPurchase(state: ReturnType<typeof useLocalStore>['state']): Purchase {
  return {
    id: createId('po'),
    supplierId: state.suppliers[0]?.id ?? '',
    orderedAt: new Date().toISOString().slice(0, 10),
    status: 'received',
    notes: '',
    items: state.ingredients[0]
      ? [
          {
            id: createId('poi'),
            ingredientId: state.ingredients[0].id,
            quantity: 1,
            unit: state.ingredients[0].purchaseUnit,
            unitPrice: state.ingredients[0].purchasePrice,
            receivedQuantity: 1,
          },
        ]
      : [],
  };
}

function emptyWaste(state: ReturnType<typeof useLocalStore>['state']): WasteRecord {
  return {
    id: createId('waste'),
    ingredientId: state.ingredients[0]?.id ?? '',
    quantity: 0,
    unit: state.ingredients[0]?.purchaseUnit ?? 'kg',
    reasonType: 'Operacional',
    responsible: '',
    date: new Date().toISOString().slice(0, 10),
    costImpact: 0,
  };
}

function emptyProduction(state: ReturnType<typeof useLocalStore>['state']): ProductionPlan {
  return {
    id: createId('prod'),
    name: '',
    scheduledFor: new Date().toISOString().slice(0, 10),
    responsible: '',
    status: 'Pendiente',
    items: state.baseRecipes[0]
      ? [{ id: createId('prod-item'), refType: 'baseRecipe', refId: state.baseRecipes[0].id, quantity: 1 }]
      : [],
  };
}

function createWarehouseAuditRow(ingredient: ReturnType<typeof useLocalStore>['state']['ingredients'][number]) {
  return {
    ingredientId: ingredient.id,
    checked: false,
    checkedBy: ingredient.responsible || '',
    countedStock: ingredient.currentStock,
    stockUnit: ingredient.purchaseUnit,
    storageTemp: ingredient.currentStorageTemp,
    location: ingredient.storageLocation || '',
    notes: '',
  };
}

function emptySale(state: ReturnType<typeof useLocalStore>['state']): Sale {
  return {
    id: createId('sale'),
    soldAt: new Date().toISOString().slice(0, 10),
    channel: 'Salon',
    items: state.dishes[0]
      ? [{ id: createId('sale-item'), dishId: state.dishes[0].id, quantity: 1, unitPrice: 0, discount: 0 }]
      : [],
  };
}

function emptyProjection(): Projection {
  return {
    id: createId('proj'),
    name: 'Nueva proyeccion',
    period: 'mes',
    days: [
      { day: 'Lunes', projectedCustomers: 120, avgFoodTicket: 17500, avgBeverageTicket: 4200 },
      { day: 'Martes', projectedCustomers: 110, avgFoodTicket: 17500, avgBeverageTicket: 4200 },
      { day: 'Miercoles', projectedCustomers: 125, avgFoodTicket: 17500, avgBeverageTicket: 4200 },
      { day: 'Jueves', projectedCustomers: 140, avgFoodTicket: 18200, avgBeverageTicket: 4700 },
      { day: 'Viernes', projectedCustomers: 155, avgFoodTicket: 18900, avgBeverageTicket: 5200 },
      { day: 'Sabado', projectedCustomers: 170, avgFoodTicket: 19600, avgBeverageTicket: 5600 },
      { day: 'Domingo', projectedCustomers: 145, avgFoodTicket: 18100, avgBeverageTicket: 4800 },
    ],
  };
}

function emptyIndirectCost(): IndirectCost {
  return {
    id: createId('ic'),
    name: '',
    category: '',
    period: 'mensual',
    amount: 0,
    allocationMethod: 'manual',
    allocationValue: 1,
  };
}

function emptyLabor(): LaborProfile {
  return {
    id: createId('labor'),
    roleName: '',
    roleGroup: 'cocinero',
    headcount: 1,
    monthlySalary: 0,
    monthlyHours: 220,
    extraMonthlyCost: 0,
  };
}

function emptyPackaging(): PackagingCost {
  return {
    id: createId('pack'),
    name: '',
    channel: 'General',
    unit: 'unidad',
    unitCost: 0,
  };
}

function emptyFoodCostTarget(state: ReturnType<typeof useLocalStore>['state']): FoodCostTarget {
  return {
    id: createId('fct'),
    scopeType: 'category',
    scopeId: state.categories.find((item) => item.type === 'dish')?.id ?? state.business.id,
    targetPercent: state.business.targetFoodCost,
  };
}

function emptyStaffShift(state: ReturnType<typeof useLocalStore>['state']): StaffShift {
  return {
    id: createId('shift'),
    laborProfileId: state.laborProfiles[0]?.id ?? '',
    employeeName: '',
    date: new Date().toISOString().slice(0, 10),
    startTime: '09:00',
    endTime: '18:00',
    breakMinutes: 30,
    extraMinutes: 0,
    notes: '',
  };
}

function createStaffShiftForCell(laborProfileId: string, employeeName: string, date: string): StaffShift {
  return {
    id: createId('shift'),
    laborProfileId,
    employeeName,
    date,
    startTime: '09:00',
    endTime: '18:00',
    breakMinutes: 30,
    extraMinutes: 0,
    notes: '',
  };
}

function parseTimeToMinutes(value: string) {
  const [hours = '0', minutes = '0'] = value.split(':');
  return Number(hours) * 60 + Number(minutes);
}

function minutesToTime(value: number) {
  const normalized = ((value % (24 * 60)) + (24 * 60)) % (24 * 60);
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function getShiftWorkedMinutes(shift: StaffShift) {
  const start = parseTimeToMinutes(shift.startTime);
  const end = parseTimeToMinutes(shift.endTime);
  const raw = end >= start ? end - start : (24 * 60 - start) + end;
  return Math.max(raw - Math.max(shift.breakMinutes, 0), 0);
}

function getChileWeeklyLimitHours(date: string) {
  return date >= '2026-04-26' ? 42 : 44;
}

function getWeekKey(date: string) {
  const current = new Date(`${date}T12:00:00`);
  const day = current.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  current.setDate(current.getDate() + diffToMonday);
  return current.toISOString().slice(0, 10);
}

function addDaysToIsoDate(date: string, days: number) {
  const current = new Date(`${date}T12:00:00`);
  current.setDate(current.getDate() + days);
  return current.toISOString().slice(0, 10);
}

function getDaysInMonth(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month, 0).getDate();
}

function listMonthDays(monthKey: string) {
  const totalDays = getDaysInMonth(monthKey);
  return Array.from({ length: totalDays }, (_, index) => `${monthKey}-${String(index + 1).padStart(2, '0')}`);
}

function listMonthWeeks(monthKey: string) {
  const monthDays = listMonthDays(monthKey);
  if (monthDays.length === 0) return [];
  const firstWeekStart = getWeekKey(monthDays[0]);
  const lastWeekStart = getWeekKey(monthDays[monthDays.length - 1]);
  const weeks: Array<Array<{ date: string; inMonth: boolean }>> = [];
  let cursor = firstWeekStart;

  while (cursor <= lastWeekStart) {
    weeks.push(
      Array.from({ length: 7 }, (_, index) => {
        const date = addDaysToIsoDate(cursor, index);
        return { date, inMonth: getMonthKey(date) === monthKey };
      }),
    );
    cursor = addDaysToIsoDate(cursor, 7);
  }

  return weeks;
}

function getMonthKey(date: string) {
  return date.slice(0, 7);
}

function getShiftEmployeeKey(shift: StaffShift) {
  return `${shift.laborProfileId}::${shift.employeeName.trim().toLowerCase()}`;
}

function getMonthlySundaySummary(shifts: StaffShift[], monthKey: string) {
  const monthDates = listMonthDays(monthKey);
  const sundayDates = monthDates.filter((date) => new Date(`${date}T12:00:00`).getDay() === 0);
  const grouped = new Map<string, { employeeName: string; workedSundays: number; sundaysOff: number }>();

  shifts
    .filter((shift) => getMonthKey(shift.date) === monthKey)
    .forEach((shift) => {
      const key = getShiftEmployeeKey(shift);
      const current = grouped.get(key) ?? {
        employeeName: shift.employeeName,
        workedSundays: 0,
        sundaysOff: sundayDates.length,
      };
      if (new Date(`${shift.date}T12:00:00`).getDay() === 0) {
        current.workedSundays += 1;
        current.sundaysOff = Math.max(sundayDates.length - current.workedSundays, 0);
      }
      grouped.set(key, current);
    });

  return Array.from(grouped.values());
}

function isColdStationRole(profile?: LaborProfile) {
  if (!profile) return false;
  return profile.roleGroup === 'pasteleria'
    || (profile.roleGroup === 'cocinero' && profile.roleName.toLowerCase().includes('fria'));
}

function isHotStationRole(profile?: LaborProfile) {
  if (!profile) return false;
  return profile.roleGroup === 'cocinero' && profile.roleName.toLowerCase().includes('caliente');
}

function canHelpersBackfillColdStation(date: string, morningHelpers: number, afternoonHelpers: number) {
  const isoDay = new Date(`${date}T12:00:00`).getDay();
  const totalHelpers = morningHelpers + afternoonHelpers;
  return isoDay === 0 || (isoDay >= 1 && isoDay <= 4 && totalHelpers >= 2);
}

function getHelperCoverageTargets(date: string) {
  const isoDay = new Date(`${date}T12:00:00`).getDay();
  if (isoDay === 0) {
    return { morning: 2, afternoon: 0 };
  }
  if (isoDay >= 1 && isoDay <= 4) {
    return { morning: 2, afternoon: 2 };
  }
  return { morning: 3, afternoon: 2 };
}

function getPlanningAlerts(state: ReturnType<typeof useLocalStore>['state'], monthKey: string) {
  const monthShifts = state.staffShifts.filter((shift) => getMonthKey(shift.date) === monthKey);
  const alerts: Array<{ id: string; tone: 'danger' | 'warning'; title: string; detail: string }> = [];
  const laborProfileMap = new Map(state.laborProfiles.map((profile) => [profile.id, profile]));

  monthShifts.forEach((shift) => {
    const workedMinutes = getShiftWorkedMinutes(shift);
    const ordinaryMinutes = Math.max(workedMinutes - Math.max(shift.extraMinutes, 0), 0);

    if (ordinaryMinutes > 10 * 60) {
      alerts.push({
        id: `daily-ordinary-${shift.id}`,
        tone: 'danger',
        title: `${shift.employeeName || 'Turno'} supera 10 horas ordinarias`,
        detail: `${shift.date} registra ${decimal.format(ordinaryMinutes / 60)} horas ordinarias. Ajusta jornada base.`,
      });
    }

    if (shift.extraMinutes > 120) {
      alerts.push({
        id: `daily-extra-${shift.id}`,
        tone: 'danger',
        title: `${shift.employeeName || 'Turno'} supera tope de horas extra`,
        detail: `${shift.date} tiene ${decimal.format(shift.extraMinutes / 60)} horas extra. El tope diario legal es 2 horas.`,
      });
    }

    if (workedMinutes >= 5 * 60 && shift.breakMinutes < 30) {
      alerts.push({
        id: `break-${shift.id}`,
        tone: 'warning',
        title: `${shift.employeeName || 'Turno'} con colacion insuficiente`,
        detail: `${shift.date} considera ${shift.breakMinutes} min de colacion. La referencia minima usada es 30 min.`,
      });
    }
  });

  const weekGroups = new Map<string, { employeeName: string; weekStart: string; ordinaryMinutes: number; workedDays: Set<string> }>();
  monthShifts.forEach((shift) => {
    const key = `${getShiftEmployeeKey(shift)}::${getWeekKey(shift.date)}`;
    const current = weekGroups.get(key) ?? {
      employeeName: shift.employeeName,
      weekStart: getWeekKey(shift.date),
      ordinaryMinutes: 0,
      workedDays: new Set<string>(),
    };
    current.ordinaryMinutes += Math.max(getShiftWorkedMinutes(shift) - Math.max(shift.extraMinutes, 0), 0);
    current.workedDays.add(shift.date);
    weekGroups.set(key, current);
  });

  weekGroups.forEach((group, key) => {
    const weeklyLimit = getChileWeeklyLimitHours(group.weekStart);
    if (group.ordinaryMinutes > weeklyLimit * 60) {
      alerts.push({
        id: `weekly-${key}`,
        tone: 'danger',
        title: `${group.employeeName || 'Colaborador'} supera jornada semanal`,
        detail: `Semana ${group.weekStart}: ${decimal.format(group.ordinaryMinutes / 60)} h ordinarias vs limite ${weeklyLimit} h.`,
      });
    }

    if (group.workedDays.size > 6) {
      alerts.push({
        id: `days-${key}`,
        tone: 'warning',
        title: `${group.employeeName || 'Colaborador'} trabaja mas de 6 dias`,
        detail: `Semana ${group.weekStart}: ${group.workedDays.size} dias con turno. Revisar distribucion de descansos.`,
      });
    }
  });

  getMonthlySundaySummary(monthShifts, monthKey).forEach((summary) => {
    if (summary.sundaysOff < 2) {
      alerts.push({
        id: `sundays-${summary.employeeName}-${monthKey}`,
        tone: 'warning',
        title: `${summary.employeeName || 'Colaborador'} queda con menos de 2 domingos libres`,
        detail: `${monthKey}: ${summary.workedSundays} domingos trabajados y ${summary.sundaysOff} libres.`,
      });
    }
  });

  const helperProfile = state.laborProfiles.find((profile) => profile.roleGroup === 'ayudante');
  const weeklyHelperDemand = ['2026-04-06', '2026-04-07', '2026-04-08', '2026-04-09', '2026-04-10', '2026-04-11', '2026-04-12']
    .reduce((total, date) => {
      const target = getHelperCoverageTargets(date);
      return total + target.morning + target.afternoon;
    }, 0);
  if (helperProfile && helperProfile.headcount * 6 < weeklyHelperDemand) {
    alerts.push({
      id: `helpers-capacity-${monthKey}`,
      tone: 'danger',
      title: 'Dotacion de ayudantes insuficiente para la cobertura semanal pedida',
      detail: `Con ${helperProfile.headcount} ayudantes y maximo legal de 6 dias por semana solo caben ${helperProfile.headcount * 6} asignaciones semanales. La regla exige ${weeklyHelperDemand}: de lunes a jueves 2 AM / 2 PM, viernes y sabado 3 AM / 2 PM, y domingo solo 2 AM.`,
    });
  }

  listMonthDays(monthKey).forEach((date) => {
    const dayShifts = monthShifts.filter((shift) => shift.date === date);
    const helperTargets = getHelperCoverageTargets(date);
    const morningHelpers = dayShifts.filter((shift) => {
      const profile = laborProfileMap.get(shift.laborProfileId);
      return profile?.roleGroup === 'ayudante' && parseTimeToMinutes(shift.startTime) < 12 * 60;
    }).length;
    const afternoonHelpers = dayShifts.filter((shift) => {
      const profile = laborProfileMap.get(shift.laborProfileId);
      return profile?.roleGroup === 'ayudante' && parseTimeToMinutes(shift.startTime) >= 12 * 60;
    }).length;
    const leadCoverage = dayShifts.filter((shift) => {
      const profile = laborProfileMap.get(shift.laborProfileId);
      return profile?.roleGroup === 'chef' || profile?.roleGroup === 'sous-chef';
    }).length;
    const coldCoverage = dayShifts.filter((shift) => isColdStationRole(laborProfileMap.get(shift.laborProfileId))).length;
    const hotCoverage = dayShifts.filter((shift) => isHotStationRole(laborProfileMap.get(shift.laborProfileId))).length;
    const leadershipCoveredByHotStation = leadCoverage > 0 || hotCoverage > 0;
    const coldStationCoveredByHelpers = canHelpersBackfillColdStation(date, morningHelpers, afternoonHelpers);

    if (morningHelpers < helperTargets.morning) {
      alerts.push({
        id: `helpers-morning-${date}`,
        tone: 'danger',
        title: `Faltan ayudantes de manana el ${date}`,
        detail: `Hay ${morningHelpers} ayudantes de manana y la regla exige ${helperTargets.morning}.`,
      });
    }

    if (afternoonHelpers < helperTargets.afternoon) {
      alerts.push({
        id: `helpers-afternoon-${date}`,
        tone: 'danger',
        title: `Faltan ayudantes de tarde el ${date}`,
        detail: `Hay ${afternoonHelpers} ayudantes de tarde y la regla exige ${helperTargets.afternoon}.`,
      });
    }

    if (!leadershipCoveredByHotStation) {
      alerts.push({
        id: `lead-coverage-${date}`,
        tone: 'danger',
        title: `Sin chef ni sous chef el ${date}`,
        detail: 'Cuando no hay chef ni sous chef, la partida caliente debe asumir liderazgo operativo. No puede quedar el liderazgo fuera del turno.',
      });
    }

    if (coldCoverage === 0 && !coldStationCoveredByHelpers) {
      alerts.push({
        id: `cold-coverage-${date}`,
        tone: 'danger',
        title: `Sin pastelero ni partida fria el ${date}`,
        detail: 'Debe quedar al menos uno entre pasteleria y partida fria en servicio, o 2 ayudantes que absorban ese frente operativo.',
      });
    }

    if (hotCoverage === 0) {
      alerts.push({
        id: `hot-coverage-${date}`,
        tone: 'danger',
        title: `Sin partida caliente el ${date}`,
        detail: 'No puede quedar un dia sin cobertura de partida caliente.',
      });
    }
  });

  return alerts;
}

function getDraftPlanningAlerts(
  state: ReturnType<typeof useLocalStore>['state'],
  draft: StaffShift,
) {
  if (!draft.employeeName || !draft.laborProfileId || !draft.date) return [];
  const monthKey = getMonthKey(draft.date);
  const nextShifts = state.staffShifts.some((shift) => shift.id === draft.id)
    ? state.staffShifts.map((shift) => (shift.id === draft.id ? draft : shift))
    : [...state.staffShifts, draft];
  const draftEmployeeKey = getShiftEmployeeKey(draft);
  return getPlanningAlerts({ ...state, staffShifts: nextShifts }, monthKey).filter((alert) =>
    alert.title.toLowerCase().includes(draft.employeeName.toLowerCase())
    || alert.id.includes(draft.id)
    || alert.id.includes(draftEmployeeKey.replace(/[^a-z0-9]/gi, '-').toLowerCase()),
  );
}

function getPlanningRoster(state: ReturnType<typeof useLocalStore>['state']) {
  return state.laborProfiles.flatMap((profile) => {
    const knownNames = Array.from(
      new Set(
        state.staffShifts
          .filter((shift) => shift.laborProfileId === profile.id)
          .map((shift) => shift.employeeName.trim())
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b));

    const rosterNames = [...knownNames];
    const missingHeadcount = Math.max(profile.headcount - rosterNames.length, 0);

    for (let index = 0; index < missingHeadcount; index += 1) {
      rosterNames.push(`${profile.roleName} ${rosterNames.length + 1}`);
    }

    return rosterNames.map((employeeName, employeeIndex) => ({
      laborProfileId: profile.id,
      employeeName,
      employeeIndex,
      roleGroup: profile.roleGroup,
      roleName: profile.roleName,
    }));
  });
}

function getChilePlanningTemplate(roleGroup: LaborRoleGroup, roleName: string, employeeIndex: number) {
  if (roleGroup === 'chef') return { shiftBand: 'am', notes: 'Supervision general y pase.' };
  if (roleGroup === 'sous-chef') return { shiftBand: 'pm', notes: 'Cobertura PM y cierre operativo.' };
  if (roleGroup === 'pasteleria') return { shiftBand: 'am', notes: 'Produccion de postres y mise en place dulce.' };

  if (roleGroup === 'ayudante') {
    return {
      shiftBand: employeeIndex < 3 ? 'am' : 'pm',
      notes: 'Apoyo transversal de produccion y servicio.',
    };
  }

  if (roleName.toLowerCase().includes('caliente')) {
    return {
      shiftBand: employeeIndex % 2 === 0 ? 'am' : 'pm',
      notes: employeeIndex % 2 === 0 ? 'Mise en place AM y linea caliente.' : 'Linea PM y cierre en calientes.',
    };
  }

  if (roleName.toLowerCase().includes('fria')) {
    return {
      shiftBand: employeeIndex % 2 === 0 ? 'am' : 'pm',
      notes: employeeIndex % 2 === 0 ? 'Mise en place de entradas.' : 'Linea fria y apoyo de cierre.',
    };
  }

  return { shiftBand: 'am', notes: 'Turno base operativo.' };
}

function getSundayCrewSize(roleGroup: LaborRoleGroup, teamSize: number) {
  if (teamSize <= 1) {
    if (roleGroup === 'chef' || roleGroup === 'sous-chef') return 1;
    if (roleGroup === 'pasteleria') return 0;
    return 1;
  }

  if (roleGroup === 'ayudante') return Math.max(2, Math.floor(teamSize / 2));
  return Math.max(1, Math.floor(teamSize / 2));
}

function getRuleDrivenWorkdays(
  employee: ReturnType<typeof getPlanningRoster>[number],
  isoDay: number,
  weekIndex: number,
  teamSize: number,
) {
  if (employee.roleGroup === 'chef') {
    const patterns = [
      [1, 2, 4, 5, 6],
      [0, 2, 3, 5, 6],
    ];
    return (patterns[weekIndex % patterns.length] ?? patterns[0]).includes(isoDay);
  }

  if (employee.roleGroup === 'sous-chef') {
    const patterns = [
      [0, 1, 2, 3, 4],
      [1, 2, 3, 4, 5],
    ];
    return (patterns[weekIndex % patterns.length] ?? patterns[0]).includes(isoDay);
  }

  if (employee.roleGroup === 'pasteleria') return [1, 2, 3, 4, 5].includes(isoDay);

  if (employee.roleGroup === 'ayudante') {
    const offDay = (employee.employeeIndex + weekIndex) % 7;
    return isoDay !== offDay;
  }

  if (employee.roleName.toLowerCase().includes('caliente')) {
    const patterns = [
      [
        [1, 2, 3, 4, 6],
        [0, 1, 2, 4, 5],
      ],
      [
        [0, 1, 3, 4, 5],
        [1, 2, 3, 5, 6],
      ],
    ];
    const weekPatterns = patterns[weekIndex % patterns.length] ?? patterns[0];
    return (weekPatterns[employee.employeeIndex] ?? weekPatterns[0]).includes(isoDay);
  }

  if (employee.roleName.toLowerCase().includes('fria')) {
    const patterns = [
      [
        [1, 2, 3, 4, 6],
        [0, 1, 2, 4, 5],
      ],
      [
        [0, 1, 3, 4, 5],
        [1, 2, 3, 5, 6],
      ],
    ];
    const weekPatterns = patterns[weekIndex % patterns.length] ?? patterns[0];
    return (weekPatterns[employee.employeeIndex] ?? weekPatterns[0]).includes(isoDay);
  }

  if (teamSize <= 1) return isoDay !== ((employee.employeeIndex + weekIndex) % 7);

  const weeklyLimit = getSundayCrewSize(employee.roleGroup, teamSize);
  return employee.employeeIndex < weeklyLimit || isoDay !== ((employee.employeeIndex + weekIndex) % 7);
}

function getGeneratedShiftWindow(
  employee: ReturnType<typeof getPlanningRoster>[number],
  template: ReturnType<typeof getChilePlanningTemplate>,
  isoDay: number,
) {
  if (isoDay === 0) {
    return {
      startTime: '10:00',
      endTime: '17:00',
      notesSuffix: 'Domingo solo almuerzo.',
    };
  }

  if (employee.roleGroup === 'ayudante') {
    return template.shiftBand === 'pm'
      ? { startTime: '15:00', endTime: '23:00', notesSuffix: 'Ayudante tarde.' }
      : { startTime: '10:00', endTime: '17:00', notesSuffix: 'Ayudante manana.' };
  }

  return template.shiftBand === 'pm'
    ? { startTime: '15:00', endTime: '23:00', notesSuffix: 'Cobertura PM.' }
    : { startTime: '10:00', endTime: '18:00', notesSuffix: 'Cobertura AM.' };
}

function buildSundayRoleCoverageShifts(
  candidates: ReturnType<typeof getPlanningRoster>,
  sundayDates: string[],
  notes: string,
) {
  if (candidates.length === 0 || sundayDates.length === 0) return [];

  const maxAssignments = Math.ceil(sundayDates.length / candidates.length);
  const assignments = new Map(candidates.map((candidate) => [candidate.employeeName, 0]));
  const lastSundayByEmployee = new Map<string, number>();

  return sundayDates.flatMap((date, sundayIndex) => {
    const selected = [...candidates].sort((left, right) => {
      const leftCount = assignments.get(left.employeeName) ?? 0;
      const rightCount = assignments.get(right.employeeName) ?? 0;
      const leftGap = sundayIndex - (lastSundayByEmployee.get(left.employeeName) ?? -10);
      const rightGap = sundayIndex - (lastSundayByEmployee.get(right.employeeName) ?? -10);
      const leftPenalty = leftCount >= maxAssignments ? 100 : 0;
      const rightPenalty = rightCount >= maxAssignments ? 100 : 0;

      if (leftPenalty !== rightPenalty) return leftPenalty - rightPenalty;
      if (leftCount !== rightCount) return leftCount - rightCount;
      if (leftGap !== rightGap) return rightGap - leftGap;
      return left.employeeIndex - right.employeeIndex;
    })[0];

    if (!selected) return [];

    assignments.set(selected.employeeName, (assignments.get(selected.employeeName) ?? 0) + 1);
    lastSundayByEmployee.set(selected.employeeName, sundayIndex);
    const template = getChilePlanningTemplate(selected.roleGroup, selected.roleName, selected.employeeIndex);
    const shiftWindow = getGeneratedShiftWindow(selected, template, 0);

    return [{
      id: createId('shift'),
      laborProfileId: selected.laborProfileId,
      employeeName: selected.employeeName,
      date,
      startTime: shiftWindow.startTime,
      endTime: shiftWindow.endTime,
      breakMinutes: 30,
      extraMinutes: 0,
      notes: `Turno base Chile. ${notes} ${shiftWindow.notesSuffix}`,
    }];
  });
}

function buildHelperMonthlyShifts(roster: ReturnType<typeof getPlanningRoster>, monthKey: string) {
  const helpers = roster.filter((employee) => employee.roleGroup === 'ayudante');
  if (helpers.length === 0) return [];

  const monthDates = listMonthDays(monthKey);
  const sundayDates = monthDates.filter((date) => new Date(`${date}T12:00:00`).getDay() === 0);
  const maxSundayWorked = Math.max(sundayDates.length - 2, 0);
  const totalAssignments = new Map(helpers.map((employee) => [employee.employeeName, 0]));
  const sundayAssignments = new Map(helpers.map((employee) => [employee.employeeName, 0]));
  const weeklyAssignments = new Map<string, Map<string, number>>();
  const lastSlotByHelper = new Map<string, 'am' | 'pm'>();
  const shifts: StaffShift[] = [];

  monthDates.forEach((date) => {
    const helperTargets = getHelperCoverageTargets(date);
    const slotQueue: Array<'am' | 'pm'> = [
      ...Array.from({ length: helperTargets.morning }, () => 'am' as const),
      ...Array.from({ length: helperTargets.afternoon }, () => 'pm' as const),
    ];
    const weekKey = getWeekKey(date);
    const weekLoads = weeklyAssignments.get(weekKey) ?? new Map(helpers.map((employee) => [employee.employeeName, 0]));
    weeklyAssignments.set(weekKey, weekLoads);
    const assignedToday = new Set<string>();
    const isSunday = new Date(`${date}T12:00:00`).getDay() === 0;

    slotQueue.forEach((slot) => {
      const eligibleHelpers = helpers.filter((employee) => (
        !assignedToday.has(employee.employeeName)
        && (weekLoads.get(employee.employeeName) ?? 0) < 6
        && (!isSunday || (sundayAssignments.get(employee.employeeName) ?? 0) < maxSundayWorked)
      ));
      const fallbackHelpers = helpers.filter((employee) => (
        !assignedToday.has(employee.employeeName)
        && (weekLoads.get(employee.employeeName) ?? 0) < 6
      ));
      const candidates = eligibleHelpers.length > 0 ? eligibleHelpers : fallbackHelpers;
      const selected = [...candidates].sort((left, right) => {
        const leftSunday = sundayAssignments.get(left.employeeName) ?? 0;
        const rightSunday = sundayAssignments.get(right.employeeName) ?? 0;
        const leftWeek = weekLoads.get(left.employeeName) ?? 0;
        const rightWeek = weekLoads.get(right.employeeName) ?? 0;
        const leftTotal = totalAssignments.get(left.employeeName) ?? 0;
        const rightTotal = totalAssignments.get(right.employeeName) ?? 0;
        const leftSameSlotPenalty = lastSlotByHelper.get(left.employeeName) === slot ? 1 : 0;
        const rightSameSlotPenalty = lastSlotByHelper.get(right.employeeName) === slot ? 1 : 0;

        if (isSunday && leftSunday !== rightSunday) return leftSunday - rightSunday;
        if (leftWeek !== rightWeek) return leftWeek - rightWeek;
        if (leftTotal !== rightTotal) return leftTotal - rightTotal;
        if (leftSameSlotPenalty !== rightSameSlotPenalty) return leftSameSlotPenalty - rightSameSlotPenalty;
        return left.employeeIndex - right.employeeIndex;
      })[0];

      if (!selected) return;

      assignedToday.add(selected.employeeName);
      totalAssignments.set(selected.employeeName, (totalAssignments.get(selected.employeeName) ?? 0) + 1);
      weekLoads.set(selected.employeeName, (weekLoads.get(selected.employeeName) ?? 0) + 1);
      lastSlotByHelper.set(selected.employeeName, slot);
      if (isSunday) {
        sundayAssignments.set(selected.employeeName, (sundayAssignments.get(selected.employeeName) ?? 0) + 1);
      }

      const shiftWindow = getGeneratedShiftWindow(selected, { shiftBand: slot, notes: 'Apoyo transversal de produccion y servicio.' }, isSunday ? 0 : 1);
      shifts.push({
        id: createId('shift'),
        laborProfileId: selected.laborProfileId,
        employeeName: selected.employeeName,
        date,
        startTime: shiftWindow.startTime,
        endTime: shiftWindow.endTime,
        breakMinutes: 30,
        extraMinutes: 0,
        notes: `Turno base Chile. Apoyo transversal de produccion y servicio. ${shiftWindow.notesSuffix}`,
      });
    });
  });

  return shifts;
}

function buildSundayCoreCoverageShifts(roster: ReturnType<typeof getPlanningRoster>, monthKey: string) {
  const sundayDates = listMonthDays(monthKey).filter((date) => new Date(`${date}T12:00:00`).getDay() === 0);
  const hotCandidates = roster.filter((employee) => employee.roleName.toLowerCase().includes('caliente'));
  const coldCandidates = roster.filter((employee) =>
    employee.roleGroup === 'pasteleria'
    || employee.roleName.toLowerCase().includes('fria'),
  );

  return [
    ...buildSundayRoleCoverageShifts(
      hotCandidates,
      sundayDates,
      'Cobertura dominical de partida caliente y liderazgo operativo.',
    ),
    ...buildSundayRoleCoverageShifts(
      coldCandidates,
      sundayDates,
      'Cobertura dominical de area fria/pasteleria.',
    ),
  ];
}

function buildChileCompliantMonthlyShifts(
  state: ReturnType<typeof useLocalStore>['state'],
  monthKey: string,
) {
  const roster = getPlanningRoster(state);
  const calendarWeeks = listMonthWeeks(monthKey);
  const helperShifts = buildHelperMonthlyShifts(roster, monthKey);
  const sundayCoreShifts = buildSundayCoreCoverageShifts(roster, monthKey);
  const nonHelperRoster = roster.filter((employee) => employee.roleGroup !== 'ayudante');

  const nonHelperShifts = calendarWeeks.flatMap((weekDays, weekIndex) =>
    nonHelperRoster.flatMap((employee) => {
      const sameProfileTeam = roster.filter((item) => item.laborProfileId === employee.laborProfileId);
      const template = getChilePlanningTemplate(employee.roleGroup, employee.roleName, employee.employeeIndex);

      return weekDays.flatMap((day) => {
        if (!day.inMonth) return [];

        const isoDay = new Date(`${day.date}T12:00:00`).getDay();
        if (isoDay === 0) return [];
        if (!getRuleDrivenWorkdays(employee, isoDay, weekIndex, sameProfileTeam.length)) return [];

        const shiftWindow = getGeneratedShiftWindow(employee, template, isoDay);

        return [{
          id: createId('shift'),
          laborProfileId: employee.laborProfileId,
          employeeName: employee.employeeName,
          date: day.date,
          startTime: shiftWindow.startTime,
          endTime: shiftWindow.endTime,
          breakMinutes: 30,
          extraMinutes: 0,
          notes: `Turno base Chile. ${template.notes} ${shiftWindow.notesSuffix}`,
        }];
      });
    }),
  );

  return [...nonHelperShifts, ...helperShifts, ...sundayCoreShifts];
}

export function App() {
  const { state, actions, isHydrating, syncError } = useLocalStore();
  const {
    user,
    login,
    logout,
    canManage,
    hasFinancialAccess,
    usingSupabase,
    authLoading,
    authError,
  } = useAuth();
  const [view, setView] = useState<View>('dashboard');
  const [sidebarHidden, setSidebarHidden] = useState(() => localStorage.getItem('culinary-insight-sidebar-hidden') === 'true');

  useEffect(() => {
    localStorage.setItem('culinary-insight-sidebar-hidden', String(sidebarHidden));
  }, [sidebarHidden]);

  if (!user) {
    return (
      <LoginScreen
        onLogin={login}
        usingSupabase={usingSupabase}
        authLoading={authLoading}
        authError={authError}
      />
    );
  }

  const allowedNav = navItems.filter((item) => item.roles.includes(user.role));
  const activeView = allowedNav.some((item) => item.id === view) ? view : 'dashboard';

  return (
    <div className={sidebarHidden ? 'app-shell sidebar-hidden' : 'app-shell'}>
      {sidebarHidden && (
        <button
          className="secondary-button sidebar-reveal"
          onClick={() => setSidebarHidden(false)}
          title="Mostrar menu"
          aria-label="Mostrar menu"
        >
          <PanelLeftOpen size={18} />
        </button>
      )}
      <aside className={sidebarHidden ? 'sidebar hidden' : 'sidebar'}>
        <div className="brand">
          <div className="brand-mark logo">
            <img src={udlaLogo} alt="UDLA" />
          </div>
          <div>
            <strong>UDLA Culinary Insight Pro</strong>
            <span>{state.business.businessType} · {state.business.name}</span>
          </div>
        </div>
        <nav className="nav-list" aria-label="Principal">
          {allowedNav.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={activeView === item.id ? 'nav-item active' : 'nav-item'}
                onClick={() => setView(item.id)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="status-row">
            <span className={isSupabaseConfigured ? 'status-dot online' : 'status-dot'} />
            <span>{isSupabaseConfigured ? 'Supabase listo' : 'Supabase no configurado'}</span>
          </div>
          {syncError && <small>Error de sincronizacion: {syncError}</small>}
          <small>{user.role}</small>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="topbar-title">
            <button
              className="secondary-button sidebar-toggle"
              onClick={() => setSidebarHidden((current) => !current)}
              title={sidebarHidden ? 'Mostrar menu' : 'Ocultar menu'}
              aria-label={sidebarHidden ? 'Mostrar menu' : 'Ocultar menu'}
            >
              {sidebarHidden ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
            <div>
            <p className="eyebrow">ERP gastronomico profesional</p>
            <h1>{navItems.find((item) => item.id === activeView)?.label}</h1>
            </div>
          </div>
          <div className="topbar-actions">
            <div className="user-card">
              <Users size={18} />
              <div>
                <strong>{user.name}</strong>
                <span>{user.role} · Produccion</span>
              </div>
              <button className="icon-button" onClick={logout} title="Cerrar sesion">
                <Lock size={16} />
              </button>
            </div>
          </div>
        </header>

        <Suspense fallback={<ModuleLoading view={activeView} />}>
          {isHydrating ? (
            <ModuleLoading view={activeView} />
          ) : (
            <>
          {activeView === 'dashboard' && <DashboardModule state={state} />}
          {activeView === 'ingredients' && <IngredientsModule state={state} actions={actions} canManage={canManage} />}
          {activeView === 'yields' && <YieldModule state={state} actions={actions} canManage={canManage} />}
          {activeView === 'baseRecipes' && <BaseRecipesModule state={state} actions={actions} canManage={canManage} />}
          {activeView === 'dishes' && <DishesModule state={state} actions={actions} canManage={canManage} />}
          {activeView === 'sheets' && <SheetsModule state={state} actions={actions} canManage={canManage} hasFinancialAccess={hasFinancialAccess} />}
          {activeView === 'procurement' && <ProcurementModule state={state} actions={actions} canManage={canManage} />}
          {activeView === 'inventory' && <InventoryModule state={state} actions={actions} canManage={canManage} />}
          {activeView === 'waste' && <WasteModule state={state} actions={actions} canManage={canManage} />}
          {activeView === 'production' && <ProductionModule state={state} actions={actions} canManage={canManage} />}
          {activeView === 'sales' && <SalesModule state={state} actions={actions} canManage={canManage} />}
          {activeView === 'expenses' && <ExpensesModule state={state} actions={actions} hasFinancialAccess={hasFinancialAccess} />}
          {activeView === 'planning' && <PlanningModule state={state} actions={actions} canManage={canManage} />}
          {activeView === 'analytics' && <AnalyticsModule state={state} />}
          {activeView === 'simulations' && <SimulationsModule state={state} />}
          {activeView === 'reports' && <ReportsModule state={state} />}
          {activeView === 'settings' && (
            <SettingsModule
              state={state}
              actions={actions}
              canManage={canManage}
              hasFinancialAccess={hasFinancialAccess}
              isAdmin={user.role === 'Administrador general'}
            />
          )}
            </>
          )}
        </Suspense>
      </main>
    </div>
  );
}

function ModuleLoading({ view }: { view: View }) {
  return (
    <section className="content-stack">
      <section className="panel">
        <PanelHeader title={`Cargando ${navItems.find((item) => item.id === view)?.label ?? 'modulo'}`} />
        <p className="helper-text">Preparando datos y componentes del modulo.</p>
      </section>
    </section>
  );
}

function LoginScreen({
  onLogin,
  usingSupabase,
  authLoading,
  authError,
}: {
  onLogin: (email: string, role: Role, options?: LoginOptions) => Promise<void> | void;
  usingSupabase: boolean;
  authLoading: boolean;
  authError: string | null;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('Administrador general');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('Administrador general');
  const [businessName, setBusinessName] = useState('Mi negocio gastronómico');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');

  return (
    <main className="login-screen">
      <section className="login-panel">
        <div className="brand large">
          <div className="brand-mark logo wide">
            <img src={udlaLogo} alt="UDLA" />
          </div>
          <div>
            <strong>UDLA Culinary Insight Pro</strong>
            <span>Costeo, compras, inventario, ventas y control ejecutivo</span>
          </div>
        </div>
        {usingSupabase && (
          <div className="toolbar">
            <button className={mode === 'signin' ? 'primary-button' : 'secondary-button compact'} onClick={() => setMode('signin')}>
              Ingresar
            </button>
            <button className={mode === 'signup' ? 'primary-button' : 'secondary-button compact'} onClick={() => setMode('signup')}>
              Crear cuenta
            </button>
          </div>
        )}
        {usingSupabase && mode === 'signup' && (
          <>
            <label>Nombre<input value={name} onChange={(event) => setName(event.target.value)} /></label>
            <label>Negocio<input value={businessName} onChange={(event) => setBusinessName(event.target.value)} /></label>
          </>
        )}
        <label>Correo<input value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        {usingSupabase && (
          <label>Contrasena<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        )}
        <label>
          Rol
          <select value={role} onChange={(event) => setRole(event.target.value as Role)}>
            <option>Administrador general</option>
            <option>Gerente</option>
            <option>Chef ejecutivo</option>
            <option>Sous chef</option>
            <option>Jefe de compras</option>
            <option>Bodega</option>
            <option>Finanzas</option>
            <option>Operador</option>
          </select>
        </label>
        {authError && <p className="helper-text">{authError}</p>}
        <button
          className="primary-button"
          disabled={authLoading}
          onClick={() =>
            onLogin(email, role, {
              password,
              name,
              businessName,
              mode: usingSupabase ? mode : 'signin',
            })
          }
        >
          <LogIn size={18} /> {authLoading ? 'Conectando...' : usingSupabase ? (mode === 'signup' ? 'Crear cuenta' : 'Ingresar') : 'Ingresar'}
        </button>
      </section>
    </main>
  );
}

function IngredientsModule({
  state,
  actions,
  canManage,
}: {
  state: ReturnType<typeof useLocalStore>['state'];
  actions: ReturnType<typeof useLocalStore>['actions'];
  canManage: boolean;
}) {
  const [draft, setDraft] = useState<Ingredient>(() => emptyIngredient(state));
  const [selectedIngredientId, setSelectedIngredientId] = useState(state.ingredients[0]?.id ?? '');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState<'all' | 'critical' | 'stock' | 'price'>('all');
  const [priceDraft, setPriceDraft] = useState(() => ({
    ingredientId: state.ingredients[0]?.id ?? '',
    supplierId: state.suppliers[0]?.id ?? '',
    date: new Date().toISOString().slice(0, 10),
    pricePurchase: state.ingredients[0]?.purchasePrice ?? 0,
  }));
  const sanitary = getSanitaryCategory(state, draft.sanitaryCategoryId);
  const supplierCodeOptions = useMemo(
    () => getSupplierCodeOptions(state, draft.primarySupplierId),
    [draft.primarySupplierId, state],
  );
  const storageTypeOptions = useMemo(
    () => getStorageTypeOptions(state, draft.storageType),
    [draft.storageType, state],
  );
  const tempInRange =
    draft.currentStorageTemp >= draft.recommendedMinTemp && draft.currentStorageTemp <= draft.recommendedMaxTemp;
  const inDangerZone = draft.currentStorageTemp >= 5 && draft.currentStorageTemp <= 65 && draft.riskLevel !== 'Bajo';
  const selectedPriceIngredient = state.ingredients.find((item) => item.id === priceDraft.ingredientId);
  const priceTrend = selectedPriceIngredient ? getIngredientPriceTrend(selectedPriceIngredient) : null;
  const warehouseSummary = useMemo(() => getWarehouseAuditSummary(state), [state]);
  const selectedIngredient = state.ingredients.find((item) => item.id === selectedIngredientId) ?? state.ingredients[0];
  const selectedWarehouseItem = warehouseSummary.items.find((item) => item.ingredient.id === selectedIngredient?.id);
  const enrichedIngredientRows = useMemo(() => {
    return warehouseSummary.items
      .map((item) => {
        const trend = getIngredientPriceTrend(item.ingredient);
        const recipeUsages = state.baseRecipes
          .map((recipe) => {
            const recipeResult = calculateBaseRecipeCost(state, recipe);
            const lines = recipeResult.lines.filter((line) => line.ingredientId === item.ingredient.id);
            const lineCost = lines.reduce((sum, line) => sum + line.lineCost, 0);
            const quantity = lines.reduce((sum, line) => sum + line.normalizedQuantity, 0);
            return { recipe, lineCost, quantity, lines: lines.length };
          })
          .filter((usage) => usage.lines > 0);
        const dishUsages = state.dishes
          .map((dish) => {
            const result = calculateDishCost(state, dish);
            const directLines = result.componentLines.filter(
              (line) => line.componentType === 'ingredient' && line.refId === item.ingredient.id,
            );
            const nestedLines = result.componentLines.flatMap((line) =>
              line.nestedLines?.filter((nestedLine) => nestedLine.ingredientId === item.ingredient.id) ?? [],
            );
            const lineCost =
              directLines.reduce((sum, line) => sum + line.lineCost, 0) +
              nestedLines.reduce((sum, line) => sum + line.lineCost, 0);
            return { dish, lineCost, lines: directLines.length + nestedLines.length };
          })
          .filter((usage) => usage.lines > 0);
        return { ...item, trend, recipeUsages, dishUsages };
      })
      .sort((a, b) => {
        const alertDelta = b.alerts.length - a.alerts.length;
        if (alertDelta !== 0) return alertDelta;
        return a.ingredient.name.localeCompare(b.ingredient.name);
      });
  }, [state, warehouseSummary.items]);
  const ingredientRows = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return enrichedIngredientRows.filter((item) => {
      const ingredient = item.ingredient;
      const supplier = item.supplier?.name.toLowerCase() ?? '';
      const category = item.category?.name.toLowerCase() ?? '';
      const matchesSearch =
        !normalizedSearch ||
        ingredient.name.toLowerCase().includes(normalizedSearch) ||
        ingredient.internalCode.toLowerCase().includes(normalizedSearch) ||
        supplier.includes(normalizedSearch) ||
        category.includes(normalizedSearch);
      const matchesCategory = categoryFilter === 'all' || ingredient.categoryId === categoryFilter;
      const matchesSupplier = supplierFilter === 'all' || ingredient.primarySupplierId === supplierFilter;
      const matchesRisk =
        riskFilter === 'all' ||
        (riskFilter === 'critical' && item.alerts.length > 0) ||
        (riskFilter === 'stock' && item.projectedStockAtLeadTime < ingredient.minStock) ||
        (riskFilter === 'price' && Boolean(item.trend && Math.abs(item.trend.percentDelta) >= 0.05));
      return matchesSearch && matchesCategory && matchesSupplier && matchesRisk;
    });
  }, [categoryFilter, enrichedIngredientRows, riskFilter, searchTerm, supplierFilter]);
  const selectedRecipeUsage = selectedIngredient
    ? enrichedIngredientRows.find((item) => item.ingredient.id === selectedIngredient.id)?.recipeUsages ?? []
    : [];
  const selectedDishUsage = selectedIngredient
    ? enrichedIngredientRows.find((item) => item.ingredient.id === selectedIngredient.id)?.dishUsages ?? []
    : [];
  const stockValue = state.ingredients.reduce((sum, item) => sum + item.currentStock * item.purchasePrice, 0);
  const lowCoverageItems = warehouseSummary.items.filter((item) => item.projectedDaysRemaining < 5).length;
  const recipeLinkedItems = enrichedIngredientRows.filter((item) => item.recipeUsages.length > 0 || item.dishUsages.length > 0).length;
  const nearExpiryValue = warehouseSummary.items
    .filter((item) => item.expiryDays <= 2)
    .reduce((sum, item) => sum + item.ingredient.currentStock * item.ingredient.purchasePrice, 0);

  useEffect(() => {
    if (!state.ingredients.length) return;
    setSelectedIngredientId((current) => state.ingredients.some((item) => item.id === current) ? current : state.ingredients[0].id);
    setPriceDraft((current) => {
      const fallbackIngredient = state.ingredients.find((item) => item.id === current.ingredientId) ?? state.ingredients[0];
      if (!fallbackIngredient) return current;
      return {
        ingredientId: fallbackIngredient.id,
        supplierId: fallbackIngredient.primarySupplierId || current.supplierId || state.suppliers[0]?.id || '',
        date: current.date,
        pricePurchase: fallbackIngredient.id === current.ingredientId ? current.pricePurchase : fallbackIngredient.purchasePrice,
      };
    });
  }, [state.ingredients, state.suppliers]);

  useEffect(() => {
    if (!selectedPriceIngredient) return;
    setPriceDraft((current) => ({
      ...current,
      supplierId: selectedPriceIngredient.primarySupplierId || current.supplierId,
      pricePurchase: selectedPriceIngredient.purchasePrice,
    }));
  }, [selectedPriceIngredient]);

  const recalculateIngredientDraftCosts = (ingredient: Ingredient) => ({
    ...ingredient,
    usefulUnitCost: calculateUsefulUnitCost(
      ingredient.purchasePrice,
      ingredient.purchaseUnit,
      ingredient.useUnit,
      Math.max(ingredient.usableYieldPercent, 0.001),
    ),
  });

  const withAutomatedTraceability = (ingredient: Ingredient) => {
    const internalCode = ingredient.internalCode || generateIngredientInternalCode(state, ingredient);
    const supplierCode = ingredient.supplierCode || generateSupplierCode(state, { ...ingredient, internalCode });
    const lotCode = ingredient.lotCode || generateLotCode({ ...ingredient, internalCode, supplierCode });
    return {
      ...ingredient,
      internalCode,
      supplierCode,
      lotCode,
    };
  };

  const updateDraft = (updater: (current: Ingredient) => Ingredient) => {
    setDraft((current) => recalculateIngredientDraftCosts(updater(current)));
  };

  const updateDraftName = (name: string) => {
    updateDraft((current) => {
      const next = { ...current, name };
      return {
        ...next,
        internalCode: current.internalCode ? current.internalCode : generateIngredientInternalCode(state, next),
        supplierCode: current.supplierCode ? current.supplierCode : generateSupplierCode(state, next),
        lotCode: current.lotCode ? current.lotCode : generateLotCode({
          ...next,
          internalCode: current.internalCode || generateIngredientInternalCode(state, next),
          supplierCode: current.supplierCode || generateSupplierCode(state, next),
        }),
      };
    });
  };

  const updateDraftSanitaryCategory = (sanitaryCategoryId: string) => {
    updateDraft((current) => {
      const next = applySanitaryCategory(state, current, sanitaryCategoryId);
      const internalCode = generateIngredientInternalCode(state, next);
      const supplierCode = current.supplierCode || generateSupplierCode(state, { ...next, internalCode });
      return {
        ...next,
        internalCode,
        supplierCode,
        lotCode: generateLotCode({ ...next, internalCode, supplierCode }),
      };
    });
  };

  const updateDraftSupplier = (supplierId: string) => {
    updateDraft((current) => {
      const next = { ...current, primarySupplierId: supplierId };
      const supplierCode = generateSupplierCode(state, next);
      return {
        ...next,
        supplierCode,
        lotCode: generateLotCode({ ...next, supplierCode }),
      };
    });
  };

  const updateDraftReceivedDate = (receivedDate: string) => {
    updateDraft((current) => ({
      ...current,
      receivedDate,
      lotCode: generateLotCode({ ...current, receivedDate }),
    }));
  };

  return (
    <section className="content-stack">
      <section className="panel">
        <PanelHeader title="Centro operativo de materias primas" />
        <div className="summary-strip compact">
          <SummaryMetric label="Stock valorizado" value={money.format(stockValue)} />
          <SummaryMetric label="Quiebres proyectados" value={String(warehouseSummary.projectedBreakCount)} />
          <SummaryMetric label="Con cobertura menor a 5 dias" value={String(lowCoverageItems)} />
          <SummaryMetric label="Valor vence pronto" value={money.format(nearExpiryValue)} />
          <SummaryMetric label="Conectadas a recetarios" value={`${recipeLinkedItems}/${state.ingredients.length}`} />
        </div>
        <div className="ingredient-toolbar">
          <label>Buscar<input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Nombre, codigo, proveedor..." /></label>
          <label>
            Categoria
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="all">Todas</option>
              {state.categories.filter((item) => item.type === 'ingredient').map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
          <label>
            Proveedor
            <select value={supplierFilter} onChange={(event) => setSupplierFilter(event.target.value)}>
              <option value="all">Todos</option>
              {state.suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
            </select>
          </label>
          <label>
            Vista
            <select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value as typeof riskFilter)}>
              <option value="all">Todo el maestro</option>
              <option value="critical">Solo alertas</option>
              <option value="stock">Reposicion requerida</option>
              <option value="price">Variacion de precio</option>
            </select>
          </label>
        </div>
      </section>

      <section className="ingredient-workbench">
        <section className="panel ingredient-grid-panel">
          <PanelHeader title="Grilla viva de materias primas" />
          <div className="table-wrap ingredient-master-grid-wrap">
            <table className="ingredient-master-grid">
              <thead>
                <tr>
                  <th>MP</th>
                  <th>Categoria</th>
                  <th>Proveedor</th>
                  <th>Costo util</th>
                  <th>Stock</th>
                  <th>Cobertura</th>
                  <th>Lead time</th>
                  <th>Recetarios</th>
                  <th>Precio</th>
                  <th>Alertas</th>
                </tr>
              </thead>
              <tbody>
                {ingredientRows.map((item) => {
                  const ingredient = item.ingredient;
                  const isSelected = selectedIngredient?.id === ingredient.id;
                  const coverage = Number.isFinite(item.projectedDaysRemaining) ? `${decimal.format(item.projectedDaysRemaining)} d` : 'Sin consumo';
                  return (
                    <tr key={ingredient.id} className={isSelected ? 'selected-row' : ''} onClick={() => setSelectedIngredientId(ingredient.id)}>
                      <td>
                        <button type="button" className="table-link-button" onClick={() => setDraft(recalculateIngredientDraftCosts(ingredient))}>{ingredient.name}</button>
                        <div className="helper-text">{ingredient.internalCode || ingredient.lotCode || 'Sin codigo'}</div>
                      </td>
                      <td><ColorChip text={item.category?.name ?? 'Sin categoria'} colorHex={ingredient.colorHex} /></td>
                      <td>{item.supplier?.name ?? 'Sin proveedor'}</td>
                      <td>
                        <strong>{money.format(ingredient.usefulUnitCost)}</strong>
                        <div className="helper-text">/{ingredient.useUnit}</div>
                      </td>
                      <td>
                        <strong>{`${decimal.format(ingredient.currentStock)} ${ingredient.purchaseUnit}`}</strong>
                        <div className="helper-text">{`Min ${decimal.format(ingredient.minStock)} · Max ${decimal.format(ingredient.maxStock)}`}</div>
                      </td>
                      <td>{coverage}</td>
                      <td>
                        <strong>{`${decimal.format(item.projectedStockAtLeadTime)} ${ingredient.purchaseUnit}`}</strong>
                        <div className="helper-text">{item.suggestedOrderQty > 0 ? `Pedir ${decimal.format(item.suggestedOrderQty)}` : 'Sin compra'}</div>
                      </td>
                      <td>{`${item.recipeUsages.length} recetas · ${item.dishUsages.length} platos`}</td>
                      <td>{item.trend ? `${item.trend.delta >= 0 ? '+' : ''}${percent.format(item.trend.percentDelta)}` : 'Sin variacion'}</td>
                      <td>
                        <div className="mini-badges">
                          {item.alerts.length > 0 ? item.alerts.slice(0, 3).map((alert) => (
                            <StatusBadge key={`${ingredient.id}-${alert}`} tone={alert.includes('fuera') || alert.includes('Quiebre') || alert.includes('peligro') ? 'danger' : 'warning'} text={alert} />
                          )) : <StatusBadge tone="ok" text="OK" />}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel ingredient-detail-panel">
          <PanelHeader
            title={selectedIngredient ? selectedIngredient.name : 'Detalle'}
            action={selectedIngredient && (
              <button className="icon-button" type="button" onClick={() => setDraft(recalculateIngredientDraftCosts(selectedIngredient))} title="Editar materia prima">
                <Pencil size={15} />
              </button>
            )}
          />
          {selectedIngredient && selectedWarehouseItem && (
            <div className="ingredient-detail-stack">
              <div className="summary-strip compact">
                <SummaryMetric label="Costo compra" value={money.format(selectedIngredient.purchasePrice)} />
                <SummaryMetric label="Costo util" value={`${money.format(selectedIngredient.usefulUnitCost)} / ${selectedIngredient.useUnit}`} />
                <SummaryMetric label="Consumo diario" value={`${decimal.format(selectedWarehouseItem.avgDailyUsage)} ${selectedIngredient.purchaseUnit}`} />
                <SummaryMetric label="Planificado" value={`${decimal.format(selectedWarehouseItem.plannedUsage)} ${selectedIngredient.purchaseUnit}`} />
              </div>
              <div className="ingredient-detail-block">
                <h3>Recetas base que consumen esta MP</h3>
                <div className="compact-shell">
                  <table>
                    <thead><tr><th>Receta</th><th>Cantidad lote</th><th>Costo en lote</th><th>Peso costo</th></tr></thead>
                    <tbody>
                      {selectedRecipeUsage.length > 0 ? selectedRecipeUsage.map((usage) => {
                        const result = calculateBaseRecipeCost(state, usage.recipe);
                        return (
                          <tr key={usage.recipe.id}>
                            <td>{usage.recipe.name}</td>
                            <td>{`${decimal.format(usage.quantity)} ${selectedIngredient.useUnit}`}</td>
                            <td>{money.format(usage.lineCost)}</td>
                            <td>{percent.format(usage.lineCost / Math.max(result.ingredientCost, 1))}</td>
                          </tr>
                        );
                      }) : <tr><td colSpan={4}>Sin consumo en recetas base.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="ingredient-detail-block">
                <h3>Platos finales impactados</h3>
                <div className="compact-shell">
                  <table>
                    <thead><tr><th>Plato</th><th>Categoria</th><th>Costo MP/plato</th><th>Ventas</th></tr></thead>
                    <tbody>
                      {selectedDishUsage.length > 0 ? selectedDishUsage.map((usage) => (
                        <tr key={usage.dish.id}>
                          <td>{usage.dish.name}</td>
                          <td>{state.categories.find((item) => item.id === usage.dish.categoryId)?.name ?? '-'}</td>
                          <td>{money.format(usage.lineCost)}</td>
                          <td>{decimal.format(usage.dish.salesCount)}</td>
                        </tr>
                      )) : <tr><td colSpan={4}>Sin consumo directo o anidado en platos.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="ingredient-detail-block">
                <h3>Trazabilidad y HACCP</h3>
                <div className="ingredient-trace-grid">
                  <span>Lote<strong>{selectedIngredient.lotCode || '-'}</strong></span>
                  <span>Ingreso<strong>{selectedIngredient.receivedDate || '-'}</strong></span>
                  <span>Vence<strong>{selectedIngredient.expiryDate || '-'}</strong></span>
                  <span>Ubicacion<strong>{selectedIngredient.storageLocation || '-'}</strong></span>
                  <span>Temperatura<strong>{`${decimal.format(selectedIngredient.currentStorageTemp)} C`}</strong></span>
                  <span>Rango<strong>{`${selectedIngredient.recommendedMinTemp} a ${selectedIngredient.recommendedMaxTemp} C`}</strong></span>
                </div>
              </div>
            </div>
          )}
        </section>
      </section>

      <section className="panel">
        <PanelHeader title="Maestro de materias primas" />
        <div className="form-section-stack">
          <section className="form-section">
            <h3>Identificacion y clasificacion</h3>
            <div className="form-grid four">
              <label>Nombre<input value={draft.name} onChange={(event) => updateDraftName(event.target.value)} /></label>
              <label>
                Categoria operativa
                <select value={draft.categoryId} disabled>
                  {state.categories.filter((item) => item.type === 'ingredient').map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
                <span className="helper-text">Se asigna automaticamente segun la categoria sanitaria.</span>
              </label>
              <label>
                Categoria sanitaria
                <select value={draft.sanitaryCategoryId} onChange={(event) => updateDraftSanitaryCategory(event.target.value)}>
                  {state.sanitaryCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </label>
              <label>
                Proveedor principal
                <select value={draft.primarySupplierId} onChange={(event) => updateDraftSupplier(event.target.value)}>
                  {state.suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                </select>
              </label>
              <label>
                Codigo interno
                <div className="input-action-row">
                  <input value={draft.internalCode} readOnly placeholder="Automatico" />
                  <button type="button" className="secondary-button compact" onClick={() => updateDraft((current) => {
                    const internalCode = generateIngredientInternalCode(state, current);
                    return { ...current, internalCode, lotCode: generateLotCode({ ...current, internalCode }) };
                  })}>Generar</button>
                </div>
              </label>
              <label>
                Codigo proveedor
                <div className="input-action-row">
                  <input
                    value={draft.supplierCode}
                    list="supplier-code-options"
                    placeholder="Selecciona o genera"
                    onChange={(event) => updateDraft((current) => {
                      const supplierCode = event.target.value;
                      return { ...current, supplierCode, lotCode: generateLotCode({ ...current, supplierCode }) };
                    })}
                  />
                  <button type="button" className="secondary-button compact" onClick={() => updateDraft((current) => {
                    const supplierCode = generateSupplierCode(state, current);
                    return { ...current, supplierCode, lotCode: generateLotCode({ ...current, supplierCode }) };
                  })}>Generar</button>
                </div>
                <datalist id="supplier-code-options">
                  {supplierCodeOptions.map((code) => <option key={code} value={code} />)}
                </datalist>
              </label>
              <label>
                Lote
                <div className="input-action-row">
                  <input value={draft.lotCode} readOnly placeholder="Automatico" />
                  <button type="button" className="secondary-button compact" onClick={() => updateDraft((current) => ({ ...current, lotCode: generateLotCode(current) }))}>Generar</button>
                </div>
              </label>
              <label>Responsable<input value={draft.responsible} onChange={(event) => setDraft({ ...draft, responsible: event.target.value })} /></label>
            </div>
          </section>

          <section className="form-section">
            <h3>Unidad, costo y stock</h3>
            <div className="form-grid four">
              <label>
                Unidad compra
                <select value={draft.purchaseUnit} onChange={(event) => updateDraft((current) => ({ ...current, purchaseUnit: event.target.value as Unit }))}>
                  {units.map((unit) => <option key={unit}>{unit}</option>)}
                </select>
              </label>
              <label>
                Unidad uso
                <select value={draft.useUnit} onChange={(event) => updateDraft((current) => ({ ...current, useUnit: event.target.value as Unit }))}>
                  {units.map((unit) => <option key={unit}>{unit}</option>)}
                </select>
              </label>
              <label>Precio compra<input type="number" step="0.001" value={draft.purchasePrice} onChange={(event) => updateDraft((current) => ({ ...current, purchasePrice: parseNumericInput(event.target.value) }))} /></label>
              <label>Costo util real<input type="number" step="0.001" value={draft.usefulUnitCost} readOnly /></label>
              <label>Stock actual<input type="number" step="0.001" value={draft.currentStock} onChange={(event) => setDraft({ ...draft, currentStock: parseNumericInput(event.target.value) })} /></label>
              <label>Stock minimo<input type="number" step="0.001" value={draft.minStock} onChange={(event) => setDraft({ ...draft, minStock: parseNumericInput(event.target.value) })} /></label>
              <label>Stock maximo<input type="number" step="0.001" value={draft.maxStock} onChange={(event) => setDraft({ ...draft, maxStock: parseNumericInput(event.target.value) })} /></label>
              <label>Vida util dias<input type="number" step="1" value={draft.shelfLifeDays} onChange={(event) => setDraft({ ...draft, shelfLifeDays: parseNumericInput(event.target.value) })} /></label>
            </div>
          </section>

          <section className="form-section">
            <h3>Condicion sanitaria y almacenamiento</h3>
            <div className="form-grid four">
              <label>
                Tipo almacenamiento
                <select value={draft.storageType} onChange={(event) => setDraft({ ...draft, storageType: event.target.value })}>
                  {storageTypeOptions.map((storageType) => <option key={storageType} value={storageType}>{storageType}</option>)}
                </select>
              </label>
              <label>Condicion sanitaria<input value={draft.storageConditions} onChange={(event) => setDraft({ ...draft, storageConditions: event.target.value })} /></label>
              <label>Temp. minima<input type="number" step="0.1" value={draft.recommendedMinTemp} onChange={(event) => setDraft({ ...draft, recommendedMinTemp: parseNumericInput(event.target.value) })} /></label>
              <label>Temp. maxima<input type="number" step="0.1" value={draft.recommendedMaxTemp} onChange={(event) => setDraft({ ...draft, recommendedMaxTemp: parseNumericInput(event.target.value) })} /></label>
              <label>Temperatura actual<input type="number" step="0.1" value={draft.currentStorageTemp} onChange={(event) => setDraft({ ...draft, currentStorageTemp: parseNumericInput(event.target.value), storageTemperature: `${parseNumericInput(event.target.value)} C` })} /></label>
              <label>Ubicacion<input value={draft.storageLocation} onChange={(event) => setDraft({ ...draft, storageLocation: event.target.value })} /></label>
              <label>Fecha ingreso<input type="date" value={draft.receivedDate} onChange={(event) => updateDraftReceivedDate(event.target.value)} /></label>
              <label>Fecha vencimiento<input type="date" value={draft.expiryDate} onChange={(event) => setDraft({ ...draft, expiryDate: event.target.value })} /></label>
            </div>
          </section>
        </div>
        {sanitary && (
          <div className="sanitary-strip">
            <ColorChip text={`${sanitary.name} · ${sanitary.colorName}`} colorHex={sanitary.colorHex} />
            <StatusBadge tone={draft.riskLevel === 'Critico' ? 'danger' : draft.riskLevel.includes('Alto') ? 'warning' : 'ok'} text={`Riesgo ${draft.riskLevel}`} />
            <StatusBadge tone={tempInRange ? 'ok' : 'danger'} text={tempInRange ? 'Temperatura correcta' : 'Temperatura fuera de rango'} />
            {inDangerZone && <StatusBadge tone="danger" text="Zona de peligro microbiologico" />}
          </div>
        )}
        <div className="toolbar">
          <button className="primary-button" disabled={!canManage || !draft.name} onClick={() => {
            const readyDraft = withAutomatedTraceability(draft);
            actions.upsertIngredient({
              ...readyDraft,
              lastPurchaseDate: draft.lastPurchaseDate || new Date().toISOString().slice(0, 10),
            });
            setDraft(emptyIngredient(state));
          }}>
            <Save size={18} /> Guardar ingrediente
          </button>
        </div>
      </section>

      <section className="panel">
        <PanelHeader title="Gestion de precios de compra" />
        <div className="form-grid four">
          <label>
            Ingrediente
            <select
              value={priceDraft.ingredientId}
              onChange={(event) => setPriceDraft((current) => ({ ...current, ingredientId: event.target.value }))}
            >
              {state.ingredients.map((ingredient) => <option key={ingredient.id} value={ingredient.id}>{ingredient.name}</option>)}
            </select>
          </label>
          <label>
            Proveedor
            <select
              value={priceDraft.supplierId}
              onChange={(event) => setPriceDraft((current) => ({ ...current, supplierId: event.target.value }))}
            >
              {state.suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
            </select>
          </label>
          <label>
            Fecha
            <input
              type="date"
              value={priceDraft.date}
              onChange={(event) => setPriceDraft((current) => ({ ...current, date: event.target.value }))}
            />
          </label>
          <label>
            Nuevo precio compra
            <input
              type="number"
              step="0.001"
              value={priceDraft.pricePurchase}
              onChange={(event) =>
                setPriceDraft((current) => ({ ...current, pricePurchase: parseNumericInput(event.target.value) }))
              }
            />
          </label>
        </div>
        <div className="summary-strip compact">
          <SummaryMetric label="Precio actual" value={money.format(selectedPriceIngredient?.purchasePrice ?? 0)} />
          <SummaryMetric
            label="Costo util actual"
            value={
              selectedPriceIngredient
                ? `${money.format(selectedPriceIngredient.usefulUnitCost)} / ${selectedPriceIngredient.useUnit}`
                : money.format(0)
            }
          />
          <SummaryMetric
            label="Variacion"
            value={
              priceTrend
                ? `${priceTrend.delta >= 0 ? '+' : ''}${money.format(priceTrend.delta)} (${percent.format(priceTrend.percentDelta)})`
                : 'Sin historico'
            }
          />
        </div>
        <div className="toolbar">
          <button
            className="primary-button"
            disabled={!canManage || !priceDraft.ingredientId || !priceDraft.supplierId}
            onClick={() => {
              actions.registerIngredientPrice(priceDraft);
            }}
          >
            <Save size={18} /> Registrar cambio de precio
          </button>
        </div>
      </section>

      <DataTable
        title="Catalogo de ingredientes"
        headers={['Ingrediente', 'Sanitario', 'Proveedor', 'Precio compra', 'Costo util', 'Temperatura', 'Vencimiento', 'Stock', 'Alertas', '']}
        rows={state.ingredients.map((ingredient) => [
          ingredient.name,
          <ColorChip key={`${ingredient.id}-chip`} text={state.sanitaryCategories.find((category) => category.id === ingredient.sanitaryCategoryId)?.name ?? 'Sin categoria'} colorHex={ingredient.colorHex} />,
          state.suppliers.find((supplier) => supplier.id === ingredient.primarySupplierId)?.name ?? '-',
          money.format(ingredient.purchasePrice),
          `${money.format(ingredient.usefulUnitCost)} / ${ingredient.useUnit}`,
          `${decimal.format(ingredient.currentStorageTemp)} C (${ingredient.recommendedMinTemp} a ${ingredient.recommendedMaxTemp} C)`,
          ingredient.expiryDate || '-',
          `${decimal.format(ingredient.currentStock)} ${ingredient.purchaseUnit}`,
          <div className="mini-badges" key={`${ingredient.id}-alerts`}>
            {ingredient.currentStock <= ingredient.minStock && <StatusBadge tone="danger" text="Stock bajo" />}
            {(ingredient.currentStorageTemp < ingredient.recommendedMinTemp || ingredient.currentStorageTemp > ingredient.recommendedMaxTemp) && <StatusBadge tone="danger" text="Temp fuera de rango" />}
            {ingredient.currentStorageTemp >= 5 && ingredient.currentStorageTemp <= 65 && ingredient.riskLevel !== 'Bajo' && <StatusBadge tone="danger" text="Zona de peligro" />}
          </div>,
          <div className="row-actions" key={`${ingredient.id}-a`}>
            <button className="icon-button" onClick={() => setDraft(ingredient)}><Save size={15} /></button>
            <button className="icon-button" onClick={() => actions.removeIngredient(ingredient.id)}><Trash2 size={15} /></button>
          </div>,
        ])}
      />
    </section>
  );
}

function YieldModule({
  state,
  actions,
  canManage,
}: {
  state: ReturnType<typeof useLocalStore>['state'];
  actions: ReturnType<typeof useLocalStore>['actions'];
  canManage: boolean;
}) {
  const [draft, setDraft] = useState<YieldRecord>(() => emptyYieldRecord(state));
  const [selectedIngredientId, setSelectedIngredientId] = useState(state.ingredients[0]?.id ?? '');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unmeasured' | 'critical' | 'cost'>('all');
  const selectedDraftIngredient = state.ingredients.find((item) => item.id === draft.ingredientId);
  const projectedYield = draft.purchaseWeight === 0 ? 0 : (draft.finalUsefulWeight / draft.purchaseWeight) * 100;
  const projectedWaste = Math.max(100 - projectedYield, 0);
  const projectedUsefulCost = selectedDraftIngredient
    ? calculateUsefulUnitCost(
      selectedDraftIngredient.purchasePrice,
      selectedDraftIngredient.purchaseUnit,
      selectedDraftIngredient.useUnit,
      Math.max(projectedYield, 0.001),
    )
    : 0;
  const yieldRows = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return state.ingredients
      .map((ingredient) => {
        const records = state.yieldRecords
          .filter((record) => record.ingredientId === ingredient.id)
          .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
        const latest = records[0];
        const averageYield = records.length
          ? records.reduce((sum, record) => sum + record.yieldPercent, 0) / records.length
          : ingredient.usableYieldPercent;
        const latestYield = latest?.yieldPercent ?? ingredient.usableYieldPercent;
        const projectedCost = calculateUsefulUnitCost(
          ingredient.purchasePrice,
          ingredient.purchaseUnit,
          ingredient.useUnit,
          Math.max(latestYield, 0.001),
        );
        const costDelta = projectedCost - ingredient.usefulUnitCost;
        const recipeUsages = state.baseRecipes.filter((recipe) => recipe.items.some((item) => item.ingredientId === ingredient.id));
        const dishUsages = state.dishes.filter((dish) => {
          const result = calculateDishCost(state, dish);
          return result.componentLines.some((line) =>
            (line.componentType === 'ingredient' && line.refId === ingredient.id) ||
            line.nestedLines?.some((nestedLine) => nestedLine.ingredientId === ingredient.id),
          );
        });
        const category = state.categories.find((item) => item.id === ingredient.categoryId);
        const supplier = state.suppliers.find((item) => item.id === ingredient.primarySupplierId);
        const tone = getYieldTone(latestYield);
        return {
          ingredient,
          records,
          latest,
          averageYield,
          latestYield,
          projectedCost,
          costDelta,
          recipeUsages,
          dishUsages,
          category,
          supplier,
          tone,
        };
      })
      .filter((item) => {
        const ingredient = item.ingredient;
        const matchesSearch =
          !normalizedSearch ||
          ingredient.name.toLowerCase().includes(normalizedSearch) ||
          ingredient.internalCode.toLowerCase().includes(normalizedSearch) ||
          item.category?.name.toLowerCase().includes(normalizedSearch) ||
          item.supplier?.name.toLowerCase().includes(normalizedSearch);
        const matchesCategory = categoryFilter === 'all' || ingredient.categoryId === categoryFilter;
        const matchesStatus =
          statusFilter === 'all' ||
          (statusFilter === 'unmeasured' && item.records.length === 0) ||
          (statusFilter === 'critical' && item.tone === 'danger') ||
          (statusFilter === 'cost' && item.costDelta > ingredient.usefulUnitCost * 0.08);
        return matchesSearch && matchesCategory && matchesStatus;
      })
      .sort((a, b) => {
        const toneRank = { danger: 0, warning: 1, ok: 2 };
        const toneDelta = toneRank[a.tone] - toneRank[b.tone];
        if (toneDelta !== 0) return toneDelta;
        return a.ingredient.name.localeCompare(b.ingredient.name);
      });
  }, [categoryFilter, searchTerm, state, statusFilter]);
  const selectedYieldRow = yieldRows.find((item) => item.ingredient.id === selectedIngredientId) ??
    yieldRows[0] ??
    null;
  const selectedYieldOutOfSync = selectedYieldRow
    ? Math.abs(selectedYieldRow.latestYield - selectedYieldRow.ingredient.usableYieldPercent) > 0.001
    : false;
  const selectedDraftPurchaseUnit = selectedDraftIngredient?.purchaseUnit ?? 'unidad';
  const selectedDraftUseUnit = selectedDraftIngredient?.useUnit ?? selectedDraftPurchaseUnit;
  const totalRecords = state.yieldRecords.length;
  const measuredIngredients = new Set(state.yieldRecords.map((record) => record.ingredientId)).size;
  const averageMeasuredYield = totalRecords
    ? state.yieldRecords.reduce((sum, record) => sum + record.yieldPercent, 0) / totalRecords
    : 0;
  const criticalRecords = state.yieldRecords.filter((record) => getYieldTone(record.yieldPercent) === 'danger').length;
  const totalWasteCost = state.yieldRecords.reduce((sum, record) => {
    const ingredient = state.ingredients.find((item) => item.id === record.ingredientId);
    if (!ingredient) return sum;
    return sum + calculateYieldLossTotal(record) * ingredient.usefulUnitCost;
  }, 0);

  useEffect(() => {
    if (!state.ingredients.length) return;
    setSelectedIngredientId((current) => state.ingredients.some((item) => item.id === current) ? current : state.ingredients[0].id);
  }, [state.ingredients]);

  const updateDraftIngredient = (ingredientId: string) => {
    const ingredient = state.ingredients.find((item) => item.id === ingredientId);
    setDraft((current) => ({
      ...current,
      ingredientId,
      yieldPercent: ingredient?.usableYieldPercent ?? current.yieldPercent,
      wastePercent: Math.max(100 - (ingredient?.usableYieldPercent ?? current.yieldPercent), 0),
    }));
    setSelectedIngredientId(ingredientId);
  };

  return (
    <section className="content-stack">
      <section className="panel">
        <PanelHeader title="Centro de control de rendimientos" />
        <div className="summary-strip compact">
          <SummaryMetric label="Ingredientes medidos" value={`${measuredIngredients}/${state.ingredients.length}`} />
          <SummaryMetric label="Rendimiento promedio" value={totalRecords ? percent.format(averageMeasuredYield / 100) : 'Sin registros'} />
          <SummaryMetric label="Registros criticos" value={String(criticalRecords)} />
          <SummaryMetric label="Merma valorizada estimada" value={money.format(totalWasteCost)} />
        </div>
        <div className="ingredient-toolbar">
          <label>Buscar<input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Ingrediente, codigo, proveedor..." /></label>
          <label>
            Categoria
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="all">Todas</option>
              {state.categories.filter((item) => item.type === 'ingredient').map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
          <label>
            Vista
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
              <option value="all">Todos</option>
              <option value="unmeasured">Sin medicion</option>
              <option value="critical">Criticos</option>
              <option value="cost">Impacto costo</option>
            </select>
          </label>
        </div>
      </section>

      <section className="yield-workbench">
        <section className="panel yield-grid-panel">
          <PanelHeader title="Grilla de rendimiento por materia prima" />
          <div className="table-wrap yield-master-grid-wrap">
            <table className="yield-master-grid">
              <thead>
                <tr>
                  <th>Materia prima</th>
                  <th>Categoria</th>
                  <th>Ultimo rendimiento</th>
                  <th>Promedio</th>
                  <th>Costo util</th>
                  <th>Impacto</th>
                  <th>Recetarios</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {yieldRows.map((item) => (
                  <tr
                    key={item.ingredient.id}
                    className={selectedYieldRow?.ingredient.id === item.ingredient.id ? 'selected-row' : ''}
                    onClick={() => setSelectedIngredientId(item.ingredient.id)}
                  >
                    <td>
                      <strong>{item.ingredient.name}</strong>
                      <div className="helper-text">{item.ingredient.internalCode || 'Sin codigo'}</div>
                    </td>
                    <td>{item.category?.name ?? '-'}</td>
                    <td>
                      <div className="yield-bar-cell">
                        <span>{percent.format(item.latestYield / 100)}</span>
                        <div className="yield-bar"><span style={{ width: `${Math.min(Math.max(item.latestYield, 0), 110) / 110 * 100}%` }} /></div>
                      </div>
                    </td>
                    <td>{percent.format(item.averageYield / 100)}</td>
                    <td>
                      <strong>{`${money.format(item.projectedCost)} / ${item.ingredient.useUnit}`}</strong>
                      <div className="helper-text">{`Actual ${money.format(item.ingredient.usefulUnitCost)}`}</div>
                    </td>
                    <td className={item.costDelta > 0 ? 'numeric-danger' : 'numeric-ok'}>{item.costDelta >= 0 ? '+' : ''}{money.format(item.costDelta)}</td>
                    <td>{`${item.recipeUsages.length} recetas · ${item.dishUsages.length} platos`}</td>
                    <td><StatusBadge tone={item.records.length ? item.tone : 'warning'} text={item.records.length ? getYieldStatusText(item.latestYield) : 'Sin medicion'} /></td>
                    <td>
                      <div className="row-actions">
                        <button className="icon-button" title="Nuevo registro" onClick={(event) => {
                          event.stopPropagation();
                          updateDraftIngredient(item.ingredient.id);
                        }}><Pencil size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel yield-detail-panel">
          <PanelHeader
            title={selectedYieldRow?.ingredient.name ?? 'Detalle de rendimiento'}
            action={selectedYieldRow?.latest && selectedYieldOutOfSync
              ? (
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={!canManage}
                    onClick={() => actions.applyYieldToIngredient({
                      ingredientId: selectedYieldRow.ingredient.id,
                      yieldPercent: selectedYieldRow.latestYield,
                    })}
                  >
                    Aplicar a ficha maestra
                  </button>
                )
              : undefined}
          />
          {selectedYieldRow && (
            <div className="ingredient-detail-stack">
              <div className="summary-strip compact">
                <SummaryMetric label="Registros" value={String(selectedYieldRow.records.length)} />
                <SummaryMetric label="Ultimo rendimiento" value={percent.format(selectedYieldRow.latestYield / 100)} />
                <SummaryMetric label="Costo proyectado" value={`${money.format(selectedYieldRow.projectedCost)} / ${selectedYieldRow.ingredient.useUnit}`} />
                <SummaryMetric label="Recetarios afectados" value={`${selectedYieldRow.recipeUsages.length + selectedYieldRow.dishUsages.length}`} />
              </div>
              <p className="helper-text">
                El ultimo rendimiento registrado se sincroniza automaticamente con la ficha maestra. Usa la accion manual solo si necesitas reaplicar ese valor.
              </p>
              <div className="ingredient-detail-block">
                <h3>Tendencia de registros</h3>
                <div className="yield-trend-list">
                  {selectedYieldRow.records.slice(0, 6).map((record) => (
                    <div className="yield-trend-row" key={record.id}>
                      <span>{record.recordedAt}</span>
                      <div className="yield-bar"><span style={{ width: `${Math.min(Math.max(record.yieldPercent, 0), 110) / 110 * 100}%` }} /></div>
                      <strong>{percent.format(record.yieldPercent / 100)}</strong>
                    </div>
                  ))}
                  {selectedYieldRow.records.length === 0 && <p className="helper-text">Sin registros historicos para esta materia prima.</p>}
                </div>
              </div>
              <div className="ingredient-detail-block">
                <h3>Uso conectado a recetarios</h3>
                <div className="compact-shell">
                  <table>
                    <thead><tr><th>Tipo</th><th>Nombre</th><th>Categoria</th></tr></thead>
                    <tbody>
                      {[...selectedYieldRow.recipeUsages.map((recipe) => ({ id: recipe.id, type: 'Receta base', name: recipe.name, categoryId: recipe.categoryId })),
                        ...selectedYieldRow.dishUsages.map((dish) => ({ id: dish.id, type: 'Plato final', name: dish.name, categoryId: dish.categoryId }))].slice(0, 8).map((usage) => (
                        <tr key={`${usage.type}-${usage.id}`}>
                          <td>{usage.type}</td>
                          <td>{usage.name}</td>
                          <td>{state.categories.find((category) => category.id === usage.categoryId)?.name ?? '-'}</td>
                        </tr>
                      ))}
                      {selectedYieldRow.recipeUsages.length + selectedYieldRow.dishUsages.length === 0 && <tr><td colSpan={3}>Sin recetarios conectados.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </section>
      </section>

      <section className="panel">
        <PanelHeader title="Registro guiado de rendimiento" />
        <div className="form-section-stack">
          <section className="form-section">
            <h3>Materia prima y resultado</h3>
            <div className="form-grid four">
              <label>
                Ingrediente
                <select value={draft.ingredientId} onChange={(event) => updateDraftIngredient(event.target.value)}>
                  {state.ingredients.map((ingredient) => <option key={ingredient.id} value={ingredient.id}>{ingredient.name}</option>)}
                </select>
              </label>
              <label>Fecha<input type="date" value={draft.recordedAt} onChange={(event) => setDraft({ ...draft, recordedAt: event.target.value })} /></label>
              <label>
                Tipo de merma
                <select value={draft.wasteType} onChange={(event) => setDraft({ ...draft, wasteType: event.target.value })}>
                  {yieldWasteTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </label>
              <label>Notas<input value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></label>
              <label>{`Peso comprado (${selectedDraftPurchaseUnit})`}<input type="number" step="0.001" value={draft.purchaseWeight} onChange={(event) => setDraft({ ...draft, purchaseWeight: parseNumericInput(event.target.value) })} /></label>
              <label>{`Peso limpieza (${selectedDraftPurchaseUnit})`}<input type="number" step="0.001" value={draft.cleanedWeight} onChange={(event) => setDraft({ ...draft, cleanedWeight: parseNumericInput(event.target.value) })} /></label>
              <label>{`Peso coccion (${selectedDraftPurchaseUnit})`}<input type="number" step="0.001" value={draft.cookedWeight} onChange={(event) => setDraft({ ...draft, cookedWeight: parseNumericInput(event.target.value) })} /></label>
              <label>{`Peso util final (${selectedDraftUseUnit})`}<input type="number" step="0.001" value={draft.finalUsefulWeight} onChange={(event) => setDraft({ ...draft, finalUsefulWeight: parseNumericInput(event.target.value) })} /></label>
            </div>
          </section>
          <section className="form-section">
            <h3>Merma por etapa</h3>
            <div className="form-grid four">
              <label>{`Despunte (${selectedDraftPurchaseUnit})`}<input type="number" step="0.001" value={draft.trimLoss} onChange={(event) => setDraft({ ...draft, trimLoss: parseNumericInput(event.target.value) })} /></label>
              <label>{`Piel / cascara (${selectedDraftPurchaseUnit})`}<input type="number" step="0.001" value={draft.peelLoss} onChange={(event) => setDraft({ ...draft, peelLoss: parseNumericInput(event.target.value) })} /></label>
              <label>{`Hueso (${selectedDraftPurchaseUnit})`}<input type="number" step="0.001" value={draft.boneLoss} onChange={(event) => setDraft({ ...draft, boneLoss: parseNumericInput(event.target.value) })} /></label>
              <label>{`Grasa (${selectedDraftPurchaseUnit})`}<input type="number" step="0.001" value={draft.fatLoss} onChange={(event) => setDraft({ ...draft, fatLoss: parseNumericInput(event.target.value) })} /></label>
              <label>{`Evaporacion (${selectedDraftPurchaseUnit})`}<input type="number" step="0.001" value={draft.evaporationLoss} onChange={(event) => setDraft({ ...draft, evaporationLoss: parseNumericInput(event.target.value) })} /></label>
              <label>{`Descongelado (${selectedDraftPurchaseUnit})`}<input type="number" step="0.001" value={draft.thawLoss} onChange={(event) => setDraft({ ...draft, thawLoss: parseNumericInput(event.target.value) })} /></label>
              <label>{`Manipulacion (${selectedDraftPurchaseUnit})`}<input type="number" step="0.001" value={draft.handlingLoss} onChange={(event) => setDraft({ ...draft, handlingLoss: parseNumericInput(event.target.value) })} /></label>
              <div className="yield-action-box">
                <button className="secondary-button compact" type="button" onClick={() => setDraft((current) => applyYieldLosses(current))}>Aplicar perdidas</button>
                <span>{`${decimal.format(calculateYieldLossTotal(draft))} ${selectedDraftPurchaseUnit} de merma capturada`}</span>
              </div>
            </div>
          </section>
        </div>
        <div className="summary-strip compact">
          <SummaryMetric label="Rendimiento proyectado" value={percent.format(projectedYield / 100)} />
          <SummaryMetric label="Merma proyectada" value={percent.format(projectedWaste / 100)} />
          <SummaryMetric label="Costo util proyectado" value={`${money.format(projectedUsefulCost)} / ${selectedDraftUseUnit}`} />
          <SummaryMetric label="Unidad de control" value={selectedDraftIngredient ? `${selectedDraftPurchaseUnit} -> ${selectedDraftUseUnit}` : '-'} />
        </div>
        <div className="toolbar">
          <button className="primary-button" disabled={!canManage || !draft.ingredientId} onClick={() => {
            actions.upsertYieldRecord({
              ...draft,
              yieldPercent: projectedYield,
              wastePercent: projectedWaste,
            });
            setDraft(emptyYieldRecord(state));
          }}>
            <Save size={18} /> Registrar rendimiento
          </button>
        </div>
      </section>

      <DataTable
        title="Historico tecnico de rendimientos"
        headers={['Ingrediente', 'Fecha', 'Compra', 'Limpio', 'Cocido', 'Util', 'Rend.', 'Merma', 'Tipo', '']}
        rows={state.yieldRecords.map((record) => {
          const ingredient = state.ingredients.find((item) => item.id === record.ingredientId);
          return [
            ingredient?.name ?? '-',
            record.recordedAt,
            `${decimal.format(record.purchaseWeight)} ${ingredient?.purchaseUnit ?? ''}`,
            `${decimal.format(record.cleanedWeight)} ${ingredient?.purchaseUnit ?? ''}`,
            `${decimal.format(record.cookedWeight)} ${ingredient?.purchaseUnit ?? ''}`,
            `${decimal.format(record.finalUsefulWeight)} ${ingredient?.useUnit ?? ingredient?.purchaseUnit ?? ''}`,
            percent.format(record.yieldPercent / 100),
            percent.format(record.wastePercent / 100),
            record.wasteType,
            <button className="icon-button" key={`${record.id}-edit`} onClick={() => {
              setDraft(record);
              setSelectedIngredientId(record.ingredientId);
            }}><Pencil size={15} /></button>,
          ];
        })}
      />
    </section>
  );
}

function BaseRecipesModule({
  state,
  actions,
  canManage,
}: {
  state: ReturnType<typeof useLocalStore>['state'];
  actions: ReturnType<typeof useLocalStore>['actions'];
  canManage: boolean;
}) {
  const [draft, setDraft] = useState<BaseRecipe>(() => emptyBaseRecipe(state));
  const result = useMemo(() => calculateBaseRecipeCost(state, draft), [state, draft]);
  const effectiveDraftLaborMinutes = getEffectiveLaborMinutes(draft.timeMinutes, draft.laborMinutes);
  const laborPolicy = getLaborPolicy(state, draft.laborProfileId, effectiveDraftLaborMinutes);
  const activeCategoryName = state.categories.find((item) => item.id === draft.categoryId)?.name ?? 'Sin categoria';
  const recipeRollup = useMemo(() => {
    const recipes = state.baseRecipes.map((recipe) => {
      const recipeResult = calculateBaseRecipeCost(state, recipe);
      const effectiveLaborMinutes = getEffectiveLaborMinutes(recipe.timeMinutes, recipe.laborMinutes);
      const recipePolicy = getLaborPolicy(state, recipe.laborProfileId, effectiveLaborMinutes);
      return { recipe, recipeResult, recipePolicy, effectiveLaborMinutes };
    });
    const totalBatchCost = recipes.reduce((sum, item) => sum + item.recipeResult.totalCost, 0);
    const totalUnitCost = recipes.reduce((sum, item) => sum + item.recipeResult.costPerYieldUnit, 0);
    const policyAlerts = recipes.filter((item) => item.recipePolicy.tone !== 'ok').length;
    return {
      recipes,
      averageBatchCost: recipes.length ? totalBatchCost / recipes.length : 0,
      averageUnitCost: recipes.length ? totalUnitCost / recipes.length : 0,
      policyAlerts,
    };
  }, [state]);

  const updateDraftItem = (itemId: string, updater: (item: BaseRecipe['items'][number]) => BaseRecipe['items'][number]) => {
    setDraft((current) => ({
      ...current,
      items: current.items.map((line) => (line.id === itemId ? updater(line) : line)),
    }));
  };

  return (
    <section className="content-stack">
      <section className="panel">
        <PanelHeader
          title="Recetas base y mise en place"
          action={<button className="secondary-button" onClick={() => setDraft((current) => ({
            ...current,
            items: [...current.items, { id: createId('item'), ingredientId: state.ingredients[0]?.id ?? '', quantity: 0, unit: 'g', wastePercent: 0 }],
          }))}>Agregar insumo</button>}
        />
        <div className="summary-strip compact">
          <SummaryMetric label="Recetas activas" value={String(state.baseRecipes.length)} />
          <SummaryMetric label="Costo medio por tanda" value={money.format(recipeRollup.averageBatchCost)} />
          <SummaryMetric label="Costo medio por unidad" value={`${money.format(recipeRollup.averageUnitCost)} / unidad`} />
          <SummaryMetric label="Alertas operativas" value={String(recipeRollup.policyAlerts)} />
        </div>
        <div className="spreadsheet-wrap">
          <div className="table-wrap">
            <table className="spreadsheet-table">
              <thead>
                <tr>
                  <th>Receta</th>
                  <th>Categoria</th>
                  <th>Rendimiento</th>
                  <th>Unidad base</th>
                  <th>Costo por unidad</th>
                  <th>Tiempo prep</th>
                  <th>Min mano obra</th>
                  <th>Perfil laboral</th>
                  <th>Alergenos</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Ej. Fondo oscuro, mousse, pure base" /></td>
                  <td>
                    <select value={draft.categoryId} onChange={(event) => setDraft({ ...draft, categoryId: event.target.value })}>
                      {state.categories.filter((item) => item.type === 'dish').map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                    </select>
                  </td>
                  <td><input type="number" step="0.001" value={draft.yieldAmount} onChange={(event) => setDraft({ ...draft, yieldAmount: parseNumericInput(event.target.value, 1) })} /></td>
                  <td>
                    <select value={draft.yieldUnit} onChange={(event) => setDraft({ ...draft, yieldUnit: event.target.value as Unit, itemCostUnit: event.target.value as Unit })}>
                      {units.map((unit) => <option key={unit}>{unit}</option>)}
                    </select>
                  </td>
                  <td>{`${money.format(result.costPerYieldUnit)} / ${draft.itemCostUnit}`}</td>
                  <td><input type="number" step="0.1" value={draft.timeMinutes} onChange={(event) => {
                    const nextTimeMinutes = parseNumericInput(event.target.value);
                    setDraft((current) => ({
                      ...current,
                      timeMinutes: nextTimeMinutes,
                      laborMinutes: current.laborMinutes > 0 ? current.laborMinutes : nextTimeMinutes,
                    }));
                  }} /></td>
                  <td><input type="number" step="0.1" value={draft.laborMinutes} onChange={(event) => setDraft({ ...draft, laborMinutes: parseNumericInput(event.target.value) })} /></td>
                  <td>
                    <select value={draft.laborProfileId} onChange={(event) => setDraft({ ...draft, laborProfileId: event.target.value })}>
                      {state.laborProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.roleName}</option>)}
                    </select>
                  </td>
                  <td><input value={draft.allergens.join(', ')} onChange={(event) => setDraft({ ...draft, allergens: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} placeholder="Lacteos, gluten, huevo" /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div className="summary-strip compact">
          <SummaryMetric label="Categoria activa" value={activeCategoryName} />
          <SummaryMetric label="Ingredientes" value={money.format(result.ingredientCost)} />
          <SummaryMetric label="Indirectos" value={money.format(result.indirectCost)} />
          <SummaryMetric label="Mano de obra" value={money.format(result.laborCost)} />
          <SummaryMetric label="Costo total" value={money.format(result.totalCost)} />
          <SummaryMetric label="Costo unitario" value={`${money.format(result.costPerYieldUnit)} / ${draft.itemCostUnit}`} />
        </div>
        <div className={`alert-row ${laborPolicy.tone === 'danger' ? 'critical' : laborPolicy.tone === 'warning' ? 'warning' : 'info'}`}>
          <AlertTriangle size={18} />
          <div>
            <strong>{laborPolicy.text}</strong>
            <span>{laborPolicy.detail}</span>
          </div>
        </div>
        <section className="recipe-cost-breakdown">
          <div className="recipe-breakdown-header">
            <h3>Resumen economico de la receta</h3>
          </div>
          <div className="table-shell compact-shell">
            <table>
              <thead>
                <tr>
                  <th>Concepto</th>
                  <th>Formula</th>
                  <th>Costo por tanda</th>
                  <th>Participacion</th>
                  <th>Costo por {draft.itemCostUnit}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Insumos</td>
                  <td>Suma valorizada de materias primas y mermas</td>
                  <td>{money.format(result.ingredientCost)}</td>
                  <td>{percent.format(result.totalCost === 0 ? 0 : result.ingredientCost / result.totalCost)}</td>
                  <td>{money.format(result.ingredientCost / Math.max(draft.yieldAmount, 0.001))}</td>
                </tr>
                <tr>
                  <td>Mano de obra</td>
                  <td>{`${decimal.format(effectiveDraftLaborMinutes)} min x tarifa del perfil`}</td>
                  <td>{money.format(result.laborCost)}</td>
                  <td>{percent.format(result.totalCost === 0 ? 0 : result.laborCost / result.totalCost)}</td>
                  <td>{money.format(result.laborCost / Math.max(draft.yieldAmount, 0.001))}</td>
                </tr>
                <tr>
                  <td>Indirectos</td>
                  <td>Prorrateo operativo segun horas y reglas de asignacion</td>
                  <td>{money.format(result.indirectCost)}</td>
                  <td>{percent.format(result.totalCost === 0 ? 0 : result.indirectCost / result.totalCost)}</td>
                  <td>{money.format(result.indirectCost / Math.max(draft.yieldAmount, 0.001))}</td>
                </tr>
                <tr className="nested-cost-row">
                  <td>Costo total receta</td>
                  <td>Insumos + mano de obra + indirectos</td>
                  <td>{money.format(result.totalCost)}</td>
                  <td>{percent.format(result.totalCost === 0 ? 0 : 1)}</td>
                  <td>{money.format(result.costPerYieldUnit)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
        <section className="recipe-cost-breakdown">
          <div className="recipe-breakdown-header">
            <h3>Formula valorizada</h3>
          </div>
          <div className="spreadsheet-wrap">
            <div className="table-wrap">
              <table className="spreadsheet-table">
                <thead>
                  <tr>
                    <th>Ingrediente</th>
                    <th>Categoria MP</th>
                    <th>Proveedor</th>
                    <th>Cantidad receta</th>
                    <th>Unidad</th>
                    <th>Merma %</th>
                    <th>Cantidad util</th>
                    <th>Costo util</th>
                    <th>Costo linea</th>
                    <th>Stock</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {draft.items.map((item) => {
                    const ingredient = state.ingredients.find((row) => row.id === item.ingredientId);
                    const line = result.lines.find((row) => row.recipeItemId === item.id);
                    const ingredientCategory = state.categories.find((row) => row.id === ingredient?.categoryId)?.name ?? '-';
                    const supplierName = state.suppliers.find((row) => row.id === ingredient?.primarySupplierId)?.name ?? '-';
                    return (
                      <tr key={item.id}>
                        <td>
                          <select value={item.ingredientId} onChange={(event) => updateDraftItem(item.id, (current) => ({ ...current, ingredientId: event.target.value }))}>
                            {state.ingredients.map((ingredientOption) => <option key={ingredientOption.id} value={ingredientOption.id}>{ingredientOption.name}</option>)}
                          </select>
                        </td>
                        <td>{ingredientCategory}</td>
                        <td>{supplierName}</td>
                        <td><input type="number" step="0.001" value={item.quantity} onChange={(event) => updateDraftItem(item.id, (current) => ({ ...current, quantity: parseNumericInput(event.target.value) }))} /></td>
                        <td>
                          <select value={item.unit} onChange={(event) => updateDraftItem(item.id, (current) => ({ ...current, unit: event.target.value as Unit }))}>
                            {units.map((unit) => <option key={unit}>{unit}</option>)}
                          </select>
                        </td>
                        <td><input type="number" step="0.1" value={item.wastePercent} onChange={(event) => updateDraftItem(item.id, (current) => ({ ...current, wastePercent: parseNumericInput(event.target.value) }))} /></td>
                        <td>{line ? `${decimal.format(line.normalizedQuantity)} ${line.useUnit}` : '-'}</td>
                        <td>{line ? `${money.format(line.usefulUnitCost)} / ${line.useUnit}` : '-'}</td>
                        <td>{line ? money.format(line.lineCost) : money.format(0)}</td>
                        <td>{ingredient ? `${decimal.format(ingredient.currentStock)} ${ingredient.purchaseUnit}` : '-'}</td>
                        <td>
                          <button className="icon-button" onClick={() => setDraft((current) => ({
                            ...current,
                            items: current.items.filter((lineItem) => lineItem.id !== item.id),
                          }))}>
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
        <section className="recipe-cost-breakdown">
          <div className="recipe-breakdown-header">
            <h3>Instrucciones, calidad y notas de pase</h3>
          </div>
          <div className="spreadsheet-wrap">
            <div className="table-wrap">
              <table className="spreadsheet-table">
                <thead>
                  <tr>
                    <th>Instrucciones</th>
                    <th>Control de calidad</th>
                    <th>Observaciones operativas</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><textarea className="sheet-textarea" value={draft.instructions} onChange={(event) => setDraft({ ...draft, instructions: event.target.value })} placeholder="Secuencia de mise en place, coccion, enfriado, armado." /></td>
                    <td><textarea className="sheet-textarea" value={draft.qualityNotes} onChange={(event) => setDraft({ ...draft, qualityNotes: event.target.value })} placeholder="Puntos de control, textura, sabor, color, rendimiento." /></td>
                    <td><textarea className="sheet-textarea" value={draft.observations} onChange={(event) => setDraft({ ...draft, observations: event.target.value })} placeholder="Notas de produccion, regeneracion, conservacion o servicio." /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
        <section className="recipe-cost-breakdown">
          <div className="recipe-breakdown-header">
            <h3>Desglose de costo por ingrediente</h3>
          </div>
          <div className="table-shell compact-shell">
            <table>
              <thead>
                <tr>
                  <th>Ingrediente</th>
                  <th>Cantidad</th>
                  <th>Cantidad util</th>
                  <th>Merma</th>
                  <th>Precio compra</th>
                  <th>Costo util</th>
                  <th>Costo linea</th>
                </tr>
              </thead>
              <tbody>
                {result.lines.map((line) => (
                  <tr key={line.recipeItemId}>
                    <td>{line.ingredientName}</td>
                    <td>{`${decimal.format(line.quantity)} ${line.unit}`}</td>
                    <td>{`${decimal.format(line.normalizedQuantity)} ${line.useUnit}`}</td>
                    <td>{percent.format(line.wastePercent / 100)}</td>
                    <td>{money.format(line.purchasePrice)}</td>
                    <td>{`${money.format(line.usefulUnitCost)} / ${line.useUnit}`}</td>
                    <td>{money.format(line.lineCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <button className="primary-button" disabled={!canManage || !draft.name} onClick={() => {
          actions.upsertBaseRecipe({
            ...draft,
            laborMinutes: effectiveDraftLaborMinutes,
          });
          setDraft(emptyBaseRecipe(state));
        }}>
          <Save size={18} /> Guardar receta base
        </button>
      </section>

      <DataTable
        title="Catalogo activo de recetas base"
        headers={['Receta', 'Categoria', 'Rendimiento', 'Lineas', 'MO min', 'Insumos', 'MO', 'Indirectos', 'Politica', 'Costo total', 'Costo unitario', '']}
        rows={recipeRollup.recipes.map(({ recipe, recipeResult, recipePolicy, effectiveLaborMinutes }) => {
          const categoryName = state.categories.find((item) => item.id === recipe.categoryId)?.name ?? '-';
          return [
            <button className="table-link-button" key={`${recipe.id}-name`} onClick={() => setDraft(recipe)}>{recipe.name}</button>,
            categoryName,
            `${decimal.format(recipe.yieldAmount)} ${recipe.yieldUnit}`,
            String(recipe.items.length),
            `${decimal.format(effectiveLaborMinutes)} min`,
            money.format(recipeResult.ingredientCost),
            money.format(recipeResult.laborCost),
            money.format(recipeResult.indirectCost),
            <StatusBadge key={`${recipe.id}-policy`} text={recipePolicy.text} tone={recipePolicy.tone} />,
            money.format(recipeResult.totalCost),
            `${money.format(recipeResult.costPerYieldUnit)} / ${recipe.itemCostUnit}`,
            <div className="row-actions" key={`${recipe.id}-actions`}>
              <button className="icon-button" onClick={() => setDraft(recipe)} title="Editar receta"><Pencil size={15} /></button>
              <button className="icon-button" onClick={() => actions.removeBaseRecipe(recipe.id)}><Trash2 size={15} /></button>
            </div>,
          ];
        })}
      />
    </section>
  );
}

function DishesModule({
  state,
  actions,
  canManage,
}: {
  state: ReturnType<typeof useLocalStore>['state'];
  actions: ReturnType<typeof useLocalStore>['actions'];
  canManage: boolean;
}) {
  const [draft, setDraft] = useState<Dish>(() => emptyDish(state));
  const [priceDraft, setPriceDraft] = useState(() => ({
    ingredientId: '',
    supplierId: '',
    date: new Date().toISOString().slice(0, 10),
    pricePurchase: 0,
  }));
  const result = useMemo(() => calculateDishCost(state, draft), [state, draft]);
  const capacitySnapshot = useMemo(() => getDishOperationalCapacitySnapshot(state, draft), [state, draft]);
  const roundedCustomerPrice = roundPriceForCustomer(result.recommendedPrice);
  const laborPolicy = getLaborPolicy(state, draft.laborProfileId, draft.laborMinutes);
  const assemblyPolicy = getDishAssemblyPolicy(state, draft.laborMinutes);
  const draftCategoryName = state.categories.find((item) => item.id === draft.categoryId)?.name ?? 'Sin categoria';
  const canSaveDish = canManage && Boolean(draft.name) && assemblyPolicy.tone !== 'danger';
  const dishIngredients = useMemo(() => {
    const ingredientMap = new Map<string, { id: string; name: string; purchasePrice: number; usefulUnitCost: number; useUnit: Unit; supplierId: string }>();
    result.componentLines.forEach((line) => {
      if (line.componentType === 'ingredient') {
        const ingredient = state.ingredients.find((item) => item.id === line.refId);
        if (!ingredient) return;
        ingredientMap.set(ingredient.id, {
          id: ingredient.id,
          name: ingredient.name,
          purchasePrice: ingredient.purchasePrice,
          usefulUnitCost: ingredient.usefulUnitCost,
          useUnit: ingredient.useUnit,
          supplierId: ingredient.primarySupplierId,
        });
      }
      line.nestedLines?.forEach((nestedLine) => {
        const ingredient = state.ingredients.find((item) => item.id === nestedLine.ingredientId);
        if (!ingredient) return;
        ingredientMap.set(ingredient.id, {
          id: ingredient.id,
          name: ingredient.name,
          purchasePrice: ingredient.purchasePrice,
          usefulUnitCost: ingredient.usefulUnitCost,
          useUnit: ingredient.useUnit,
          supplierId: ingredient.primarySupplierId,
        });
      });
    });
    return Array.from(ingredientMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [result.componentLines, state.ingredients]);
  const selectedPriceIngredient = dishIngredients.find((item) => item.id === priceDraft.ingredientId);
  const selectedIngredientEntity = state.ingredients.find((item) => item.id === priceDraft.ingredientId);
  const selectedPriceTrend = selectedIngredientEntity ? getIngredientPriceTrend(selectedIngredientEntity) : null;

  useEffect(() => {
    if (!dishIngredients.length) return;
    setPriceDraft((current) => {
      const ingredient = dishIngredients.find((item) => item.id === current.ingredientId) ?? dishIngredients[0];
      return {
        ingredientId: ingredient.id,
        supplierId: ingredient.supplierId,
        date: current.date,
        pricePurchase: ingredient.id === current.ingredientId ? current.pricePurchase : ingredient.purchasePrice,
      };
    });
  }, [dishIngredients]);

  return (
    <section className="content-stack">
      <section className="panel">
        <PanelHeader
          title="Flujo obligatorio: plato final"
          action={<button className="secondary-button" onClick={() => setDraft((current) => ({
            ...current,
            directItems: [...current.directItems, { id: createId('cmp'), componentType: 'ingredient', refId: state.ingredients[0]?.id ?? '', quantity: 0, unit: 'g', wastePercent: 0 }],
          }))}>Agregar componente</button>}
        />
        <div className="form-section-stack">
          <section className="form-section">
            <h3>Datos comerciales del plato</h3>
            <div className="form-grid four">
              <label>Nombre<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
              <label>
                Categoria
                <select value={draft.categoryId} onChange={(event) => setDraft({ ...draft, categoryId: event.target.value })}>
                  {state.categories.filter((item) => item.type === 'dish').map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </label>
              <label>
                Servicio
                <select value={draft.service} onChange={(event) => setDraft({ ...draft, service: event.target.value as Dish['service'] })}>
                  <option>Desayuno</option>
                  <option>Almuerzo</option>
                  <option>Cena</option>
                  <option>Delivery</option>
                  <option>Evento</option>
                </select>
              </label>
              <label>Food cost objetivo %<input type="number" step="0.1" value={draft.targetFoodCost * 100} onChange={(event) => setDraft({ ...draft, targetFoodCost: parseNumericInput(event.target.value) / 100 })} /></label>
              <label>Margen deseado %<input type="number" step="0.1" value={draft.desiredMargin * 100} onChange={(event) => setDraft({ ...draft, desiredMargin: parseNumericInput(event.target.value) / 100 })} /></label>
              <label>Factor indirectos<input type="number" step="0.01" value={draft.indirectCostShare} onChange={(event) => setDraft({ ...draft, indirectCostShare: parseNumericInput(event.target.value, 1) })} /></label>
              <label>Minutos armado final<input type="number" step="0.1" max={state.business.maxLeadershipMinutes} value={draft.laborMinutes} onChange={(event) => setDraft({ ...draft, laborMinutes: parseNumericInput(event.target.value) })} /></label>
              <label>
                Perfil laboral
                <select value={draft.laborProfileId} onChange={(event) => setDraft({ ...draft, laborProfileId: event.target.value })}>
                  {state.laborProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.roleName}</option>)}
                </select>
              </label>
            </div>
          </section>

          <section className="form-section">
            <h3>Montaje y control de calidad</h3>
            <div className="form-grid four">
              <label>Alergenos<input value={draft.allergens.join(', ')} onChange={(event) => setDraft({ ...draft, allergens: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} /></label>
              <label>Guarniciones<input value={draft.garnishes.join(', ')} onChange={(event) => setDraft({ ...draft, garnishes: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} /></label>
              <label>Decoraciones<input value={draft.decorations.join(', ')} onChange={(event) => setDraft({ ...draft, decorations: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} /></label>
              <label>Checklist de calidad<input value={draft.qualityChecklist.join(', ')} onChange={(event) => setDraft({ ...draft, qualityChecklist: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} /></label>
            </div>
          </section>
        </div>
        <div className="field-grid-header dish-lines">
          <span>Tipo</span>
          <span>Componente</span>
          <span>Cantidad</span>
          <span>Unidad</span>
          <span>Merma %</span>
          <span></span>
        </div>
        <div className="line-editor">
          {draft.directItems.map((component) => (
            <div className="line-grid six" key={component.id}>
              <select value={component.componentType} onChange={(event) => setDraft((current) => ({
                ...current,
                directItems: current.directItems.map((line) => line.id === component.id ? {
                  ...line,
                  componentType: event.target.value as DishComponent['componentType'],
                  refId:
                    event.target.value === 'baseRecipe'
                      ? state.baseRecipes[0]?.id ?? line.refId
                      : event.target.value === 'packaging'
                        ? state.packagingCosts[0]?.id ?? line.refId
                        : state.ingredients[0]?.id ?? line.refId,
                } : line),
              }))}>
                <option value="ingredient">Ingrediente</option>
                <option value="baseRecipe">Receta base</option>
                <option value="packaging">Packaging</option>
              </select>
              <select value={component.refId} onChange={(event) => setDraft((current) => ({
                ...current,
                directItems: current.directItems.map((line) => line.id === component.id ? { ...line, refId: event.target.value } : line),
              }))}>
                {component.componentType === 'ingredient' && state.ingredients.map((ingredient) => <option key={ingredient.id} value={ingredient.id}>{ingredient.name}</option>)}
                {component.componentType === 'baseRecipe' && state.baseRecipes.map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.name}</option>)}
                {component.componentType === 'packaging' && state.packagingCosts.map((packaging) => <option key={packaging.id} value={packaging.id}>{packaging.name}</option>)}
              </select>
              <input type="number" step="0.001" value={component.quantity} onChange={(event) => setDraft((current) => ({
                ...current,
                directItems: current.directItems.map((line) => line.id === component.id ? { ...line, quantity: parseNumericInput(event.target.value) } : line),
              }))} />
              <select value={component.unit} onChange={(event) => setDraft((current) => ({
                ...current,
                directItems: current.directItems.map((line) => line.id === component.id ? { ...line, unit: event.target.value as Unit } : line),
              }))}>
                {units.map((unit) => <option key={unit}>{unit}</option>)}
              </select>
              <input type="number" step="0.1" value={component.wastePercent} onChange={(event) => setDraft((current) => ({
                ...current,
                directItems: current.directItems.map((line) => line.id === component.id ? { ...line, wastePercent: parseNumericInput(event.target.value) } : line),
              }))} />
              <button className="icon-button" onClick={() => setDraft((current) => ({
                ...current,
                directItems: current.directItems.filter((line) => line.id !== component.id),
              }))}><Trash2 size={16} /></button>
            </div>
          ))}
        </div>

        <div className="summary-strip wide">
          <SummaryMetric label="Categoria" value={draftCategoryName} />
          <SummaryMetric label="Armado final" value={`${decimal.format(draft.laborMinutes)} min`} />
          <SummaryMetric label="Capacidad mensual plato" value={`${capacitySnapshot.monthlyCapacityPlates} platos`} />
          <SummaryMetric label="Costo fijo por plato" value={money.format(capacitySnapshot.fixedCostPerDish)} />
          <SummaryMetric label="Materia prima real" value={money.format(result.materialCost)} />
          <SummaryMetric label="Merma" value={money.format(result.wasteCost)} />
          <SummaryMetric label="Recetas base total" value={money.format(result.baseRecipeCost)} />
          <SummaryMetric label="MO recetas base" value={money.format(result.baseRecipeLaborCost)} />
          <SummaryMetric label="Indirectos recetas base" value={money.format(result.baseRecipeIndirectCost)} />
          <SummaryMetric label="Packaging" value={money.format(result.packagingCost)} />
          <SummaryMetric label="MO armado final" value={money.format(result.laborCost)} />
          <SummaryMetric label="Costos variables" value={money.format(result.variableCost)} />
          <SummaryMetric label="Fijos prorrateados" value={money.format(result.fixedAllocatedCost)} />
          <SummaryMetric label="Comisiones" value={money.format(result.commissionCost)} />
          <SummaryMetric label="Margen seguridad" value={money.format(result.safetyBufferCost)} />
          <SummaryMetric label="Subtotal formula" value={money.format(result.subtotalBeforeMargin)} />
          <SummaryMetric label="Costo operativo total" value={money.format(result.totalCost)} />
          <SummaryMetric label="Precio formula real" value={money.format(result.formulaPrice)} />
          <SummaryMetric label="Precio sugerido food cost" value={money.format(result.suggestedPriceByFoodCost)} />
          <SummaryMetric label="Precio sugerido margen" value={money.format(result.suggestedPriceByMargin)} />
          <SummaryMetric label="Precio recomendado" value={money.format(result.recommendedPrice)} />
          <SummaryMetric label="Precio cliente redondeado" value={money.format(roundedCustomerPrice)} />
          <SummaryMetric label="Food cost %" value={percent.format(result.foodCostPercent)} />
          <SummaryMetric label="Margen neto" value={percent.format(result.netMarginPercent)} />
        </div>
        <div className="alert-row info">
          <ClipboardList size={18} />
          <div>
            <strong>Formula activa del plato final</strong>
            <span>Precio final = (materia prima real + merma + mano de obra + costos variables + costos fijos prorrateados + comisiones + packaging + margen de seguridad) / (1 - margen deseado).</span>
          </div>
        </div>
        <div className="alert-row info">
          <Factory size={18} />
          <div>
            <strong>Capacidad usada para prorratear fijos</strong>
            <span>{`${capacitySnapshot.monthlyCapacityPlates} platos/mes a ${decimal.format(capacitySnapshot.assemblyMinutes)} min por plato, sobre ${decimal.format(capacitySnapshot.practicalMinutes)} min utiles mensuales (${percent.format(capacitySnapshot.practicalFactor)} de la capacidad disponible).`}</span>
          </div>
        </div>
        <div className={`alert-row ${assemblyPolicy.tone === 'danger' ? 'critical' : assemblyPolicy.tone === 'warning' ? 'warning' : 'info'}`}>
          <AlertTriangle size={18} />
          <div>
            <strong>{assemblyPolicy.text}</strong>
            <span>{assemblyPolicy.detail}</span>
          </div>
        </div>
        <div className={`alert-row ${laborPolicy.tone === 'danger' ? 'critical' : laborPolicy.tone === 'warning' ? 'warning' : 'info'}`}>
          <AlertTriangle size={18} />
          <div>
            <strong>{laborPolicy.text}</strong>
            <span>{laborPolicy.detail}</span>
          </div>
        </div>
        <section className="recipe-cost-breakdown">
          <div className="recipe-breakdown-header">
            <h3>Desglose del plato seleccionado</h3>
          </div>
          <div className="table-shell compact-shell">
            <table>
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Componente</th>
                  <th>Cantidad</th>
                  <th>Costo unitario</th>
                  <th>Costo linea</th>
                </tr>
              </thead>
              <tbody>
                {result.componentLines.map((line) => (
                  <>
                    <tr key={line.componentId}>
                      <td>{line.componentType === 'baseRecipe' ? 'Receta base' : line.componentType === 'ingredient' ? 'Ingrediente' : 'Packaging'}</td>
                      <td>{line.componentName}</td>
                      <td>{`${decimal.format(line.quantity)} ${line.unit}`}</td>
                      <td>{money.format(line.unitCost)}</td>
                      <td>{money.format(line.lineCost)}</td>
                    </tr>
                    {line.nestedLines?.map((nestedLine) => (
                      <tr key={`${line.componentId}-${nestedLine.ingredientId}`} className="nested-cost-row">
                        <td>Detalle receta</td>
                        <td>{nestedLine.ingredientName}</td>
                        <td>{`${decimal.format(nestedLine.quantity)} ${nestedLine.unit}`}</td>
                        <td>{`${money.format(nestedLine.usefulUnitCost)} / ${nestedLine.unit}`}</td>
                        <td>{money.format(nestedLine.lineCost)}</td>
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="recipe-cost-breakdown">
          <div className="recipe-breakdown-header">
            <h3>Desglose de formula del precio real</h3>
          </div>
          <div className="table-shell compact-shell">
            <table>
              <thead>
                <tr>
                  <th>Componente</th>
                  <th>Valor</th>
                  <th>Base de calculo</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Materia prima real</td><td>{money.format(result.materialCost)}</td><td>Ingredientes directos + insumos materiales contenidos en recetas base.</td></tr>
                <tr><td>Merma</td><td>{money.format(result.wasteCost)}</td><td>Merma porcentual de ingredientes directos y componentes de receta base.</td></tr>
                <tr><td>Mano de obra armado final</td><td>{money.format(result.laborCost)}</td><td>{`${decimal.format(draft.laborMinutes)} min de armado final con perfil ${state.laborProfiles.find((item) => item.id === draft.laborProfileId)?.roleName ?? 'sin perfil'}.`}</td></tr>
                <tr><td>Costos variables</td><td>{money.format(result.variableCost)}</td><td>Indirectos variables convertidos a costo por minuto de cocina util.</td></tr>
                <tr><td>Costos fijos prorrateados</td><td>{money.format(result.fixedAllocatedCost)}</td><td>{`${money.format(capacitySnapshot.fixedStructureMonthlyCost)} / ${capacitySnapshot.monthlyCapacityPlates} platos de capacidad mensual util.`}</td></tr>
                <tr><td>Comisiones</td><td>{money.format(result.commissionCost)}</td><td>Costos indirectos marcados como comision.</td></tr>
                <tr><td>Packaging</td><td>{money.format(result.packagingCost)}</td><td>Elementos de empaque asociados al plato.</td></tr>
                <tr><td>Margen de seguridad</td><td>{money.format(result.safetyBufferCost)}</td><td>Buffer tecnico del 3% sobre el subtotal operativo.</td></tr>
                <tr><td>Subtotal antes de margen</td><td>{money.format(result.subtotalBeforeMargin)}</td><td>Base completa de costos del plato.</td></tr>
                <tr><td>Precio por formula</td><td>{money.format(result.formulaPrice)}</td><td>{`Subtotal / (1 - ${percent.format(draft.desiredMargin)})`}</td></tr>
                <tr><td>Precio recomendado final</td><td>{money.format(result.recommendedPrice)}</td><td>Mayor entre precio por formula y precio exigido por food cost objetivo.</td></tr>
                <tr><td>Precio cliente redondeado</td><td>{money.format(roundedCustomerPrice)}</td><td>Precio final sugerido en carta, redondeado hacia arriba al siguiente tramo de $100.</td></tr>
              </tbody>
            </table>
          </div>
        </section>
        {dishIngredients.length > 0 && (
          <section className="form-section">
            <h3>Precios de productos usados en este plato</h3>
            <div className="form-grid four">
              <label>
                Ingrediente
                <select
                  value={priceDraft.ingredientId}
                  onChange={(event) => {
                    const ingredient = dishIngredients.find((item) => item.id === event.target.value);
                    setPriceDraft((current) => ({
                      ...current,
                      ingredientId: event.target.value,
                      supplierId: ingredient?.supplierId ?? current.supplierId,
                      pricePurchase: ingredient?.purchasePrice ?? current.pricePurchase,
                    }));
                  }}
                >
                  {dishIngredients.map((ingredient) => <option key={ingredient.id} value={ingredient.id}>{ingredient.name}</option>)}
                </select>
              </label>
              <label>
                Proveedor
                <select
                  value={priceDraft.supplierId}
                  onChange={(event) => setPriceDraft((current) => ({ ...current, supplierId: event.target.value }))}
                >
                  {state.suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                </select>
              </label>
              <label>
                Fecha
                <input type="date" value={priceDraft.date} onChange={(event) => setPriceDraft((current) => ({ ...current, date: event.target.value }))} />
              </label>
              <label>
                Nuevo precio compra
                <input
                  type="number"
                  step="0.001"
                  value={priceDraft.pricePurchase}
                  onChange={(event) => setPriceDraft((current) => ({ ...current, pricePurchase: parseNumericInput(event.target.value) }))}
                />
              </label>
            </div>
            <div className="summary-strip compact">
              <SummaryMetric label="Precio actual" value={money.format(selectedPriceIngredient?.purchasePrice ?? 0)} />
              <SummaryMetric
                label="Costo util actual"
                value={
                  selectedPriceIngredient
                    ? `${money.format(selectedPriceIngredient.usefulUnitCost)} / ${selectedPriceIngredient.useUnit}`
                    : money.format(0)
                }
              />
              <SummaryMetric
                label="Variacion"
                value={
                  selectedPriceTrend
                    ? `${selectedPriceTrend.delta >= 0 ? '+' : ''}${money.format(selectedPriceTrend.delta)} (${percent.format(selectedPriceTrend.percentDelta)})`
                    : 'Sin historico'
                }
              />
            </div>
            <div className="toolbar">
              <button
                className="primary-button"
                disabled={!canManage || !priceDraft.ingredientId || !priceDraft.supplierId}
                onClick={() => actions.registerIngredientPrice(priceDraft)}
              >
                <Save size={18} /> Actualizar precio del insumo
              </button>
            </div>
          </section>
        )}
        <button className="primary-button" disabled={!canSaveDish} onClick={() => {
          actions.upsertDish(draft);
          setDraft(emptyDish(state));
        }}>
          <Save size={18} /> Guardar plato final
        </button>
      </section>

      <DataTable
        title="Platos por tiempo y costo"
        headers={['Plato', 'Tiempo', 'Politica tiempo', 'Costo cocina', 'Costo operativo', 'Precio recomendado', 'Precio cliente', 'Food cost', 'Margen neto', '']}
        rows={state.dishes.map((dish) => {
          const dishResult = calculateDishCost(state, dish);
          const dishPolicy = getDishAssemblyPolicy(state, dish.laborMinutes);
          const roundedDishPrice = roundPriceForCustomer(dishResult.recommendedPrice);
          return [
            <button className="table-link-button" key={`${dish.id}-name`} onClick={() => setDraft(dish)}>{dish.name}</button>,
            `${decimal.format(dish.laborMinutes)} min`,
            <StatusBadge key={`${dish.id}-policy`} text={dishPolicy.text} tone={dishPolicy.tone} />,
            money.format(dishResult.directCost),
            money.format(dishResult.totalCost),
            money.format(dishResult.recommendedPrice),
            money.format(roundedDishPrice),
            percent.format(dishResult.foodCostPercent),
            percent.format(dishResult.netMarginPercent),
            <div className="row-actions" key={`${dish.id}-actions`}>
              <button className="icon-button" onClick={() => setDraft(dish)} title="Ver desglose"><ClipboardList size={15} /></button>
              <button className="icon-button" onClick={() => actions.removeDish(dish.id)}><Trash2 size={15} /></button>
            </div>,
          ];
        })}
      />
      {state.menus.length > 0 && (
        <DataTable
          title="Menus separados por tiempo"
          headers={['Menu', 'Aperitivo', 'Entrada', 'Principal', 'Postre', 'Precio menu']}
          rows={state.menus.map((menu) => {
            const dishes = menu.dishIds
              .map((dishId) => state.dishes.find((dish) => dish.id === dishId))
              .filter((dish): dish is Dish => Boolean(dish));
            const getDishName = (categoryName: string) =>
              dishes.find((dish) => state.categories.find((category) => category.id === dish.categoryId)?.name === categoryName)?.name ?? '-';
            const roundedMenuPrice = roundPriceForCustomer(dishes.reduce((sum, dish) => sum + roundPriceForCustomer(calculateDishCost(state, dish).recommendedPrice), 0));
            return [
              menu.name,
              getDishName('Amuse bouche'),
              getDishName('Entradas'),
              getDishName('Fondos'),
              getDishName('Postres'),
              money.format(roundedMenuPrice),
            ];
          })}
        />
      )}
    </section>
  );
}

function ProcurementModule({
  state,
  actions,
  canManage,
}: {
  state: ReturnType<typeof useLocalStore>['state'];
  actions: ReturnType<typeof useLocalStore>['actions'];
  canManage: boolean;
}) {
  const [supplierDraft, setSupplierDraft] = useState<Supplier>(emptySupplier);
  const [purchaseDraft, setPurchaseDraft] = useState<Purchase>(() => emptyPurchase(state));

  return (
    <section className="content-stack">
      <div className="dashboard-grid">
        <section className="panel">
          <PanelHeader title="Proveedor" />
          <div className="form-grid two">
            <label>Nombre<input value={supplierDraft.name} onChange={(event) => setSupplierDraft({ ...supplierDraft, name: event.target.value })} /></label>
            <label>RUT<input value={supplierDraft.rut} onChange={(event) => setSupplierDraft({ ...supplierDraft, rut: event.target.value })} /></label>
            <label>Contacto<input value={supplierDraft.contactName} onChange={(event) => setSupplierDraft({ ...supplierDraft, contactName: event.target.value })} /></label>
            <label>Telefono<input value={supplierDraft.phone} onChange={(event) => setSupplierDraft({ ...supplierDraft, phone: event.target.value })} /></label>
            <label>Email<input value={supplierDraft.email} onChange={(event) => setSupplierDraft({ ...supplierDraft, email: event.target.value })} /></label>
            <label>Categoria<input value={supplierDraft.productCategory} onChange={(event) => setSupplierDraft({ ...supplierDraft, productCategory: event.target.value })} /></label>
            <label>Pago<input value={supplierDraft.paymentTerms} onChange={(event) => setSupplierDraft({ ...supplierDraft, paymentTerms: event.target.value })} /></label>
            <label>Lead time<input type="number" value={supplierDraft.leadTimeDays} onChange={(event) => setSupplierDraft({ ...supplierDraft, leadTimeDays: parseNumericInput(event.target.value) })} /></label>
          </div>
          <button className="primary-button" disabled={!canManage || !supplierDraft.name} onClick={() => {
            actions.upsertSupplier(supplierDraft);
            setSupplierDraft(emptySupplier());
          }}>
            <Save size={18} /> Guardar proveedor
          </button>
        </section>

        <section className="panel">
          <PanelHeader title="Orden de compra" />
          <div className="form-grid two">
            <label>
              Proveedor
              <select value={purchaseDraft.supplierId} onChange={(event) => setPurchaseDraft({ ...purchaseDraft, supplierId: event.target.value })}>
                {state.suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
              </select>
            </label>
            <label>Fecha<input value={purchaseDraft.orderedAt} onChange={(event) => setPurchaseDraft({ ...purchaseDraft, orderedAt: event.target.value })} /></label>
          </div>
          <div className="line-editor">
            {purchaseDraft.items.map((item) => (
                <div className="line-grid six" key={item.id}>
                  <select value={item.ingredientId} onChange={(event) => setPurchaseDraft((current) => ({
                    ...current,
                    items: current.items.map((line) => line.id === item.id ? { ...line, ingredientId: event.target.value } : line),
                  }))}>
                    {state.ingredients.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
                  </select>
                  <input type="number" step="0.001" value={item.quantity} onChange={(event) => setPurchaseDraft((current) => ({
                    ...current,
                    items: current.items.map((line) => line.id === item.id ? { ...line, quantity: parseNumericInput(event.target.value) } : line),
                  }))} />
                  <select value={item.unit} onChange={(event) => setPurchaseDraft((current) => ({
                    ...current,
                    items: current.items.map((line) => line.id === item.id ? { ...line, unit: event.target.value as Unit } : line),
                  }))}>
                    {units.map((unit) => <option key={unit}>{unit}</option>)}
                  </select>
                  <input type="number" step="0.001" value={item.unitPrice} onChange={(event) => setPurchaseDraft((current) => ({
                    ...current,
                    items: current.items.map((line) => line.id === item.id ? { ...line, unitPrice: parseNumericInput(event.target.value) } : line),
                  }))} />
                  <input type="number" step="0.001" value={item.receivedQuantity} onChange={(event) => setPurchaseDraft((current) => ({
                    ...current,
                    items: current.items.map((line) => line.id === item.id ? { ...line, receivedQuantity: parseNumericInput(event.target.value) } : line),
                  }))} />
                  <button className="icon-button" onClick={() => setPurchaseDraft((current) => ({
                    ...current,
                    items: current.items.filter((line) => line.id !== item.id),
                  }))}><Trash2 size={16} /></button>
                </div>
            ))}
          </div>
          <div className="toolbar">
            <button className="secondary-button" onClick={() => setPurchaseDraft((current) => ({
              ...current,
              items: [...current.items, {
                id: createId('poi'),
                ingredientId: state.ingredients[0]?.id ?? '',
                quantity: 0,
                unit: state.ingredients[0]?.purchaseUnit ?? 'kg',
                unitPrice: state.ingredients[0]?.purchasePrice ?? 0,
                receivedQuantity: 0,
              }],
            }))}>Agregar item</button>
            <button className="primary-button" disabled={!canManage || purchaseDraft.items.length === 0} onClick={() => {
              actions.recordPurchase(purchaseDraft);
              setPurchaseDraft(emptyPurchase(state));
            }}>
              <Truck size={18} /> Registrar compra
            </button>
          </div>
        </section>
      </div>

      <DataTable
        title="Comparativo de proveedores"
        headers={['Proveedor', 'Categoria', 'Pago', 'Lead time', 'Calidad', 'Cumplimiento']}
        rows={state.suppliers.map((supplier) => [
          supplier.name,
          supplier.productCategory,
          supplier.paymentTerms,
          `${supplier.leadTimeDays} dias`,
          `${supplier.qualityScore}/5`,
          `${supplier.deliveryScore}/5`,
        ])}
      />
    </section>
  );
}

function InventoryModule({
  state,
  actions,
  canManage,
}: {
  state: ReturnType<typeof useLocalStore>['state'];
  actions: ReturnType<typeof useLocalStore>['actions'];
  canManage: boolean;
}) {
  const summary = useMemo(() => getWarehouseAuditSummary(state), [state]);
  const warehouseAudits = state.warehouseAudits ?? [];
  const draftPurchases = state.purchases.filter((purchase) => purchase.status === 'draft');
  const [auditDate, setAuditDate] = useState(new Date().toISOString().slice(0, 10));
  const [zoneFilter, setZoneFilter] = useState('Todas');
  const [statusFilter, setStatusFilter] = useState<'Todos' | 'Solo alertas' | 'Solo checkeados'>('Todos');
  const [auditRows, setAuditRows] = useState(() => state.ingredients.map((ingredient) => createWarehouseAuditRow(ingredient)));
  useEffect(() => {
    setAuditRows(state.ingredients.map((ingredient) => createWarehouseAuditRow(ingredient)));
  }, [state.ingredients]);

  const countsByZone = state.ingredients.reduce<Record<string, { items: number; lowStock: number; tempIssues: number }>>((acc, ingredient) => {
    const zone = ingredient.storageLocation.split('/')[0]?.trim() || 'Sin zona';
    if (!acc[zone]) {
      acc[zone] = { items: 0, lowStock: 0, tempIssues: 0 };
    }
    acc[zone].items += 1;
    if (ingredient.currentStock <= ingredient.minStock) acc[zone].lowStock += 1;
    if (ingredient.currentStorageTemp < ingredient.recommendedMinTemp || ingredient.currentStorageTemp > ingredient.recommendedMaxTemp) {
      acc[zone].tempIssues += 1;
    }
    return acc;
  }, {});
  const fifoQueue = [...state.ingredients].sort((a, b) => a.receivedDate.localeCompare(b.receivedDate));
  const zoneOptions = ['Todas', ...Object.keys(countsByZone)];
  const rowsByIngredient = new Map(auditRows.map((row) => [row.ingredientId, row]));
  const filteredItems = summary.items.filter((item) => {
    const zone = item.ingredient.storageLocation.split('/')[0]?.trim() || 'Sin zona';
    const row = rowsByIngredient.get(item.ingredient.id);
    if (zoneFilter !== 'Todas' && zone !== zoneFilter) return false;
    if (statusFilter === 'Solo alertas' && item.alerts.length === 0) return false;
    if (statusFilter === 'Solo checkeados' && !row?.checked) return false;
    return true;
  });
  const checkedCount = auditRows.filter((row) => row.checked).length;
  const rowsWithAlerts = filteredItems.filter((item) => item.alerts.length > 0).length;
  const updateAuditRow = <K extends keyof typeof auditRows[number]>(ingredientId: string, key: K, value: (typeof auditRows[number])[K]) => {
    setAuditRows((current) => current.map((row) => row.ingredientId === ingredientId ? { ...row, [key]: value } : row));
  };
  const saveCheckedAuditRows = () => {
    auditRows
      .filter((row) => row.checked)
      .forEach((row) => {
        actions.recordWarehouseAudit({
          id: createId('audit'),
          ingredientId: row.ingredientId,
          checkedAt: auditDate,
          checkedBy: row.checkedBy,
          countedStock: row.countedStock,
          stockUnit: row.stockUnit,
          storageTemp: row.storageTemp,
          location: row.location,
          notes: row.notes,
        });
      });
    setAuditRows(state.ingredients.map((ingredient) => createWarehouseAuditRow(ingredient)));
  };

  return (
    <section className="content-stack">
      <div className="kpi-grid">
        <KpiCard title="Items auditados" value={String(summary.totalItems)} icon={Boxes} />
        <KpiCard title="Stock bajo" value={String(summary.lowStockCount)} icon={AlertTriangle} />
        <KpiCard title="Quiebres proyectados" value={String(summary.projectedBreakCount)} icon={TrendingDown} />
        <KpiCard title="Temperaturas fuera de rango" value={String(summary.temperatureIssueCount)} icon={Scale} />
        <KpiCard title="Cerca de vencimiento" value={String(summary.nearExpiryCount)} icon={ClipboardList} />
        <KpiCard title="Solicitudes de compra" value={String(summary.openDraftPurchases)} icon={ShoppingCart} />
      </div>

      <div className="dashboard-grid">
        <section className="panel">
          <PanelHeader title="Planilla de auditoria" />
          <div className="audit-toolbar">
            <label>
              Fecha auditoria
              <input type="date" value={auditDate} onChange={(event) => setAuditDate(event.target.value)} />
            </label>
            <label>
              Zona
              <select value={zoneFilter} onChange={(event) => setZoneFilter(event.target.value)}>
                {zoneOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label>
              Vista
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
                <option>Todos</option>
                <option>Solo alertas</option>
                <option>Solo checkeados</option>
              </select>
            </label>
            <div className="audit-inline-metrics">
              <span>{`${filteredItems.length} filas`}</span>
              <span>{`${checkedCount} checkeadas`}</span>
              <span>{`${rowsWithAlerts} con alerta`}</span>
            </div>
          </div>
          <div className="audit-sheet-wrap">
            <table className="audit-sheet">
              <thead>
                <tr>
                  <th>OK</th>
                  <th>ID</th>
                  <th>Producto</th>
                  <th>Categoria</th>
                  <th>Color</th>
                  <th>Temp obj.</th>
                  <th>Temp real</th>
                  <th>Stock sist.</th>
                  <th>Stock contado</th>
                  <th>Min.</th>
                  <th>Ubicacion</th>
                  <th>Responsable</th>
                  <th>Notas</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const row = rowsByIngredient.get(item.ingredient.id) ?? createWarehouseAuditRow(item.ingredient);
                  return (
                    <tr key={item.ingredient.id}>
                      <td>
                        <input
                          className="audit-checkbox"
                          type="checkbox"
                          checked={row.checked}
                          onChange={(event) => updateAuditRow(item.ingredient.id, 'checked', event.target.checked)}
                        />
                      </td>
                      <td>{item.ingredient.internalCode || '-'}</td>
                      <td>
                        <div className="audit-product-cell">
                          <strong>{item.ingredient.name}</strong>
                        </div>
                      </td>
                      <td>{item.sanitaryCategory?.name ?? item.category?.name ?? '-'}</td>
                      <td>
                        <span
                          className="audit-color-dot"
                          style={{ backgroundColor: item.ingredient.colorHex }}
                          title={item.ingredient.colorName}
                        />
                      </td>
                      <td>{`${item.ingredient.recommendedMinTemp} a ${item.ingredient.recommendedMaxTemp} C`}</td>
                      <td>
                        <input type="number" step="0.1" value={row.storageTemp} onChange={(event) => updateAuditRow(item.ingredient.id, 'storageTemp', parseNumericInput(event.target.value))} />
                      </td>
                      <td>{`${decimal.format(item.ingredient.currentStock)} ${item.ingredient.purchaseUnit}`}</td>
                      <td>
                        <input type="number" step="0.001" value={row.countedStock} onChange={(event) => updateAuditRow(item.ingredient.id, 'countedStock', parseNumericInput(event.target.value))} />
                      </td>
                      <td>{`${decimal.format(item.ingredient.minStock)} ${item.ingredient.purchaseUnit}`}</td>
                      <td>
                        <input value={row.location} onChange={(event) => updateAuditRow(item.ingredient.id, 'location', event.target.value)} />
                      </td>
                      <td>
                        <input value={row.checkedBy} onChange={(event) => updateAuditRow(item.ingredient.id, 'checkedBy', event.target.value)} />
                      </td>
                      <td>
                        <input value={row.notes} onChange={(event) => updateAuditRow(item.ingredient.id, 'notes', event.target.value)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="toolbar">
            <button
              className="primary-button"
              disabled={!canManage || checkedCount === 0}
              onClick={saveCheckedAuditRows}
            >
              <Save size={18} /> Guardar auditoria seleccionada
            </button>
          </div>
        </section>

        <section className="panel">
          <PanelHeader title="Automatizacion y alertas" />
          <div className="stack-list">
            {summary.items
              .filter((item) => item.alerts.length > 0)
              .slice(0, 6)
              .map((item) => (
                <div className="record-row" key={item.ingredient.id}>
                  <strong>{item.ingredient.name}</strong>
                  <span>{item.alerts.join(' · ')}</span>
                </div>
              ))}
          </div>
          <div className="metric-table">
            {summary.items
              .filter((item) => item.suggestedOrderQty > 0)
              .slice(0, 4)
              .map((item) => (
                <div className="metric-row" key={`${item.ingredient.id}-req`}>
                  <span>{item.ingredient.name}</span>
                  <strong>{`${decimal.format(item.suggestedOrderQty)} ${item.ingredient.purchaseUnit}`}</strong>
                </div>
              ))}
          </div>
          <p className="helper-text">La proyeccion combina consumo historico por ventas y produccion pendiente para anticipar quiebres y generar compras borrador. La rotacion operativa visible en este modulo usa FIFO.</p>
        </section>
      </div>

      <div className="dashboard-grid">
        <section className="panel">
          <PanelHeader title="Conteo ciclico por zona" />
          <DataTable
            headers={['Zona', 'Items', 'Stock bajo', 'Temp fuera de rango']}
            rows={Object.entries(countsByZone).map(([zone, metrics]) => [
              zone,
              String(metrics.items),
              String(metrics.lowStock),
              String(metrics.tempIssues),
            ])}
          />
        </section>

        <section className="panel">
          <PanelHeader title="Rotacion FIFO" />
          <DataTable
            headers={['Prioridad', 'Producto', 'Ingreso', 'Lote', 'Ubicacion']}
            rows={fifoQueue.slice(0, 8).map((ingredient, index) => [
              `#${index + 1}`,
              ingredient.name,
              ingredient.receivedDate || '-',
              ingredient.lotCode || '-',
              ingredient.storageLocation || '-',
            ])}
          />
        </section>
      </div>

      <DataTable
        title="Control de stock y auditoria"
        headers={['ID', 'Producto', 'Categoria', 'Temperatura', 'Stock', 'Proyeccion', 'Vencimiento', 'Alertas', 'Accion']}
        rows={summary.items.map((item) => [
          item.ingredient.internalCode || '-',
          <div key={`${item.ingredient.id}-name`}>
            <strong>{item.ingredient.name}</strong>
            <div className="helper-text">{item.ingredient.storageLocation}</div>
          </div>,
          <ColorChip key={`${item.ingredient.id}-category`} text={item.sanitaryCategory?.name ?? item.category?.name ?? 'Sin categoria'} colorHex={item.ingredient.colorHex} />,
          <div key={`${item.ingredient.id}-temp`}>
            <strong>{`${decimal.format(item.ingredient.currentStorageTemp)} C`}</strong>
            <div className="helper-text">{`${item.ingredient.recommendedMinTemp} a ${item.ingredient.recommendedMaxTemp} C`}</div>
          </div>,
          <div key={`${item.ingredient.id}-stock`}>
            <strong>{`${decimal.format(item.ingredient.currentStock)} ${item.ingredient.purchaseUnit}`}</strong>
            <div className="helper-text">{`Min ${decimal.format(item.ingredient.minStock)} · Max ${decimal.format(item.ingredient.maxStock)}`}</div>
          </div>,
          <div key={`${item.ingredient.id}-proj`}>
            <strong>{Number.isFinite(item.projectedDaysRemaining) ? `${decimal.format(item.projectedDaysRemaining)} dias` : 'Sin consumo'}</strong>
            <div className="helper-text">{`Lead time: ${decimal.format(item.projectedStockAtLeadTime)} ${item.ingredient.purchaseUnit}`}</div>
          </div>,
          item.ingredient.expiryDate || '-',
          <div className="mini-badges" key={`${item.ingredient.id}-alerts`}>
            {item.alerts.length === 0
              ? <StatusBadge tone="ok" text="Controlado" />
              : item.alerts.slice(0, 3).map((alert) => (
                <StatusBadge
                  key={`${item.ingredient.id}-${alert}`}
                  tone={alert.includes('Temperatura') || alert.includes('Zona') ? 'danger' : alert.includes('quebre') || alert.includes('Stock') ? 'warning' : 'warning'}
                  text={alert}
                />
              ))}
          </div>,
          <div className="row-actions" key={`${item.ingredient.id}-action`}>
            <button
              className="secondary-button compact"
              disabled={item.suggestedOrderQty <= 0}
              onClick={() => actions.createRestockRequest({
                ingredientId: item.ingredient.id,
                quantity: Number(item.suggestedOrderQty.toFixed(3)),
                requestedBy: rowsByIngredient.get(item.ingredient.id)?.checkedBy || 'Bodega',
                notes: `Solicitud automatica desde auditoria. Stock proyectado a lead time: ${decimal.format(item.projectedStockAtLeadTime)} ${item.ingredient.purchaseUnit}.`,
              })}
            >
              Solicitar compra
            </button>
          </div>,
        ])}
      />

      <DataTable
        title="Solicitudes de compra automáticas"
        headers={['Fecha', 'Proveedor', 'Ingrediente', 'Cantidad', 'Estado', 'Notas', 'Accion']}
        rows={draftPurchases.map((purchase) => [
          purchase.orderedAt,
          state.suppliers.find((item) => item.id === purchase.supplierId)?.name ?? '-',
          purchase.items.map((item) => state.ingredients.find((ingredient) => ingredient.id === item.ingredientId)?.name ?? '-').join(', '),
          purchase.items.map((item) => `${decimal.format(item.quantity)} ${item.unit}`).join(' · '),
          'Solicitud',
          purchase.notes,
          <div className="row-actions" key={`${purchase.id}-approve`}>
            <button className="secondary-button compact" onClick={() => actions.updatePurchaseStatus(purchase.id, 'partial')}>
              Aprobar
            </button>
          </div>,
        ])}
      />

      <DataTable
        title="Auditorias recientes"
        headers={['Fecha', 'Producto', 'Responsable', 'Stock auditado', 'Temperatura', 'Ubicacion', 'Notas']}
        rows={warehouseAudits.slice(0, 10).map((audit) => [
          audit.checkedAt,
          state.ingredients.find((item) => item.id === audit.ingredientId)?.name ?? '-',
          audit.checkedBy,
          `${decimal.format(audit.countedStock)} ${audit.stockUnit}`,
          `${decimal.format(audit.storageTemp)} C`,
          audit.location,
          audit.notes || '-',
        ])}
      />

      <DataTable
        title="Movimientos recientes"
        headers={['Fecha', 'Ingrediente', 'Tipo', 'Cantidad', 'Lote', 'Ubicacion']}
        rows={state.inventoryMovements.slice(-12).reverse().map((movement: InventoryMovement) => [
          movement.date,
          state.ingredients.find((item) => item.id === movement.ingredientId)?.name ?? '-',
          movement.type,
          `${decimal.format(movement.quantity)} ${movement.unit}`,
          movement.lot,
          movement.location,
        ])}
      />
    </section>
  );
}

function WasteModule({
  state,
  actions,
  canManage,
}: {
  state: ReturnType<typeof useLocalStore>['state'];
  actions: ReturnType<typeof useLocalStore>['actions'];
  canManage: boolean;
}) {
  const [draft, setDraft] = useState<WasteRecord>(() => emptyWaste(state));
  const wasteValue = state.wasteRecords.reduce((sum, item) => sum + item.costImpact, 0);

  return (
    <section className="content-stack">
      <section className="panel">
        <PanelHeader title="Registro de mermas" />
        <div className="form-grid four">
          <label>
            Producto
            <select value={draft.ingredientId} onChange={(event) => {
              const ingredient = state.ingredients.find((item) => item.id === event.target.value);
              setDraft({ ...draft, ingredientId: event.target.value, unit: ingredient?.purchaseUnit ?? 'kg' });
            }}>
              {state.ingredients.map((ingredient) => <option key={ingredient.id} value={ingredient.id}>{ingredient.name}</option>)}
            </select>
          </label>
          <label>Cantidad<input type="number" step="0.001" value={draft.quantity} onChange={(event) => setDraft({ ...draft, quantity: parseNumericInput(event.target.value) })} /></label>
          <label>
            Unidad
            <select value={draft.unit} onChange={(event) => setDraft({ ...draft, unit: event.target.value as Unit })}>
              {units.map((unit) => <option key={unit}>{unit}</option>)}
            </select>
          </label>
          <label>
            Tipo
            <select value={draft.reasonType} onChange={(event) => setDraft({ ...draft, reasonType: event.target.value as WasteRecord['reasonType'] })}>
              <option>Operacional</option>
              <option>Produccion</option>
              <option>Vencimiento</option>
              <option>Manipulacion</option>
              <option>Coccion</option>
              <option>Limpieza</option>
              <option>Error humano</option>
              <option>Devolucion</option>
            </select>
          </label>
          <label>Responsable<input value={draft.responsible} onChange={(event) => setDraft({ ...draft, responsible: event.target.value })} /></label>
          <label>Fecha<input value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></label>
        </div>
        <button className="primary-button" disabled={!canManage} onClick={() => {
          const ingredient = state.ingredients.find((item) => item.id === draft.ingredientId);
          const costImpact = ingredient ? ingredient.usefulUnitCost * draft.quantity : 0;
          actions.recordWaste({ ...draft, costImpact });
          setDraft(emptyWaste(state));
        }}>
          <Save size={18} /> Registrar merma
        </button>
      </section>

      <div className="kpi-grid three">
        <KpiCard title="Merma valorizada" value={money.format(wasteValue)} icon={TrendingDown} />
        <KpiCard title="Casos registrados" value={String(state.wasteRecords.length)} icon={AlertTriangle} />
        <KpiCard title="Responsables activos" value={String(new Set(state.wasteRecords.map((item) => item.responsible)).size)} icon={Users} />
      </div>
      <DataTable
        headers={['Fecha', 'Ingrediente', 'Cantidad', 'Tipo', 'Responsable', 'Costo']}
        rows={state.wasteRecords.map((record) => [
          record.date,
          state.ingredients.find((item) => item.id === record.ingredientId)?.name ?? '-',
          `${decimal.format(record.quantity)} ${record.unit}`,
          record.reasonType,
          record.responsible,
          money.format(record.costImpact),
        ])}
      />
    </section>
  );
}

function ProductionModule({
  state,
  actions,
  canManage,
}: {
  state: ReturnType<typeof useLocalStore>['state'];
  actions: ReturnType<typeof useLocalStore>['actions'];
  canManage: boolean;
}) {
  const [draft, setDraft] = useState<ProductionPlan>(() => emptyProduction(state));
  const responsibleOptions = Array.from(
    new Set(
      [...state.laborProfiles.map((profile) => profile.roleName), ...state.productionPlans.map((plan) => plan.responsible)]
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
  const totalPlannedUnits = draft.items.reduce((sum, item) => sum + item.quantity, 0);
  const baseRecipeCount = draft.items.filter((item) => item.refType === 'baseRecipe').length;
  const dishCount = draft.items.filter((item) => item.refType === 'dish').length;

  return (
    <section className="content-stack">
      <section className="panel">
        <PanelHeader title="Planificacion de produccion" />
        <div className="form-section-stack">
          <section className="form-section">
            <h3>Cabecera del plan</h3>
            <div className="form-grid four">
              <label>Nombre<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
              <label>Fecha<input type="date" value={draft.scheduledFor} onChange={(event) => setDraft({ ...draft, scheduledFor: event.target.value })} /></label>
              <label>
                Responsable
                <select value={draft.responsible} onChange={(event) => setDraft({ ...draft, responsible: event.target.value })}>
                  <option value="">Seleccionar responsable</option>
                  {responsibleOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label>
                Estado
                <select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as ProductionPlan['status'] })}>
                  <option>Pendiente</option>
                  <option>En produccion</option>
                  <option>Finalizado</option>
                  <option>Cancelado</option>
                </select>
              </label>
            </div>
          </section>

          <section className="form-section">
            <h3>Lineas de produccion</h3>
            {draft.items.length > 0 && (
              <div className="field-grid-header production-lines">
                <span>Tipo</span>
                <span>Preparacion</span>
                <span>Cantidad</span>
                <span></span>
              </div>
            )}
            <div className="line-editor">
              {draft.items.map((item) => (
                <div className="line-grid production" key={item.id}>
                  <select value={item.refType} onChange={(event) => setDraft((current) => ({
                    ...current,
                    items: current.items.map((line) => line.id === item.id ? {
                      ...line,
                      refType: event.target.value as typeof item.refType,
                      refId: event.target.value === 'baseRecipe'
                        ? state.baseRecipes[0]?.id ?? line.refId
                        : state.dishes[0]?.id ?? line.refId,
                    } : line),
                  }))}>
                    <option value="baseRecipe">Receta base</option>
                    <option value="dish">Plato final</option>
                  </select>
                  <select value={item.refId} onChange={(event) => setDraft((current) => ({
                    ...current,
                    items: current.items.map((line) => line.id === item.id ? { ...line, refId: event.target.value } : line),
                  }))}>
                    {item.refType === 'baseRecipe' && state.baseRecipes.map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.name}</option>)}
                    {item.refType === 'dish' && state.dishes.map((dish) => <option key={dish.id} value={dish.id}>{dish.name}</option>)}
                  </select>
                  <input type="number" step="0.001" min="0" value={item.quantity} onChange={(event) => setDraft((current) => ({
                    ...current,
                    items: current.items.map((line) => line.id === item.id ? { ...line, quantity: parseNumericInput(event.target.value) } : line),
                  }))} />
                  <button className="icon-button" onClick={() => setDraft((current) => ({
                    ...current,
                    items: current.items.filter((line) => line.id !== item.id),
                  }))}><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
            <p className="helper-text">Cada linea representa una preparacion a producir, ya sea una receta base o un plato final, con su cantidad planificada.</p>
          </section>
        </div>
        <div className="summary-strip">
          <SummaryMetric label="Lineas del plan" value={String(draft.items.length)} />
          <SummaryMetric label="Unidades planificadas" value={decimal.format(totalPlannedUnits)} />
          <SummaryMetric label="Mix de produccion" value={`${baseRecipeCount} base · ${dishCount} platos`} />
        </div>
        <div className="toolbar">
          <button className="secondary-button" onClick={() => setDraft((current) => ({
            ...current,
            items: [...current.items, { id: createId('prod-item'), refType: 'dish', refId: state.dishes[0]?.id ?? '', quantity: 1 }],
          }))}>Agregar linea</button>
          <button className="primary-button" disabled={!canManage || !draft.name} onClick={() => {
            actions.upsertProductionPlan(draft);
            setDraft(emptyProduction(state));
          }}>
            <Save size={18} /> Guardar plan
          </button>
        </div>
      </section>

      <DataTable
        headers={['Plan', 'Fecha', 'Responsable', 'Estado', 'Items', 'Detalle']}
        rows={state.productionPlans.map((plan) => [
          plan.name,
          plan.scheduledFor,
          plan.responsible,
          <StatusBadge key={`${plan.id}-status`} tone={plan.status === 'Finalizado' ? 'ok' : plan.status === 'Cancelado' ? 'danger' : 'warning'} text={plan.status} />,
          `${plan.items.length} lineas`,
          plan.items.map((item) => {
            const name = item.refType === 'baseRecipe'
              ? state.baseRecipes.find((recipe) => recipe.id === item.refId)?.name
              : state.dishes.find((dish) => dish.id === item.refId)?.name;
            return `${item.refType === 'baseRecipe' ? 'Base' : 'Plato'}: ${name ?? '-'} x ${decimal.format(item.quantity)}`;
          }).join(' · '),
        ])}
      />
    </section>
  );
}

function SalesModule({
  state,
  actions,
  canManage,
}: {
  state: ReturnType<typeof useLocalStore>['state'];
  actions: ReturnType<typeof useLocalStore>['actions'];
  canManage: boolean;
}) {
  const [saleDraft, setSaleDraft] = useState<Sale>(() => emptySale(state));
  const [projectionDraft, setProjectionDraft] = useState<Projection>(emptyProjection);
  const latestProjection = useMemo(() => getLatestProjection(state.projections), [state.projections]);
  const projectionRows = useMemo(
    () => [...state.projections].reverse().map((projection, index) => ({
      ...projection,
      revenue: calculateProjectionRevenue(projection),
      projectedCustomersMonthly: projection.days.reduce((sum, day) => {
        const multiplier = projection.period === 'dia' ? 30 : 4;
        return sum + day.projectedCustomers * multiplier;
      }, 0),
      isLatest: index === 0,
    })),
    [state.projections],
  );
  const isEditingProjection = state.projections.some((projection) => projection.id === projectionDraft.id);

  const loadProjectionDraft = (projection: Projection) => {
    setProjectionDraft({
      ...projection,
      days: projection.days.map((day) => ({ ...day })),
    });
  };

  return (
    <section className="content-stack">
      <div className="dashboard-grid">
        <section className="panel sales-panel">
          <PanelHeader title="Registrar venta" />
          <div className="form-grid two sales-meta-grid">
            <label>Fecha<input value={saleDraft.soldAt} onChange={(event) => setSaleDraft({ ...saleDraft, soldAt: event.target.value })} /></label>
            <label>
              Canal
              <select value={saleDraft.channel} onChange={(event) => setSaleDraft({ ...saleDraft, channel: event.target.value as SalesChannel })}>
                {channels.map((channel) => <option key={channel}>{channel}</option>)}
              </select>
            </label>
          </div>
          <div className="sales-lines-card">
            {saleDraft.items.length > 0 && (
              <div className="field-grid-header sales">
                <span>Producto</span>
                <span>Cantidad</span>
                <span>Precio vendido</span>
                <span>Descuento %</span>
                <span></span>
              </div>
            )}
            <div className="line-editor sales-line-editor">
              {saleDraft.items.map((item) => (
                <div className="line-grid five sales-line-grid" key={item.id}>
                <select value={item.dishId} onChange={(event) => setSaleDraft((current) => ({
                  ...current,
                  items: current.items.map((line) => line.id === item.id ? { ...line, dishId: event.target.value } : line),
                }))}>
                  {state.dishes.map((dish) => <option key={dish.id} value={dish.id}>{dish.name}</option>)}
                </select>
                <input type="number" step="0.001" placeholder="Cantidad" aria-label="Cantidad vendida" value={item.quantity} onChange={(event) => setSaleDraft((current) => ({
                  ...current,
                  items: current.items.map((line) => line.id === item.id ? { ...line, quantity: parseNumericInput(event.target.value) } : line),
                }))} />
                <input type="number" step="0.001" placeholder="Precio" aria-label="Precio vendido" value={item.unitPrice} onChange={(event) => setSaleDraft((current) => ({
                  ...current,
                  items: current.items.map((line) => line.id === item.id ? { ...line, unitPrice: parseNumericInput(event.target.value) } : line),
                }))} />
                <input type="number" step="0.001" placeholder="% desc." aria-label="Descuento aplicado" value={item.discount} onChange={(event) => setSaleDraft((current) => ({
                  ...current,
                  items: current.items.map((line) => line.id === item.id ? { ...line, discount: parseNumericInput(event.target.value) } : line),
                }))} />
                <button className="icon-button" onClick={() => setSaleDraft((current) => ({
                  ...current,
                  items: current.items.filter((line) => line.id !== item.id),
                }))}><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
          </div>
          <p className="helper-text">Cada linea representa un producto vendido: cantidad, precio final cobrado y descuento aplicado.</p>
          <div className="toolbar">
            <button className="secondary-button" onClick={() => setSaleDraft((current) => ({
              ...current,
              items: [...current.items, { id: createId('sale-item'), dishId: state.dishes[0]?.id ?? '', quantity: 1, unitPrice: 0, discount: 0 }],
            }))}>Agregar producto</button>
            <button className="primary-button" disabled={!canManage || saleDraft.items.length === 0} onClick={() => {
              actions.recordSale(saleDraft);
              setSaleDraft(emptySale(state));
            }}>
              <Save size={18} /> Guardar venta
            </button>
          </div>
        </section>

        <section className="panel sales-panel">
          <PanelHeader title="Proyeccion comercial" />
          {latestProjection && (
            <div className="summary-strip">
              <SummaryMetric label="Proyeccion vigente" value={latestProjection.name} />
              <SummaryMetric label="Venta mensual usada en reportes" value={money.format(calculateProjectionRevenue(latestProjection))} />
            </div>
          )}
          <div className="form-grid two sales-meta-grid">
            <label>Nombre<input value={projectionDraft.name} onChange={(event) => setProjectionDraft({ ...projectionDraft, name: event.target.value })} /></label>
            <label>
              Periodo
              <select value={projectionDraft.period} onChange={(event) => setProjectionDraft({ ...projectionDraft, period: event.target.value as Projection['period'] })}>
                <option value="dia">Dia</option>
                <option value="semana">Semana</option>
                <option value="mes">Mes</option>
              </select>
            </label>
          </div>
          <div className="sales-lines-card projection-card">
            <div className="field-grid-header projection">
              <span>Dia</span>
              <span>Clientes</span>
              <span>Ticket comida</span>
              <span>Ticket bebidas</span>
            </div>
            <div className="projection-grid">
              {projectionDraft.days.map((day, index) => (
                <div className="projection-row" key={day.day}>
                  <strong>{day.day}</strong>
                  <input type="number" step="1" placeholder="Clientes" aria-label={`Clientes proyectados ${day.day}`} value={day.projectedCustomers} onChange={(event) => setProjectionDraft((current) => ({
                    ...current,
                    days: current.days.map((entry, entryIndex) => entryIndex === index ? { ...entry, projectedCustomers: parseNumericInput(event.target.value) } : entry),
                  }))} />
                  <input type="number" step="0.001" placeholder="Ticket comida" aria-label={`Ticket comida ${day.day}`} value={day.avgFoodTicket} onChange={(event) => setProjectionDraft((current) => ({
                    ...current,
                    days: current.days.map((entry, entryIndex) => entryIndex === index ? { ...entry, avgFoodTicket: parseNumericInput(event.target.value) } : entry),
                  }))} />
                  <input type="number" step="0.001" placeholder="Ticket bebidas" aria-label={`Ticket bebidas ${day.day}`} value={day.avgBeverageTicket} onChange={(event) => setProjectionDraft((current) => ({
                    ...current,
                    days: current.days.map((entry, entryIndex) => entryIndex === index ? { ...entry, avgBeverageTicket: parseNumericInput(event.target.value) } : entry),
                  }))} />
                </div>
              ))}
            </div>
          </div>
          <p className="helper-text">Clientes proyectados por dia y ticket promedio separado entre comida y bebidas.</p>
          <div className="summary-strip">
            <SummaryMetric label="Venta proyectada" value={money.format(calculateProjectionRevenue(projectionDraft))} />
          </div>
          <div className="toolbar">
            <button className="secondary-button" onClick={() => setProjectionDraft(emptyProjection())}>
              <Pencil size={18} /> Nueva proyeccion
            </button>
            <button className="primary-button" disabled={!canManage} onClick={() => {
              actions.upsertProjection(projectionDraft);
              setProjectionDraft(emptyProjection());
            }}>
              <Save size={18} /> {isEditingProjection ? 'Actualizar proyeccion' : 'Guardar proyeccion'}
            </button>
          </div>
        </section>
      </div>

      <DataTable
        title="Ventas registradas"
        headers={['Fecha', 'Canal', 'Items', 'Ingreso neto']}
        rows={state.sales.map((sale) => [
          sale.soldAt,
          sale.channel,
          `${sale.items.length} lineas`,
          money.format(sale.items.reduce((sum, item) => sum + item.quantity * item.unitPrice * (1 - item.discount), 0)),
        ])}
      />

      <section className="panel">
        <PanelHeader title="Historial de proyecciones" />
        {projectionRows.length > 0 ? (
          <div className="compact-shell">
            <table>
              <thead>
                <tr>
                  <th>Estado</th>
                  <th>Nombre</th>
                  <th>Periodo</th>
                  <th>Clientes / mes</th>
                  <th>Venta mensual</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {projectionRows.map((projection) => (
                  <tr key={projection.id}>
                    <td>
                      <StatusBadge tone={projection.isLatest ? 'ok' : 'warning'} text={projection.isLatest ? 'Vigente' : 'Historial'} />
                    </td>
                    <td>{projection.name}</td>
                    <td>{projection.period === 'mes' ? 'Mes' : projection.period === 'semana' ? 'Semana' : 'Dia'}</td>
                    <td>{projection.projectedCustomersMonthly}</td>
                    <td>{money.format(projection.revenue)}</td>
                    <td>
                      <div className="toolbar">
                        <button className="icon-button" onClick={() => loadProjectionDraft(projection)} aria-label={`Revisar ${projection.name}`}>
                          <Pencil size={16} />
                        </button>
                        <button
                          className="icon-button"
                          disabled={!canManage}
                          onClick={() => {
                            actions.removeProjection(projection.id);
                            if (projectionDraft.id === projection.id) {
                              setProjectionDraft(emptyProjection());
                            }
                          }}
                          aria-label={`Borrar ${projection.name}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="helper-text">Todavia no hay proyecciones guardadas.</p>
        )}
      </section>
    </section>
  );
}

function ExpensesModule({
  state,
  actions,
  hasFinancialAccess,
}: {
  state: ReturnType<typeof useLocalStore>['state'];
  actions: ReturnType<typeof useLocalStore>['actions'];
  hasFinancialAccess: boolean;
}) {
  const [draft, setDraft] = useState<IndirectCost>(emptyIndirectCost());
  const [editingCostId, setEditingCostId] = useState<string | null>(null);
  const monthlyIndirect = state.indirectCosts.reduce((sum, item) => sum + getMonthlyCostAmount(item), 0);
  const monthlyLabor = calculateTotalMonthlyLaborCost(state);
  const structureTotal = state.business.fixedCostsMonthly + monthlyIndirect + monthlyLabor;
  const groupedByCategory = Array.from(
    state.indirectCosts.reduce((acc, item) => {
      const current = acc.get(item.category) ?? 0;
      acc.set(item.category, current + getMonthlyCostAmount(item));
      return acc;
    }, new Map<string, number>()),
  ).sort((a, b) => b[1] - a[1]);

  return (
    <section className="content-stack">
      <section className="panel">
        <PanelHeader title="Modulo exclusivo de gastos" />
        <div className="summary-strip compact">
          <SummaryMetric label="Fijos base / mes" value={money.format(state.business.fixedCostsMonthly)} />
          <SummaryMetric label="Indirectos mensualizados" value={money.format(monthlyIndirect)} />
          <SummaryMetric label="Personal total / mes" value={money.format(monthlyLabor)} />
          <SummaryMetric label="Estructura mensual total" value={money.format(structureTotal)} />
        </div>
        <p className="helper-text">
          Este modulo concentra los gastos que alimentan el costo final: estructura fija del negocio, personal cargado e indirectos mensualizados.
        </p>
      </section>

      <div className="dashboard-grid">
        <section className="panel">
          <PanelHeader title="Registrar o editar gasto indirecto" />
          <div className="form-grid two">
            <label>Nombre<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
            <label>Categoria<input value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} /></label>
            <label>Monto<input type="number" step="0.001" value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: parseNumericInput(event.target.value) })} /></label>
            <label>
              Periodo
              <select value={draft.period} onChange={(event) => setDraft({ ...draft, period: event.target.value as IndirectCost['period'] })}>
                <option value="diario">Diario</option>
                <option value="semanal">Semanal</option>
                <option value="mensual">Mensual</option>
              </select>
            </label>
            <label>
              Metodo
              <select value={draft.allocationMethod} onChange={(event) => setDraft({ ...draft, allocationMethod: event.target.value as IndirectCost['allocationMethod'] })}>
                <option value="manual">Manual</option>
                <option value="hours">Horas</option>
                <option value="sales">Ventas</option>
                <option value="product">Producto</option>
                <option value="recipe">Receta</option>
                <option value="category">Categoria</option>
              </select>
            </label>
            <label>Factor de reparto<input type="number" step="0.01" value={draft.allocationValue} onChange={(event) => setDraft({ ...draft, allocationValue: parseNumericInput(event.target.value, 1) })} /></label>
          </div>
          <div className="toolbar">
            <button
              className="primary-button"
              disabled={!hasFinancialAccess || !draft.name}
              onClick={() => {
                actions.upsertIndirectCost(draft);
                setEditingCostId(null);
                setDraft(emptyIndirectCost());
              }}
            >
              <Save size={18} /> {editingCostId ? 'Guardar edicion' : 'Guardar gasto'}
            </button>
            <button className="secondary-button compact" onClick={() => {
              setEditingCostId(null);
              setDraft(emptyIndirectCost());
            }}>
              {editingCostId ? 'Cancelar edicion' : 'Limpiar'}
            </button>
          </div>
        </section>

        <section className="panel">
          <PanelHeader title="Participacion mensual por categoria" />
          <div className="stack-list">
            {groupedByCategory.map(([category, amount]) => (
              <div className="summary-metric" key={category}>
                <span>{category}</span>
                <strong>{money.format(amount)}</strong>
              </div>
            ))}
            {groupedByCategory.length === 0 && <p className="helper-text">Aun no hay gastos indirectos registrados.</p>}
          </div>
        </section>
      </div>

      <DataTable
        title="Gastos indirectos imputables al costo final"
        headers={['Nombre', 'Categoria', 'Periodo', 'Monto origen', 'Mensualizado', 'Metodo', 'Factor', '']}
        rows={state.indirectCosts.map((item) => {
          const isEditing = editingCostId === item.id;
          return [
            isEditing ? <input key={`${item.id}-name`} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /> : item.name,
            isEditing ? <input key={`${item.id}-category`} value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} /> : item.category,
            isEditing ? (
              <select key={`${item.id}-period`} value={draft.period} onChange={(event) => setDraft({ ...draft, period: event.target.value as IndirectCost['period'] })}>
                <option value="diario">Diario</option>
                <option value="semanal">Semanal</option>
                <option value="mensual">Mensual</option>
              </select>
            ) : item.period,
            isEditing ? <input key={`${item.id}-amount`} type="number" step="0.001" value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: parseNumericInput(event.target.value) })} /> : money.format(item.amount),
            money.format(getMonthlyCostAmount(isEditing ? draft : item)),
            isEditing ? (
              <select key={`${item.id}-method`} value={draft.allocationMethod} onChange={(event) => setDraft({ ...draft, allocationMethod: event.target.value as IndirectCost['allocationMethod'] })}>
                <option value="manual">Manual</option>
                <option value="hours">Horas</option>
                <option value="sales">Ventas</option>
                <option value="product">Producto</option>
                <option value="recipe">Receta</option>
                <option value="category">Categoria</option>
              </select>
            ) : item.allocationMethod,
            isEditing ? <input key={`${item.id}-factor`} type="number" step="0.01" value={draft.allocationValue} onChange={(event) => setDraft({ ...draft, allocationValue: parseNumericInput(event.target.value, 1) })} /> : decimal.format(item.allocationValue),
            <div className="row-actions" key={`${item.id}-actions`}>
              {isEditing ? (
                <>
                  <button className="icon-button" title="Guardar gasto" onClick={() => {
                    actions.upsertIndirectCost(draft);
                    setEditingCostId(null);
                    setDraft(emptyIndirectCost());
                  }}>
                    <Save size={15} />
                  </button>
                  <button className="secondary-button compact" title="Cancelar edicion" onClick={() => {
                    setEditingCostId(null);
                    setDraft(emptyIndirectCost());
                  }}>
                    Cancelar
                  </button>
                </>
              ) : (
                <>
                  <button className="icon-button" title="Editar gasto" onClick={() => {
                    setEditingCostId(item.id);
                    setDraft(item);
                  }}>
                    <Pencil size={15} />
                  </button>
                  <button className="icon-button" title="Eliminar gasto" onClick={() => actions.removeIndirectCost(item.id)}>
                    <Trash2 size={15} />
                  </button>
                </>
              )}
            </div>,
          ];
        })}
      />

      <DataTable
        title="Personal cargado que entra al calculo"
        headers={['Cargo', 'Dotacion', 'Costo unitario / mes', 'Costo total / mes', 'Costo por hora']}
        rows={state.laborProfiles.map((profile) => [
          profile.roleName,
          String(profile.headcount),
          money.format(calculateLaborProfileMonthlyCost(state, profile)),
          money.format(calculateLaborProfileMonthlyTeamCost(state, profile)),
          money.format(calculateLaborCostPerMinute(state, profile.id) * 60),
        ])}
      />
    </section>
  );
}

function PlanningModule({
  state,
  actions,
  canManage,
}: {
  state: ReturnType<typeof useLocalStore>['state'];
  actions: ReturnType<typeof useLocalStore>['actions'];
  canManage: boolean;
}) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [monthKey, setMonthKey] = useState(currentMonth);
  const [draft, setDraft] = useState<StaffShift>(emptyStaffShift(state));
  const [inlineEditorKey, setInlineEditorKey] = useState<string | null>(null);
  const [inlineDraft, setInlineDraft] = useState<StaffShift | null>(null);

  useEffect(() => {
    if (!draft.laborProfileId && state.laborProfiles[0]?.id) {
      setDraft((current) => ({ ...current, laborProfileId: state.laborProfiles[0]?.id ?? '' }));
    }
  }, [draft.laborProfileId, state.laborProfiles]);

  const calendarWeeks = useMemo(() => listMonthWeeks(monthKey), [monthKey]);
  const monthShifts = state.staffShifts
    .filter((shift) => getMonthKey(shift.date) === monthKey)
    .sort((a, b) => `${a.employeeName}-${a.date}-${a.startTime}`.localeCompare(`${b.employeeName}-${b.date}-${b.startTime}`));
  const planningAlerts = getPlanningAlerts(state, monthKey);
  const draftWorkedMinutes = getShiftWorkedMinutes(draft);
  const draftOrdinaryMinutes = Math.max(draftWorkedMinutes - Math.max(draft.extraMinutes, 0), 0);
  const draftAlerts = getDraftPlanningAlerts(state, draft);
  const generatedMonthPreview = useMemo(() => buildChileCompliantMonthlyShifts(state, monthKey), [state, monthKey]);
  const groupedEmployees = useMemo(() => {
    const groupedFromShifts = monthShifts.reduce((acc, shift) => {
      const key = getShiftEmployeeKey(shift);
      const current = acc.get(key) ?? {
        key,
        employeeName: shift.employeeName,
        laborProfileId: shift.laborProfileId,
        shifts: [] as StaffShift[],
      };
      current.shifts.push(shift);
      acc.set(key, current);
      return acc;
    }, new Map<string, { key: string; employeeName: string; laborProfileId: string; shifts: StaffShift[] }>());

    const roster: Array<{ key: string; employeeName: string; laborProfileId: string; shifts: StaffShift[] }> = [];

    state.laborProfiles.forEach((profile) => {
      const assignedEmployees = Array.from(groupedFromShifts.values())
        .filter((employee) => employee.laborProfileId === profile.id)
        .sort((a, b) => a.employeeName.localeCompare(b.employeeName));

      assignedEmployees.forEach((employee) => roster.push(employee));

      const missingHeadcount = Math.max(profile.headcount - assignedEmployees.length, 0);
      for (let index = 0; index < missingHeadcount; index += 1) {
        const placeholderNumber = assignedEmployees.length + index + 1;
        roster.push({
          key: `${profile.id}::placeholder-${placeholderNumber}`,
          employeeName: `${profile.roleName} ${placeholderNumber}`,
          laborProfileId: profile.id,
          shifts: [],
        });
      }
    });

    return roster;
  }, [monthShifts, state.laborProfiles]);
  const weeklySections = calendarWeeks.map((weekDays) => {
    const weekStart = weekDays[0]?.date ?? monthKey;
    const weekEnd = weekDays[6]?.date ?? monthKey;
    const employees = groupedEmployees
      .map((employee) => {
        const profile = state.laborProfiles.find((item) => item.id === employee.laborProfileId);
        const shifts = employee.shifts.filter((shift) => weekDays.some((day) => day.date === shift.date));
        const shiftMap = new Map(shifts.map((shift) => [shift.date, shift]));
        const ordinaryHours = shifts.reduce(
          (sum, shift) => sum + Math.max(getShiftWorkedMinutes(shift) - Math.max(shift.extraMinutes, 0), 0),
          0,
        ) / 60;
        const extraHours = shifts.reduce((sum, shift) => sum + Math.max(shift.extraMinutes, 0), 0) / 60;
        return {
          key: employee.key,
          employeeName: employee.employeeName,
          laborProfileId: employee.laborProfileId,
          profileName: profile?.roleName ?? 'Sin perfil',
          shiftMap,
          ordinaryHours,
          extraHours,
          workedDays: shifts.length,
        };
      });

    const weeklyOrdinaryHours = employees.reduce((sum, employee) => sum + employee.ordinaryHours, 0);
    const weeklyExtraHours = employees.reduce((sum, employee) => sum + employee.extraHours, 0);

    return {
      weekStart,
      weekEnd,
      weekDays,
      employees,
      weeklyOrdinaryHours,
      weeklyExtraHours,
    };
  });
  const ordinaryHoursMonth = monthShifts.reduce(
    (sum, shift) => sum + Math.max(getShiftWorkedMinutes(shift) - Math.max(shift.extraMinutes, 0), 0),
    0,
  ) / 60;
  const extraHoursMonth = monthShifts.reduce((sum, shift) => sum + Math.max(shift.extraMinutes, 0), 0) / 60;
  const isEditingShift = state.staffShifts.some((shift) => shift.id === draft.id);
  const startInlineEdit = (employeeName: string, laborProfileId: string, date: string, shift?: StaffShift) => {
    setInlineEditorKey(`${laborProfileId}::${employeeName}::${date}`);
    setInlineDraft(shift ? { ...shift } : createStaffShiftForCell(laborProfileId, employeeName, date));
  };
  const cancelInlineEdit = () => {
    setInlineEditorKey(null);
    setInlineDraft(null);
  };
  const saveInlineEdit = () => {
    if (!inlineDraft || !inlineDraft.employeeName || !inlineDraft.laborProfileId || !canManage) return;
    actions.upsertStaffShift(inlineDraft);
    cancelInlineEdit();
  };

  return (
    <section className="content-stack">
      <section className="panel">
        <PanelHeader title="Planificacion mensual de empleados" />
        {isEditingShift && (
          <div className="alert-row info">
            <AlertTriangle size={18} />
            <div>
              <strong>{`Editando turno de ${draft.employeeName}`}</strong>
              <span>{`${draft.date} | ${draft.startTime} - ${draft.endTime}. Guarda para aplicar cambios o limpia para salir.`}</span>
            </div>
          </div>
        )}
        <div className="form-grid four">
          <label>Mes<input type="month" value={monthKey} onChange={(event) => setMonthKey(event.target.value)} /></label>
          <label>
            Perfil laboral
            <select value={draft.laborProfileId} onChange={(event) => setDraft({ ...draft, laborProfileId: event.target.value })}>
              {state.laborProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.roleName}</option>)}
            </select>
          </label>
          <label>Empleado<input value={draft.employeeName} onChange={(event) => setDraft({ ...draft, employeeName: event.target.value })} placeholder="Ej. Ana Rojas" /></label>
          <label>Fecha<input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></label>
          <label>Inicio<input type="time" value={draft.startTime} onChange={(event) => setDraft({ ...draft, startTime: event.target.value })} /></label>
          <label>Termino<input type="time" value={draft.endTime} onChange={(event) => setDraft({ ...draft, endTime: event.target.value })} /></label>
          <label>Colacion min<input type="number" step="1" value={draft.breakMinutes} onChange={(event) => setDraft({ ...draft, breakMinutes: parseNumericInput(event.target.value) })} /></label>
          <label>Horas extra min<input type="number" step="1" value={draft.extraMinutes} onChange={(event) => setDraft({ ...draft, extraMinutes: parseNumericInput(event.target.value) })} /></label>
        </div>
        <label>Notas<input value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="Apertura, cierre, refuerzo, evento..." /></label>
        <div className="summary-strip compact">
          <SummaryMetric label="Limite semanal vigente" value={`${getChileWeeklyLimitHours(monthKey + '-01')} h`} />
          <SummaryMetric label="Horas ordinarias mes" value={decimal.format(ordinaryHoursMonth)} />
          <SummaryMetric label="Horas extra mes" value={decimal.format(extraHoursMonth)} />
          <SummaryMetric label="Alertas normativas" value={String(planningAlerts.length)} />
        </div>
        <div className="summary-strip compact">
          <SummaryMetric label="Turno borrador" value={`${decimal.format(draftWorkedMinutes / 60)} h`} />
          <SummaryMetric label="Horas ordinarias" value={`${decimal.format(draftOrdinaryMinutes / 60)} h`} />
          <SummaryMetric label="Horas extra" value={`${decimal.format(Math.max(draft.extraMinutes, 0) / 60)} h`} />
          <SummaryMetric label="Riesgos del borrador" value={String(draftAlerts.length)} />
        </div>
        {draftAlerts.length > 0 && (
          <div className="stack-list">
            {draftAlerts.map((alert) => (
              <div className={`alert-row ${alert.tone === 'danger' ? 'critical' : 'warning'}`} key={`draft-${alert.id}`}>
                <AlertTriangle size={18} />
                <div>
                  <strong>{alert.title}</strong>
                  <span>{alert.detail}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="toolbar">
          <button
            className="primary-button"
            disabled={!canManage || !draft.employeeName || !draft.laborProfileId}
            onClick={() => {
              actions.upsertStaffShift(draft);
              setDraft(emptyStaffShift(state));
            }}
          >
            <Save size={18} /> {isEditingShift ? 'Guardar cambios' : 'Guardar turno'}
          </button>
          <button className="secondary-button compact" onClick={() => setDraft(emptyStaffShift(state))}>
            {isEditingShift ? 'Cancelar edicion' : 'Limpiar'}
          </button>
          <button
            className="secondary-button compact"
            disabled={!canManage || generatedMonthPreview.length === 0}
            onClick={() => {
              state.staffShifts
                .filter((shift) => getMonthKey(shift.date) === monthKey)
                .forEach((shift) => actions.removeStaffShift(shift.id));

              generatedMonthPreview.forEach((shift) => actions.upsertStaffShift(shift));
              setDraft(emptyStaffShift(state));
            }}
          >
            <Sparkles size={16} /> Generar turnos Chile
          </button>
        </div>
        <p className="helper-text">
          Regimen base usado para generar y validar: 44 h semanales hasta el 25 de abril de 2026; 42 h desde el 26 de abril de 2026; maximo diario ordinario 10 h; horas extra hasta 2 h por dia; colacion minima de 30 min; hasta 6 dias de trabajo por semana; al menos 2 domingos libres al mes. El boton reemplaza los turnos del mes seleccionado por una pauta base con rotacion dominical y cobertura reducida de domingo bajo regimen general chileno.
        </p>
      </section>

      {planningAlerts.length > 0 && (
        <section className="panel">
          <PanelHeader title="Alertas legales y operativas" />
          <div className="stack-list">
            {planningAlerts.map((alert) => (
              <div className={`alert-row ${alert.tone === 'danger' ? 'critical' : 'warning'}`} key={alert.id}>
                <AlertTriangle size={18} />
                <div>
                  <strong>{alert.title}</strong>
                  <span>{alert.detail}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="panel">
        <PanelHeader title="Agenda semanal por colaborador" />
        <div className="planning-week-stack">
          {weeklySections.map((week) => (
            <section className="planning-week-card" key={week.weekStart}>
              <div className="planning-week-header">
                <div>
                  <strong>{`Semana del ${week.weekStart} al ${week.weekEnd}`}</strong>
                  <span>{`${week.employees.filter((employee) => employee.workedDays > 0).length} con turnos; ${week.employees.length} visibles segun dotacion`}</span>
                </div>
                <div className="planning-week-metrics">
                  <span>{`${decimal.format(week.weeklyOrdinaryHours)} h ord.`}</span>
                  <span>{`${decimal.format(week.weeklyExtraHours)} h extra`}</span>
                </div>
              </div>

              <div className="planning-week-scroll">
                <div className="planning-week-grid">
                  <div className="planning-week-grid-header employee">Colaborador</div>
                  {week.weekDays.map((day) => (
                    <div
                      className={`planning-week-grid-header ${day.inMonth ? '' : 'muted'}`.trim()}
                      key={day.date}
                    >
                      <strong>{['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'][new Date(`${day.date}T12:00:00`).getDay() === 0 ? 6 : new Date(`${day.date}T12:00:00`).getDay() - 1]}</strong>
                      <span>{day.date.slice(5)}</span>
                    </div>
                  ))}
                  <div className="planning-week-grid-header totals">Resumen</div>

                  {week.employees.length > 0 ? (
                    week.employees.map((employee) => (
                      <Fragment key={`${week.weekStart}-${employee.key}`}>
                        <div className="planning-employee-meta">
                          <strong>{employee.employeeName}</strong>
                          <span>{employee.profileName}</span>
                        </div>
                        {week.weekDays.map((day) => {
                          const shift = employee.shiftMap.get(day.date);
                          const dayLabel = `${['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'][new Date(`${day.date}T12:00:00`).getDay() === 0 ? 6 : new Date(`${day.date}T12:00:00`).getDay() - 1]} ${day.date.slice(5)}`;
                          const cellEditorKey = `${employee.laborProfileId}::${employee.employeeName}::${day.date}`;
                          const isInlineEditing = inlineEditorKey === cellEditorKey && inlineDraft;
                          return (
                            <div className={`planning-shift-cell ${day.inMonth ? '' : 'outside'}`.trim()} key={`${employee.key}-${day.date}`}>
                              <span className="planning-shift-day">{dayLabel}</span>
                              {!isInlineEditing && shift ? (
                                <>
                                  <div className="planning-shift-time">{`${shift.startTime} - ${shift.endTime}`}</div>
                                  <div className="planning-shift-meta">
                                    <span>{`${decimal.format(getShiftWorkedMinutes(shift) / 60)} h`}</span>
                                    {shift.extraMinutes > 0 ? <span>{`+${decimal.format(shift.extraMinutes / 60)} h extra`}</span> : <span>Ordinario</span>}
                                  </div>
                                  <div className="planning-shift-actions">
                                    <button
                                      className="icon-button"
                                      title="Editar turno"
                                      onClick={() => startInlineEdit(employee.employeeName, employee.laborProfileId, day.date, shift)}
                                    >
                                      <Pencil size={14} />
                                    </button>
                                    <button className="icon-button" title="Eliminar turno" onClick={() => actions.removeStaffShift(shift.id)}>
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </>
                              ) : null}
                              {!isInlineEditing && !shift ? (
                                <>
                                  <span className="planning-shift-empty">{day.inMonth ? 'Libre' : 'Fuera de mes'}</span>
                                  {day.inMonth && canManage ? (
                                    <button
                                      className="secondary-button compact planning-add-button"
                                      onClick={() => startInlineEdit(employee.employeeName, employee.laborProfileId, day.date)}
                                    >
                                      Agregar turno
                                    </button>
                                  ) : null}
                                </>
                              ) : null}
                              {isInlineEditing && inlineDraft ? (
                                <div className="planning-inline-editor">
                                  <label>
                                    Inicio
                                    <input
                                      type="time"
                                      value={inlineDraft.startTime}
                                      onChange={(event) => setInlineDraft({ ...inlineDraft, startTime: event.target.value })}
                                    />
                                  </label>
                                  <label>
                                    Termino
                                    <input
                                      type="time"
                                      value={inlineDraft.endTime}
                                      onChange={(event) => setInlineDraft({ ...inlineDraft, endTime: event.target.value })}
                                    />
                                  </label>
                                  <label>
                                    Colacion
                                    <input
                                      type="number"
                                      step="1"
                                      value={inlineDraft.breakMinutes}
                                      onChange={(event) => setInlineDraft({ ...inlineDraft, breakMinutes: parseNumericInput(event.target.value) })}
                                    />
                                  </label>
                                  <label>
                                    Extra
                                    <input
                                      type="number"
                                      step="1"
                                      value={inlineDraft.extraMinutes}
                                      onChange={(event) => setInlineDraft({ ...inlineDraft, extraMinutes: parseNumericInput(event.target.value) })}
                                    />
                                  </label>
                                  <label className="planning-inline-notes">
                                    Nota
                                    <input
                                      value={inlineDraft.notes}
                                      onChange={(event) => setInlineDraft({ ...inlineDraft, notes: event.target.value })}
                                      placeholder="Apertura, cierre..."
                                    />
                                  </label>
                                  <div className="planning-inline-actions">
                                    <button className="primary-button compact-inline" onClick={saveInlineEdit} disabled={!canManage}>
                                      <Save size={16} /> Guardar
                                    </button>
                                    <button className="secondary-button compact" onClick={cancelInlineEdit}>
                                      Cancelar
                                    </button>
                                    {shift ? (
                                      <button
                                        className="secondary-button compact"
                                        onClick={() => {
                                          actions.removeStaffShift(shift.id);
                                          cancelInlineEdit();
                                        }}
                                        disabled={!canManage}
                                      >
                                        Eliminar
                                      </button>
                                    ) : null}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                        <div className="planning-week-summary">
                          <strong>{`${decimal.format(employee.ordinaryHours)} h`}</strong>
                          <span>{`${employee.workedDays} dias asignados`}</span>
                          <span>{`${decimal.format(employee.extraHours)} h extra`}</span>
                        </div>
                      </Fragment>
                    ))
                  ) : (
                    <div className="planning-week-empty">No hay turnos cargados en esta semana.</div>
                  )}
                </div>
              </div>
            </section>
          ))}
          {groupedEmployees.length === 0 && <div className="planning-week-empty">{`Aun no hay dotacion configurada para ${monthKey}.`}</div>}
        </div>
      </section>
    </section>
  );
}

type SheetsTab = 'planning' | 'costs' | 'prices';

function DetailedCostsSheet({
  state,
}: {
  state: ReturnType<typeof useLocalStore>['state'];
}) {
  const monthlyIndirect = state.indirectCosts.reduce((sum, item) => sum + getMonthlyCostAmount(item), 0);
  const monthlyLabor = calculateTotalMonthlyLaborCost(state);
  const structureTotal = state.business.fixedCostsMonthly + monthlyIndirect + monthlyLabor;
  const dishRows = state.dishes
    .map((dish) => {
      const result = calculateDishCost(state, dish);
      return { dish, result };
    })
    .sort((a, b) => b.result.totalCost - a.result.totalCost);

  return (
    <section className="content-stack">
      <section className="panel">
        <PanelHeader title="Planilla de costos consolidada" />
        <div className="summary-strip compact">
          <SummaryMetric label="Fijos base / mes" value={money.format(state.business.fixedCostsMonthly)} />
          <SummaryMetric label="Indirectos / mes" value={money.format(monthlyIndirect)} />
          <SummaryMetric label="Personal / mes" value={money.format(monthlyLabor)} />
          <SummaryMetric label="Estructura total / mes" value={money.format(structureTotal)} />
        </div>
        <p className="helper-text">
          Esta hoja concentra la estructura que alimenta el costo final de cada plato: gastos fijos, indirectos, personal y costo técnico de producción.
        </p>
      </section>

      <DataTable
        title="Grilla de costos por plato"
        headers={['Plato', 'MP directa', 'Recetas base', 'Packaging', 'Mano de obra', 'CIF', 'Costo total', 'Precio sugerido', 'Food cost']}
        rows={dishRows.map(({ dish, result }) => [
          dish.name,
          money.format(result.ingredientCost),
          money.format(result.baseRecipeCost),
          money.format(result.packagingCost),
          money.format(result.laborCost),
          money.format(result.indirectCost),
          money.format(result.totalCost),
          money.format(result.recommendedPrice),
          percent.format(result.foodCostPercent),
        ])}
      />

      <DataTable
        title="Grilla de gastos indirectos"
        headers={['Nombre', 'Categoria', 'Periodo', 'Monto origen', 'Mensualizado', 'Metodo', 'Factor']}
        rows={state.indirectCosts.map((item) => [
          item.name,
          item.category,
          item.period,
          money.format(item.amount),
          money.format(getMonthlyCostAmount(item)),
          item.allocationMethod,
          decimal.format(item.allocationValue),
        ])}
      />

      <DataTable
        title="Grilla de costo empresa de personal"
        headers={['Cargo', 'Grupo', 'Dotacion', 'Sueldo base por persona', 'Extras cargo', 'Costo empresa / mes', 'Costo total cargo / mes', 'Costo hora']}
        rows={state.laborProfiles.map((profile) => [
          profile.roleName,
          laborRoleGroupLabels[profile.roleGroup] ?? profile.roleGroup,
          String(profile.headcount),
          money.format(profile.monthlySalary),
          money.format(profile.extraMonthlyCost),
          money.format(calculateLaborProfileMonthlyCost(state, profile)),
          money.format(calculateLaborProfileMonthlyTeamCost(state, profile)),
          money.format(calculateLaborCostPerMinute(state, profile.id) * 60),
        ])}
      />
    </section>
  );
}

function RawMaterialPricesSheet({
  state,
}: {
  state: ReturnType<typeof useLocalStore>['state'];
}) {
  const rows = state.ingredients
    .map((ingredient) => {
      const supplier = state.suppliers.find((item) => item.id === ingredient.primarySupplierId);
      const category = state.categories.find((item) => item.id === ingredient.categoryId);
      const sortedHistory = [...ingredient.priceHistory].sort((a, b) => a.date.localeCompare(b.date));
      const latest = sortedHistory[sortedHistory.length - 1];
      const previous = sortedHistory[sortedHistory.length - 2];
      const trend = getIngredientPriceTrend(ingredient);
      return { ingredient, supplier, category, latest, previous, trend };
    })
    .sort((a, b) => a.ingredient.name.localeCompare(b.ingredient.name));

  return (
    <section className="content-stack">
      <section className="panel">
        <PanelHeader title="Planilla referencial de materias primas" />
        <div className="summary-strip compact">
          <SummaryMetric label="Ingredientes activos" value={String(state.ingredients.length)} />
          <SummaryMetric label="Costo util promedio" value={money.format(state.ingredients.reduce((sum, item) => sum + item.usefulUnitCost, 0) / Math.max(state.ingredients.length, 1))} />
          <SummaryMetric label="Stock valorizado" value={money.format(state.ingredients.reduce((sum, item) => sum + item.currentStock * item.usefulUnitCost, 0))} />
          <SummaryMetric label="Con historial de precios" value={String(state.ingredients.filter((item) => item.priceHistory.length > 0).length)} />
        </div>
        <p className="helper-text">
          Hoja de referencia para compras y costeo: precio actual, costo util, rendimiento, proveedor, ultima compra y variacion contra el registro previo.
        </p>
      </section>

      <section className="panel">
        <PanelHeader title="Grilla de precios MP" />
        <div className="table-wrap spreadsheet-wrap">
          <table className="spreadsheet-table">
            <thead>
              <tr>
                <th>Ingrediente</th>
                <th>Categoria</th>
                <th>Proveedor</th>
                <th>Unidad compra</th>
                <th>Precio compra</th>
                <th>Unidad uso</th>
                <th>Costo util</th>
                <th>Rend. %</th>
                <th>Ult. compra</th>
                <th>Precio previo</th>
                <th>Precio actual hist.</th>
                <th>Variacion</th>
                <th>Stock</th>
                <th>Min</th>
                <th>Max</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ ingredient, supplier, category, latest, previous, trend }) => (
                <tr key={ingredient.id}>
                  <td>{ingredient.name}</td>
                  <td>{category?.name ?? 'Sin categoria'}</td>
                  <td>{supplier?.name ?? 'Sin proveedor'}</td>
                  <td>{ingredient.purchaseUnit}</td>
                  <td>{money.format(ingredient.purchasePrice)}</td>
                  <td>{ingredient.useUnit}</td>
                  <td>{money.format(ingredient.usefulUnitCost)}</td>
                  <td>{percent.format(ingredient.usableYieldPercent / 100)}</td>
                  <td>{ingredient.lastPurchaseDate || '—'}</td>
                  <td>{previous ? money.format(previous.pricePurchase) : '—'}</td>
                  <td>{latest ? money.format(latest.pricePurchase) : money.format(ingredient.purchasePrice)}</td>
                  <td>{trend ? `${trend.delta >= 0 ? '+' : ''}${percent.format(trend.percentDelta)}` : '—'}</td>
                  <td>{decimal.format(ingredient.currentStock)}</td>
                  <td>{decimal.format(ingredient.minStock)}</td>
                  <td>{decimal.format(ingredient.maxStock)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

function SheetsModule({
  state,
  actions,
  canManage,
  hasFinancialAccess,
}: {
  state: ReturnType<typeof useLocalStore>['state'];
  actions: ReturnType<typeof useLocalStore>['actions'];
  canManage: boolean;
  hasFinancialAccess: boolean;
}) {
  const [tab, setTab] = useState<SheetsTab>('planning');

  return (
    <section className="content-stack">
      <section className="panel">
        <PanelHeader title="Modulo exclusivo de planillas operativas" />
        <div className="sheet-tabbar" role="tablist" aria-label="Planillas operativas">
          <button
            className={tab === 'planning' ? 'sheet-tab active' : 'sheet-tab'}
            onClick={() => setTab('planning')}
            type="button"
          >
            Planificacion mensual
          </button>
          <button
            className={tab === 'costs' ? 'sheet-tab active' : 'sheet-tab'}
            onClick={() => setTab('costs')}
            type="button"
          >
            Costos detallados
          </button>
          <button
            className={tab === 'prices' ? 'sheet-tab active' : 'sheet-tab'}
            onClick={() => setTab('prices')}
            type="button"
          >
            Precios MP
          </button>
        </div>
        <p className="helper-text">
          Desde aqui quedan agrupadas las planillas tipo grilla para operar el negocio: turnos del mes, costo final y referencia de materias primas.
        </p>
      </section>

      {tab === 'planning' && <PlanningModule state={state} actions={actions} canManage={canManage} />}
      {tab === 'costs' && (
        <>
          <DetailedCostsSheet state={state} />
          <ExpensesModule state={state} actions={actions} hasFinancialAccess={hasFinancialAccess} />
        </>
      )}
      {tab === 'prices' && <RawMaterialPricesSheet state={state} />}
    </section>
  );
}

function SettingsModule({
  state,
  actions,
  canManage,
  hasFinancialAccess,
  isAdmin,
}: {
  state: ReturnType<typeof useLocalStore>['state'];
  actions: ReturnType<typeof useLocalStore>['actions'];
  canManage: boolean;
  hasFinancialAccess: boolean;
  isAdmin: boolean;
}) {
  const [businessDraft, setBusinessDraft] = useState(state.business);
  const [indirectDraft, setIndirectDraft] = useState<IndirectCost>(emptyIndirectCost);
  const [editingCostId, setEditingCostId] = useState<string | null>(null);
  const [laborDraft, setLaborDraft] = useState<LaborProfile>(emptyLabor);
  const [editingLaborId, setEditingLaborId] = useState<string | null>(null);
  const [packDraft, setPackDraft] = useState<PackagingCost>(emptyPackaging);
  const [foodCostDraft, setFoodCostDraft] = useState<FoodCostTarget>(() => emptyFoodCostTarget(state));
  const [sanitaryDraft, setSanitaryDraft] = useState<SanitaryCategoryConfig>(state.sanitaryCategories[0]);
  const totalHeadcount = state.laborProfiles.reduce((sum, profile) => sum + Math.max(profile.headcount, 1), 0);
  const sharedExtrasPerPerson = totalHeadcount > 0 ? state.business.personnelSharedExtrasMonthly / totalHeadcount : 0;
  const policyAlerts = [
    ...state.baseRecipes
      .filter((recipe) => getLaborPolicy(state, recipe.laborProfileId, getEffectiveLaborMinutes(recipe.timeMinutes, recipe.laborMinutes)).tone === 'danger')
      .map((recipe) => `Receta base: ${recipe.name}`),
    ...state.dishes
      .filter((dish) => getLaborPolicy(state, dish.laborProfileId, dish.laborMinutes).tone === 'danger')
      .map((dish) => `Plato: ${dish.name}`),
  ];

  useEffect(() => {
    setBusinessDraft(state.business);
  }, [state.business]);

  return (
    <section className="content-stack">
      <section className="panel">
        <PanelHeader title="Configuracion del negocio" />
        <div className="table-wrap spreadsheet-wrap">
          <table className="spreadsheet-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Horario</th>
                <th>Trabajadores</th>
                <th>IVA %</th>
                <th>Food cost %</th>
                <th>Margen %</th>
                <th>Fijos mensuales</th>
                <th>Cargas laborales %</th>
                <th>Extras compartidos</th>
                <th>Max min chef / sous</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><input value={businessDraft.name} onChange={(event) => setBusinessDraft({ ...businessDraft, name: event.target.value })} /></td>
                <td>
                  <select value={businessDraft.businessType} onChange={(event) => setBusinessDraft({ ...businessDraft, businessType: event.target.value as typeof businessDraft.businessType })}>
                    <option>Restaurante</option>
                    <option>Hotel</option>
                    <option>Dark Kitchen</option>
                    <option>Casino</option>
                    <option>Banqueteria</option>
                  </select>
                </td>
                <td><input value={businessDraft.openingHours} onChange={(event) => setBusinessDraft({ ...businessDraft, openingHours: event.target.value })} /></td>
                <td><input type="number" value={businessDraft.workerCount} onChange={(event) => setBusinessDraft({ ...businessDraft, workerCount: parseNumericInput(event.target.value) })} /></td>
                <td><input type="number" step="0.1" value={businessDraft.taxRate * 100} onChange={(event) => setBusinessDraft({ ...businessDraft, taxRate: parseNumericInput(event.target.value) / 100 })} /></td>
                <td><input type="number" step="0.1" value={businessDraft.targetFoodCost * 100} onChange={(event) => setBusinessDraft({ ...businessDraft, targetFoodCost: parseNumericInput(event.target.value) / 100 })} /></td>
                <td><input type="number" step="0.1" value={businessDraft.targetMargin * 100} onChange={(event) => setBusinessDraft({ ...businessDraft, targetMargin: parseNumericInput(event.target.value) / 100 })} /></td>
                <td><input type="number" step="0.001" value={businessDraft.fixedCostsMonthly} onChange={(event) => setBusinessDraft({ ...businessDraft, fixedCostsMonthly: parseNumericInput(event.target.value) })} /></td>
                <td><input type="number" step="0.1" value={businessDraft.payrollBurdenPercent * 100} onChange={(event) => setBusinessDraft({ ...businessDraft, payrollBurdenPercent: parseNumericInput(event.target.value) / 100 })} /></td>
                <td><input type="number" step="0.001" value={businessDraft.personnelSharedExtrasMonthly} onChange={(event) => setBusinessDraft({ ...businessDraft, personnelSharedExtrasMonthly: parseNumericInput(event.target.value) })} /></td>
                <td><input type="number" step="0.1" value={businessDraft.maxLeadershipMinutes} onChange={(event) => setBusinessDraft({ ...businessDraft, maxLeadershipMinutes: parseNumericInput(event.target.value, 20) })} /></td>
                <td>
                  <button
                    type="button"
                    className="icon-button"
                    disabled={!canManage}
                    title="Guardar configuracion"
                    onClick={() => actions.updateBusiness(businessDraft)}
                  >
                    <Save size={15} />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="summary-strip compact">
          <SummaryMetric label="Cargas laborales" value={percent.format(state.business.payrollBurdenPercent)} />
          <SummaryMetric label="Dotacion modelada" value={`${totalHeadcount || 0} personas`} />
          <SummaryMetric label="Extras por persona" value={money.format(sharedExtrasPerPerson)} />
          <SummaryMetric label="Alertas de politica" value={String(policyAlerts.length)} />
        </div>
      </section>

      <DataTable
        title="Gastos indirectos"
        headers={['Nombre', 'Categoria', 'Periodo', 'Monto', 'Mensualizado', 'Metodo', 'Factor', '']}
        rows={[
          ...state.indirectCosts.map((item) => {
            const isEditing = editingCostId === item.id;
            const effectiveCost = isEditing ? indirectDraft : item;
            return [
              isEditing ? <input key={`${item.id}-name`} value={indirectDraft.name} onChange={(event) => setIndirectDraft({ ...indirectDraft, name: event.target.value })} /> : item.name,
              isEditing ? <input key={`${item.id}-category`} value={indirectDraft.category} onChange={(event) => setIndirectDraft({ ...indirectDraft, category: event.target.value })} /> : item.category,
              isEditing ? (
                <select key={`${item.id}-period`} value={indirectDraft.period} onChange={(event) => setIndirectDraft({ ...indirectDraft, period: event.target.value as IndirectCost['period'] })}>
                  <option value="diario">Diario</option>
                  <option value="semanal">Semanal</option>
                  <option value="mensual">Mensual</option>
                </select>
              ) : item.period,
              isEditing ? <input key={`${item.id}-amount`} type="number" step="0.001" value={indirectDraft.amount} onChange={(event) => setIndirectDraft({ ...indirectDraft, amount: parseNumericInput(event.target.value) })} /> : money.format(item.amount),
              money.format(getMonthlyCostAmount(effectiveCost)),
              isEditing ? (
                <select key={`${item.id}-method`} value={indirectDraft.allocationMethod} onChange={(event) => setIndirectDraft({ ...indirectDraft, allocationMethod: event.target.value as IndirectCost['allocationMethod'] })}>
                  <option value="manual">Manual</option>
                  <option value="hours">Horas</option>
                  <option value="sales">Ventas</option>
                  <option value="product">Producto</option>
                  <option value="recipe">Receta</option>
                  <option value="category">Categoria</option>
                </select>
              ) : item.allocationMethod,
              isEditing ? <input key={`${item.id}-factor`} type="number" step="0.01" value={indirectDraft.allocationValue} onChange={(event) => setIndirectDraft({ ...indirectDraft, allocationValue: parseNumericInput(event.target.value, 1) })} /> : decimal.format(item.allocationValue),
              <div className="row-actions" key={`${item.id}-actions`}>
                {isEditing ? (
                  <>
                    <button className="icon-button" title="Guardar gasto" onClick={() => {
                      actions.upsertIndirectCost(indirectDraft);
                      setEditingCostId(null);
                      setIndirectDraft(emptyIndirectCost());
                    }}>
                      <Save size={15} />
                    </button>
                    <button className="secondary-button compact" title="Cancelar edicion" onClick={() => {
                      setEditingCostId(null);
                      setIndirectDraft(emptyIndirectCost());
                    }}>
                      Cancelar
                    </button>
                  </>
                ) : (
                  <>
                    <button className="icon-button" title="Editar gasto" onClick={() => {
                      setEditingCostId(item.id);
                      setIndirectDraft(item);
                    }}>
                      <Pencil size={15} />
                    </button>
                    <button className="icon-button" title="Eliminar gasto" onClick={() => actions.removeIndirectCost(item.id)}>
                      <Trash2 size={15} />
                    </button>
                  </>
                )}
              </div>,
            ];
          }),
          [
            <input key="new-cost-name" placeholder="Nuevo gasto" value={editingCostId ? '' : indirectDraft.name} onChange={(event) => !editingCostId && setIndirectDraft({ ...indirectDraft, name: event.target.value })} disabled={Boolean(editingCostId)} />,
            <input key="new-cost-category" placeholder="Categoria" value={editingCostId ? '' : indirectDraft.category} onChange={(event) => !editingCostId && setIndirectDraft({ ...indirectDraft, category: event.target.value })} disabled={Boolean(editingCostId)} />,
            <select key="new-cost-period" value={editingCostId ? 'mensual' : indirectDraft.period} onChange={(event) => !editingCostId && setIndirectDraft({ ...indirectDraft, period: event.target.value as IndirectCost['period'] })} disabled={Boolean(editingCostId)}>
              <option value="diario">Diario</option>
              <option value="semanal">Semanal</option>
              <option value="mensual">Mensual</option>
            </select>,
            <input key="new-cost-amount" type="number" step="0.001" value={editingCostId ? 0 : indirectDraft.amount} onChange={(event) => !editingCostId && setIndirectDraft({ ...indirectDraft, amount: parseNumericInput(event.target.value) })} disabled={Boolean(editingCostId)} />,
            money.format(getMonthlyCostAmount(indirectDraft)),
            <select key="new-cost-method" value={editingCostId ? 'manual' : indirectDraft.allocationMethod} onChange={(event) => !editingCostId && setIndirectDraft({ ...indirectDraft, allocationMethod: event.target.value as IndirectCost['allocationMethod'] })} disabled={Boolean(editingCostId)}>
              <option value="manual">Manual</option>
              <option value="hours">Horas</option>
              <option value="sales">Ventas</option>
              <option value="product">Producto</option>
              <option value="recipe">Receta</option>
              <option value="category">Categoria</option>
            </select>,
            <input key="new-cost-factor" type="number" step="0.01" value={editingCostId ? 1 : indirectDraft.allocationValue} onChange={(event) => !editingCostId && setIndirectDraft({ ...indirectDraft, allocationValue: parseNumericInput(event.target.value, 1) })} disabled={Boolean(editingCostId)} />,
            <div className="row-actions" key="new-cost-actions">
              <button className="icon-button" disabled={!hasFinancialAccess || !indirectDraft.name || Boolean(editingCostId)} title="Agregar gasto" onClick={() => {
                actions.upsertIndirectCost(indirectDraft);
                setIndirectDraft(emptyIndirectCost());
              }}>
                <Save size={15} />
              </button>
            </div>,
          ],
        ]}
      />

      <DataTable
        title="Dotacion y costo empresa"
        headers={['Cargo', 'Grupo', 'Dotacion', 'Sueldo base por persona', 'Horas mes', 'Extras cargo / mes', 'Costo empresa / mes', 'Costo hora', 'Politica tiempo', '']}
        rows={[
          ...state.laborProfiles.map((profile) => {
            const isEditing = editingLaborId === profile.id;
            const effectiveProfile = isEditing ? laborDraft : profile;
            return [
              isEditing ? <input key={`${profile.id}-role`} value={laborDraft.roleName} onChange={(event) => setLaborDraft({ ...laborDraft, roleName: event.target.value })} /> : profile.roleName,
              isEditing ? (
                <select key={`${profile.id}-group`} value={laborDraft.roleGroup} onChange={(event) => setLaborDraft({ ...laborDraft, roleGroup: event.target.value as LaborRoleGroup })}>
                  {Object.entries(laborRoleGroupLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              ) : laborRoleGroupLabels[profile.roleGroup],
              isEditing ? <input key={`${profile.id}-headcount`} type="number" step="1" value={laborDraft.headcount} onChange={(event) => setLaborDraft({ ...laborDraft, headcount: parseNumericInput(event.target.value, 1) })} /> : String(profile.headcount),
              isEditing ? <input key={`${profile.id}-salary`} type="number" step="0.001" value={laborDraft.monthlySalary} onChange={(event) => setLaborDraft({ ...laborDraft, monthlySalary: parseNumericInput(event.target.value) })} /> : money.format(profile.monthlySalary),
              isEditing ? <input key={`${profile.id}-hours`} type="number" step="0.1" value={laborDraft.monthlyHours} onChange={(event) => setLaborDraft({ ...laborDraft, monthlyHours: parseNumericInput(event.target.value) })} /> : decimal.format(profile.monthlyHours),
              isEditing ? <input key={`${profile.id}-extras`} type="number" step="0.001" value={laborDraft.extraMonthlyCost} onChange={(event) => setLaborDraft({ ...laborDraft, extraMonthlyCost: parseNumericInput(event.target.value) })} /> : money.format(profile.extraMonthlyCost),
              money.format(calculateLaborProfileMonthlyCost(state, effectiveProfile)),
              money.format(calculateLaborProfileCostPerMinute(state, effectiveProfile) * 60),
              effectiveProfile.roleGroup === 'ayudante'
                ? <StatusBadge key={`${profile.id}-policy`} text="Absorbe tareas largas" tone="ok" />
                : <StatusBadge
                    key={`${profile.id}-policy`}
                    text={`Hasta ${decimal.format(state.business.maxLeadershipMinutes)} min`}
                    tone={effectiveProfile.roleGroup === 'chef' || effectiveProfile.roleGroup === 'sous-chef' ? 'warning' : 'ok'}
                  />,
              <div className="row-actions" key={`${profile.id}-actions`}>
                {isEditing ? (
                  <>
                    <button
                      className="icon-button"
                      title="Guardar perfil"
                      onClick={() => {
                        actions.upsertLaborProfile(laborDraft);
                        setEditingLaborId(null);
                        setLaborDraft(emptyLabor());
                      }}
                    >
                      <Save size={15} />
                    </button>
                    <button
                      className="secondary-button compact"
                      title="Cancelar edicion"
                      onClick={() => {
                        setEditingLaborId(null);
                        setLaborDraft(emptyLabor());
                      }}
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="icon-button"
                      title="Editar perfil"
                      onClick={() => {
                        setEditingLaborId(profile.id);
                        setLaborDraft(profile);
                      }}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      className="icon-button"
                      title="Eliminar perfil"
                      onClick={() => actions.removeLaborProfile(profile.id)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </>
                )}
              </div>,
            ];
          }),
          [
            <input key="new-labor-role" placeholder="Nuevo cargo" value={editingLaborId ? '' : laborDraft.roleName} onChange={(event) => !editingLaborId && setLaborDraft({ ...laborDraft, roleName: event.target.value })} disabled={Boolean(editingLaborId)} />,
            <select key="new-labor-group" value={editingLaborId ? 'cocinero' : laborDraft.roleGroup} onChange={(event) => !editingLaborId && setLaborDraft({ ...laborDraft, roleGroup: event.target.value as LaborRoleGroup })} disabled={Boolean(editingLaborId)}>
              {Object.entries(laborRoleGroupLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>,
            <input key="new-labor-headcount" type="number" step="1" value={editingLaborId ? 1 : laborDraft.headcount} onChange={(event) => !editingLaborId && setLaborDraft({ ...laborDraft, headcount: parseNumericInput(event.target.value, 1) })} disabled={Boolean(editingLaborId)} />,
            <input key="new-labor-salary" type="number" step="0.001" value={editingLaborId ? 0 : laborDraft.monthlySalary} onChange={(event) => !editingLaborId && setLaborDraft({ ...laborDraft, monthlySalary: parseNumericInput(event.target.value) })} disabled={Boolean(editingLaborId)} />,
            <input key="new-labor-hours" type="number" step="0.1" value={editingLaborId ? 220 : laborDraft.monthlyHours} onChange={(event) => !editingLaborId && setLaborDraft({ ...laborDraft, monthlyHours: parseNumericInput(event.target.value) })} disabled={Boolean(editingLaborId)} />,
            <input key="new-labor-extras" type="number" step="0.001" value={editingLaborId ? 0 : laborDraft.extraMonthlyCost} onChange={(event) => !editingLaborId && setLaborDraft({ ...laborDraft, extraMonthlyCost: parseNumericInput(event.target.value) })} disabled={Boolean(editingLaborId)} />,
            money.format(calculateLaborProfileMonthlyCost(state, laborDraft)),
            money.format(calculateLaborProfileCostPerMinute(state, laborDraft) * 60),
            laborDraft.roleGroup === 'ayudante'
              ? <StatusBadge key="new-labor-policy" text="Absorbe tareas largas" tone="ok" />
              : <StatusBadge key="new-labor-policy" text={`Hasta ${decimal.format(state.business.maxLeadershipMinutes)} min`} tone={laborDraft.roleGroup === 'chef' || laborDraft.roleGroup === 'sous-chef' ? 'warning' : 'ok'} />,
            <div className="row-actions" key="new-labor-actions">
              <button
                className="icon-button"
                disabled={!canManage || !laborDraft.roleName || Boolean(editingLaborId)}
                title="Agregar perfil"
                onClick={() => {
                  actions.upsertLaborProfile(laborDraft);
                  setLaborDraft(emptyLabor());
                }}
              >
                <Save size={15} />
              </button>
            </div>,
          ],
        ]}
      />
      <p className="helper-text">Todo se edita en grilla: lapiz para modificar una fila existente y ultima fila para agregar una nueva.</p>

      {policyAlerts.length > 0 && (
        <section className="panel">
          <PanelHeader title="Alertas de politica operacional" />
          <div className="stack-list">
            {policyAlerts.map((alert) => (
              <div className="alert-row warning" key={alert}>
                <AlertTriangle size={18} />
                <div>
                  <strong>{alert}</strong>
                  <span>Supera el umbral y debe reasignarse a ayudante de cocina o partir la tarea.</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="dashboard-grid">
        <section className="panel">
          <PanelHeader title="Packaging" />
          <div className="form-grid two">
            <label>Nombre<input value={packDraft.name} onChange={(event) => setPackDraft({ ...packDraft, name: event.target.value })} /></label>
            <label>
              Canal
              <select value={packDraft.channel} onChange={(event) => setPackDraft({ ...packDraft, channel: event.target.value as PackagingCost['channel'] })}>
                <option>General</option>
                {channels.map((channel) => <option key={channel}>{channel}</option>)}
              </select>
            </label>
            <label>Costo unitario<input type="number" step="0.001" value={packDraft.unitCost} onChange={(event) => setPackDraft({ ...packDraft, unitCost: parseNumericInput(event.target.value) })} /></label>
          </div>
          <button className="primary-button" disabled={!canManage || !packDraft.name} onClick={() => {
            actions.upsertPackagingCost(packDraft);
            setPackDraft(emptyPackaging());
          }}>
            <Save size={18} /> Guardar packaging
          </button>
        </section>

        <section className="panel">
          <PanelHeader title="Food cost objetivo" />
          <div className="form-grid two">
            <label>
              Scope
              <select value={foodCostDraft.scopeType} onChange={(event) => setFoodCostDraft({ ...foodCostDraft, scopeType: event.target.value as FoodCostTarget['scopeType'] })}>
                <option value="business">Negocio</option>
                <option value="category">Categoria</option>
                <option value="dish">Plato</option>
                <option value="service">Servicio</option>
                <option value="menu">Menu</option>
              </select>
            </label>
            <label>ID referencia<input value={foodCostDraft.scopeId} onChange={(event) => setFoodCostDraft({ ...foodCostDraft, scopeId: event.target.value })} /></label>
            <label>Objetivo %<input type="number" step="0.1" value={foodCostDraft.targetPercent * 100} onChange={(event) => setFoodCostDraft({ ...foodCostDraft, targetPercent: parseNumericInput(event.target.value) / 100 })} /></label>
          </div>
          <button className="primary-button" disabled={!hasFinancialAccess} onClick={() => {
            actions.upsertFoodCostTarget(foodCostDraft);
            setFoodCostDraft(emptyFoodCostTarget(state));
          }}>
            <Save size={18} /> Guardar objetivo
          </button>
        </section>
      </div>

      <section className="panel">
        <PanelHeader title="Configuracion sanitaria HACCP" />
        <div className="form-section-stack">
          <section className="form-section">
            <h3>Identidad sanitaria</h3>
            <div className="form-grid four">
              <label>
                Categoria
                <select value={sanitaryDraft.id} onChange={(event) => {
                  const next = state.sanitaryCategories.find((item) => item.id === event.target.value);
                  if (next) setSanitaryDraft(next);
                }}>
                  {state.sanitaryCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </label>
              <label>Color<input value={sanitaryDraft.colorName} onChange={(event) => setSanitaryDraft({ ...sanitaryDraft, colorName: event.target.value })} /></label>
              <label>Hex<input value={sanitaryDraft.colorHex} onChange={(event) => setSanitaryDraft({ ...sanitaryDraft, colorHex: event.target.value })} /></label>
              <label>Almacenamiento<input value={sanitaryDraft.storageType} onChange={(event) => setSanitaryDraft({ ...sanitaryDraft, storageType: event.target.value })} /></label>
            </div>
          </section>

          <section className="form-section">
            <h3>Control de riesgo</h3>
            <div className="form-grid four">
              <label>Temp minima<input type="number" step="0.1" value={sanitaryDraft.minTemp} onChange={(event) => setSanitaryDraft({ ...sanitaryDraft, minTemp: parseNumericInput(event.target.value) })} /></label>
              <label>Temp maxima<input type="number" step="0.1" value={sanitaryDraft.maxTemp} onChange={(event) => setSanitaryDraft({ ...sanitaryDraft, maxTemp: parseNumericInput(event.target.value) })} /></label>
              <label>
                Riesgo
                <select value={sanitaryDraft.riskLevel} onChange={(event) => setSanitaryDraft({ ...sanitaryDraft, riskLevel: event.target.value as RiskLevel })}>
                  <option>Bajo</option>
                  <option>Medio</option>
                  <option>Alto</option>
                  <option>Bajo/Medio</option>
                  <option>Medio/Alto</option>
                  <option>Critico</option>
                </select>
              </label>
              <label>Condicion sanitaria<input value={sanitaryDraft.sanitaryCondition} onChange={(event) => setSanitaryDraft({ ...sanitaryDraft, sanitaryCondition: event.target.value })} /></label>
            </div>
          </section>
        </div>
        <div className="toolbar">
          <ColorChip text={`${sanitaryDraft.name} · ${sanitaryDraft.colorName}`} colorHex={sanitaryDraft.colorHex} />
          <button className="primary-button" disabled={!isAdmin} onClick={() => actions.upsertSanitaryCategory(sanitaryDraft)}>
            <Save size={18} /> Guardar categoria sanitaria
          </button>
        </div>
        <p className="helper-text">Configuracion fija del sistema. Solo administracion debe modificar estos estandares.</p>
      </section>
    </section>
  );
}

function KpiCard({ title, value, icon: Icon }: { title: string; value: string; icon: typeof Store }) {
  return (
    <section className="kpi">
      <div className="kpi-icon"><Icon size={18} /></div>
      <span>{title}</span>
      <strong>{value}</strong>
    </section>
  );
}

function PanelHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="panel-header">
      <h2>{title}</h2>
      {action}
    </div>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusBadge({ text, tone }: { text: string; tone: 'ok' | 'warning' | 'danger' }) {
  return <span className={`status-badge ${tone}`}>{text}</span>;
}

function ColorChip({ text, colorHex }: { text: string; colorHex: string }) {
  return (
    <span className="color-chip">
      <span className="color-dot" style={{ backgroundColor: colorHex }} />
      {text}
    </span>
  );
}

function DataTable({
  title,
  headers,
  rows,
}: {
  title?: string;
  headers: string[];
  rows: Array<Array<ReactNode>>;
}) {
  return (
    <section className="panel">
      {title && <PanelHeader title={title} />}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
