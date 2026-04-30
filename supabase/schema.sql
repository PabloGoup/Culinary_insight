create extension if not exists "uuid-ossp";

create type app_role as enum (
  'Administrador general',
  'Gerente',
  'Chef ejecutivo',
  'Sous chef',
  'Jefe de compras',
  'Bodega',
  'Finanzas',
  'Operador'
);

create type category_type as enum ('ingredient', 'dish', 'menu');
create type business_type as enum ('Restaurante', 'Hotel', 'Dark Kitchen', 'Casino', 'Banqueteria');
create type app_currency as enum ('CLP');
create type unit_type as enum ('kg', 'g', 'litro', 'ml', 'unidad', 'porcion');
create type cost_period as enum ('diario', 'semanal', 'mensual');
create type purchase_status as enum ('draft', 'partial', 'received');
create type inventory_movement_type as enum ('entry', 'exit', 'adjustment', 'waste', 'production');
create type waste_type as enum ('Operacional', 'Produccion', 'Vencimiento', 'Manipulacion', 'Coccion', 'Limpieza', 'Error humano', 'Devolucion');
create type production_status as enum ('Pendiente', 'En produccion', 'Finalizado', 'Cancelado');
create type sales_channel as enum ('Salon', 'Delivery', 'Retiro', 'Hotel', 'Eventos', 'Banqueteria', 'Room service');
create type allocation_method as enum ('recipe', 'product', 'category', 'sales', 'hours', 'manual');
create type food_cost_scope as enum ('business', 'category', 'dish', 'service', 'menu', 'event');
create type recipe_kind as enum ('base', 'final');
create type risk_level as enum ('Bajo', 'Medio', 'Alto', 'Bajo/Medio', 'Medio/Alto', 'Critico');
create type projection_period as enum ('dia', 'semana', 'mes');
create type dish_service as enum ('Desayuno', 'Almuerzo', 'Cena', 'Delivery', 'Evento');
create type dish_component_type as enum ('ingredient', 'baseRecipe', 'packaging');
create type production_ref_type as enum ('baseRecipe', 'dish');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.businesses (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  business_type business_type not null default 'Restaurante',
  currency app_currency not null default 'CLP',
  tax_rate numeric(8, 4) not null default 0.19,
  target_food_cost numeric(8, 4) not null default 0.30,
  target_margin numeric(8, 4) not null default 0.70,
  fixed_costs_monthly numeric(14, 2) not null default 0,
  payroll_burden_percent numeric(8, 4) not null default 0.32,
  personnel_shared_extras_monthly numeric(14, 2) not null default 0,
  max_leadership_minutes numeric(10, 2) not null default 20,
  opening_hours text not null default '',
  worker_count integer not null default 0,
  internal_categories text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  email text not null unique,
  role app_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  type category_type not null,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, type, name)
);

create table public.sanitary_categories (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  color_name text not null,
  color_hex text not null,
  storage_type text not null,
  min_temp numeric(8, 2) not null,
  max_temp numeric(8, 2) not null,
  risk_level risk_level not null,
  sanitary_condition text not null,
  danger_zone_sensitive boolean not null default true,
  cross_contamination_group text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, name)
);

create table public.suppliers (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  rut text not null default '',
  contact_name text not null default '',
  phone text not null default '',
  email text not null default '',
  product_category text not null default '',
  payment_terms text not null default '',
  lead_time_days integer not null default 0,
  quality_score numeric(4, 2) not null default 0,
  delivery_score numeric(4, 2) not null default 0,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ingredients (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  sanitary_category_id uuid references public.sanitary_categories(id) on delete set null,
  primary_supplier_id uuid references public.suppliers(id) on delete set null,
  name text not null,
  purchase_unit unit_type not null,
  use_unit unit_type not null,
  purchase_price numeric(14, 4) not null default 0,
  useful_unit_cost numeric(14, 4) not null default 0,
  usable_yield_percent numeric(8, 4) not null default 0,
  current_stock numeric(14, 4) not null default 0,
  min_stock numeric(14, 4) not null default 0,
  max_stock numeric(14, 4) not null default 0,
  last_purchase_date date,
  shelf_life_days integer not null default 0,
  storage_type text not null default '',
  storage_conditions text not null default '',
  storage_temperature text not null default '',
  recommended_min_temp numeric(8, 2) not null default 0,
  recommended_max_temp numeric(8, 2) not null default 0,
  current_storage_temp numeric(8, 2) not null default 0,
  risk_level risk_level not null default 'Bajo',
  color_hex text not null default '#000000',
  color_name text not null default '',
  internal_code text not null default '',
  supplier_code text not null default '',
  storage_location text not null default '',
  received_date date,
  expiry_date date,
  lot_code text not null default '',
  responsible text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, internal_code)
);

