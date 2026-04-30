export type Role =
  | 'Administrador general'
  | 'Gerente'
  | 'Chef ejecutivo'
  | 'Sous chef'
  | 'Jefe de compras'
  | 'Bodega'
  | 'Finanzas'
  | 'Operador';

export type Unit = 'kg' | 'g' | 'litro' | 'ml' | 'unidad' | 'porcion';

export type CategoryType = 'ingredient' | 'dish' | 'menu';

export type BusinessType =
  | 'Restaurante'
  | 'Hotel'
  | 'Dark Kitchen'
  | 'Casino'
  | 'Banqueteria';

export type CostPeriod = 'diario' | 'semanal' | 'mensual';

export type PurchaseStatus = 'draft' | 'partial' | 'received';

export type InventoryMovementType = 'entry' | 'exit' | 'adjustment' | 'waste' | 'production';

export type WasteType =
  | 'Operacional'
  | 'Produccion'
  | 'Vencimiento'
  | 'Manipulacion'
  | 'Coccion'
  | 'Limpieza'
  | 'Error humano'
  | 'Devolucion';

export type ProductionStatus = 'Pendiente' | 'En produccion' | 'Finalizado' | 'Cancelado';

export type SalesChannel =
  | 'Salon'
  | 'Delivery'
  | 'Retiro'
  | 'Hotel'
  | 'Eventos'
  | 'Banqueteria'
  | 'Room service';

export type AllocationMethod = 'recipe' | 'product' | 'category' | 'sales' | 'hours' | 'manual';

export type FoodCostScope = 'business' | 'category' | 'dish' | 'service' | 'menu' | 'event';

export type RecipeKind = 'base' | 'final';
export type RiskLevel = 'Bajo' | 'Medio' | 'Alto' | 'Bajo/Medio' | 'Medio/Alto' | 'Critico';
export type LaborRoleGroup = 'chef' | 'sous-chef' | 'cocinero' | 'ayudante' | 'pasteleria' | 'administrativo';

export interface SanitaryCategoryConfig {
  id: string;
  name: string;
  colorName: string;
  colorHex: string;
  storageType: string;
  minTemp: number;
  maxTemp: number;
  riskLevel: RiskLevel;
  sanitaryCondition: string;
  dangerZoneSensitive: boolean;
  crossContaminationGroup: string;
}

export interface UserProfile {
  id: string;
  businessId: string;
  name: string;
  email: string;
  role: Role;
}

export interface BusinessSettings {
  id: string;
  name: string;
  businessType: BusinessType;
  currency: 'CLP';
  taxRate: number;
  targetFoodCost: number;
  targetMargin: number;
  fixedCostsMonthly: number;
  payrollBurdenPercent: number;
  personnelSharedExtrasMonthly: number;
  maxLeadershipMinutes: number;
  openingHours: string;
  workerCount: number;
  internalCategories: string[];
}

export interface Category {
  id: string;
  type: CategoryType;
  name: string;
}

export interface Supplier {
  id: string;
  name: string;
  rut: string;
  contactName: string;
  phone: string;
  email: string;
  productCategory: string;
  paymentTerms: string;
  leadTimeDays: number;
  qualityScore: number;
  deliveryScore: number;
  notes: string;
}

export interface IngredientPriceHistory {
  date: string;
  supplierId: string;
  pricePurchase: number;
}

export interface Ingredient {
  id: string;
  name: string;
  categoryId: string;
  sanitaryCategoryId: string;
  primarySupplierId: string;
  purchaseUnit: Unit;
  useUnit: Unit;
  purchasePrice: number;
  usefulUnitCost: number;
  usableYieldPercent: number;
  currentStock: number;
  minStock: number;
  maxStock: number;
  lastPurchaseDate: string;
  priceHistory: IngredientPriceHistory[];
  shelfLifeDays: number;
  storageType: string;
  storageConditions: string;
  storageTemperature: string;
  recommendedMinTemp: number;
  recommendedMaxTemp: number;
  currentStorageTemp: number;
  riskLevel: RiskLevel;
  colorHex: string;
  colorName: string;
  internalCode: string;
  supplierCode: string;
  storageLocation: string;
  receivedDate: string;
  expiryDate: string;
  lotCode: string;
  responsible: string;
}