create table public.ingredient_price_history (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  price_purchase numeric(14, 4) not null,
  recorded_at date not null default current_date,
  created_at timestamptz not null default now()
);

create table public.yield_records (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  recorded_at date not null default current_date,
  purchase_weight numeric(14, 4) not null default 0,
  cleaned_weight numeric(14, 4) not null default 0,
  cooked_weight numeric(14, 4) not null default 0,
  final_useful_weight numeric(14, 4) not null default 0,
  waste_percent numeric(8, 4) not null default 0,
  yield_percent numeric(8, 4) not null default 0,
  waste_type text not null default '',
  trim_loss numeric(14, 4) not null default 0,
  peel_loss numeric(14, 4) not null default 0,
  bone_loss numeric(14, 4) not null default 0,
  fat_loss numeric(14, 4) not null default 0,
  evaporation_loss numeric(14, 4) not null default 0,
  thaw_loss numeric(14, 4) not null default 0,
  handling_loss numeric(14, 4) not null default 0,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table public.labor_profiles (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  role_name text not null,
  role_group text not null default 'cocinero',
  headcount integer not null default 1,
  monthly_salary numeric(14, 2) not null default 0,
  monthly_hours numeric(10, 2) not null default 0,
  extra_monthly_cost numeric(14, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recipes (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  kind recipe_kind not null,
  name text not null,
  yield_amount numeric(14, 4) not null default 1,
  yield_unit unit_type not null,
  item_cost_unit unit_type not null,
  time_minutes numeric(10, 2) not null default 0,
  labor_profile_id uuid references public.labor_profiles(id) on delete set null,
  labor_minutes numeric(10, 2) not null default 0,
  instructions text not null default '',
  quality_notes text not null default '',
  allergens text[] not null default '{}',
  observations text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recipe_items (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  quantity numeric(14, 4) not null default 0,
  unit unit_type not null,
  waste_percent numeric(8, 4) not null default 0,
  created_at timestamptz not null default now()
);

create table public.packaging_costs (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  channel sales_channel,
  unit unit_type not null,
  unit_cost numeric(14, 4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.dishes (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  service dish_service not null,
  labor_profile_id uuid references public.labor_profiles(id) on delete set null,
  labor_minutes numeric(10, 2) not null default 0,
  indirect_cost_share numeric(8, 4) not null default 1,
  target_food_cost numeric(8, 4) not null default 0.30,
  desired_margin numeric(8, 4) not null default 0.70,
  allergens text[] not null default '{}',
  plating_notes text not null default '',
  quality_checklist text[] not null default '{}',
  technical_notes text not null default '',
  shelf_life_hours numeric(10, 2) not null default 0,
  sales_count integer not null default 0,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.dish_components (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  dish_id uuid not null references public.dishes(id) on delete cascade,
  component_type dish_component_type not null,
  ref_id uuid not null,
  quantity numeric(14, 4) not null default 0,
  unit unit_type not null,
  waste_percent numeric(8, 4) not null default 0,
  created_at timestamptz not null default now()
);

create table public.food_cost_targets (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  scope_type food_cost_scope not null,
  scope_id text not null,
  target_percent numeric(8, 4) not null default 0.30,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.indirect_costs (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  category text not null,
  period cost_period not null,
  amount numeric(14, 2) not null default 0,
  allocation_method allocation_method not null,
  allocation_value numeric(10, 4) not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.purchases (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  ordered_at date not null default current_date,
  status purchase_status not null default 'draft',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.purchase_items (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  quantity numeric(14, 4) not null default 0,
  unit unit_type not null,
  unit_price numeric(14, 4) not null default 0,
  received_quantity numeric(14, 4) not null default 0,
  created_at timestamptz not null default now()
);

create table public.inventory_movements (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  type inventory_movement_type not null,
  quantity numeric(14, 4) not null default 0,
  unit unit_type not null,
  movement_date date not null default current_date,
  lot text not null default '',
  expires_at date,
  location text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table public.warehouse_audits (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  checked_at date not null default current_date,
  checked_by text not null default '',
  counted_stock numeric(14, 4) not null default 0,
  stock_unit unit_type not null,
  storage_temp numeric(8, 2) not null default 0,
  location text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table public.waste_records (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  quantity numeric(14, 4) not null default 0,
  unit unit_type not null,
  reason_type waste_type not null,
  responsible text not null default '',
  waste_date date not null default current_date,
  cost_impact numeric(14, 4) not null default 0,
  created_at timestamptz not null default now()
);

create table public.production_plans (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  scheduled_for date not null,
  responsible text not null default '',
  status production_status not null default 'Pendiente',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.production_plan_items (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  production_plan_id uuid not null references public.production_plans(id) on delete cascade,
  ref_type production_ref_type not null,
  ref_id uuid not null,
  quantity numeric(14, 4) not null default 0,
  created_at timestamptz not null default now()
);

create table public.sales (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  sold_at date not null default current_date,
  channel sales_channel not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sale_items (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  sale_id uuid not null references public.sales(id) on delete cascade,
  dish_id uuid not null references public.dishes(id) on delete restrict,
  quantity numeric(14, 4) not null default 0,
  unit_price numeric(14, 4) not null default 0,
  discount numeric(8, 4) not null default 0,
  created_at timestamptz not null default now()
);

create table public.menus (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.menu_categories (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  menu_id uuid not null references public.menus(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (menu_id, category_id)
);

create table public.menu_items (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  menu_id uuid not null references public.menus(id) on delete cascade,
  dish_id uuid not null references public.dishes(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (menu_id, dish_id)
);

create table public.projections (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  period projection_period not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projection_days (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  projection_id uuid not null references public.projections(id) on delete cascade,
  day_name text not null,
  projected_customers integer not null default 0,
  avg_food_ticket numeric(14, 4) not null default 0,
  avg_beverage_ticket numeric(14, 4) not null default 0,
  created_at timestamptz not null default now()
);

create table public.event_quotes (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  event_type text not null,
  guests integer not null default 0,
  labor_cost numeric(14, 2) not null default 0,
  transport_cost numeric(14, 2) not null default 0,
  setup_cost numeric(14, 2) not null default 0,
  equipment_cost numeric(14, 2) not null default 0,
  margin_target numeric(8, 4) not null default 0.30,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.event_quote_dishes (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  event_quote_id uuid not null references public.event_quotes(id) on delete cascade,
  dish_id uuid not null references public.dishes(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (event_quote_id, dish_id)
);

create table public.app_snapshots (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  state jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_businesses_updated_at before update on public.businesses for each row execute function public.set_updated_at();
create trigger set_users_updated_at before update on public.users for each row execute function public.set_updated_at();
create trigger set_categories_updated_at before update on public.categories for each row execute function public.set_updated_at();
create trigger set_sanitary_categories_updated_at before update on public.sanitary_categories for each row execute function public.set_updated_at();
create trigger set_suppliers_updated_at before update on public.suppliers for each row execute function public.set_updated_at();
create trigger set_ingredients_updated_at before update on public.ingredients for each row execute function public.set_updated_at();
create trigger set_labor_profiles_updated_at before update on public.labor_profiles for each row execute function public.set_updated_at();
create trigger set_recipes_updated_at before update on public.recipes for each row execute function public.set_updated_at();
create trigger set_packaging_costs_updated_at before update on public.packaging_costs for each row execute function public.set_updated_at();
create trigger set_dishes_updated_at before update on public.dishes for each row execute function public.set_updated_at();
create trigger set_food_cost_targets_updated_at before update on public.food_cost_targets for each row execute function public.set_updated_at();
create trigger set_indirect_costs_updated_at before update on public.indirect_costs for each row execute function public.set_updated_at();
create trigger set_purchases_updated_at before update on public.purchases for each row execute function public.set_updated_at();
create trigger set_production_plans_updated_at before update on public.production_plans for each row execute function public.set_updated_at();
create trigger set_sales_updated_at before update on public.sales for each row execute function public.set_updated_at();
create trigger set_menus_updated_at before update on public.menus for each row execute function public.set_updated_at();
create trigger set_projections_updated_at before update on public.projections for each row execute function public.set_updated_at();
create trigger set_event_quotes_updated_at before update on public.event_quotes for each row execute function public.set_updated_at();
create trigger set_app_snapshots_updated_at before update on public.app_snapshots for each row execute function public.set_updated_at();

create index idx_users_business_id on public.users (business_id);
create index idx_categories_business_id on public.categories (business_id);
create index idx_sanitary_categories_business_id on public.sanitary_categories (business_id);
create index idx_suppliers_business_id on public.suppliers (business_id);
create index idx_ingredients_business_id on public.ingredients (business_id);
create index idx_ingredients_category_id on public.ingredients (category_id);
create index idx_ingredients_supplier_id on public.ingredients (primary_supplier_id);
create index idx_ingredient_price_history_business_id on public.ingredient_price_history (business_id);
create index idx_yield_records_business_id on public.yield_records (business_id);
create index idx_recipes_business_id on public.recipes (business_id);
create index idx_dishes_business_id on public.dishes (business_id);
create index idx_purchases_business_id on public.purchases (business_id);
create index idx_inventory_movements_business_id on public.inventory_movements (business_id);
create index idx_warehouse_audits_business_id on public.warehouse_audits (business_id);
create index idx_waste_records_business_id on public.waste_records (business_id);
create index idx_production_plans_business_id on public.production_plans (business_id);
create index idx_sales_business_id on public.sales (business_id);
create index idx_menus_business_id on public.menus (business_id);
create index idx_projections_business_id on public.projections (business_id);
create index idx_event_quotes_business_id on public.event_quotes (business_id);

alter table public.businesses enable row level security;
alter table public.users enable row level security;
alter table public.categories enable row level security;
alter table public.sanitary_categories enable row level security;
alter table public.suppliers enable row level security;
alter table public.ingredients enable row level security;
alter table public.ingredient_price_history enable row level security;
alter table public.yield_records enable row level security;
alter table public.labor_profiles enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_items enable row level security;
alter table public.packaging_costs enable row level security;
alter table public.dishes enable row level security;
alter table public.dish_components enable row level security;
alter table public.food_cost_targets enable row level security;
alter table public.indirect_costs enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.warehouse_audits enable row level security;
alter table public.waste_records enable row level security;
alter table public.production_plans enable row level security;
alter table public.production_plan_items enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.menus enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.projections enable row level security;
alter table public.projection_days enable row level security;
alter table public.event_quotes enable row level security;
alter table public.event_quote_dishes enable row level security;
alter table public.app_snapshots enable row level security;

create policy "users own profile" on public.users
  for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "business create authenticated" on public.businesses
  for insert
  with check (auth.role() = 'authenticated');

create policy "business select by membership" on public.businesses
  for select
  using (exists (
    select 1
    from public.users
    where users.business_id = businesses.id
      and users.id = auth.uid()
  ));

create policy "business update by membership" on public.businesses
  for update
  using (exists (
    select 1
    from public.users
    where users.business_id = businesses.id
      and users.id = auth.uid()
  ))
  with check (exists (
    select 1
    from public.users
    where users.business_id = businesses.id
      and users.id = auth.uid()
  ));

create policy "categories by business" on public.categories
  for all
  using (exists (select 1 from public.users where users.business_id = categories.business_id and users.id = auth.uid()))
  with check (exists (select 1 from public.users where users.business_id = categories.business_id and users.id = auth.uid()));

create policy "sanitary categories by business" on public.sanitary_categories
  for all
  using (exists (select 1 from public.users where users.business_id = sanitary_categories.business_id and users.id = auth.uid()))
  with check (exists (select 1 from public.users where users.business_id = sanitary_categories.business_id and users.id = auth.uid()));

create policy "suppliers by business" on public.suppliers
  for all
  using (exists (select 1 from public.users where users.business_id = suppliers.business_id and users.id = auth.uid()))
  with check (exists (select 1 from public.users where users.business_id = suppliers.business_id and users.id = auth.uid()));

create policy "ingredients by business" on public.ingredients
  for all
  using (exists (select 1 from public.users where users.business_id = ingredients.business_id and users.id = auth.uid()))
  with check (exists (select 1 from public.users where users.business_id = ingredients.business_id and users.id = auth.uid()));

create policy "ingredient price history by business" on public.ingredient_price_history
  for all
  using (exists (select 1 from public.users where users.business_id = ingredient_price_history.business_id and users.id = auth.uid()))
  with check (exists (select 1 from public.users where users.business_id = ingredient_price_history.business_id and users.id = auth.uid()));

create policy "yield records by business" on public.yield_records
  for all
  using (exists (select 1 from public.users where users.business_id = yield_records.business_id and users.id = auth.uid()))
  with check (exists (select 1 from public.users where users.business_id = yield_records.business_id and users.id = auth.uid()));

create policy "labor profiles by business" on public.labor_profiles
  for all
  using (exists (select 1 from public.users where users.business_id = labor_profiles.business_id and users.id = auth.uid()))
  with check (exists (select 1 from public.users where users.business_id = labor_profiles.business_id and users.id = auth.uid()));

create policy "recipes by business" on public.recipes
  for all
  using (exists (select 1 from public.users where users.business_id = recipes.business_id and users.id = auth.uid()))
  with check (exists (select 1 from public.users where users.business_id = recipes.business_id and users.id = auth.uid()));

create policy "recipe items by business" on public.recipe_items
  for all
  using (exists (select 1 from public.users where users.business_id = recipe_items.business_id and users.id = auth.uid()))
  with check (exists (select 1 from public.users where users.business_id = recipe_items.business_id and users.id = auth.uid()));

create policy "packaging costs by business" on public.packaging_costs
  for all
  using (exists (select 1 from public.users where users.business_id = packaging_costs.business_id and users.id = auth.uid()))
  with check (exists (select 1 from public.users where users.business_id = packaging_costs.business_id and users.id = auth.uid()));

create policy "dishes by business" on public.dishes
  for all
  using (exists (select 1 from public.users where users.business_id = dishes.business_id and users.id = auth.uid()))
  with check (exists (select 1 from public.users where users.business_id = dishes.business_id and users.id = auth.uid()));

create policy "dish components by business" on public.dish_components
  for all
  using (exists (select 1 from public.users where users.business_id = dish_components.business_id and users.id = auth.uid()))
  with check (exists (select 1 from public.users where users.business_id = dish_components.business_id and users.id = auth.uid()));

create policy "food cost targets by business" on public.food_cost_targets
  for all
  using (exists (select 1 from public.users where users.business_id = food_cost_targets.business_id and users.id = auth.uid()))
  with check (exists (select 1 from public.users where users.business_id = food_cost_targets.business_id and users.id = auth.uid()));

create policy "indirect costs by business" on public.indirect_costs
  for all
  using (exists (select 1 from public.users where users.business_id = indirect_costs.business_id and users.id = auth.uid()))
  with check (exists (select 1 from public.users where users.business_id = indirect_costs.business_id and users.id = auth.uid()));

create policy "purchases by business" on public.purchases
  for all
  using (exists (select 1 from public.users where users.business_id = purchases.business_id and users.id = auth.uid()))
  with check (exists (select 1 from public.users where users.business_id = purchases.business_id and users.id = auth.uid()));

create policy "purchase items by business" on public.purchase_items
  for all
  using (exists (select 1 from public.users where users.business_id = purchase_items.business_id and users.id = auth.uid()))
  with check (exists (select 1 from public.users where users.business_id = purchase_items.business_id and users.id = auth.uid()));

create policy "inventory movements by business" on public.inventory_movements
  for all
  using (exists (select 1 from public.users where users.business_id = inventory_movements.business_id and users.id = auth.uid()))
  with check (exists (select 1 from public.users where users.business_id = inventory_movements.business_id and users.id = auth.uid()));

create policy "warehouse audits by business" on public.warehouse_audits
  for all
  using (exists (select 1 from public.users where users.business_id = warehouse_audits.business_id and users.id = auth.uid()))
  with check (exists (select 1 from public.users where users.business_id = warehouse_audits.business_id and users.id = auth.uid()));

create policy "waste records by business" on public.waste_records
  for all
  using (exists (select 1 from public.users where users.business_id = waste_records.business_id and users.id = auth.uid()))
  with check (exists (select 1 from public.users where users.business_id = waste_records.business_id and users.id = auth.uid()));

create policy "production plans by business" on public.production_plans
  for all
  using (exists (select 1 from public.users where users.business_id = production_plans.business_id and users.id = auth.uid()))
  with check (exists (select 1 from public.users where users.business_id = production_plans.business_id and users.id = auth.uid()));

create policy "production plan items by business" on public.production_plan_items
  for all
  using (exists (select 1 from public.users where users.business_id = production_plan_items.business_id and users.id = auth.uid()))
  with check (exists (select 1 from public.users where users.business_id = production_plan_items.business_id and users.id = auth.uid()));

create policy "sales by business" on public.sales
  for all
  using (exists (select 1 from public.users where users.business_id = sales.business_id and users.id = auth.uid()))
  with check (exists (select 1 from public.users where users.business_id = sales.business_id and users.id = auth.uid()));

create policy "sale items by business" on public.sale_items
  for all
  using (exists (select 1 from public.users where users.business_id = sale_items.business_id and users.id = auth.uid()))
  with check (exists (select 1 from public.users where users.business_id = sale_items.business_id and users.id = auth.uid()));

create policy "menus by business" on public.menus
  for all
  using (exists (select 1 from public.users where users.business_id = menus.business_id and users.id = auth.uid()))
  with check (exists (select 1 from public.users where users.business_id = menus.business_id and users.id = auth.uid()));

create policy "menu categories by business" on public.menu_categories
  for all
  using (exists (select 1 from public.users where users.business_id = menu_categories.business_id and users.id = auth.uid()))
  with check (exists (select 1 from public.users where users.business_id = menu_categories.business_id and users.id = auth.uid()));

create policy "menu items by business" on public.menu_items
  for all
  using (exists (select 1 from public.users where users.business_id = menu_items.business_id and users.id = auth.uid()))
  with check (exists (select 1 from public.users where users.business_id = menu_items.business_id and users.id = auth.uid()));

create policy "projections by business" on public.projections
  for all
  using (exists (select 1 from public.users where users.business_id = projections.business_id and users.id = auth.uid()))
  with check (exists (select 1 from public.users where users.business_id = projections.business_id and users.id = auth.uid()));

create policy "projection days by business" on public.projection_days
  for all
  using (exists (select 1 from public.users where users.business_id = projection_days.business_id and users.id = auth.uid()))
  with check (exists (select 1 from public.users where users.business_id = projection_days.business_id and users.id = auth.uid()));

create policy "event quotes by business" on public.event_quotes
  for all
  using (exists (select 1 from public.users where users.business_id = event_quotes.business_id and users.id = auth.uid()))
  with check (exists (select 1 from public.users where users.business_id = event_quotes.business_id and users.id = auth.uid()));

create policy "event quote dishes by business" on public.event_quote_dishes
  for all
  using (exists (select 1 from public.users where users.business_id = event_quote_dishes.business_id and users.id = auth.uid()))
  with check (exists (select 1 from public.users where users.business_id = event_quote_dishes.business_id and users.id = auth.uid()));

create policy "snapshots by business" on public.app_snapshots
  for all
  using (exists (select 1 from public.users where users.business_id = app_snapshots.business_id and users.id = auth.uid()))
  with check (exists (select 1 from public.users where users.business_id = app_snapshots.business_id and users.id = auth.uid()));