export interface YieldRecord {
  id: string;
  ingredientId: string;
  recordedAt: string;
  purchaseWeight: number;
  cleanedWeight: number;
  cookedWeight: number;
  finalUsefulWeight: number;
  wastePercent: number;
  yieldPercent: number;
  wasteType: string;
  trimLoss: number;
  peelLoss: number;
  boneLoss: number;
  fatLoss: number;
  evaporationLoss: number;
  thawLoss: number;
  handlingLoss: number;
  notes: string;
}

export interface RecipeItem {
  id: string;
  ingredientId: string;
  quantity: number;
  unit: Unit;
  wastePercent: number;
}

export interface LaborProfile {
  id: string;
  roleName: string;
  roleGroup: LaborRoleGroup;
  headcount: number;
  monthlySalary: number;
  monthlyHours: number;
  extraMonthlyCost: number;
}

export interface BaseRecipe {
  id: string;
  name: string;
  categoryId: string;
  kind: RecipeKind;
  yieldAmount: number;
  yieldUnit: Unit;
  itemCostUnit: Unit;
  items: RecipeItem[];
  timeMinutes: number;
  laborProfileId: string;
  laborMinutes: number;
  instructions: string;
  qualityNotes: string;
  allergens: string[];
  observations: string;
}

export interface PackagingCost {
  id: string;
  name: string;
  channel: SalesChannel | 'General';
  unit: Unit;
  unitCost: number;
}

export interface DishComponent {
  id: string;
  componentType: 'ingredient' | 'baseRecipe' | 'packaging';
  refId: string;
  quantity: number;
  unit: Unit;
  wastePercent: number;
}

export interface Dish {
  id: string;
  name: string;
  categoryId: string;
  service: 'Desayuno' | 'Almuerzo' | 'Cena' | 'Delivery' | 'Evento';
  directItems: DishComponent[];
  garnishes: string[];
  decorations: string[];
  laborProfileId: string;
  laborMinutes: number;
  indirectCostShare: number;
  targetFoodCost: number;
  desiredMargin: number;
  allergens: string[];
  platingNotes: string;
  qualityChecklist: string[];
  technicalNotes: string;
  shelfLifeHours: number;
  salesCount: number;
  imageUrl?: string;
}

export interface FoodCostTarget {
  id: string;
  scopeType: FoodCostScope;
  scopeId: string;
  targetPercent: number;
}

export interface IndirectCost {
  id: string;
  name: string;
  category: string;
  period: CostPeriod;
  amount: number;
  allocationMethod: AllocationMethod;
  allocationValue: number;
}

export interface PurchaseItem {
  id: string;
  ingredientId: string;
  quantity: number;
  unit: Unit;
  unitPrice: number;
  receivedQuantity: number;
}

export interface Purchase {
  id: string;
  supplierId: string;
  orderedAt: string;
  status: PurchaseStatus;
  items: PurchaseItem[];
  notes: string;
}

export interface InventoryMovement {
  id: string;
  ingredientId: string;
  type: InventoryMovementType;
  quantity: number;
  unit: Unit;
  date: string;
  lot: string;
  expiresAt: string;
  location: string;
  notes: string;
}

export interface WasteRecord {
  id: string;
  ingredientId: string;
  quantity: number;
  unit: Unit;
  reasonType: WasteType;
  responsible: string;
  date: string;
  costImpact: number;
}

export interface ProductionPlanItem {
  id: string;
  refType: 'baseRecipe' | 'dish';
  refId: string;
  quantity: number;
}

export interface ProductionPlan {
  id: string;
  name: string;
  scheduledFor: string;
  responsible: string;
  status: ProductionStatus;
  items: ProductionPlanItem[];
}

export interface WarehouseAuditRecord {
  id: string;
  ingredientId: string;
  checkedAt: string;
  checkedBy: string;
  countedStock: number;
  stockUnit: Unit;
  storageTemp: number;
  location: string;
  notes: string;
}

export interface SaleItem {
  id: string;
  dishId: string;
  quantity: number;
  unitPrice: number;
  discount: number;
}

export interface Sale {
  id: string;
  soldAt: string;
  channel: SalesChannel;
  items: SaleItem[];
}

export interface Menu {
  id: string;
  name: string;
  categoryIds: string[];
  dishIds: string[];
}

export interface ProjectionDay {
  day: string;
  projectedCustomers: number;
  avgFoodTicket: number;
  avgBeverageTicket: number;
}

export interface Projection {
  id: string;
  name: string;
  period: 'dia' | 'semana' | 'mes';
  days: ProjectionDay[];
}

export interface StaffShift {
  id: string;
  laborProfileId: string;
  employeeName: string;
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  extraMinutes: number;
  notes: string;
}

export interface EventQuote {
  id: string;
  name: string;
  eventType: string;
  guests: number;
  dishIds: string[];
  laborCost: number;
  transportCost: number;
  setupCost: number;
  equipmentCost: number;
  marginTarget: number;
}

export interface AppState {
  users: UserProfile[];
  business: BusinessSettings;
  categories: Category[];
  sanitaryCategories: SanitaryCategoryConfig[];
  suppliers: Supplier[];
  ingredients: Ingredient[];
  yieldRecords: YieldRecord[];
  laborProfiles: LaborProfile[];
  baseRecipes: BaseRecipe[];
  dishes: Dish[];
  foodCostTargets: FoodCostTarget[];
  indirectCosts: IndirectCost[];
  packagingCosts: PackagingCost[];
  purchases: Purchase[];
  inventoryMovements: InventoryMovement[];
  warehouseAudits: WarehouseAuditRecord[];
  wasteRecords: WasteRecord[];
  productionPlans: ProductionPlan[];
  sales: Sale[];
  menus: Menu[];
  projections: Projection[];
  staffShifts: StaffShift[];
  eventQuotes: EventQuote[];
}

export interface IngredientCostSnapshot {
  ingredientId: string;
  usefulUnitCost: number;
  yieldPercent: number;
}

export interface BaseRecipeCostResult {
  lines: Array<{
    recipeItemId: string;
    ingredientId: string;
    ingredientName: string;
    quantity: number;
    unit: Unit;
    wastePercent: number;
    normalizedQuantity: number;
    useUnit: Unit;
    purchasePrice: number;
    usefulUnitCost: number;
    lineCost: number;
  }>;
  ingredientCost: number;
  laborCost: number;
  indirectCost: number;
  totalCost: number;
  costPerYieldUnit: number;
}

export interface DishCostResult {
  componentLines: Array<{
    componentId: string;
    componentType: DishComponent['componentType'];
    refId: string;
    componentName: string;
    quantity: number;
    unit: Unit;
    wastePercent: number;
    unitCost: number;
    lineCost: number;
    nestedLines?: Array<{
      ingredientId: string;
      ingredientName: string;
      quantity: number;
      unit: Unit;
      purchasePrice: number;
      usefulUnitCost: number;
      lineCost: number;
    }>;
  }>;
  ingredientCost: number;
  baseRecipeCost: number;
  packagingCost: number;
  materialCost: number;
  wasteCost: number;
  baseRecipeLaborCost: number;
  baseRecipeIndirectCost: number;
  variableCost: number;
  fixedAllocatedCost: number;
  commissionCost: number;
  safetyBufferCost: number;
  directCost: number;
  laborCost: number;
  productionCost: number;
  indirectCost: number;
  totalCost: number;
  subtotalBeforeMargin: number;
  formulaPrice: number;
  suggestedPriceByFoodCost: number;
  suggestedPriceByMargin: number;
  recommendedPrice: number;
  grossMarginPercent: number;
  netMarginPercent: number;
  foodCostPercent: number;
}

export interface DashboardAlert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  context?: string;
}

export interface DashboardMetrics {
  totalSales: number;
  totalCosts: number;
  foodCostPercent: number;
  grossMarginPercent: number;
  netMarginPercent: number;
  estimatedProfit: number;
  monthlyProjection: number;
  projectedNetMarginPercent: number;
  projectedProfit: number;
  topDishes: Array<{ dish: Dish; result: DishCostResult; unitsSold: number }>;
  lowDishes: Array<{ dish: Dish; result: DishCostResult; unitsSold: number }>;
  alerts: DashboardAlert[];
}

export interface MenuEngineeringItem {
  dish: Dish;
  result: DishCostResult;
  unitsSold: number;
  revenue: number;
  contribution: number;
  popularityIndex: number;
  quadrant: 'Estrella' | 'Caballo' | 'Puzzle' | 'Perro';
  recommendedAction: string;
}

export interface ReportSnapshot {
  inventoryValue: number;
  wasteValue: number;
  breakEvenSales: number;
  breakEvenUnits: number;
  breakEvenGuestTickets: number;
  totalMonthlyStructure: number;
  averageDishSellingPrice: number;
  projectedAverageFoodTicket: number;
  contributionMargin: number;
  contributionMarginRatio: number;
  projectedProfit: number;
}
