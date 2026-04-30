-- Seed productivo para 3 menus coherentes de 4 tiempos
-- Ejecutar en Supabase SQL Editor.
-- Reemplaza v_owner_email por el correo real del usuario dueno del negocio.
-- El script:
-- 1. Carga datos normalizados en tablas reales.
-- 2. Sincroniza app_snapshots para que el frontend actual vea los datos.

create or replace function pg_temp.seed_uuid(base uuid, slug text)
returns uuid
language sql
immutable
as $$
  select uuid_generate_v5(uuid_ns_url(), base::text || ':' || slug);
$$;

alter table public.businesses
  add column if not exists payroll_burden_percent numeric(8, 4) not null default 0.32,
  add column if not exists personnel_shared_extras_monthly numeric(14, 2) not null default 0,
  add column if not exists max_leadership_minutes numeric(10, 2) not null default 20;

alter table public.labor_profiles
  add column if not exists role_group text not null default 'cocinero',
  add column if not exists headcount integer not null default 1,
  add column if not exists extra_monthly_cost numeric(14, 2) not null default 0;

do $$
declare
  v_owner_email text := 'pablo@goupevents.cl';
  v_business_id uuid;

  cat_ing_proteinas uuid;
  cat_ing_lacteos uuid;
  cat_ing_verduras uuid;
  cat_ing_frutas uuid;
  cat_ing_secos uuid;
  cat_ing_panaderia uuid;
  cat_ing_bebidas uuid;
  cat_ing_condimentos uuid;

  cat_dish_amuse uuid;
  cat_dish_entradas uuid;
  cat_dish_fondos uuid;
  cat_dish_postres uuid;
begin
  select business_id
  into v_business_id
  from public.users
  where lower(email) = lower(v_owner_email)
  limit 1;

  if v_business_id is null then
    raise exception 'No se encontro business_id para el usuario % en public.users', v_owner_email;
  end if;

  update public.businesses
  set
    target_food_cost = 0.30,
    target_margin = 0.70,
    fixed_costs_monthly = 6805000,
    payroll_burden_percent = 0.32,
    personnel_shared_extras_monthly = 950000,
    max_leadership_minutes = 20,
    worker_count = 12,
    internal_categories = array['Amuse bouche', 'Entradas', 'Fondos', 'Postres', 'Menus degustacion']
  where id = v_business_id;

  cat_ing_proteinas := pg_temp.seed_uuid(v_business_id, 'category:ingredient:proteinas');
  cat_ing_lacteos := pg_temp.seed_uuid(v_business_id, 'category:ingredient:lacteos');
  cat_ing_verduras := pg_temp.seed_uuid(v_business_id, 'category:ingredient:verduras');
  cat_ing_frutas := pg_temp.seed_uuid(v_business_id, 'category:ingredient:frutas');
  cat_ing_secos := pg_temp.seed_uuid(v_business_id, 'category:ingredient:secos');
  cat_ing_panaderia := pg_temp.seed_uuid(v_business_id, 'category:ingredient:panaderia');
  cat_ing_bebidas := pg_temp.seed_uuid(v_business_id, 'category:ingredient:bebidas');
  cat_ing_condimentos := pg_temp.seed_uuid(v_business_id, 'category:ingredient:condimentos');

  cat_dish_amuse := pg_temp.seed_uuid(v_business_id, 'category:dish:amuse');
  cat_dish_entradas := pg_temp.seed_uuid(v_business_id, 'category:dish:entradas');
  cat_dish_fondos := pg_temp.seed_uuid(v_business_id, 'category:dish:fondos');
  cat_dish_postres := pg_temp.seed_uuid(v_business_id, 'category:dish:postres');

  insert into public.categories (id, business_id, type, name)
  values
    (cat_ing_proteinas, v_business_id, 'ingredient', 'Proteinas'),
    (cat_ing_lacteos, v_business_id, 'ingredient', 'Lacteos'),
    (cat_ing_verduras, v_business_id, 'ingredient', 'Verduras y hortalizas'),
    (cat_ing_frutas, v_business_id, 'ingredient', 'Frutas'),
    (cat_ing_secos, v_business_id, 'ingredient', 'Secos y despensa'),
    (cat_ing_panaderia, v_business_id, 'ingredient', 'Panaderia'),
    (cat_ing_bebidas, v_business_id, 'ingredient', 'Bebidas y vinos'),
    (cat_ing_condimentos, v_business_id, 'ingredient', 'Condimentos y aceites'),
    (cat_dish_amuse, v_business_id, 'dish', 'Amuse bouche'),
    (cat_dish_entradas, v_business_id, 'dish', 'Entradas'),
    (cat_dish_fondos, v_business_id, 'dish', 'Fondos'),
    (cat_dish_postres, v_business_id, 'dish', 'Postres')
  on conflict (id) do update
  set
    name = excluded.name,
    type = excluded.type,
    business_id = excluded.business_id;

  insert into public.sanitary_categories (
    id, business_id, name, color_name, color_hex, storage_type, min_temp, max_temp,
    risk_level, sanitary_condition, danger_zone_sensitive, cross_contamination_group
  )
  values
    (pg_temp.seed_uuid(v_business_id, 'sanitary:red-meat'), v_business_id, 'Carnes rojas', 'Rojo', '#D32F2F', 'Refrigerado', 0, 2, 'Alto', 'Mantener separadas, en bandejas inferiores, protegidas y etiquetadas.', true, 'raw-animal'),
    (pg_temp.seed_uuid(v_business_id, 'sanitary:poultry'), v_business_id, 'Aves', 'Amarillo', '#FBC02D', 'Refrigerado', 0, 2, 'Alto', 'Separar completamente de otros alimentos, evitar goteo y contaminacion cruzada.', true, 'raw-animal'),
    (pg_temp.seed_uuid(v_business_id, 'sanitary:fish'), v_business_id, 'Pescados y mariscos', 'Azul', '#1976D2', 'Refrigerado', 0, 2, 'Alto', 'Mantener muy frio, idealmente sobre hielo con drenaje, protegido y etiquetado.', true, 'raw-animal'),
    (pg_temp.seed_uuid(v_business_id, 'sanitary:vegetables'), v_business_id, 'Verduras y hortalizas', 'Verde', '#388E3C', 'Refrigerado', 3, 5, 'Medio', 'Mantener limpias, separadas de carnes crudas y en contenedores ventilados.', true, 'produce'),
    (pg_temp.seed_uuid(v_business_id, 'sanitary:fruits'), v_business_id, 'Frutas', 'Verde claro', '#8BC34A', 'Refrigerado o ambiente controlado', 4, 8, 'Bajo/Medio', 'Separar por maduracion, evitar humedad excesiva y contaminacion cruzada.', true, 'produce'),
    (pg_temp.seed_uuid(v_business_id, 'sanitary:dairy'), v_business_id, 'Lacteos', 'Blanco', '#F5F5F5', 'Refrigerado', 2, 5, 'Medio/Alto', 'Mantener cerrados, etiquetados y con control de vencimiento.', true, 'ready'),
    (pg_temp.seed_uuid(v_business_id, 'sanitary:eggs'), v_business_id, 'Huevos', 'Crema', '#FFF3CD', 'Refrigerado', 2, 5, 'Alto', 'Mantener en envase original o contenedor limpio, separados de alimentos listos para consumo.', true, 'raw-animal'),
    (pg_temp.seed_uuid(v_business_id, 'sanitary:ready'), v_business_id, 'Alimentos cocidos / listos para consumo', 'Morado', '#7B1FA2', 'Refrigerado', 2, 4, 'Alto', 'Siempre tapados, fechados, etiquetados y separados de alimentos crudos.', true, 'ready'),
    (pg_temp.seed_uuid(v_business_id, 'sanitary:charcuterie'), v_business_id, 'Embutidos y charcuteria', 'Naranjo', '#F57C00', 'Refrigerado', 2, 5, 'Medio/Alto', 'Mantener sellados, etiquetados y con control estricto de vencimiento.', true, 'ready'),
    (pg_temp.seed_uuid(v_business_id, 'sanitary:bakery'), v_business_id, 'Panaderia y pasteleria', 'Cafe', '#795548', 'Seco o refrigerado segun producto', 15, 25, 'Bajo/Medio', 'Proteger de humedad, polvo y contaminacion.', false, 'dry'),
    (pg_temp.seed_uuid(v_business_id, 'sanitary:drygoods'), v_business_id, 'Abarrotes secos', 'Gris oscuro', '#424242', 'Seco', 15, 25, 'Bajo', 'Lugar seco, ventilado, sin exposicion directa al sol y alejado del piso.', false, 'dry'),
    (pg_temp.seed_uuid(v_business_id, 'sanitary:frozen'), v_business_id, 'Congelados', 'Celeste', '#00BCD4', 'Congelado', -30, -18, 'Medio/Alto', 'Mantener cadena de frio, evitar recongelacion y controlar fechas.', false, 'frozen'),
    (pg_temp.seed_uuid(v_business_id, 'sanitary:allergen'), v_business_id, 'Alergenos', 'Violeta intenso', '#6A1B9A', 'Segun producto', 0, 25, 'Critico', 'Identificar claramente, separar y evitar contaminacion cruzada.', true, 'allergen'),
    (pg_temp.seed_uuid(v_business_id, 'sanitary:chemical'), v_business_id, 'Productos quimicos / limpieza', 'Negro', '#000000', 'Separado de alimentos', 15, 25, 'Critico', 'Nunca almacenar junto a alimentos. Deben estar en zona exclusiva y rotulada.', false, 'chemical')
  on conflict (id) do update
  set
    name = excluded.name,
    color_name = excluded.color_name,
    color_hex = excluded.color_hex,
    storage_type = excluded.storage_type,
    min_temp = excluded.min_temp,
    max_temp = excluded.max_temp,
    risk_level = excluded.risk_level,
    sanitary_condition = excluded.sanitary_condition,
    danger_zone_sensitive = excluded.danger_zone_sensitive,
    cross_contamination_group = excluded.cross_contamination_group;

  insert into public.suppliers (
    id, business_id, name, rut, contact_name, phone, email, product_category,
    payment_terms, lead_time_days, quality_score, delivery_score, notes
  )
  values
    (pg_temp.seed_uuid(v_business_id, 'supplier:pacific-sea-foods'), v_business_id, 'Pacific Sea Foods', '76.321.450-1', 'Camila Rojas', '+56 9 6211 3301', 'ventas@pacificsea.cl', 'Pescados y mariscos', '30 dias', 2, 4.8, 4.7, 'Proveedor principal de salmon premium y pescados frescos.'),
    (pg_temp.seed_uuid(v_business_id, 'supplier:carnes-don-andres'), v_business_id, 'Carnes Don Andres', '77.115.990-3', 'Andres Cifuentes', '+56 9 6822 1044', 'comercial@carnesdonandres.cl', 'Carnes premium', '15 dias', 2, 4.9, 4.6, 'Cortes premium para fondo y carpaccio.'),
    (pg_temp.seed_uuid(v_business_id, 'supplier:huerto-central'), v_business_id, 'Huerto Central', '76.908.120-4', 'Sofia Morales', '+56 9 7154 2020', 'pedidos@huertocentral.cl', 'Frutas y verduras', 'Contado', 1, 4.6, 4.8, 'Entrega diaria de frutas, verduras y hierbas frescas.'),
    (pg_temp.seed_uuid(v_business_id, 'supplier:lacteos-valle-verde'), v_business_id, 'Lacteos Valle Verde', '76.554.230-8', 'Marcela Muñoz', '+56 9 6111 4556', 'comercial@valleverde.cl', 'Lacteos y quesos', '30 dias', 2, 4.7, 4.7, 'Crema, leche, mantequilla, quesos y huevos.'),
    (pg_temp.seed_uuid(v_business_id, 'supplier:despensa-gourmet'), v_business_id, 'Despensa Gourmet', '77.664.200-9', 'Juan Pablo Saez', '+56 9 7440 2211', 'abastecimiento@despensagourmet.cl', 'Abarrotes secos', '30 dias', 3, 4.5, 4.5, 'Secos, especias, chocolate, harinas y aceites.'),
    (pg_temp.seed_uuid(v_business_id, 'supplier:panes-masa-madre'), v_business_id, 'Panes Masa Madre', '76.222.090-5', 'Daniela Vergara', '+56 9 7555 0812', 'pedidos@panesmasamadre.cl', 'Panaderia artesanal', 'Contado', 1, 4.7, 4.9, 'Rebanadas y tostones de masa madre diaria.'),
    (pg_temp.seed_uuid(v_business_id, 'supplier:vinoteca-andina'), v_business_id, 'Vinoteca Andina', '77.801.440-6', 'Mauricio Araya', '+56 9 6991 9001', 'ventas@vinotecaandina.cl', 'Vinos y bebidas', '30 dias', 3, 4.4, 4.5, 'Vino tinto para reducciones y servicio.')
  on conflict (id) do update
  set
    name = excluded.name,
    rut = excluded.rut,
    contact_name = excluded.contact_name,
    phone = excluded.phone,
    email = excluded.email,
    product_category = excluded.product_category,
    payment_terms = excluded.payment_terms,
    lead_time_days = excluded.lead_time_days,
    quality_score = excluded.quality_score,
    delivery_score = excluded.delivery_score,
    notes = excluded.notes;

  insert into public.labor_profiles (
    id, business_id, role_name, role_group, headcount, monthly_salary, monthly_hours, extra_monthly_cost
  )
  values
    (pg_temp.seed_uuid(v_business_id, 'labor:chef-ejecutivo'), v_business_id, 'Chef ejecutivo', 'chef', 1, 2500000, 220, 180000),
    (pg_temp.seed_uuid(v_business_id, 'labor:sous-chef'), v_business_id, 'Sous chef', 'sous-chef', 1, 1700000, 220, 140000),
    (pg_temp.seed_uuid(v_business_id, 'labor:partida-fria'), v_business_id, 'Partida fria', 'cocinero', 2, 1100000, 220, 90000),
    (pg_temp.seed_uuid(v_business_id, 'labor:partida-caliente'), v_business_id, 'Partida caliente', 'cocinero', 2, 1150000, 220, 90000),
    (pg_temp.seed_uuid(v_business_id, 'labor:pastelero'), v_business_id, 'Pastelero', 'pasteleria', 1, 1200000, 220, 100000),
    (pg_temp.seed_uuid(v_business_id, 'labor:ayudante-cocina'), v_business_id, 'Ayudante de cocina', 'ayudante', 5, 800000, 220, 60000)
  on conflict (id) do update
  set
    role_name = excluded.role_name,
    role_group = excluded.role_group,
    headcount = excluded.headcount,
    monthly_salary = excluded.monthly_salary,
    monthly_hours = excluded.monthly_hours,
    extra_monthly_cost = excluded.extra_monthly_cost;

  insert into public.indirect_costs (id, business_id, name, category, period, amount, allocation_method, allocation_value)
  values
    (pg_temp.seed_uuid(v_business_id, 'indirect:luz'), v_business_id, 'Luz cocina y servicio', 'Servicios basicos', 'mensual', 450000, 'hours', 1),
    (pg_temp.seed_uuid(v_business_id, 'indirect:agua'), v_business_id, 'Agua potable', 'Servicios basicos', 'mensual', 160000, 'sales', 1),
    (pg_temp.seed_uuid(v_business_id, 'indirect:gas'), v_business_id, 'Gas cocina', 'Servicios basicos', 'mensual', 320000, 'hours', 1),
    (pg_temp.seed_uuid(v_business_id, 'indirect:arriendo'), v_business_id, 'Arriendo', 'Fijos', 'mensual', 2800000, 'sales', 1),
    (pg_temp.seed_uuid(v_business_id, 'indirect:internet'), v_business_id, 'Internet', 'Fijos', 'mensual', 90000, 'manual', 1),
    (pg_temp.seed_uuid(v_business_id, 'indirect:software'), v_business_id, 'Software operativo', 'Administracion', 'mensual', 120000, 'manual', 1),
    (pg_temp.seed_uuid(v_business_id, 'indirect:sueldos-admin'), v_business_id, 'Sueldos administrativos', 'Administracion', 'mensual', 2200000, 'sales', 1),
    (pg_temp.seed_uuid(v_business_id, 'indirect:limpieza'), v_business_id, 'Limpieza y sanitizacion', 'Operacion', 'mensual', 180000, 'manual', 1),
    (pg_temp.seed_uuid(v_business_id, 'indirect:mantenciones'), v_business_id, 'Mantenciones menores', 'Operacion', 'mensual', 140000, 'hours', 1),
    (pg_temp.seed_uuid(v_business_id, 'indirect:comisiones'), v_business_id, 'Comisiones bancarias', 'Finanzas', 'mensual', 95000, 'sales', 1),
    (pg_temp.seed_uuid(v_business_id, 'indirect:publicidad'), v_business_id, 'Publicidad digital', 'Marketing', 'mensual', 250000, 'sales', 1)
  on conflict (id) do update
  set
    name = excluded.name,
    category = excluded.category,
    period = excluded.period,
    amount = excluded.amount,
    allocation_method = excluded.allocation_method,
    allocation_value = excluded.allocation_value;

  insert into public.food_cost_targets (id, business_id, scope_type, scope_id, target_percent)
  values
    (pg_temp.seed_uuid(v_business_id, 'fct:business'), v_business_id, 'business', v_business_id::text, 0.30),
    (pg_temp.seed_uuid(v_business_id, 'fct:category:amuse'), v_business_id, 'category', cat_dish_amuse::text, 0.22),
    (pg_temp.seed_uuid(v_business_id, 'fct:category:entradas'), v_business_id, 'category', cat_dish_entradas::text, 0.28),
    (pg_temp.seed_uuid(v_business_id, 'fct:category:fondos'), v_business_id, 'category', cat_dish_fondos::text, 0.32),
    (pg_temp.seed_uuid(v_business_id, 'fct:category:postres'), v_business_id, 'category', cat_dish_postres::text, 0.25)
  on conflict (id) do update
  set
    scope_type = excluded.scope_type,
    scope_id = excluded.scope_id,
    target_percent = excluded.target_percent;

  insert into public.packaging_costs (id, business_id, name, channel, unit, unit_cost)
  values
    (pg_temp.seed_uuid(v_business_id, 'packaging:delivery-premium'), v_business_id, 'Packaging delivery premium', 'Delivery', 'unidad', 950)
  on conflict (id) do update
  set
    name = excluded.name,
    channel = excluded.channel,
    unit = excluded.unit,
    unit_cost = excluded.unit_cost;

  insert into public.ingredients (
    id, business_id, category_id, sanitary_category_id, primary_supplier_id, name,
    purchase_unit, use_unit, purchase_price, useful_unit_cost, usable_yield_percent,
    current_stock, min_stock, max_stock, last_purchase_date, shelf_life_days,
    storage_type, storage_conditions, storage_temperature, recommended_min_temp, recommended_max_temp,
    current_storage_temp, risk_level, color_hex, color_name, internal_code, supplier_code,
    storage_location, received_date, expiry_date, lot_code, responsible
  )
  values
    (pg_temp.seed_uuid(v_business_id, 'ingredient:salmon-fresco'), v_business_id, cat_ing_proteinas, pg_temp.seed_uuid(v_business_id, 'sanitary:fish'), pg_temp.seed_uuid(v_business_id, 'supplier:pacific-sea-foods'), 'Salmon fresco', 'kg', 'g', 14500, 15.7609, 92, 12, 3, 18, current_date - 2, 5, 'Refrigerado', 'Mantener sobre hielo y drenaje.', '0 C a 2 C', 0, 2, 1.2, 'Alto', '#1976D2', 'Azul', 'SAL-001', 'PAC-SAL-01', 'Camara 1 / pescados', current_date - 2, current_date + 3, 'LOT-SAL-2404', 'Bodega AM'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:lomo-vetado'), v_business_id, cat_ing_proteinas, pg_temp.seed_uuid(v_business_id, 'sanitary:red-meat'), pg_temp.seed_uuid(v_business_id, 'supplier:carnes-don-andres'), 'Lomo vetado', 'kg', 'g', 24000, 34.2857, 70, 10, 3, 14, current_date - 2, 6, 'Refrigerado', 'Corte protegido en bandeja inferior.', '0 C a 2 C', 0, 2, 1.1, 'Alto', '#D32F2F', 'Rojo', 'LOM-002', 'CDA-LOM-02', 'Camara 1 / carnes', current_date - 2, current_date + 4, 'LOT-LOM-2404', 'Bodega AM'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:queso-cabra'), v_business_id, cat_ing_lacteos, pg_temp.seed_uuid(v_business_id, 'sanitary:dairy'), pg_temp.seed_uuid(v_business_id, 'supplier:lacteos-valle-verde'), 'Queso de cabra', 'kg', 'g', 18500, 18.5000, 100, 4, 1, 6, current_date - 3, 15, 'Refrigerado', 'Mantener sellado y rotulado.', '2 C a 5 C', 2, 5, 4.0, 'Medio/Alto', '#F5F5F5', 'Blanco', 'QCB-003', 'LVV-QCB-03', 'Camara lacteos', current_date - 3, current_date + 12, 'LOT-QCB-2404', 'Bodega PM'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:parmesano'), v_business_id, cat_ing_lacteos, pg_temp.seed_uuid(v_business_id, 'sanitary:dairy'), pg_temp.seed_uuid(v_business_id, 'supplier:lacteos-valle-verde'), 'Parmesano', 'kg', 'g', 22000, 22.0000, 100, 6, 1.5, 8, current_date - 3, 20, 'Refrigerado', 'Mantener envase cerrado.', '2 C a 5 C', 2, 5, 4.2, 'Medio/Alto', '#F5F5F5', 'Blanco', 'PAR-004', 'LVV-PAR-04', 'Camara lacteos', current_date - 3, current_date + 17, 'LOT-PAR-2404', 'Bodega PM'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:crema'), v_business_id, cat_ing_lacteos, pg_temp.seed_uuid(v_business_id, 'sanitary:dairy'), pg_temp.seed_uuid(v_business_id, 'supplier:lacteos-valle-verde'), 'Crema', 'litro', 'ml', 4300, 4.3000, 100, 20, 4, 26, current_date - 3, 10, 'Refrigerado', 'Mantener cerrada y en rotacion FIFO.', '2 C a 5 C', 2, 5, 4.1, 'Medio/Alto', '#F5F5F5', 'Blanco', 'CRE-005', 'LVV-CRE-05', 'Camara lacteos', current_date - 3, current_date + 7, 'LOT-CRE-2404', 'Bodega PM'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:mantequilla'), v_business_id, cat_ing_lacteos, pg_temp.seed_uuid(v_business_id, 'sanitary:dairy'), pg_temp.seed_uuid(v_business_id, 'supplier:lacteos-valle-verde'), 'Mantequilla', 'kg', 'g', 6200, 6.2000, 100, 8, 2, 10, current_date - 3, 20, 'Refrigerado', 'Mantener cerrada y protegida de olores.', '2 C a 5 C', 2, 5, 4.3, 'Medio/Alto', '#F5F5F5', 'Blanco', 'MAN-006', 'LVV-MAN-06', 'Camara lacteos', current_date - 3, current_date + 14, 'LOT-MAN-2404', 'Bodega PM'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:leche-entera'), v_business_id, cat_ing_lacteos, pg_temp.seed_uuid(v_business_id, 'sanitary:dairy'), pg_temp.seed_uuid(v_business_id, 'supplier:lacteos-valle-verde'), 'Leche entera', 'litro', 'ml', 1350, 1.3500, 100, 25, 6, 30, current_date - 3, 8, 'Refrigerado', 'Mantener cerrada.', '2 C a 5 C', 2, 5, 4.0, 'Medio/Alto', '#F5F5F5', 'Blanco', 'LEC-007', 'LVV-LEC-07', 'Camara lacteos', current_date - 3, current_date + 5, 'LOT-LEC-2404', 'Bodega PM'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:huevos'), v_business_id, cat_ing_lacteos, pg_temp.seed_uuid(v_business_id, 'sanitary:eggs'), pg_temp.seed_uuid(v_business_id, 'supplier:lacteos-valle-verde'), 'Huevos', 'unidad', 'unidad', 230, 230.0000, 100, 120, 30, 180, current_date - 3, 20, 'Refrigerado', 'Mantener en bandeja original.', '2 C a 5 C', 2, 5, 4.4, 'Alto', '#FFF3CD', 'Crema', 'HUE-008', 'LVV-HUE-08', 'Camara lacteos', current_date - 3, current_date + 15, 'LOT-HUE-2404', 'Bodega PM'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:quinoa-blanca'), v_business_id, cat_ing_secos, pg_temp.seed_uuid(v_business_id, 'sanitary:drygoods'), pg_temp.seed_uuid(v_business_id, 'supplier:despensa-gourmet'), 'Quinoa blanca', 'kg', 'g', 3600, 3.6000, 100, 18, 5, 25, current_date - 5, 365, 'Seco', 'Mantener cerrado y alejado del piso.', '15 C a 25 C', 15, 25, 21.0, 'Bajo', '#424242', 'Gris oscuro', 'QUI-010', 'DGO-QUI-10', 'Secos / anaquel 1', current_date - 5, current_date + 320, 'LOT-QUI-2404', 'Bodega seca'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:arroz-arborio'), v_business_id, cat_ing_secos, pg_temp.seed_uuid(v_business_id, 'sanitary:drygoods'), pg_temp.seed_uuid(v_business_id, 'supplier:despensa-gourmet'), 'Arroz arborio', 'kg', 'g', 4200, 4.2000, 100, 12, 4, 18, current_date - 5, 365, 'Seco', 'Mantener cerrado y alejado del piso.', '15 C a 25 C', 15, 25, 21.0, 'Bajo', '#424242', 'Gris oscuro', 'ARB-011', 'DGO-ARB-11', 'Secos / anaquel 1', current_date - 5, current_date + 320, 'LOT-ARB-2404', 'Bodega seca'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:azucar'), v_business_id, cat_ing_secos, pg_temp.seed_uuid(v_business_id, 'sanitary:drygoods'), pg_temp.seed_uuid(v_business_id, 'supplier:despensa-gourmet'), 'Azucar granulada', 'kg', 'g', 1400, 1.4000, 100, 15, 3, 20, current_date - 5, 365, 'Seco', 'Mantener seco y ventilado.', '15 C a 25 C', 15, 25, 21.0, 'Bajo', '#424242', 'Gris oscuro', 'AZU-012', 'DGO-AZU-12', 'Secos / anaquel 2', current_date - 5, current_date + 320, 'LOT-AZU-2404', 'Bodega seca'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:sal-fina'), v_business_id, cat_ing_condimentos, pg_temp.seed_uuid(v_business_id, 'sanitary:drygoods'), pg_temp.seed_uuid(v_business_id, 'supplier:despensa-gourmet'), 'Sal fina', 'kg', 'g', 650, 0.6500, 100, 12, 2, 18, current_date - 5, 365, 'Seco', 'Mantener cerrado.', '15 C a 25 C', 15, 25, 21.0, 'Bajo', '#424242', 'Gris oscuro', 'SAL-013', 'DGO-SAL-13', 'Secos / condimentos', current_date - 5, current_date + 320, 'LOT-SALF-2404', 'Bodega seca'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:pimienta'), v_business_id, cat_ing_condimentos, pg_temp.seed_uuid(v_business_id, 'sanitary:drygoods'), pg_temp.seed_uuid(v_business_id, 'supplier:despensa-gourmet'), 'Pimienta negra', 'kg', 'g', 18000, 18.0000, 100, 2, 0.5, 3, current_date - 5, 365, 'Seco', 'Mantener seco y rotulado.', '15 C a 25 C', 15, 25, 21.0, 'Bajo', '#424242', 'Gris oscuro', 'PIM-014', 'DGO-PIM-14', 'Secos / condimentos', current_date - 5, current_date + 320, 'LOT-PIM-2404', 'Bodega seca'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:aceite-oliva'), v_business_id, cat_ing_condimentos, pg_temp.seed_uuid(v_business_id, 'sanitary:drygoods'), pg_temp.seed_uuid(v_business_id, 'supplier:despensa-gourmet'), 'Aceite de oliva', 'litro', 'ml', 7200, 7.2000, 100, 15, 3, 20, current_date - 5, 365, 'Seco', 'Mantener lejos de luz directa.', '15 C a 25 C', 15, 25, 21.0, 'Bajo', '#424242', 'Gris oscuro', 'ACO-015', 'DGO-ACO-15', 'Secos / aceites', current_date - 5, current_date + 320, 'LOT-ACO-2404', 'Bodega seca'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:vinagre'), v_business_id, cat_ing_condimentos, pg_temp.seed_uuid(v_business_id, 'sanitary:drygoods'), pg_temp.seed_uuid(v_business_id, 'supplier:despensa-gourmet'), 'Vinagre blanco', 'litro', 'ml', 1600, 1.6000, 100, 10, 2, 14, current_date - 5, 365, 'Seco', 'Mantener en envase cerrado.', '15 C a 25 C', 15, 25, 21.0, 'Bajo', '#424242', 'Gris oscuro', 'VIN-016', 'DGO-VIN-16', 'Secos / aceites', current_date - 5, current_date + 320, 'LOT-VIN-2404', 'Bodega seca'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:vino-tinto'), v_business_id, cat_ing_bebidas, pg_temp.seed_uuid(v_business_id, 'sanitary:drygoods'), pg_temp.seed_uuid(v_business_id, 'supplier:vinoteca-andina'), 'Vino tinto', 'litro', 'ml', 4800, 4.8000, 100, 12, 2, 16, current_date - 5, 365, 'Seco', 'Botellas cerradas en lugar ventilado.', '15 C a 25 C', 15, 25, 20.0, 'Bajo', '#424242', 'Gris oscuro', 'VIT-017', 'VAN-VIT-17', 'Bebidas / cava', current_date - 5, current_date + 320, 'LOT-VIT-2404', 'Bodega seca'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:gelatina'), v_business_id, cat_ing_secos, pg_temp.seed_uuid(v_business_id, 'sanitary:drygoods'), pg_temp.seed_uuid(v_business_id, 'supplier:despensa-gourmet'), 'Gelatina sin sabor', 'kg', 'g', 22000, 22.0000, 100, 1, 0.2, 2, current_date - 5, 365, 'Seco', 'Mantener envase sellado.', '15 C a 25 C', 15, 25, 21.0, 'Bajo', '#424242', 'Gris oscuro', 'GEL-018', 'DGO-GEL-18', 'Secos / reposteria', current_date - 5, current_date + 320, 'LOT-GEL-2404', 'Bodega seca'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:vainilla'), v_business_id, cat_ing_condimentos, pg_temp.seed_uuid(v_business_id, 'sanitary:drygoods'), pg_temp.seed_uuid(v_business_id, 'supplier:despensa-gourmet'), 'Extracto de vainilla', 'litro', 'ml', 14500, 14.5000, 100, 1, 0.2, 2, current_date - 5, 365, 'Seco', 'Mantener cerrado y lejos de calor.', '15 C a 25 C', 15, 25, 21.0, 'Bajo', '#424242', 'Gris oscuro', 'VAI-019', 'DGO-VAI-19', 'Secos / reposteria', current_date - 5, current_date + 320, 'LOT-VAI-2404', 'Bodega seca'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:chocolate'), v_business_id, cat_ing_secos, pg_temp.seed_uuid(v_business_id, 'sanitary:drygoods'), pg_temp.seed_uuid(v_business_id, 'supplier:despensa-gourmet'), 'Chocolate amargo 70%', 'kg', 'g', 13800, 13.8000, 100, 8, 2, 12, current_date - 5, 365, 'Seco', 'Mantener a temperatura controlada.', '15 C a 25 C', 15, 25, 20.0, 'Bajo', '#424242', 'Gris oscuro', 'CHO-020', 'DGO-CHO-20', 'Secos / reposteria', current_date - 5, current_date + 320, 'LOT-CHO-2404', 'Bodega seca'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:harina'), v_business_id, cat_ing_secos, pg_temp.seed_uuid(v_business_id, 'sanitary:drygoods'), pg_temp.seed_uuid(v_business_id, 'supplier:despensa-gourmet'), 'Harina sin polvos', 'kg', 'g', 980, 0.9800, 100, 20, 4, 28, current_date - 5, 365, 'Seco', 'Mantener en envase hermetico.', '15 C a 25 C', 15, 25, 21.0, 'Bajo', '#424242', 'Gris oscuro', 'HAR-021', 'DGO-HAR-21', 'Secos / harinas', current_date - 5, current_date + 320, 'LOT-HAR-2404', 'Bodega seca'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:canela'), v_business_id, cat_ing_condimentos, pg_temp.seed_uuid(v_business_id, 'sanitary:drygoods'), pg_temp.seed_uuid(v_business_id, 'supplier:despensa-gourmet'), 'Canela molida', 'kg', 'g', 11500, 11.5000, 100, 1, 0.2, 2, current_date - 5, 365, 'Seco', 'Mantener cerrado.', '15 C a 25 C', 15, 25, 21.0, 'Bajo', '#424242', 'Gris oscuro', 'CAN-022', 'DGO-CAN-22', 'Secos / condimentos', current_date - 5, current_date + 320, 'LOT-CAN-2404', 'Bodega seca'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:garbanzos'), v_business_id, cat_ing_secos, pg_temp.seed_uuid(v_business_id, 'sanitary:drygoods'), pg_temp.seed_uuid(v_business_id, 'supplier:despensa-gourmet'), 'Garbanzos', 'kg', 'g', 2200, 2.2000, 100, 15, 4, 20, current_date - 5, 365, 'Seco', 'Mantener seco.', '15 C a 25 C', 15, 25, 21.0, 'Bajo', '#424242', 'Gris oscuro', 'GAR-023', 'DGO-GAR-23', 'Secos / legumbres', current_date - 5, current_date + 320, 'LOT-GAR-2404', 'Bodega seca'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:masa-madre'), v_business_id, cat_ing_panaderia, pg_temp.seed_uuid(v_business_id, 'sanitary:bakery'), pg_temp.seed_uuid(v_business_id, 'supplier:panes-masa-madre'), 'Masa madre rebanadas', 'unidad', 'unidad', 480, 480.0000, 100, 80, 20, 120, current_date - 1, 2, 'Seco', 'Mantener protegido de humedad.', '15 C a 25 C', 15, 25, 21.0, 'Bajo/Medio', '#795548', 'Cafe', 'PAN-024', 'PMM-PAN-24', 'Panaderia diaria', current_date - 1, current_date + 1, 'LOT-PAN-2404', 'Panaderia'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:pepino'), v_business_id, cat_ing_verduras, pg_temp.seed_uuid(v_business_id, 'sanitary:vegetables'), pg_temp.seed_uuid(v_business_id, 'supplier:huerto-central'), 'Pepino', 'kg', 'g', 1700, 1.7000, 100, 4, 1, 6, current_date - 1, 7, 'Refrigerado', 'Contenedor ventilado.', '3 C a 5 C', 3, 5, 4.2, 'Medio', '#388E3C', 'Verde', 'PEP-025', 'HUC-PEP-25', 'Camara verduras', current_date - 1, current_date + 6, 'LOT-PEP-2404', 'Bodega AM'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:palta'), v_business_id, cat_ing_frutas, pg_temp.seed_uuid(v_business_id, 'sanitary:fruits'), pg_temp.seed_uuid(v_business_id, 'supplier:huerto-central'), 'Palta hass', 'kg', 'g', 5800, 5.8000, 100, 6, 2, 9, current_date - 1, 6, 'Refrigerado o ambiente controlado', 'Separar por maduracion.', '4 C a 8 C', 4, 8, 7.0, 'Bajo/Medio', '#8BC34A', 'Verde claro', 'PAL-026', 'HUC-PAL-26', 'Camara verduras', current_date - 1, current_date + 5, 'LOT-PAL-2404', 'Bodega AM'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:cebolla-morada'), v_business_id, cat_ing_verduras, pg_temp.seed_uuid(v_business_id, 'sanitary:vegetables'), pg_temp.seed_uuid(v_business_id, 'supplier:huerto-central'), 'Cebolla morada', 'kg', 'g', 1400, 1.4000, 100, 5, 1.5, 8, current_date - 1, 20, 'Refrigerado', 'Separada de crudos animales.', '3 C a 5 C', 3, 5, 4.6, 'Medio', '#388E3C', 'Verde', 'CEM-027', 'HUC-CEM-27', 'Camara verduras', current_date - 1, current_date + 12, 'LOT-CEM-2404', 'Bodega AM'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:cebolla-blanca'), v_business_id, cat_ing_verduras, pg_temp.seed_uuid(v_business_id, 'sanitary:vegetables'), pg_temp.seed_uuid(v_business_id, 'supplier:huerto-central'), 'Cebolla blanca', 'kg', 'g', 1200, 1.2000, 100, 8, 2, 12, current_date - 1, 20, 'Refrigerado', 'Separada de crudos animales.', '3 C a 5 C', 3, 5, 4.5, 'Medio', '#388E3C', 'Verde', 'CEB-028', 'HUC-CEB-28', 'Camara verduras', current_date - 1, current_date + 12, 'LOT-CEB-2404', 'Bodega AM'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:ajo'), v_business_id, cat_ing_verduras, pg_temp.seed_uuid(v_business_id, 'sanitary:vegetables'), pg_temp.seed_uuid(v_business_id, 'supplier:huerto-central'), 'Ajo', 'kg', 'g', 4200, 4.2000, 100, 2, 0.5, 4, current_date - 1, 25, 'Refrigerado', 'Mantener seco y ventilado.', '3 C a 5 C', 3, 5, 4.5, 'Medio', '#388E3C', 'Verde', 'AJO-029', 'HUC-AJO-29', 'Camara verduras', current_date - 1, current_date + 18, 'LOT-AJO-2404', 'Bodega AM'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:eneldo'), v_business_id, cat_ing_verduras, pg_temp.seed_uuid(v_business_id, 'sanitary:vegetables'), pg_temp.seed_uuid(v_business_id, 'supplier:huerto-central'), 'Eneldo fresco', 'kg', 'g', 18000, 18.0000, 100, 1, 0.2, 2, current_date - 1, 6, 'Refrigerado', 'Mantener humedo y etiquetado.', '3 C a 5 C', 3, 5, 4.0, 'Medio', '#388E3C', 'Verde', 'ENE-030', 'HUC-ENE-30', 'Camara hierbas', current_date - 1, current_date + 5, 'LOT-ENE-2404', 'Bodega AM'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:espinaca'), v_business_id, cat_ing_verduras, pg_temp.seed_uuid(v_business_id, 'sanitary:vegetables'), pg_temp.seed_uuid(v_business_id, 'supplier:huerto-central'), 'Espinaca baby', 'kg', 'g', 3990, 4.4333, 90, 8, 2, 10, current_date - 1, 5, 'Refrigerado', 'Mantener ventilada y seca.', '3 C a 5 C', 3, 5, 4.0, 'Medio', '#388E3C', 'Verde', 'ESP-031', 'HUC-ESP-31', 'Camara verduras', current_date - 1, current_date + 4, 'LOT-ESP-2404', 'Bodega AM'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:zapallo'), v_business_id, cat_ing_verduras, pg_temp.seed_uuid(v_business_id, 'sanitary:vegetables'), pg_temp.seed_uuid(v_business_id, 'supplier:huerto-central'), 'Zapallo camote', 'kg', 'g', 1600, 2.0000, 80, 16, 4, 24, current_date - 1, 12, 'Refrigerado', 'Mantener limpio y ventilado.', '3 C a 5 C', 3, 5, 4.3, 'Medio', '#388E3C', 'Verde', 'ZAP-032', 'HUC-ZAP-32', 'Camara verduras', current_date - 1, current_date + 10, 'LOT-ZAP-2404', 'Bodega AM'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:jengibre'), v_business_id, cat_ing_verduras, pg_temp.seed_uuid(v_business_id, 'sanitary:vegetables'), pg_temp.seed_uuid(v_business_id, 'supplier:huerto-central'), 'Jengibre', 'kg', 'g', 6500, 6.5000, 100, 2, 0.5, 3, current_date - 1, 12, 'Refrigerado', 'Mantener seco.', '3 C a 5 C', 3, 5, 4.3, 'Medio', '#388E3C', 'Verde', 'JEN-033', 'HUC-JEN-33', 'Camara verduras', current_date - 1, current_date + 10, 'LOT-JEN-2404', 'Bodega AM'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:rucula'), v_business_id, cat_ing_verduras, pg_temp.seed_uuid(v_business_id, 'sanitary:vegetables'), pg_temp.seed_uuid(v_business_id, 'supplier:huerto-central'), 'Rucula', 'kg', 'g', 6800, 6.8000, 100, 4, 1, 6, current_date - 1, 5, 'Refrigerado', 'Contenedor ventilado.', '3 C a 5 C', 3, 5, 4.0, 'Medio', '#388E3C', 'Verde', 'RUC-034', 'HUC-RUC-34', 'Camara verduras', current_date - 1, current_date + 4, 'LOT-RUC-2404', 'Bodega AM'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:setas'), v_business_id, cat_ing_verduras, pg_temp.seed_uuid(v_business_id, 'sanitary:vegetables'), pg_temp.seed_uuid(v_business_id, 'supplier:huerto-central'), 'Setas mixtas', 'kg', 'g', 7200, 7.5000, 96, 7, 2, 9, current_date - 1, 6, 'Refrigerado', 'Mantener secas y ventiladas.', '3 C a 5 C', 3, 5, 4.2, 'Medio', '#388E3C', 'Verde', 'SET-035', 'HUC-SET-35', 'Camara verduras', current_date - 1, current_date + 5, 'LOT-SET-2404', 'Bodega AM'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:zanahoria'), v_business_id, cat_ing_verduras, pg_temp.seed_uuid(v_business_id, 'sanitary:vegetables'), pg_temp.seed_uuid(v_business_id, 'supplier:huerto-central'), 'Zanahoria', 'kg', 'g', 1100, 1.1000, 100, 8, 2, 12, current_date - 1, 14, 'Refrigerado', 'Contenedor ventilado.', '3 C a 5 C', 3, 5, 4.5, 'Medio', '#388E3C', 'Verde', 'ZAN-036', 'HUC-ZAN-36', 'Camara verduras', current_date - 1, current_date + 12, 'LOT-ZAN-2404', 'Bodega AM'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:apio'), v_business_id, cat_ing_verduras, pg_temp.seed_uuid(v_business_id, 'sanitary:vegetables'), pg_temp.seed_uuid(v_business_id, 'supplier:huerto-central'), 'Apio', 'kg', 'g', 1500, 1.5000, 100, 4, 1, 6, current_date - 1, 8, 'Refrigerado', 'Contenedor ventilado.', '3 C a 5 C', 3, 5, 4.4, 'Medio', '#388E3C', 'Verde', 'API-037', 'HUC-API-37', 'Camara verduras', current_date - 1, current_date + 6, 'LOT-API-2404', 'Bodega AM'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:zucchini'), v_business_id, cat_ing_verduras, pg_temp.seed_uuid(v_business_id, 'sanitary:vegetables'), pg_temp.seed_uuid(v_business_id, 'supplier:huerto-central'), 'Zucchini', 'kg', 'g', 1600, 1.6000, 100, 8, 2, 10, current_date - 1, 8, 'Refrigerado', 'Contenedor ventilado.', '3 C a 5 C', 3, 5, 4.4, 'Medio', '#388E3C', 'Verde', 'ZUC-038', 'HUC-ZUC-38', 'Camara verduras', current_date - 1, current_date + 7, 'LOT-ZUC-2404', 'Bodega AM'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:berenjena'), v_business_id, cat_ing_verduras, pg_temp.seed_uuid(v_business_id, 'sanitary:vegetables'), pg_temp.seed_uuid(v_business_id, 'supplier:huerto-central'), 'Berenjena', 'kg', 'g', 2200, 2.2000, 100, 6, 2, 8, current_date - 1, 8, 'Refrigerado', 'Contenedor ventilado.', '3 C a 5 C', 3, 5, 4.4, 'Medio', '#388E3C', 'Verde', 'BER-039', 'HUC-BER-39', 'Camara verduras', current_date - 1, current_date + 7, 'LOT-BER-2404', 'Bodega AM'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:pimiento-rojo'), v_business_id, cat_ing_verduras, pg_temp.seed_uuid(v_business_id, 'sanitary:vegetables'), pg_temp.seed_uuid(v_business_id, 'supplier:huerto-central'), 'Pimiento rojo', 'kg', 'g', 2900, 2.9000, 100, 6, 1.5, 8, current_date - 1, 8, 'Refrigerado', 'Contenedor ventilado.', '3 C a 5 C', 3, 5, 4.4, 'Medio', '#388E3C', 'Verde', 'PIR-040', 'HUC-PIR-40', 'Camara verduras', current_date - 1, current_date + 7, 'LOT-PIR-2404', 'Bodega AM'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:limon'), v_business_id, cat_ing_frutas, pg_temp.seed_uuid(v_business_id, 'sanitary:fruits'), pg_temp.seed_uuid(v_business_id, 'supplier:huerto-central'), 'Limon', 'kg', 'g', 1800, 1.8000, 100, 7, 2, 10, current_date - 1, 10, 'Refrigerado o ambiente controlado', 'Separar por maduracion.', '4 C a 8 C', 4, 8, 7.2, 'Bajo/Medio', '#8BC34A', 'Verde claro', 'LIM-041', 'HUC-LIM-41', 'Camara frutas', current_date - 1, current_date + 8, 'LOT-LIM-2404', 'Bodega AM'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:naranja'), v_business_id, cat_ing_frutas, pg_temp.seed_uuid(v_business_id, 'sanitary:fruits'), pg_temp.seed_uuid(v_business_id, 'supplier:huerto-central'), 'Naranja', 'kg', 'g', 1900, 1.9000, 100, 6, 2, 10, current_date - 1, 10, 'Refrigerado o ambiente controlado', 'Separar por maduracion.', '4 C a 8 C', 4, 8, 7.1, 'Bajo/Medio', '#8BC34A', 'Verde claro', 'NAR-042', 'HUC-NAR-42', 'Camara frutas', current_date - 1, current_date + 8, 'LOT-NAR-2404', 'Bodega AM'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:frutos-rojos'), v_business_id, cat_ing_frutas, pg_temp.seed_uuid(v_business_id, 'sanitary:fruits'), pg_temp.seed_uuid(v_business_id, 'supplier:huerto-central'), 'Frutos rojos', 'kg', 'g', 8200, 8.2000, 100, 6, 1.5, 8, current_date - 1, 6, 'Refrigerado', 'Mantener secos y protegidos.', '4 C a 8 C', 4, 8, 5.5, 'Bajo/Medio', '#8BC34A', 'Verde claro', 'FRR-043', 'HUC-FRR-43', 'Camara frutas', current_date - 1, current_date + 5, 'LOT-FRR-2404', 'Bodega AM'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:manzana'), v_business_id, cat_ing_frutas, pg_temp.seed_uuid(v_business_id, 'sanitary:fruits'), pg_temp.seed_uuid(v_business_id, 'supplier:huerto-central'), 'Manzana fuji', 'kg', 'g', 1700, 1.7000, 100, 10, 2, 14, current_date - 1, 12, 'Refrigerado o ambiente controlado', 'Separar por maduracion.', '4 C a 8 C', 4, 8, 7.0, 'Bajo/Medio', '#8BC34A', 'Verde claro', 'MAN-044', 'HUC-MAN-44', 'Camara frutas', current_date - 1, current_date + 10, 'LOT-MAF-2404', 'Bodega AM'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:papa'), v_business_id, cat_ing_verduras, pg_temp.seed_uuid(v_business_id, 'sanitary:vegetables'), pg_temp.seed_uuid(v_business_id, 'supplier:huerto-central'), 'Papa', 'kg', 'g', 1200, 1.2000, 100, 20, 5, 30, current_date - 1, 20, 'Refrigerado', 'Separadas de carnes crudas.', '3 C a 5 C', 3, 5, 4.5, 'Medio', '#388E3C', 'Verde', 'PAP-045', 'HUC-PAP-45', 'Camara verduras', current_date - 1, current_date + 12, 'LOT-PAP-2404', 'Bodega AM'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:alcaparras'), v_business_id, cat_ing_condimentos, pg_temp.seed_uuid(v_business_id, 'sanitary:drygoods'), pg_temp.seed_uuid(v_business_id, 'supplier:despensa-gourmet'), 'Alcaparras', 'kg', 'g', 11800, 11.8000, 100, 2, 0.4, 3, current_date - 5, 180, 'Seco', 'Mantener en frasco sellado.', '15 C a 25 C', 15, 25, 21.0, 'Bajo', '#424242', 'Gris oscuro', 'ALC-046', 'DGO-ALC-46', 'Secos / condimentos', current_date - 5, current_date + 170, 'LOT-ALC-2404', 'Bodega seca')
  on conflict (id) do update
  set
    category_id = excluded.category_id,
    sanitary_category_id = excluded.sanitary_category_id,
    primary_supplier_id = excluded.primary_supplier_id,
    name = excluded.name,
    purchase_unit = excluded.purchase_unit,
    use_unit = excluded.use_unit,
    purchase_price = excluded.purchase_price,
    useful_unit_cost = excluded.useful_unit_cost,
    usable_yield_percent = excluded.usable_yield_percent,
    current_stock = excluded.current_stock,
    min_stock = excluded.min_stock,
    max_stock = excluded.max_stock,
    last_purchase_date = excluded.last_purchase_date,
    shelf_life_days = excluded.shelf_life_days,
    storage_type = excluded.storage_type,
    storage_conditions = excluded.storage_conditions,
    storage_temperature = excluded.storage_temperature,
    recommended_min_temp = excluded.recommended_min_temp,
    recommended_max_temp = excluded.recommended_max_temp,
    current_storage_temp = excluded.current_storage_temp,
    risk_level = excluded.risk_level,
    color_hex = excluded.color_hex,
    color_name = excluded.color_name,
    internal_code = excluded.internal_code,
    supplier_code = excluded.supplier_code,
    storage_location = excluded.storage_location,
    received_date = excluded.received_date,
    expiry_date = excluded.expiry_date,
    lot_code = excluded.lot_code,
    responsible = excluded.responsible;

  insert into public.ingredient_price_history (id, business_id, ingredient_id, supplier_id, price_purchase, recorded_at)
  select
    pg_temp.seed_uuid(v_business_id, 'price:' || i.internal_code),
    v_business_id,
    i.id,
    i.primary_supplier_id,
    i.purchase_price,
    current_date
  from public.ingredients i
  where i.business_id = v_business_id
    and i.internal_code like '%-%'
  on conflict (id) do update
  set
    supplier_id = excluded.supplier_id,
    price_purchase = excluded.price_purchase,
    recorded_at = excluded.recorded_at;

  insert into public.yield_records (
    id, business_id, ingredient_id, recorded_at, purchase_weight, cleaned_weight, cooked_weight, final_useful_weight,
    waste_percent, yield_percent, waste_type, trim_loss, peel_loss, bone_loss, fat_loss, evaporation_loss, thaw_loss, handling_loss, notes
  )
  values
    (pg_temp.seed_uuid(v_business_id, 'yield:salmon'), v_business_id, pg_temp.seed_uuid(v_business_id, 'ingredient:salmon-fresco'), current_date - 2, 1, 0.95, 0.92, 0.92, 8, 92, 'Operacional', 0.02, 0, 0, 0, 0.03, 0, 0.03, 'Porcionado y retiro de bordes.'),
    (pg_temp.seed_uuid(v_business_id, 'yield:lomo'), v_business_id, pg_temp.seed_uuid(v_business_id, 'ingredient:lomo-vetado'), current_date - 2, 1, 0.82, 0.70, 0.70, 30, 70, 'Operacional', 0.12, 0, 0, 0.08, 0.10, 0, 0, 'Limpieza de grasa y perdida por coccion.'),
    (pg_temp.seed_uuid(v_business_id, 'yield:espinaca'), v_business_id, pg_temp.seed_uuid(v_business_id, 'ingredient:espinaca'), current_date - 1, 1, 0.94, 0.90, 0.90, 10, 90, 'Limpieza', 0, 0.06, 0, 0, 0.04, 0, 0, 'Merma por lavado y coccion.'),
    (pg_temp.seed_uuid(v_business_id, 'yield:zapallo'), v_business_id, pg_temp.seed_uuid(v_business_id, 'ingredient:zapallo'), current_date - 1, 1, 0.84, 0.80, 0.80, 20, 80, 'Limpieza', 0, 0.16, 0, 0, 0.04, 0, 0, 'Perdida por cascara y coccion.'),
    (pg_temp.seed_uuid(v_business_id, 'yield:setas'), v_business_id, pg_temp.seed_uuid(v_business_id, 'ingredient:setas'), current_date - 1, 1, 0.98, 0.96, 0.96, 4, 96, 'Coccion', 0, 0, 0, 0, 0.02, 0, 0.02, 'Perdida leve por salteado.')
  on conflict (id) do update
  set
    ingredient_id = excluded.ingredient_id,
    recorded_at = excluded.recorded_at,
    purchase_weight = excluded.purchase_weight,
    cleaned_weight = excluded.cleaned_weight,
    cooked_weight = excluded.cooked_weight,
    final_useful_weight = excluded.final_useful_weight,
    waste_percent = excluded.waste_percent,
    yield_percent = excluded.yield_percent,
    waste_type = excluded.waste_type,
    trim_loss = excluded.trim_loss,
    peel_loss = excluded.peel_loss,
    bone_loss = excluded.bone_loss,
    fat_loss = excluded.fat_loss,
    evaporation_loss = excluded.evaporation_loss,
    thaw_loss = excluded.thaw_loss,
    handling_loss = excluded.handling_loss,
    notes = excluded.notes;

  insert into public.recipes (
    id, business_id, category_id, kind, name, yield_amount, yield_unit, item_cost_unit, time_minutes,
    labor_profile_id, labor_minutes, instructions, quality_notes, allergens, observations
  )
  values
    (pg_temp.seed_uuid(v_business_id, 'recipe:salmon-curado'), v_business_id, cat_dish_entradas, 'base', 'Salmon curado', 800, 'g', 'g', 240, pg_temp.seed_uuid(v_business_id, 'labor:partida-fria'), 45, 'Curar salmon en mezcla seca, lavar, secar y porcionar.', 'Textura firme y brillo limpio.', array['Pescado'], 'Base para amuse costero.'),
    (pg_temp.seed_uuid(v_business_id, 'recipe:aceite-eneldo'), v_business_id, cat_dish_amuse, 'base', 'Aceite de eneldo', 250, 'ml', 'ml', 20, pg_temp.seed_uuid(v_business_id, 'labor:partida-fria'), 10, 'Blanquear eneldo, procesar con aceite y colar.', 'Color verde vivo y sin amargor.', array[]::text[], 'Uso de terminacion.'),
    (pg_temp.seed_uuid(v_business_id, 'recipe:quinoa-citrica'), v_business_id, cat_dish_fondos, 'base', 'Quinoa citrica', 2500, 'g', 'g', 35, pg_temp.seed_uuid(v_business_id, 'labor:ayudante-cocina'), 20, 'Cocer quinoa y terminar con aceite y limon.', 'Grano suelto y sazon parejo.', array[]::text[], 'Guarnicion transversal.'),
    (pg_temp.seed_uuid(v_business_id, 'recipe:crema-espinacas'), v_business_id, cat_dish_fondos, 'base', 'Crema de espinacas', 2500, 'g', 'g', 40, pg_temp.seed_uuid(v_business_id, 'labor:partida-caliente'), 25, 'Sudado de aromáticos, crema y espinaca, luego triturar.', 'Textura sedosa y color verde limpio.', array['Lacteos'], 'Guarnicion base del salmon.'),
    (pg_temp.seed_uuid(v_business_id, 'recipe:compota-frutos-rojos'), v_business_id, cat_dish_postres, 'base', 'Compota de frutos rojos', 1300, 'g', 'g', 25, pg_temp.seed_uuid(v_business_id, 'labor:pastelero'), 20, 'Reducir frutos rojos con azucar y limon.', 'Acidez limpia y brillo.', array[]::text[], 'Base para panna cotta.'),
    (pg_temp.seed_uuid(v_business_id, 'recipe:crema-zapallo-jengibre'), v_business_id, cat_dish_amuse, 'base', 'Crema suave de zapallo y jengibre', 3000, 'ml', 'ml', 55, pg_temp.seed_uuid(v_business_id, 'labor:partida-caliente'), 30, 'Cocer zapallo con aromáticos, triturar y ajustar textura.', 'Textura sedosa, jengibre sutil.', array['Lacteos'], 'Amuse del menu Tierra.'),
    (pg_temp.seed_uuid(v_business_id, 'recipe:reduccion-vino-tinto'), v_business_id, cat_dish_fondos, 'base', 'Reduccion de vino tinto', 450, 'ml', 'ml', 45, pg_temp.seed_uuid(v_business_id, 'labor:partida-caliente'), 25, 'Reducir vino con cebolla y montar con mantequilla.', 'Brillo y sabor profundo.', array['Lacteos'], 'Salsa base del lomo.'),
    (pg_temp.seed_uuid(v_business_id, 'recipe:pure-rustico'), v_business_id, cat_dish_fondos, 'base', 'Pure rustico', 3500, 'g', 'g', 50, pg_temp.seed_uuid(v_business_id, 'labor:partida-caliente'), 30, 'Cocer papas, majar y emulsionar con lacteos.', 'Textura cremosa sin exceso de liquido.', array['Lacteos'], 'Guarnicion del menu Tierra.'),
    (pg_temp.seed_uuid(v_business_id, 'recipe:hummus-clasico'), v_business_id, cat_dish_amuse, 'base', 'Hummus clasico', 1800, 'g', 'g', 30, pg_temp.seed_uuid(v_business_id, 'labor:partida-fria'), 20, 'Procesar garbanzos con aceite, ajo y limon.', 'Textura lisa y sabor limpio.', array[]::text[], 'Base del menu Huerto.'),
    (pg_temp.seed_uuid(v_business_id, 'recipe:vegetales-encurtidos'), v_business_id, cat_dish_amuse, 'base', 'Vegetales encurtidos', 1400, 'g', 'g', 20, pg_temp.seed_uuid(v_business_id, 'labor:partida-fria'), 15, 'Laminar, calentar liquido y envasar.', 'Vegetal crocante y acidez balanceada.', array[]::text[], 'Acompañamiento para toston.'),
    (pg_temp.seed_uuid(v_business_id, 'recipe:verduras-asadas'), v_business_id, cat_dish_entradas, 'base', 'Verduras asadas', 1900, 'g', 'g', 35, pg_temp.seed_uuid(v_business_id, 'labor:partida-caliente'), 20, 'Asar vegetales por separado y terminar con aceite.', 'Asado limpio, sin exceso de humedad.', array[]::text[], 'Base de entrada vegetariana.'),
    (pg_temp.seed_uuid(v_business_id, 'recipe:crema-inglesa'), v_business_id, cat_dish_postres, 'base', 'Crema inglesa', 1800, 'ml', 'ml', 35, pg_temp.seed_uuid(v_business_id, 'labor:pastelero'), 25, 'Napear mezcla de leche, crema, yemas y azucar.', 'Textura lisa, sin grumos.', array['Huevos', 'Lacteos'], 'Salsa para postres.'),
    (pg_temp.seed_uuid(v_business_id, 'recipe:panna-cotta-vainilla'), v_business_id, cat_dish_postres, 'base', 'Panna cotta de vainilla', 2200, 'g', 'g', 30, pg_temp.seed_uuid(v_business_id, 'labor:pastelero'), 20, 'Calentar lacteos, integrar gelatina, porcionar y cuajar.', 'Firme pero temblorosa.', array['Lacteos'], 'Postre base del menu Costa.'),
    (pg_temp.seed_uuid(v_business_id, 'recipe:mousse-chocolate'), v_business_id, cat_dish_postres, 'base', 'Mousse de chocolate amargo', 2200, 'g', 'g', 40, pg_temp.seed_uuid(v_business_id, 'labor:pastelero'), 30, 'Fundir chocolate y airear con crema y huevos.', 'Textura aireada estable.', array['Huevos', 'Lacteos'], 'Postre base del menu Tierra.'),
    (pg_temp.seed_uuid(v_business_id, 'recipe:relleno-manzana'), v_business_id, cat_dish_postres, 'base', 'Relleno de manzana especiada', 2000, 'g', 'g', 35, pg_temp.seed_uuid(v_business_id, 'labor:pastelero'), 20, 'Cocer manzana con azucar, mantequilla y canela.', 'Relleno seco, no acuoso.', array['Lacteos'], 'Relleno para tarta.'),
    (pg_temp.seed_uuid(v_business_id, 'recipe:masa-tarta'), v_business_id, cat_dish_postres, 'base', 'Masa tarta sablée', 1800, 'g', 'g', 30, pg_temp.seed_uuid(v_business_id, 'labor:pastelero'), 20, 'Arenar harina y mantequilla, ligar con huevo, reposar y hornear.', 'Masa crocante y regular.', array['Gluten', 'Huevos', 'Lacteos'], 'Base para tarta de manzana.'),
    (pg_temp.seed_uuid(v_business_id, 'recipe:setas-salteadas'), v_business_id, cat_dish_fondos, 'base', 'Setas salteadas', 1300, 'g', 'g', 18, pg_temp.seed_uuid(v_business_id, 'labor:partida-caliente'), 12, 'Saltear setas en mantequilla y ajo.', 'Seta dorada, sin exceso de agua.', array['Lacteos'], 'Base del risotto.')
  on conflict (id) do update
  set
    category_id = excluded.category_id,
    kind = excluded.kind,
    name = excluded.name,
    yield_amount = excluded.yield_amount,
    yield_unit = excluded.yield_unit,
    item_cost_unit = excluded.item_cost_unit,
    time_minutes = excluded.time_minutes,
    labor_profile_id = excluded.labor_profile_id,
    labor_minutes = excluded.labor_minutes,
    instructions = excluded.instructions,
    quality_notes = excluded.quality_notes,
    allergens = excluded.allergens,
    observations = excluded.observations;

  delete from public.recipe_items
  where business_id = v_business_id
    and recipe_id in (
      pg_temp.seed_uuid(v_business_id, 'recipe:salmon-curado'),
      pg_temp.seed_uuid(v_business_id, 'recipe:aceite-eneldo'),
      pg_temp.seed_uuid(v_business_id, 'recipe:quinoa-citrica'),
      pg_temp.seed_uuid(v_business_id, 'recipe:crema-espinacas'),
      pg_temp.seed_uuid(v_business_id, 'recipe:compota-frutos-rojos'),
      pg_temp.seed_uuid(v_business_id, 'recipe:crema-zapallo-jengibre'),
      pg_temp.seed_uuid(v_business_id, 'recipe:reduccion-vino-tinto'),
      pg_temp.seed_uuid(v_business_id, 'recipe:pure-rustico'),
      pg_temp.seed_uuid(v_business_id, 'recipe:hummus-clasico'),
      pg_temp.seed_uuid(v_business_id, 'recipe:vegetales-encurtidos'),
      pg_temp.seed_uuid(v_business_id, 'recipe:verduras-asadas'),
      pg_temp.seed_uuid(v_business_id, 'recipe:crema-inglesa'),
      pg_temp.seed_uuid(v_business_id, 'recipe:panna-cotta-vainilla'),
      pg_temp.seed_uuid(v_business_id, 'recipe:mousse-chocolate'),
      pg_temp.seed_uuid(v_business_id, 'recipe:relleno-manzana'),
      pg_temp.seed_uuid(v_business_id, 'recipe:masa-tarta'),
      pg_temp.seed_uuid(v_business_id, 'recipe:setas-salteadas')
    );

  insert into public.recipe_items (id, business_id, recipe_id, ingredient_id, quantity, unit, waste_percent)
  values
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:salmon-curado:salmon'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:salmon-curado'), pg_temp.seed_uuid(v_business_id, 'ingredient:salmon-fresco'), 800, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:salmon-curado:sal'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:salmon-curado'), pg_temp.seed_uuid(v_business_id, 'ingredient:sal-fina'), 25, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:salmon-curado:azucar'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:salmon-curado'), pg_temp.seed_uuid(v_business_id, 'ingredient:azucar'), 25, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:salmon-curado:eneldo'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:salmon-curado'), pg_temp.seed_uuid(v_business_id, 'ingredient:eneldo'), 10, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:salmon-curado:limon'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:salmon-curado'), pg_temp.seed_uuid(v_business_id, 'ingredient:limon'), 50, 'g', 0),

    (pg_temp.seed_uuid(v_business_id, 'recipe-item:aceite-eneldo:aceite'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:aceite-eneldo'), pg_temp.seed_uuid(v_business_id, 'ingredient:aceite-oliva'), 250, 'ml', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:aceite-eneldo:eneldo'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:aceite-eneldo'), pg_temp.seed_uuid(v_business_id, 'ingredient:eneldo'), 30, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:aceite-eneldo:limon'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:aceite-eneldo'), pg_temp.seed_uuid(v_business_id, 'ingredient:limon'), 20, 'g', 0),

    (pg_temp.seed_uuid(v_business_id, 'recipe-item:quinoa:quinoa'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:quinoa-citrica'), pg_temp.seed_uuid(v_business_id, 'ingredient:quinoa-blanca'), 1000, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:quinoa:limon'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:quinoa-citrica'), pg_temp.seed_uuid(v_business_id, 'ingredient:limon'), 80, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:quinoa:aceite'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:quinoa-citrica'), pg_temp.seed_uuid(v_business_id, 'ingredient:aceite-oliva'), 80, 'ml', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:quinoa:sal'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:quinoa-citrica'), pg_temp.seed_uuid(v_business_id, 'ingredient:sal-fina'), 12, 'g', 0),

    (pg_temp.seed_uuid(v_business_id, 'recipe-item:espinacas:espinaca'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:crema-espinacas'), pg_temp.seed_uuid(v_business_id, 'ingredient:espinaca'), 1500, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:espinacas:crema'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:crema-espinacas'), pg_temp.seed_uuid(v_business_id, 'ingredient:crema'), 1500, 'ml', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:espinacas:mantequilla'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:crema-espinacas'), pg_temp.seed_uuid(v_business_id, 'ingredient:mantequilla'), 120, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:espinacas:cebolla'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:crema-espinacas'), pg_temp.seed_uuid(v_business_id, 'ingredient:cebolla-blanca'), 300, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:espinacas:ajo'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:crema-espinacas'), pg_temp.seed_uuid(v_business_id, 'ingredient:ajo'), 40, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:espinacas:sal'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:crema-espinacas'), pg_temp.seed_uuid(v_business_id, 'ingredient:sal-fina'), 12, 'g', 0),

    (pg_temp.seed_uuid(v_business_id, 'recipe-item:compota:frutos'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:compota-frutos-rojos'), pg_temp.seed_uuid(v_business_id, 'ingredient:frutos-rojos'), 1500, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:compota:azucar'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:compota-frutos-rojos'), pg_temp.seed_uuid(v_business_id, 'ingredient:azucar'), 250, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:compota:limon'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:compota-frutos-rojos'), pg_temp.seed_uuid(v_business_id, 'ingredient:limon'), 100, 'g', 0),

    (pg_temp.seed_uuid(v_business_id, 'recipe-item:zapallo:zapallo'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:crema-zapallo-jengibre'), pg_temp.seed_uuid(v_business_id, 'ingredient:zapallo'), 3000, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:zapallo:cebolla'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:crema-zapallo-jengibre'), pg_temp.seed_uuid(v_business_id, 'ingredient:cebolla-blanca'), 400, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:zapallo:jengibre'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:crema-zapallo-jengibre'), pg_temp.seed_uuid(v_business_id, 'ingredient:jengibre'), 60, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:zapallo:crema'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:crema-zapallo-jengibre'), pg_temp.seed_uuid(v_business_id, 'ingredient:crema'), 600, 'ml', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:zapallo:mantequilla'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:crema-zapallo-jengibre'), pg_temp.seed_uuid(v_business_id, 'ingredient:mantequilla'), 80, 'g', 0),

    (pg_temp.seed_uuid(v_business_id, 'recipe-item:reduccion:vino'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:reduccion-vino-tinto'), pg_temp.seed_uuid(v_business_id, 'ingredient:vino-tinto'), 1000, 'ml', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:reduccion:cebolla'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:reduccion-vino-tinto'), pg_temp.seed_uuid(v_business_id, 'ingredient:cebolla-blanca'), 200, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:reduccion:mantequilla'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:reduccion-vino-tinto'), pg_temp.seed_uuid(v_business_id, 'ingredient:mantequilla'), 50, 'g', 0),

    (pg_temp.seed_uuid(v_business_id, 'recipe-item:pure:papa'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:pure-rustico'), pg_temp.seed_uuid(v_business_id, 'ingredient:papa'), 5000, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:pure:crema'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:pure-rustico'), pg_temp.seed_uuid(v_business_id, 'ingredient:crema'), 700, 'ml', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:pure:mantequilla'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:pure-rustico'), pg_temp.seed_uuid(v_business_id, 'ingredient:mantequilla'), 200, 'g', 0),

    (pg_temp.seed_uuid(v_business_id, 'recipe-item:hummus:garbanzos'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:hummus-clasico'), pg_temp.seed_uuid(v_business_id, 'ingredient:garbanzos'), 2000, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:hummus:aceite'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:hummus-clasico'), pg_temp.seed_uuid(v_business_id, 'ingredient:aceite-oliva'), 120, 'ml', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:hummus:limon'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:hummus-clasico'), pg_temp.seed_uuid(v_business_id, 'ingredient:limon'), 100, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:hummus:ajo'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:hummus-clasico'), pg_temp.seed_uuid(v_business_id, 'ingredient:ajo'), 50, 'g', 0),

    (pg_temp.seed_uuid(v_business_id, 'recipe-item:encurtidos:zanahoria'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:vegetales-encurtidos'), pg_temp.seed_uuid(v_business_id, 'ingredient:zanahoria'), 400, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:encurtidos:pepino'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:vegetales-encurtidos'), pg_temp.seed_uuid(v_business_id, 'ingredient:pepino'), 400, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:encurtidos:cebolla'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:vegetales-encurtidos'), pg_temp.seed_uuid(v_business_id, 'ingredient:cebolla-morada'), 300, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:encurtidos:vinagre'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:vegetales-encurtidos'), pg_temp.seed_uuid(v_business_id, 'ingredient:vinagre'), 500, 'ml', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:encurtidos:azucar'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:vegetales-encurtidos'), pg_temp.seed_uuid(v_business_id, 'ingredient:azucar'), 60, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:encurtidos:sal'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:vegetales-encurtidos'), pg_temp.seed_uuid(v_business_id, 'ingredient:sal-fina'), 10, 'g', 0),

    (pg_temp.seed_uuid(v_business_id, 'recipe-item:verduras-asadas:zucchini'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:verduras-asadas'), pg_temp.seed_uuid(v_business_id, 'ingredient:zucchini'), 800, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:verduras-asadas:berenjena'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:verduras-asadas'), pg_temp.seed_uuid(v_business_id, 'ingredient:berenjena'), 800, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:verduras-asadas:pimiento'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:verduras-asadas'), pg_temp.seed_uuid(v_business_id, 'ingredient:pimiento-rojo'), 600, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:verduras-asadas:aceite'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:verduras-asadas'), pg_temp.seed_uuid(v_business_id, 'ingredient:aceite-oliva'), 80, 'ml', 0),

    (pg_temp.seed_uuid(v_business_id, 'recipe-item:inglesa:leche'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:crema-inglesa'), pg_temp.seed_uuid(v_business_id, 'ingredient:leche-entera'), 1500, 'ml', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:inglesa:crema'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:crema-inglesa'), pg_temp.seed_uuid(v_business_id, 'ingredient:crema'), 500, 'ml', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:inglesa:huevos'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:crema-inglesa'), pg_temp.seed_uuid(v_business_id, 'ingredient:huevos'), 10, 'unidad', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:inglesa:azucar'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:crema-inglesa'), pg_temp.seed_uuid(v_business_id, 'ingredient:azucar'), 250, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:inglesa:vainilla'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:crema-inglesa'), pg_temp.seed_uuid(v_business_id, 'ingredient:vainilla'), 20, 'ml', 0),

    (pg_temp.seed_uuid(v_business_id, 'recipe-item:panna:crema'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:panna-cotta-vainilla'), pg_temp.seed_uuid(v_business_id, 'ingredient:crema'), 1500, 'ml', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:panna:leche'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:panna-cotta-vainilla'), pg_temp.seed_uuid(v_business_id, 'ingredient:leche-entera'), 500, 'ml', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:panna:azucar'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:panna-cotta-vainilla'), pg_temp.seed_uuid(v_business_id, 'ingredient:azucar'), 250, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:panna:gelatina'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:panna-cotta-vainilla'), pg_temp.seed_uuid(v_business_id, 'ingredient:gelatina'), 30, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:panna:vainilla'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:panna-cotta-vainilla'), pg_temp.seed_uuid(v_business_id, 'ingredient:vainilla'), 20, 'ml', 0),

    (pg_temp.seed_uuid(v_business_id, 'recipe-item:mousse:chocolate'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:mousse-chocolate'), pg_temp.seed_uuid(v_business_id, 'ingredient:chocolate'), 1200, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:mousse:crema'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:mousse-chocolate'), pg_temp.seed_uuid(v_business_id, 'ingredient:crema'), 1500, 'ml', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:mousse:huevos'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:mousse-chocolate'), pg_temp.seed_uuid(v_business_id, 'ingredient:huevos'), 12, 'unidad', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:mousse:azucar'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:mousse-chocolate'), pg_temp.seed_uuid(v_business_id, 'ingredient:azucar'), 200, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:mousse:naranja'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:mousse-chocolate'), pg_temp.seed_uuid(v_business_id, 'ingredient:naranja'), 80, 'g', 0),

    (pg_temp.seed_uuid(v_business_id, 'recipe-item:manzana:manzana'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:relleno-manzana'), pg_temp.seed_uuid(v_business_id, 'ingredient:manzana'), 2500, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:manzana:azucar'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:relleno-manzana'), pg_temp.seed_uuid(v_business_id, 'ingredient:azucar'), 250, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:manzana:mantequilla'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:relleno-manzana'), pg_temp.seed_uuid(v_business_id, 'ingredient:mantequilla'), 120, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:manzana:canela'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:relleno-manzana'), pg_temp.seed_uuid(v_business_id, 'ingredient:canela'), 12, 'g', 0),

    (pg_temp.seed_uuid(v_business_id, 'recipe-item:masa:harina'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:masa-tarta'), pg_temp.seed_uuid(v_business_id, 'ingredient:harina'), 1000, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:masa:mantequilla'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:masa-tarta'), pg_temp.seed_uuid(v_business_id, 'ingredient:mantequilla'), 500, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:masa:huevos'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:masa-tarta'), pg_temp.seed_uuid(v_business_id, 'ingredient:huevos'), 4, 'unidad', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:masa:azucar'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:masa-tarta'), pg_temp.seed_uuid(v_business_id, 'ingredient:azucar'), 120, 'g', 0),

    (pg_temp.seed_uuid(v_business_id, 'recipe-item:setas:setas'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:setas-salteadas'), pg_temp.seed_uuid(v_business_id, 'ingredient:setas'), 1500, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:setas:mantequilla'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:setas-salteadas'), pg_temp.seed_uuid(v_business_id, 'ingredient:mantequilla'), 120, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:setas:ajo'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:setas-salteadas'), pg_temp.seed_uuid(v_business_id, 'ingredient:ajo'), 30, 'g', 0)
  ;

  insert into public.dishes (
    id, business_id, category_id, name, service, labor_profile_id, labor_minutes,
    indirect_cost_share, target_food_cost, desired_margin, allergens, plating_notes,
    quality_checklist, technical_notes, shelf_life_hours, sales_count, image_url
  )
  values
    (pg_temp.seed_uuid(v_business_id, 'dish:costa-amuse'), v_business_id, cat_dish_amuse, 'Cucharita de salmon curado, pepino y aceite de eneldo', 'Cena', pg_temp.seed_uuid(v_business_id, 'labor:partida-fria'), 6, 1.0, 0.22, 0.70, array['Pescado'], 'Servir en cuchara fria con terminacion puntual.', array['20 g salmon curado', 'Pepino muy fino', 'Aceite sin exceso'], 'Amuse costero de apertura.', 4, 18, null),
    (pg_temp.seed_uuid(v_business_id, 'dish:costa-entrada'), v_business_id, cat_dish_entradas, 'Tartar de salmon premium con palta, alcaparras y crocante', 'Cena', pg_temp.seed_uuid(v_business_id, 'labor:partida-fria'), 9, 1.1, 0.28, 0.70, array['Pescado'], 'Molde limpio, palta pareja y crocante final.', array['120 g salmon', '60 g palta', 'Aliño balanceado'], 'Entrada fresca de alto margen.', 6, 42, null),
    (pg_temp.seed_uuid(v_business_id, 'dish:costa-fondo'), v_business_id, cat_dish_fondos, 'Salmon sellado con crema de espinacas y quinoa citrica', 'Cena', pg_temp.seed_uuid(v_business_id, 'labor:partida-caliente'), 14, 1.3, 0.32, 0.70, array['Pescado', 'Lacteos'], 'Quinoa centrada, salmon con punto medio y crema como espejo.', array['180 g salmon', '140 g quinoa', '120 g crema espinaca'], 'Principal del menu Costa.', 4, 58, null),
    (pg_temp.seed_uuid(v_business_id, 'dish:costa-postre'), v_business_id, cat_dish_postres, 'Panna cotta de vainilla con compota de frutos rojos', 'Cena', pg_temp.seed_uuid(v_business_id, 'labor:pastelero'), 5, 0.9, 0.25, 0.72, array['Lacteos'], 'Molde desmoldado limpio y compota brillante.', array['120 g panna cotta', '40 g compota'], 'Postre frio de alta repetibilidad.', 12, 37, null),

    (pg_temp.seed_uuid(v_business_id, 'dish:tierra-amuse'), v_business_id, cat_dish_amuse, 'Crema suave de zapallo y jengibre', 'Cena', pg_temp.seed_uuid(v_business_id, 'labor:partida-caliente'), 5, 0.9, 0.22, 0.70, array['Lacteos'], 'Servir en taza caliente con textura lisa.', array['90 ml crema', 'Punto de jengibre controlado'], 'Amuse del menu Tierra.', 6, 16, null),
    (pg_temp.seed_uuid(v_business_id, 'dish:tierra-entrada'), v_business_id, cat_dish_entradas, 'Carpaccio de lomo vetado con rucula, parmesano y aceite de oliva', 'Cena', pg_temp.seed_uuid(v_business_id, 'labor:partida-fria'), 8, 1.1, 0.28, 0.70, array['Lacteos'], 'Laminado fino y terminacion al pase.', array['90 g lomo', '20 g rucula', '15 g parmesano'], 'Entrada premium del menu Tierra.', 2, 24, null),
    (pg_temp.seed_uuid(v_business_id, 'dish:tierra-fondo'), v_business_id, cat_dish_fondos, 'Lomo vetado con pure rustico y reduccion de vino tinto', 'Cena', pg_temp.seed_uuid(v_business_id, 'labor:partida-caliente'), 16, 1.4, 0.32, 0.70, array['Lacteos'], 'Carne marcada, pure liso y salsa brillante.', array['220 g lomo', '180 g pure', '40 ml salsa'], 'Principal carnico del menu Tierra.', 4, 49, null),
    (pg_temp.seed_uuid(v_business_id, 'dish:tierra-postre'), v_business_id, cat_dish_postres, 'Mousse de chocolate amargo con sal de mar y naranja', 'Cena', pg_temp.seed_uuid(v_business_id, 'labor:pastelero'), 6, 0.9, 0.25, 0.72, array['Huevos', 'Lacteos'], 'Quenelle o copa con ralladura fina de naranja.', array['120 g mousse', 'Acabado limpio'], 'Postre de chocolate del menu Tierra.', 10, 33, null),

    (pg_temp.seed_uuid(v_business_id, 'dish:huerto-amuse'), v_business_id, cat_dish_amuse, 'Toston de masa madre con hummus y vegetales encurtidos', 'Cena', pg_temp.seed_uuid(v_business_id, 'labor:partida-fria'), 6, 0.9, 0.22, 0.70, array['Gluten'], 'Toston tibio, hummus parejo y encurtidos crocantes.', array['1 toston', '25 g hummus', '15 g encurtidos'], 'Amuse vegetariano del menu Huerto.', 4, 14, null),
    (pg_temp.seed_uuid(v_business_id, 'dish:huerto-entrada'), v_business_id, cat_dish_entradas, 'Ensalada tibia de quinoa, verduras asadas y queso de cabra', 'Cena', pg_temp.seed_uuid(v_business_id, 'labor:partida-fria'), 9, 1.0, 0.28, 0.70, array['Lacteos'], 'Plato hondo templado y vegetales bien glaseados.', array['90 g quinoa', '90 g verduras', '35 g queso'], 'Entrada vegetariana de alta coherencia operacional.', 4, 19, null),
    (pg_temp.seed_uuid(v_business_id, 'dish:huerto-fondo'), v_business_id, cat_dish_fondos, 'Risotto de setas con aceite de oliva y chips de parmesano', 'Cena', pg_temp.seed_uuid(v_business_id, 'labor:partida-caliente'), 15, 1.2, 0.32, 0.70, array['Lacteos'], 'Arroz al dente, setas marcadas y parmesano crocante.', array['110 g arborio', '90 g setas', '20 g parmesano'], 'Fondo vegetariano principal.', 2, 27, null),
    (pg_temp.seed_uuid(v_business_id, 'dish:huerto-postre'), v_business_id, cat_dish_postres, 'Tarta de manzana con crema inglesa', 'Cena', pg_temp.seed_uuid(v_business_id, 'labor:pastelero'), 8, 1.0, 0.25, 0.72, array['Gluten', 'Huevos', 'Lacteos'], 'Porcion tibia con salsa al pase.', array['80 g masa', '130 g relleno', '60 ml crema inglesa'], 'Postre clasico de cierre.', 8, 21, null)
  on conflict (id) do update
  set
    category_id = excluded.category_id,
    name = excluded.name,
    service = excluded.service,
    labor_profile_id = excluded.labor_profile_id,
    labor_minutes = excluded.labor_minutes,
    indirect_cost_share = excluded.indirect_cost_share,
    target_food_cost = excluded.target_food_cost,
    desired_margin = excluded.desired_margin,
    allergens = excluded.allergens,
    plating_notes = excluded.plating_notes,
    quality_checklist = excluded.quality_checklist,
    technical_notes = excluded.technical_notes,
    shelf_life_hours = excluded.shelf_life_hours,
    sales_count = excluded.sales_count,
    image_url = excluded.image_url;

  delete from public.dish_components
  where business_id = v_business_id
    and dish_id in (
      pg_temp.seed_uuid(v_business_id, 'dish:costa-amuse'),
      pg_temp.seed_uuid(v_business_id, 'dish:costa-entrada'),
      pg_temp.seed_uuid(v_business_id, 'dish:costa-fondo'),
      pg_temp.seed_uuid(v_business_id, 'dish:costa-postre'),
      pg_temp.seed_uuid(v_business_id, 'dish:tierra-amuse'),
      pg_temp.seed_uuid(v_business_id, 'dish:tierra-entrada'),
      pg_temp.seed_uuid(v_business_id, 'dish:tierra-fondo'),
      pg_temp.seed_uuid(v_business_id, 'dish:tierra-postre'),
      pg_temp.seed_uuid(v_business_id, 'dish:huerto-amuse'),
      pg_temp.seed_uuid(v_business_id, 'dish:huerto-entrada'),
      pg_temp.seed_uuid(v_business_id, 'dish:huerto-fondo'),
      pg_temp.seed_uuid(v_business_id, 'dish:huerto-postre')
    );

  insert into public.dish_components (id, business_id, dish_id, component_type, ref_id, quantity, unit, waste_percent)
  values
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:costa-amuse:salmon-curado'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:costa-amuse'), 'baseRecipe', pg_temp.seed_uuid(v_business_id, 'recipe:salmon-curado'), 25, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:costa-amuse:pepino'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:costa-amuse'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:pepino'), 15, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:costa-amuse:aceite'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:costa-amuse'), 'baseRecipe', pg_temp.seed_uuid(v_business_id, 'recipe:aceite-eneldo'), 5, 'ml', 0),

    (pg_temp.seed_uuid(v_business_id, 'dishcomp:costa-entrada:salmon'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:costa-entrada'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:salmon-fresco'), 120, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:costa-entrada:palta'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:costa-entrada'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:palta'), 60, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:costa-entrada:alcaparras'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:costa-entrada'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:alcaparras'), 8, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:costa-entrada:cebolla'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:costa-entrada'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:cebolla-morada'), 12, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:costa-entrada:limon'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:costa-entrada'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:limon'), 12, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:costa-entrada:pan'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:costa-entrada'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:masa-madre'), 1, 'unidad', 0),

    (pg_temp.seed_uuid(v_business_id, 'dishcomp:costa-fondo:salmon'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:costa-fondo'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:salmon-fresco'), 180, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:costa-fondo:crema-espinacas'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:costa-fondo'), 'baseRecipe', pg_temp.seed_uuid(v_business_id, 'recipe:crema-espinacas'), 120, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:costa-fondo:quinoa'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:costa-fondo'), 'baseRecipe', pg_temp.seed_uuid(v_business_id, 'recipe:quinoa-citrica'), 140, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:costa-postre:panna'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:costa-postre'), 'baseRecipe', pg_temp.seed_uuid(v_business_id, 'recipe:panna-cotta-vainilla'), 120, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:costa-postre:compota'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:costa-postre'), 'baseRecipe', pg_temp.seed_uuid(v_business_id, 'recipe:compota-frutos-rojos'), 40, 'g', 0),

    (pg_temp.seed_uuid(v_business_id, 'dishcomp:tierra-amuse:crema'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:tierra-amuse'), 'baseRecipe', pg_temp.seed_uuid(v_business_id, 'recipe:crema-zapallo-jengibre'), 90, 'ml', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:tierra-entrada:lomo'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:tierra-entrada'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:lomo-vetado'), 90, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:tierra-entrada:rucula'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:tierra-entrada'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:rucula'), 20, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:tierra-entrada:parmesano'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:tierra-entrada'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:parmesano'), 15, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:tierra-entrada:aceite'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:tierra-entrada'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:aceite-oliva'), 8, 'ml', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:tierra-fondo:lomo'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:tierra-fondo'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:lomo-vetado'), 220, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:tierra-fondo:pure'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:tierra-fondo'), 'baseRecipe', pg_temp.seed_uuid(v_business_id, 'recipe:pure-rustico'), 180, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:tierra-fondo:reduccion'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:tierra-fondo'), 'baseRecipe', pg_temp.seed_uuid(v_business_id, 'recipe:reduccion-vino-tinto'), 40, 'ml', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:tierra-postre:mousse'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:tierra-postre'), 'baseRecipe', pg_temp.seed_uuid(v_business_id, 'recipe:mousse-chocolate'), 120, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:tierra-postre:naranja'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:tierra-postre'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:naranja'), 10, 'g', 0),

    (pg_temp.seed_uuid(v_business_id, 'dishcomp:huerto-amuse:pan'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:huerto-amuse'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:masa-madre'), 1, 'unidad', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:huerto-amuse:hummus'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:huerto-amuse'), 'baseRecipe', pg_temp.seed_uuid(v_business_id, 'recipe:hummus-clasico'), 25, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:huerto-amuse:encurtidos'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:huerto-amuse'), 'baseRecipe', pg_temp.seed_uuid(v_business_id, 'recipe:vegetales-encurtidos'), 15, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:huerto-entrada:quinoa'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:huerto-entrada'), 'baseRecipe', pg_temp.seed_uuid(v_business_id, 'recipe:quinoa-citrica'), 90, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:huerto-entrada:verduras'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:huerto-entrada'), 'baseRecipe', pg_temp.seed_uuid(v_business_id, 'recipe:verduras-asadas'), 90, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:huerto-entrada:queso'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:huerto-entrada'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:queso-cabra'), 35, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:huerto-entrada:rucula'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:huerto-entrada'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:rucula'), 20, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:huerto-fondo:arborio'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:huerto-fondo'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:arroz-arborio'), 110, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:huerto-fondo:setas'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:huerto-fondo'), 'baseRecipe', pg_temp.seed_uuid(v_business_id, 'recipe:setas-salteadas'), 90, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:huerto-fondo:parmesano'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:huerto-fondo'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:parmesano'), 20, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:huerto-fondo:crema'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:huerto-fondo'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:crema'), 40, 'ml', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:huerto-fondo:mantequilla'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:huerto-fondo'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:mantequilla'), 20, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:huerto-postre:masa'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:huerto-postre'), 'baseRecipe', pg_temp.seed_uuid(v_business_id, 'recipe:masa-tarta'), 80, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:huerto-postre:relleno'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:huerto-postre'), 'baseRecipe', pg_temp.seed_uuid(v_business_id, 'recipe:relleno-manzana'), 130, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:huerto-postre:inglesa'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:huerto-postre'), 'baseRecipe', pg_temp.seed_uuid(v_business_id, 'recipe:crema-inglesa'), 60, 'ml', 0)
  ;

  insert into public.menus (id, business_id, name)
  values
    (pg_temp.seed_uuid(v_business_id, 'menu:costa'), v_business_id, 'Menu Costa'),
    (pg_temp.seed_uuid(v_business_id, 'menu:tierra'), v_business_id, 'Menu Tierra'),
    (pg_temp.seed_uuid(v_business_id, 'menu:huerto'), v_business_id, 'Menu Huerto')
  on conflict (id) do update
  set name = excluded.name;

  insert into public.menu_categories (id, business_id, menu_id, category_id)
  values
    (pg_temp.seed_uuid(v_business_id, 'menucat:costa:amuse'), v_business_id, pg_temp.seed_uuid(v_business_id, 'menu:costa'), cat_dish_amuse),
    (pg_temp.seed_uuid(v_business_id, 'menucat:costa:entradas'), v_business_id, pg_temp.seed_uuid(v_business_id, 'menu:costa'), cat_dish_entradas),
    (pg_temp.seed_uuid(v_business_id, 'menucat:costa:fondos'), v_business_id, pg_temp.seed_uuid(v_business_id, 'menu:costa'), cat_dish_fondos),
    (pg_temp.seed_uuid(v_business_id, 'menucat:costa:postres'), v_business_id, pg_temp.seed_uuid(v_business_id, 'menu:costa'), cat_dish_postres),
    (pg_temp.seed_uuid(v_business_id, 'menucat:tierra:amuse'), v_business_id, pg_temp.seed_uuid(v_business_id, 'menu:tierra'), cat_dish_amuse),
    (pg_temp.seed_uuid(v_business_id, 'menucat:tierra:entradas'), v_business_id, pg_temp.seed_uuid(v_business_id, 'menu:tierra'), cat_dish_entradas),
    (pg_temp.seed_uuid(v_business_id, 'menucat:tierra:fondos'), v_business_id, pg_temp.seed_uuid(v_business_id, 'menu:tierra'), cat_dish_fondos),
    (pg_temp.seed_uuid(v_business_id, 'menucat:tierra:postres'), v_business_id, pg_temp.seed_uuid(v_business_id, 'menu:tierra'), cat_dish_postres),
    (pg_temp.seed_uuid(v_business_id, 'menucat:huerto:amuse'), v_business_id, pg_temp.seed_uuid(v_business_id, 'menu:huerto'), cat_dish_amuse),
    (pg_temp.seed_uuid(v_business_id, 'menucat:huerto:entradas'), v_business_id, pg_temp.seed_uuid(v_business_id, 'menu:huerto'), cat_dish_entradas),
    (pg_temp.seed_uuid(v_business_id, 'menucat:huerto:fondos'), v_business_id, pg_temp.seed_uuid(v_business_id, 'menu:huerto'), cat_dish_fondos),
    (pg_temp.seed_uuid(v_business_id, 'menucat:huerto:postres'), v_business_id, pg_temp.seed_uuid(v_business_id, 'menu:huerto'), cat_dish_postres)
  on conflict (id) do update
  set
    menu_id = excluded.menu_id,
    category_id = excluded.category_id;

  insert into public.menu_items (id, business_id, menu_id, dish_id)
  values
    (pg_temp.seed_uuid(v_business_id, 'menuitem:costa:1'), v_business_id, pg_temp.seed_uuid(v_business_id, 'menu:costa'), pg_temp.seed_uuid(v_business_id, 'dish:costa-amuse')),
    (pg_temp.seed_uuid(v_business_id, 'menuitem:costa:2'), v_business_id, pg_temp.seed_uuid(v_business_id, 'menu:costa'), pg_temp.seed_uuid(v_business_id, 'dish:costa-entrada')),
    (pg_temp.seed_uuid(v_business_id, 'menuitem:costa:3'), v_business_id, pg_temp.seed_uuid(v_business_id, 'menu:costa'), pg_temp.seed_uuid(v_business_id, 'dish:costa-fondo')),
    (pg_temp.seed_uuid(v_business_id, 'menuitem:costa:4'), v_business_id, pg_temp.seed_uuid(v_business_id, 'menu:costa'), pg_temp.seed_uuid(v_business_id, 'dish:costa-postre')),
    (pg_temp.seed_uuid(v_business_id, 'menuitem:tierra:1'), v_business_id, pg_temp.seed_uuid(v_business_id, 'menu:tierra'), pg_temp.seed_uuid(v_business_id, 'dish:tierra-amuse')),
    (pg_temp.seed_uuid(v_business_id, 'menuitem:tierra:2'), v_business_id, pg_temp.seed_uuid(v_business_id, 'menu:tierra'), pg_temp.seed_uuid(v_business_id, 'dish:tierra-entrada')),
    (pg_temp.seed_uuid(v_business_id, 'menuitem:tierra:3'), v_business_id, pg_temp.seed_uuid(v_business_id, 'menu:tierra'), pg_temp.seed_uuid(v_business_id, 'dish:tierra-fondo')),
    (pg_temp.seed_uuid(v_business_id, 'menuitem:tierra:4'), v_business_id, pg_temp.seed_uuid(v_business_id, 'menu:tierra'), pg_temp.seed_uuid(v_business_id, 'dish:tierra-postre')),
    (pg_temp.seed_uuid(v_business_id, 'menuitem:huerto:1'), v_business_id, pg_temp.seed_uuid(v_business_id, 'menu:huerto'), pg_temp.seed_uuid(v_business_id, 'dish:huerto-amuse')),
    (pg_temp.seed_uuid(v_business_id, 'menuitem:huerto:2'), v_business_id, pg_temp.seed_uuid(v_business_id, 'menu:huerto'), pg_temp.seed_uuid(v_business_id, 'dish:huerto-entrada')),
    (pg_temp.seed_uuid(v_business_id, 'menuitem:huerto:3'), v_business_id, pg_temp.seed_uuid(v_business_id, 'menu:huerto'), pg_temp.seed_uuid(v_business_id, 'dish:huerto-fondo')),
    (pg_temp.seed_uuid(v_business_id, 'menuitem:huerto:4'), v_business_id, pg_temp.seed_uuid(v_business_id, 'menu:huerto'), pg_temp.seed_uuid(v_business_id, 'dish:huerto-postre'))
  on conflict (id) do update
  set
    menu_id = excluded.menu_id,
    dish_id = excluded.dish_id;

  insert into public.projections (id, business_id, name, period)
  values
    (pg_temp.seed_uuid(v_business_id, 'projection:lanzamiento-mensual'), v_business_id, 'Lanzamiento menus degustacion', 'mes')
  on conflict (id) do update
  set
    name = excluded.name,
    period = excluded.period;

  delete from public.projection_days
  where business_id = v_business_id
    and projection_id = pg_temp.seed_uuid(v_business_id, 'projection:lanzamiento-mensual');

  insert into public.projection_days (id, business_id, projection_id, day_name, projected_customers, avg_food_ticket, avg_beverage_ticket)
  values
    (pg_temp.seed_uuid(v_business_id, 'projection-day:lun'), v_business_id, pg_temp.seed_uuid(v_business_id, 'projection:lanzamiento-mensual'), 'Lunes', 18, 45900, 11000),
    (pg_temp.seed_uuid(v_business_id, 'projection-day:mar'), v_business_id, pg_temp.seed_uuid(v_business_id, 'projection:lanzamiento-mensual'), 'Martes', 18, 45900, 11000),
    (pg_temp.seed_uuid(v_business_id, 'projection-day:mie'), v_business_id, pg_temp.seed_uuid(v_business_id, 'projection:lanzamiento-mensual'), 'Miercoles', 22, 46900, 11200),
    (pg_temp.seed_uuid(v_business_id, 'projection-day:jue'), v_business_id, pg_temp.seed_uuid(v_business_id, 'projection:lanzamiento-mensual'), 'Jueves', 24, 47900, 11800),
    (pg_temp.seed_uuid(v_business_id, 'projection-day:vie'), v_business_id, pg_temp.seed_uuid(v_business_id, 'projection:lanzamiento-mensual'), 'Viernes', 34, 48900, 12500),
    (pg_temp.seed_uuid(v_business_id, 'projection-day:sab'), v_business_id, pg_temp.seed_uuid(v_business_id, 'projection:lanzamiento-mensual'), 'Sabado', 40, 49900, 12800),
    (pg_temp.seed_uuid(v_business_id, 'projection-day:dom'), v_business_id, pg_temp.seed_uuid(v_business_id, 'projection:lanzamiento-mensual'), 'Domingo', 26, 47900, 12000);

  insert into public.purchases (id, business_id, supplier_id, ordered_at, status, notes)
  values
    (pg_temp.seed_uuid(v_business_id, 'purchase:seafoods'), v_business_id, pg_temp.seed_uuid(v_business_id, 'supplier:pacific-sea-foods'), current_date - 2, 'received', 'Compra inicial salmon fresco.'),
    (pg_temp.seed_uuid(v_business_id, 'purchase:meat'), v_business_id, pg_temp.seed_uuid(v_business_id, 'supplier:carnes-don-andres'), current_date - 2, 'received', 'Compra inicial lomo vetado.'),
    (pg_temp.seed_uuid(v_business_id, 'purchase:produce'), v_business_id, pg_temp.seed_uuid(v_business_id, 'supplier:huerto-central'), current_date - 1, 'received', 'Abastecimiento semanal de frutas, verduras y hierbas.'),
    (pg_temp.seed_uuid(v_business_id, 'purchase:dairy'), v_business_id, pg_temp.seed_uuid(v_business_id, 'supplier:lacteos-valle-verde'), current_date - 3, 'received', 'Lacteos y huevos para mise en place semanal.'),
    (pg_temp.seed_uuid(v_business_id, 'purchase:drygoods'), v_business_id, pg_temp.seed_uuid(v_business_id, 'supplier:despensa-gourmet'), current_date - 5, 'received', 'Secos, especias y reposteria.'),
    (pg_temp.seed_uuid(v_business_id, 'purchase:bakery'), v_business_id, pg_temp.seed_uuid(v_business_id, 'supplier:panes-masa-madre'), current_date - 1, 'received', 'Rebanadas de masa madre diaria.'),
    (pg_temp.seed_uuid(v_business_id, 'purchase:wine'), v_business_id, pg_temp.seed_uuid(v_business_id, 'supplier:vinoteca-andina'), current_date - 5, 'received', 'Vino tinto para reducciones.')
  on conflict (id) do update
  set
    supplier_id = excluded.supplier_id,
    ordered_at = excluded.ordered_at,
    status = excluded.status,
    notes = excluded.notes;

  delete from public.purchase_items
  where business_id = v_business_id
    and purchase_id in (
      pg_temp.seed_uuid(v_business_id, 'purchase:seafoods'),
      pg_temp.seed_uuid(v_business_id, 'purchase:meat'),
      pg_temp.seed_uuid(v_business_id, 'purchase:produce'),
      pg_temp.seed_uuid(v_business_id, 'purchase:dairy'),
      pg_temp.seed_uuid(v_business_id, 'purchase:drygoods'),
      pg_temp.seed_uuid(v_business_id, 'purchase:bakery'),
      pg_temp.seed_uuid(v_business_id, 'purchase:wine')
    );

  insert into public.purchase_items (id, business_id, purchase_id, ingredient_id, quantity, unit, unit_price, received_quantity)
  values
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:seafoods:salmon'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:seafoods'), pg_temp.seed_uuid(v_business_id, 'ingredient:salmon-fresco'), 12, 'kg', 14500, 12),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:meat:lomo'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:meat'), pg_temp.seed_uuid(v_business_id, 'ingredient:lomo-vetado'), 10, 'kg', 24000, 10),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:produce:pepino'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:produce'), pg_temp.seed_uuid(v_business_id, 'ingredient:pepino'), 4, 'kg', 1700, 4),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:produce:palta'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:produce'), pg_temp.seed_uuid(v_business_id, 'ingredient:palta'), 6, 'kg', 5800, 6),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:produce:cebolla-morada'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:produce'), pg_temp.seed_uuid(v_business_id, 'ingredient:cebolla-morada'), 5, 'kg', 1400, 5),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:produce:cebolla-blanca'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:produce'), pg_temp.seed_uuid(v_business_id, 'ingredient:cebolla-blanca'), 8, 'kg', 1200, 8),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:produce:ajo'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:produce'), pg_temp.seed_uuid(v_business_id, 'ingredient:ajo'), 2, 'kg', 4200, 2),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:produce:eneldo'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:produce'), pg_temp.seed_uuid(v_business_id, 'ingredient:eneldo'), 1, 'kg', 18000, 1),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:produce:espinaca'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:produce'), pg_temp.seed_uuid(v_business_id, 'ingredient:espinaca'), 8, 'kg', 3990, 8),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:produce:zapallo'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:produce'), pg_temp.seed_uuid(v_business_id, 'ingredient:zapallo'), 16, 'kg', 1600, 16),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:produce:jengibre'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:produce'), pg_temp.seed_uuid(v_business_id, 'ingredient:jengibre'), 2, 'kg', 6500, 2),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:produce:rucula'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:produce'), pg_temp.seed_uuid(v_business_id, 'ingredient:rucula'), 4, 'kg', 6800, 4),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:produce:setas'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:produce'), pg_temp.seed_uuid(v_business_id, 'ingredient:setas'), 7, 'kg', 7200, 7),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:produce:zanahoria'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:produce'), pg_temp.seed_uuid(v_business_id, 'ingredient:zanahoria'), 8, 'kg', 1100, 8),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:produce:apio'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:produce'), pg_temp.seed_uuid(v_business_id, 'ingredient:apio'), 4, 'kg', 1500, 4),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:produce:zucchini'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:produce'), pg_temp.seed_uuid(v_business_id, 'ingredient:zucchini'), 8, 'kg', 1600, 8),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:produce:berenjena'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:produce'), pg_temp.seed_uuid(v_business_id, 'ingredient:berenjena'), 6, 'kg', 2200, 6),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:produce:pimiento'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:produce'), pg_temp.seed_uuid(v_business_id, 'ingredient:pimiento-rojo'), 6, 'kg', 2900, 6),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:produce:limon'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:produce'), pg_temp.seed_uuid(v_business_id, 'ingredient:limon'), 7, 'kg', 1800, 7),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:produce:naranja'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:produce'), pg_temp.seed_uuid(v_business_id, 'ingredient:naranja'), 6, 'kg', 1900, 6),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:produce:frutos-rojos'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:produce'), pg_temp.seed_uuid(v_business_id, 'ingredient:frutos-rojos'), 6, 'kg', 8200, 6),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:produce:manzana'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:produce'), pg_temp.seed_uuid(v_business_id, 'ingredient:manzana'), 10, 'kg', 1700, 10),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:produce:papa'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:produce'), pg_temp.seed_uuid(v_business_id, 'ingredient:papa'), 20, 'kg', 1200, 20),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:dairy:queso-cabra'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:dairy'), pg_temp.seed_uuid(v_business_id, 'ingredient:queso-cabra'), 4, 'kg', 18500, 4),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:dairy:parmesano'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:dairy'), pg_temp.seed_uuid(v_business_id, 'ingredient:parmesano'), 6, 'kg', 22000, 6),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:dairy:crema'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:dairy'), pg_temp.seed_uuid(v_business_id, 'ingredient:crema'), 20, 'litro', 4300, 20),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:dairy:mantequilla'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:dairy'), pg_temp.seed_uuid(v_business_id, 'ingredient:mantequilla'), 8, 'kg', 6200, 8),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:dairy:leche'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:dairy'), pg_temp.seed_uuid(v_business_id, 'ingredient:leche-entera'), 25, 'litro', 1350, 25),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:dairy:huevos'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:dairy'), pg_temp.seed_uuid(v_business_id, 'ingredient:huevos'), 120, 'unidad', 230, 120),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:drygoods:quinoa'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:drygoods'), pg_temp.seed_uuid(v_business_id, 'ingredient:quinoa-blanca'), 18, 'kg', 3600, 18),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:drygoods:arborio'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:drygoods'), pg_temp.seed_uuid(v_business_id, 'ingredient:arroz-arborio'), 12, 'kg', 4200, 12),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:drygoods:azucar'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:drygoods'), pg_temp.seed_uuid(v_business_id, 'ingredient:azucar'), 15, 'kg', 1400, 15),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:drygoods:sal'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:drygoods'), pg_temp.seed_uuid(v_business_id, 'ingredient:sal-fina'), 12, 'kg', 650, 12),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:drygoods:pimienta'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:drygoods'), pg_temp.seed_uuid(v_business_id, 'ingredient:pimienta'), 2, 'kg', 18000, 2),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:drygoods:aceite'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:drygoods'), pg_temp.seed_uuid(v_business_id, 'ingredient:aceite-oliva'), 15, 'litro', 7200, 15),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:drygoods:vinagre'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:drygoods'), pg_temp.seed_uuid(v_business_id, 'ingredient:vinagre'), 10, 'litro', 1600, 10),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:drygoods:gelatina'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:drygoods'), pg_temp.seed_uuid(v_business_id, 'ingredient:gelatina'), 1, 'kg', 22000, 1),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:drygoods:vainilla'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:drygoods'), pg_temp.seed_uuid(v_business_id, 'ingredient:vainilla'), 1, 'litro', 14500, 1),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:drygoods:chocolate'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:drygoods'), pg_temp.seed_uuid(v_business_id, 'ingredient:chocolate'), 8, 'kg', 13800, 8),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:drygoods:harina'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:drygoods'), pg_temp.seed_uuid(v_business_id, 'ingredient:harina'), 20, 'kg', 980, 20),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:drygoods:canela'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:drygoods'), pg_temp.seed_uuid(v_business_id, 'ingredient:canela'), 1, 'kg', 11500, 1),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:drygoods:garbanzos'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:drygoods'), pg_temp.seed_uuid(v_business_id, 'ingredient:garbanzos'), 15, 'kg', 2200, 15),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:drygoods:alcaparras'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:drygoods'), pg_temp.seed_uuid(v_business_id, 'ingredient:alcaparras'), 2, 'kg', 11800, 2),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:bakery:pan'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:bakery'), pg_temp.seed_uuid(v_business_id, 'ingredient:masa-madre'), 80, 'unidad', 480, 80),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:wine:vino'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:wine'), pg_temp.seed_uuid(v_business_id, 'ingredient:vino-tinto'), 12, 'litro', 4800, 12)
  ;

  delete from public.inventory_movements
  where business_id = v_business_id
    and notes like 'OC seed %';

  insert into public.inventory_movements (
    id, business_id, ingredient_id, type, quantity, unit, movement_date, lot, expires_at, location, notes
  )
  select
    pg_temp.seed_uuid(v_business_id, 'inventory-movement:' || pi.id::text),
    v_business_id,
    pi.ingredient_id,
    'entry',
    pi.received_quantity,
    pi.unit,
    p.ordered_at,
    'LOT-' || to_char(p.ordered_at, 'YYYYMMDD') || '-' || i.internal_code,
    p.ordered_at + make_interval(days => greatest(i.shelf_life_days, 0)),
    i.storage_location,
    'OC seed ' || p.id::text
  from public.purchase_items pi
  join public.purchases p on p.id = pi.purchase_id
  join public.ingredients i on i.id = pi.ingredient_id
  where pi.business_id = v_business_id
  on conflict (id) do update
  set
    ingredient_id = excluded.ingredient_id,
    quantity = excluded.quantity,
    unit = excluded.unit,
    movement_date = excluded.movement_date,
    lot = excluded.lot,
    expires_at = excluded.expires_at,
    location = excluded.location,
    notes = excluded.notes;

  insert into public.warehouse_audits (
    id, business_id, ingredient_id, checked_at, checked_by, counted_stock, stock_unit, storage_temp, location, notes
  )
  values
    (pg_temp.seed_uuid(v_business_id, 'audit:salmon'), v_business_id, pg_temp.seed_uuid(v_business_id, 'ingredient:salmon-fresco'), current_date, 'Bodega AM', 12, 'kg', 1.2, 'Camara 1 / pescados', 'Stock conforme y temperatura correcta.'),
    (pg_temp.seed_uuid(v_business_id, 'audit:lomo'), v_business_id, pg_temp.seed_uuid(v_business_id, 'ingredient:lomo-vetado'), current_date, 'Bodega AM', 10, 'kg', 1.1, 'Camara 1 / carnes', 'Corte porcionado y rotulado.'),
    (pg_temp.seed_uuid(v_business_id, 'audit:quinoa'), v_business_id, pg_temp.seed_uuid(v_business_id, 'ingredient:quinoa-blanca'), current_date, 'Bodega seca', 15, 'kg', 21, 'Secos / anaquel 1', 'Stock disponible y orden FIFO aplicado.'),
    (pg_temp.seed_uuid(v_business_id, 'audit:crema'), v_business_id, pg_temp.seed_uuid(v_business_id, 'ingredient:crema'), current_date, 'Bodega PM', 12, 'litro', 4.1, 'Camara lacteos', 'Producto dentro de rango y en uso activo.'),
    (pg_temp.seed_uuid(v_business_id, 'audit:espinaca'), v_business_id, pg_temp.seed_uuid(v_business_id, 'ingredient:espinaca'), current_date, 'Bodega AM', 5.2, 'kg', 4.0, 'Camara verduras', 'Rotacion rapida por menu Costa.')
  on conflict (id) do update
  set
    checked_at = excluded.checked_at,
    checked_by = excluded.checked_by,
    counted_stock = excluded.counted_stock,
    stock_unit = excluded.stock_unit,
    storage_temp = excluded.storage_temp,
    location = excluded.location,
    notes = excluded.notes;

  insert into public.production_plans (id, business_id, name, scheduled_for, responsible, status)
  values
    (pg_temp.seed_uuid(v_business_id, 'production:viernes-cena'), v_business_id, 'Mise en place cena viernes', current_date + 1, 'Sous chef PM', 'Pendiente')
  on conflict (id) do update
  set
    name = excluded.name,
    scheduled_for = excluded.scheduled_for,
    responsible = excluded.responsible,
    status = excluded.status;

  delete from public.production_plan_items
  where business_id = v_business_id
    and production_plan_id = pg_temp.seed_uuid(v_business_id, 'production:viernes-cena');

  insert into public.production_plan_items (id, business_id, production_plan_id, ref_type, ref_id, quantity)
  values
    (pg_temp.seed_uuid(v_business_id, 'production-item:quinoa'), v_business_id, pg_temp.seed_uuid(v_business_id, 'production:viernes-cena'), 'baseRecipe', pg_temp.seed_uuid(v_business_id, 'recipe:quinoa-citrica'), 2),
    (pg_temp.seed_uuid(v_business_id, 'production-item:crema-espinacas'), v_business_id, pg_temp.seed_uuid(v_business_id, 'production:viernes-cena'), 'baseRecipe', pg_temp.seed_uuid(v_business_id, 'recipe:crema-espinacas'), 2),
    (pg_temp.seed_uuid(v_business_id, 'production-item:panna-cotta'), v_business_id, pg_temp.seed_uuid(v_business_id, 'production:viernes-cena'), 'baseRecipe', pg_temp.seed_uuid(v_business_id, 'recipe:panna-cotta-vainilla'), 1),
    (pg_temp.seed_uuid(v_business_id, 'production-item:mousse'), v_business_id, pg_temp.seed_uuid(v_business_id, 'production:viernes-cena'), 'baseRecipe', pg_temp.seed_uuid(v_business_id, 'recipe:mousse-chocolate'), 1);

  insert into public.waste_records (
    id, business_id, ingredient_id, quantity, unit, reason_type, responsible, waste_date, cost_impact
  )
  values
    (pg_temp.seed_uuid(v_business_id, 'waste:espinaca'), v_business_id, pg_temp.seed_uuid(v_business_id, 'ingredient:espinaca'), 0.4, 'kg', 'Vencimiento', 'Bodega AM', current_date - 2, 1596),
    (pg_temp.seed_uuid(v_business_id, 'waste:panna'), v_business_id, pg_temp.seed_uuid(v_business_id, 'ingredient:crema'), 0.6, 'litro', 'Produccion', 'Pastelero', current_date - 1, 2580)
  on conflict (id) do update
  set
    ingredient_id = excluded.ingredient_id,
    quantity = excluded.quantity,
    unit = excluded.unit,
    reason_type = excluded.reason_type,
    responsible = excluded.responsible,
    waste_date = excluded.waste_date,
    cost_impact = excluded.cost_impact;

  insert into public.sales (id, business_id, sold_at, channel)
  values
    (pg_temp.seed_uuid(v_business_id, 'sale:viernes'), v_business_id, current_date - 1, 'Salon'),
    (pg_temp.seed_uuid(v_business_id, 'sale:sabado'), v_business_id, current_date, 'Salon'),
    (pg_temp.seed_uuid(v_business_id, 'sale:domingo'), v_business_id, current_date + 1, 'Salon')
  on conflict (id) do update
  set
    sold_at = excluded.sold_at,
    channel = excluded.channel;

  delete from public.sale_items
  where business_id = v_business_id
    and sale_id in (
      pg_temp.seed_uuid(v_business_id, 'sale:viernes'),
      pg_temp.seed_uuid(v_business_id, 'sale:sabado'),
      pg_temp.seed_uuid(v_business_id, 'sale:domingo')
    );

  insert into public.sale_items (id, business_id, sale_id, dish_id, quantity, unit_price, discount)
  values
    (pg_temp.seed_uuid(v_business_id, 'saleitem:viernes:costa-fondo'), v_business_id, pg_temp.seed_uuid(v_business_id, 'sale:viernes'), pg_temp.seed_uuid(v_business_id, 'dish:costa-fondo'), 8, 24900, 0),
    (pg_temp.seed_uuid(v_business_id, 'saleitem:viernes:tierra-fondo'), v_business_id, pg_temp.seed_uuid(v_business_id, 'sale:viernes'), pg_temp.seed_uuid(v_business_id, 'dish:tierra-fondo'), 7, 28900, 0),
    (pg_temp.seed_uuid(v_business_id, 'saleitem:viernes:huerto-fondo'), v_business_id, pg_temp.seed_uuid(v_business_id, 'sale:viernes'), pg_temp.seed_uuid(v_business_id, 'dish:huerto-fondo'), 5, 21900, 0),
    (pg_temp.seed_uuid(v_business_id, 'saleitem:sabado:costa-entrada'), v_business_id, pg_temp.seed_uuid(v_business_id, 'sale:sabado'), pg_temp.seed_uuid(v_business_id, 'dish:costa-entrada'), 9, 14900, 0),
    (pg_temp.seed_uuid(v_business_id, 'saleitem:sabado:tierra-entrada'), v_business_id, pg_temp.seed_uuid(v_business_id, 'sale:sabado'), pg_temp.seed_uuid(v_business_id, 'dish:tierra-entrada'), 6, 16900, 0),
    (pg_temp.seed_uuid(v_business_id, 'saleitem:sabado:costa-postre'), v_business_id, pg_temp.seed_uuid(v_business_id, 'sale:sabado'), pg_temp.seed_uuid(v_business_id, 'dish:costa-postre'), 8, 9900, 0),
    (pg_temp.seed_uuid(v_business_id, 'saleitem:domingo:huerto-entrada'), v_business_id, pg_temp.seed_uuid(v_business_id, 'sale:domingo'), pg_temp.seed_uuid(v_business_id, 'dish:huerto-entrada'), 5, 13900, 0),
    (pg_temp.seed_uuid(v_business_id, 'saleitem:domingo:tierra-postre'), v_business_id, pg_temp.seed_uuid(v_business_id, 'sale:domingo'), pg_temp.seed_uuid(v_business_id, 'dish:tierra-postre'), 7, 10900, 0),
    (pg_temp.seed_uuid(v_business_id, 'saleitem:domingo:huerto-postre'), v_business_id, pg_temp.seed_uuid(v_business_id, 'sale:domingo'), pg_temp.seed_uuid(v_business_id, 'dish:huerto-postre'), 4, 9900, 0)
  ;

  update public.dishes d
  set sales_count = coalesce((
    select sum(si.quantity)::integer
    from public.sale_items si
    where si.business_id = v_business_id
      and si.dish_id = d.id
  ), d.sales_count)
  where d.business_id = v_business_id
    and d.id in (
      pg_temp.seed_uuid(v_business_id, 'dish:costa-amuse'),
      pg_temp.seed_uuid(v_business_id, 'dish:costa-entrada'),
      pg_temp.seed_uuid(v_business_id, 'dish:costa-fondo'),
      pg_temp.seed_uuid(v_business_id, 'dish:costa-postre'),
      pg_temp.seed_uuid(v_business_id, 'dish:tierra-amuse'),
      pg_temp.seed_uuid(v_business_id, 'dish:tierra-entrada'),
      pg_temp.seed_uuid(v_business_id, 'dish:tierra-fondo'),
      pg_temp.seed_uuid(v_business_id, 'dish:tierra-postre'),
      pg_temp.seed_uuid(v_business_id, 'dish:huerto-amuse'),
      pg_temp.seed_uuid(v_business_id, 'dish:huerto-entrada'),
      pg_temp.seed_uuid(v_business_id, 'dish:huerto-fondo'),
      pg_temp.seed_uuid(v_business_id, 'dish:huerto-postre')
    );

  insert into public.app_snapshots (business_id, state)
  select
    v_business_id,
    jsonb_build_object(
      'users', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', u.id::text,
          'businessId', u.business_id::text,
          'name', u.name,
          'email', u.email,
          'role', u.role
        ) order by u.created_at)
        from public.users u
        where u.business_id = v_business_id
      ), '[]'::jsonb),
      'business', (
        select jsonb_build_object(
          'id', b.id::text,
          'name', b.name,
          'businessType', b.business_type,
          'currency', b.currency,
          'taxRate', b.tax_rate,
          'targetFoodCost', b.target_food_cost,
          'targetMargin', b.target_margin,
          'fixedCostsMonthly', b.fixed_costs_monthly,
          'payrollBurdenPercent', b.payroll_burden_percent,
          'personnelSharedExtrasMonthly', b.personnel_shared_extras_monthly,
          'maxLeadershipMinutes', b.max_leadership_minutes,
          'openingHours', b.opening_hours,
          'workerCount', b.worker_count,
          'internalCategories', to_jsonb(b.internal_categories)
        )
        from public.businesses b
        where b.id = v_business_id
      ),
      'categories', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', c.id::text,
          'type', c.type,
          'name', c.name
        ) order by c.type, c.name)
        from public.categories c
        where c.business_id = v_business_id
      ), '[]'::jsonb),
      'sanitaryCategories', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', sc.id::text,
          'name', sc.name,
          'colorName', sc.color_name,
          'colorHex', sc.color_hex,
          'storageType', sc.storage_type,
          'minTemp', sc.min_temp,
          'maxTemp', sc.max_temp,
          'riskLevel', sc.risk_level,
          'sanitaryCondition', sc.sanitary_condition,
          'dangerZoneSensitive', sc.danger_zone_sensitive,
          'crossContaminationGroup', sc.cross_contamination_group
        ) order by sc.name)
        from public.sanitary_categories sc
        where sc.business_id = v_business_id
      ), '[]'::jsonb),
      'suppliers', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', s.id::text,
          'name', s.name,
          'rut', s.rut,
          'contactName', s.contact_name,
          'phone', s.phone,
          'email', s.email,
          'productCategory', s.product_category,
          'paymentTerms', s.payment_terms,
          'leadTimeDays', s.lead_time_days,
          'qualityScore', s.quality_score,
          'deliveryScore', s.delivery_score,
          'notes', s.notes
        ) order by s.name)
        from public.suppliers s
        where s.business_id = v_business_id
      ), '[]'::jsonb),
      'ingredients', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', i.id::text,
          'name', i.name,
          'categoryId', coalesce(i.category_id::text, ''),
          'sanitaryCategoryId', coalesce(i.sanitary_category_id::text, ''),
          'primarySupplierId', coalesce(i.primary_supplier_id::text, ''),
          'purchaseUnit', i.purchase_unit,
          'useUnit', i.use_unit,
          'purchasePrice', i.purchase_price,
          'usefulUnitCost', i.useful_unit_cost,
          'usableYieldPercent', i.usable_yield_percent,
          'currentStock', i.current_stock,
          'minStock', i.min_stock,
          'maxStock', i.max_stock,
          'lastPurchaseDate', coalesce(i.last_purchase_date::text, ''),
          'priceHistory', coalesce((
            select jsonb_agg(jsonb_build_object(
              'date', iph.recorded_at::text,
              'supplierId', coalesce(iph.supplier_id::text, ''),
              'pricePurchase', iph.price_purchase
            ) order by iph.recorded_at)
            from public.ingredient_price_history iph
            where iph.business_id = v_business_id
              and iph.ingredient_id = i.id
          ), '[]'::jsonb),
          'shelfLifeDays', i.shelf_life_days,
          'storageType', i.storage_type,
          'storageConditions', i.storage_conditions,
          'storageTemperature', i.storage_temperature,
          'recommendedMinTemp', i.recommended_min_temp,
          'recommendedMaxTemp', i.recommended_max_temp,
          'currentStorageTemp', i.current_storage_temp,
          'riskLevel', i.risk_level,
          'colorHex', i.color_hex,
          'colorName', i.color_name,
          'internalCode', i.internal_code,
          'supplierCode', i.supplier_code,
          'storageLocation', i.storage_location,
          'receivedDate', coalesce(i.received_date::text, ''),
          'expiryDate', coalesce(i.expiry_date::text, ''),
          'lotCode', i.lot_code,
          'responsible', i.responsible
        ) order by i.name)
        from public.ingredients i
        where i.business_id = v_business_id
      ), '[]'::jsonb),
      'yieldRecords', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', y.id::text,
          'ingredientId', y.ingredient_id::text,
          'recordedAt', y.recorded_at::text,
          'purchaseWeight', y.purchase_weight,
          'cleanedWeight', y.cleaned_weight,
          'cookedWeight', y.cooked_weight,
          'finalUsefulWeight', y.final_useful_weight,
          'wastePercent', y.waste_percent,
          'yieldPercent', y.yield_percent,
          'wasteType', y.waste_type,
          'trimLoss', y.trim_loss,
          'peelLoss', y.peel_loss,
          'boneLoss', y.bone_loss,
          'fatLoss', y.fat_loss,
          'evaporationLoss', y.evaporation_loss,
          'thawLoss', y.thaw_loss,
          'handlingLoss', y.handling_loss,
          'notes', y.notes
        ) order by y.recorded_at)
        from public.yield_records y
        where y.business_id = v_business_id
      ), '[]'::jsonb),
      'laborProfiles', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', l.id::text,
          'roleName', l.role_name,
          'roleGroup', l.role_group,
          'headcount', l.headcount,
          'monthlySalary', l.monthly_salary,
          'monthlyHours', l.monthly_hours,
          'extraMonthlyCost', l.extra_monthly_cost
        ) order by l.role_name)
        from public.labor_profiles l
        where l.business_id = v_business_id
      ), '[]'::jsonb),
      'baseRecipes', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', r.id::text,
          'name', r.name,
          'categoryId', coalesce(r.category_id::text, ''),
          'kind', r.kind,
          'yieldAmount', r.yield_amount,
          'yieldUnit', r.yield_unit,
          'itemCostUnit', r.item_cost_unit,
          'items', coalesce((
            select jsonb_agg(jsonb_build_object(
              'id', ri.id::text,
              'ingredientId', ri.ingredient_id::text,
              'quantity', ri.quantity,
              'unit', ri.unit,
              'wastePercent', ri.waste_percent
            ) order by ri.created_at)
            from public.recipe_items ri
            where ri.business_id = v_business_id
              and ri.recipe_id = r.id
          ), '[]'::jsonb),
          'timeMinutes', r.time_minutes,
          'laborProfileId', coalesce(r.labor_profile_id::text, ''),
          'laborMinutes', r.labor_minutes,
          'instructions', r.instructions,
          'qualityNotes', r.quality_notes,
          'allergens', to_jsonb(r.allergens),
          'observations', r.observations
        ) order by r.name)
        from public.recipes r
        where r.business_id = v_business_id
          and r.kind = 'base'
      ), '[]'::jsonb),
      'dishes', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', d.id::text,
          'name', d.name,
          'categoryId', coalesce(d.category_id::text, ''),
          'service', d.service,
          'directItems', coalesce((
            select jsonb_agg(jsonb_build_object(
              'id', dc.id::text,
              'componentType', dc.component_type,
              'refId', dc.ref_id::text,
              'quantity', dc.quantity,
              'unit', dc.unit,
              'wastePercent', dc.waste_percent
            ) order by dc.created_at)
            from public.dish_components dc
            where dc.business_id = v_business_id
              and dc.dish_id = d.id
          ), '[]'::jsonb),
          'garnishes', '[]'::jsonb,
          'decorations', '[]'::jsonb,
          'laborProfileId', coalesce(d.labor_profile_id::text, ''),
          'laborMinutes', d.labor_minutes,
          'indirectCostShare', d.indirect_cost_share,
          'targetFoodCost', d.target_food_cost,
          'desiredMargin', d.desired_margin,
          'allergens', to_jsonb(d.allergens),
          'platingNotes', d.plating_notes,
          'qualityChecklist', to_jsonb(d.quality_checklist),
          'technicalNotes', d.technical_notes,
          'shelfLifeHours', d.shelf_life_hours,
          'salesCount', d.sales_count,
          'imageUrl', d.image_url
        ) order by d.name)
        from public.dishes d
        where d.business_id = v_business_id
      ), '[]'::jsonb),
      'foodCostTargets', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', f.id::text,
          'scopeType', f.scope_type,
          'scopeId', f.scope_id,
          'targetPercent', f.target_percent
        ) order by f.created_at)
        from public.food_cost_targets f
        where f.business_id = v_business_id
      ), '[]'::jsonb),
      'indirectCosts', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', ic.id::text,
          'name', ic.name,
          'category', ic.category,
          'period', ic.period,
          'amount', ic.amount,
          'allocationMethod', ic.allocation_method,
          'allocationValue', ic.allocation_value
        ) order by ic.name)
        from public.indirect_costs ic
        where ic.business_id = v_business_id
      ), '[]'::jsonb),
      'packagingCosts', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', p.id::text,
          'name', p.name,
          'channel', coalesce(p.channel::text, 'General'),
          'unit', p.unit,
          'unitCost', p.unit_cost
        ) order by p.name)
        from public.packaging_costs p
        where p.business_id = v_business_id
      ), '[]'::jsonb),
      'purchases', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', p.id::text,
          'supplierId', p.supplier_id::text,
          'orderedAt', p.ordered_at::text,
          'status', p.status,
          'items', coalesce((
            select jsonb_agg(jsonb_build_object(
              'id', pi.id::text,
              'ingredientId', pi.ingredient_id::text,
              'quantity', pi.quantity,
              'unit', pi.unit,
              'unitPrice', pi.unit_price,
              'receivedQuantity', pi.received_quantity
            ) order by pi.created_at)
            from public.purchase_items pi
            where pi.business_id = v_business_id
              and pi.purchase_id = p.id
          ), '[]'::jsonb),
          'notes', p.notes
        ) order by p.ordered_at)
        from public.purchases p
        where p.business_id = v_business_id
      ), '[]'::jsonb),
      'inventoryMovements', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', im.id::text,
          'ingredientId', im.ingredient_id::text,
          'type', im.type,
          'quantity', im.quantity,
          'unit', im.unit,
          'date', im.movement_date::text,
          'lot', im.lot,
          'expiresAt', coalesce(im.expires_at::text, ''),
          'location', im.location,
          'notes', im.notes
        ) order by im.movement_date)
        from public.inventory_movements im
        where im.business_id = v_business_id
      ), '[]'::jsonb),
      'warehouseAudits', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', wa.id::text,
          'ingredientId', wa.ingredient_id::text,
          'checkedAt', wa.checked_at::text,
          'checkedBy', wa.checked_by,
          'countedStock', wa.counted_stock,
          'stockUnit', wa.stock_unit,
          'storageTemp', wa.storage_temp,
          'location', wa.location,
          'notes', wa.notes
        ) order by wa.checked_at)
        from public.warehouse_audits wa
        where wa.business_id = v_business_id
      ), '[]'::jsonb),
      'wasteRecords', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', wr.id::text,
          'ingredientId', wr.ingredient_id::text,
          'quantity', wr.quantity,
          'unit', wr.unit,
          'reasonType', wr.reason_type,
          'responsible', wr.responsible,
          'date', wr.waste_date::text,
          'costImpact', wr.cost_impact
        ) order by wr.waste_date)
        from public.waste_records wr
        where wr.business_id = v_business_id
      ), '[]'::jsonb),
      'productionPlans', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', pp.id::text,
          'name', pp.name,
          'scheduledFor', pp.scheduled_for::text,
          'responsible', pp.responsible,
          'status', pp.status,
          'items', coalesce((
            select jsonb_agg(jsonb_build_object(
              'id', ppi.id::text,
              'refType', ppi.ref_type,
              'refId', ppi.ref_id::text,
              'quantity', ppi.quantity
            ) order by ppi.created_at)
            from public.production_plan_items ppi
            where ppi.business_id = v_business_id
              and ppi.production_plan_id = pp.id
          ), '[]'::jsonb)
        ) order by pp.scheduled_for)
        from public.production_plans pp
        where pp.business_id = v_business_id
      ), '[]'::jsonb),
      'sales', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', s.id::text,
          'soldAt', s.sold_at::text,
          'channel', s.channel,
          'items', coalesce((
            select jsonb_agg(jsonb_build_object(
              'id', si.id::text,
              'dishId', si.dish_id::text,
              'quantity', si.quantity,
              'unitPrice', si.unit_price,
              'discount', si.discount
            ) order by si.created_at)
            from public.sale_items si
            where si.business_id = v_business_id
              and si.sale_id = s.id
          ), '[]'::jsonb)
        ) order by s.sold_at)
        from public.sales s
        where s.business_id = v_business_id
      ), '[]'::jsonb),
      'menus', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', m.id::text,
          'name', m.name,
          'categoryIds', coalesce((
            select jsonb_agg(mc.category_id::text order by mc.created_at)
            from public.menu_categories mc
            where mc.business_id = v_business_id
              and mc.menu_id = m.id
          ), '[]'::jsonb),
          'dishIds', coalesce((
            select jsonb_agg(mi.dish_id::text order by mi.created_at)
            from public.menu_items mi
            where mi.business_id = v_business_id
              and mi.menu_id = m.id
          ), '[]'::jsonb)
        ) order by m.name)
        from public.menus m
        where m.business_id = v_business_id
      ), '[]'::jsonb),
      'projections', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', p.id::text,
          'name', p.name,
          'period', p.period,
          'days', coalesce((
            select jsonb_agg(jsonb_build_object(
              'day', pd.day_name,
              'projectedCustomers', pd.projected_customers,
              'avgFoodTicket', pd.avg_food_ticket,
              'avgBeverageTicket', pd.avg_beverage_ticket
            ) order by pd.created_at)
            from public.projection_days pd
            where pd.business_id = v_business_id
              and pd.projection_id = p.id
          ), '[]'::jsonb)
        ) order by p.name)
        from public.projections p
        where p.business_id = v_business_id
      ), '[]'::jsonb),
      'staffShifts', coalesce((
        with shift_people as (
          select *
          from (values
            ('chef-ejecutivo', pg_temp.seed_uuid(v_business_id, 'labor:chef-ejecutivo')::text, 'Paula Toledo', '10:00', '18:00', 30, 0, 'Supervision general y control de pase.', array[1,2,3,4,5]::int[]),
            ('sous-chef', pg_temp.seed_uuid(v_business_id, 'labor:sous-chef')::text, 'Camila Rojas', '15:00', '23:00', 30, 0, 'Cobertura de servicio PM y cierre.', array[2,3,4,5,6]::int[]),
            ('partida-caliente-1', pg_temp.seed_uuid(v_business_id, 'labor:partida-caliente')::text, 'Diego Araya', '10:00', '18:00', 30, 0, 'Mise en place AM, produccion caliente y respaldo de liderazgo.', array[1,2,3,4]::int[]),
            ('partida-caliente-2', pg_temp.seed_uuid(v_business_id, 'labor:partida-caliente')::text, 'Valentina Muñoz', '15:00', '23:00', 30, 0, 'Linea PM y apoyo de cierre en calientes.', array[3,4,5,6]::int[]),
            ('partida-fria-1', pg_temp.seed_uuid(v_business_id, 'labor:partida-fria')::text, 'Javiera Soto', '15:00', '23:00', 30, 0, 'Linea fria y apoyo de cierre.', array[2,3,4,5,6]::int[]),
            ('partida-fria-2', pg_temp.seed_uuid(v_business_id, 'labor:partida-fria')::text, 'Benjamin Morales', '10:00', '18:00', 30, 0, 'Mise en place de entradas y apoyo de banqueteria.', array[1,2,4,5,6]::int[]),
            ('pastelero', pg_temp.seed_uuid(v_business_id, 'labor:pastelero')::text, 'Fernanda Castro', '10:00', '18:00', 30, 0, 'Produccion de postres y mise en place dulce.', array[1,2,3,4,5]::int[])
          ) as people(shift_slug, labor_profile_id, employee_name, start_time, end_time, break_minutes, extra_minutes, notes, work_days)
        ),
        month_dates as (
          select
            to_char(d::date, 'YYYY-MM-DD') as shift_date,
            extract(isodow from d)::int as iso_dow
          from generate_series(
            date_trunc('month', current_date)::date,
            (date_trunc('month', current_date) + interval '1 month - 1 day')::date,
            interval '1 day'
          ) d
        ),
        recurring_staff_shifts as (
          select
            pg_temp.seed_uuid(v_business_id, 'shift:' || people.shift_slug || ':' || month_dates.shift_date)::text as id,
            people.labor_profile_id,
            people.employee_name,
            month_dates.shift_date as date,
            case
              when month_dates.iso_dow = 7 then '10:00'
              else people.start_time
            end as start_time,
            case
              when month_dates.iso_dow = 7 then '17:00'
              else people.end_time
            end as end_time,
            people.break_minutes,
            people.extra_minutes,
            case
              when month_dates.iso_dow = 7 then people.notes || ' Domingo solo almuerzo.'
              else people.notes
            end as notes
          from shift_people people
          join month_dates on month_dates.iso_dow = any(people.work_days)
        ),
        sunday_station_assignments as (
          select *
          from (values
            ('2026-04-05'::date, 'Diego Araya', 'Fernanda Castro'),
            ('2026-04-12'::date, 'Valentina Muñoz', 'Javiera Soto'),
            ('2026-04-19'::date, 'Diego Araya', 'Benjamin Morales'),
            ('2026-04-26'::date, 'Valentina Muñoz', 'Fernanda Castro')
          ) as assignments(shift_date, hot_employee, cold_employee)
        ),
        sunday_station_shifts as (
          select
            pg_temp.seed_uuid(v_business_id, 'shift:sunday-hot:' || assignments.shift_date::text || ':' || replace(lower(assignments.hot_employee), ' ', '-'))::text as id,
            case assignments.hot_employee
              when 'Diego Araya' then pg_temp.seed_uuid(v_business_id, 'labor:partida-caliente')::text
              else pg_temp.seed_uuid(v_business_id, 'labor:partida-caliente')::text
            end as labor_profile_id,
            assignments.hot_employee as employee_name,
            assignments.shift_date::text as date,
            '10:00' as start_time,
            '17:00' as end_time,
            30 as break_minutes,
            0 as extra_minutes,
            'Cobertura dominical de partida caliente y liderazgo operativo. Domingo solo almuerzo.' as notes
          from sunday_station_assignments assignments

          union all

          select
            pg_temp.seed_uuid(v_business_id, 'shift:sunday-cold:' || assignments.shift_date::text || ':' || replace(lower(assignments.cold_employee), ' ', '-'))::text as id,
            case assignments.cold_employee
              when 'Fernanda Castro' then pg_temp.seed_uuid(v_business_id, 'labor:pastelero')::text
              else pg_temp.seed_uuid(v_business_id, 'labor:partida-fria')::text
            end as labor_profile_id,
            assignments.cold_employee as employee_name,
            assignments.shift_date::text as date,
            '10:00' as start_time,
            '17:00' as end_time,
            30 as break_minutes,
            0 as extra_minutes,
            'Cobertura dominical de area fria/pasteleria. Domingo solo almuerzo.' as notes
          from sunday_station_assignments assignments
        ),
        helper_day_assignments as (
          select *
          from (values
            ('2026-04-01'::date, 'Martin Perez', 'Constanza Silva', null, 'Rodrigo Fuentes', 'Daniela Pizarro'),
            ('2026-04-02'::date, 'Nicolas Herrera', 'Rodrigo Fuentes', null, 'Martin Perez', 'Constanza Silva'),
            ('2026-04-03'::date, 'Daniela Pizarro', 'Nicolas Herrera', 'Martin Perez', 'Rodrigo Fuentes', 'Constanza Silva'),
            ('2026-04-04'::date, 'Daniela Pizarro', 'Nicolas Herrera', 'Constanza Silva', 'Martin Perez', 'Rodrigo Fuentes'),
            ('2026-04-05'::date, 'Daniela Pizarro', 'Nicolas Herrera', null, null, null),
            ('2026-04-06'::date, 'Martin Perez', 'Rodrigo Fuentes', null, 'Constanza Silva', 'Daniela Pizarro'),
            ('2026-04-07'::date, 'Nicolas Herrera', 'Constanza Silva', null, 'Martin Perez', 'Rodrigo Fuentes'),
            ('2026-04-08'::date, 'Daniela Pizarro', 'Nicolas Herrera', null, 'Constanza Silva', 'Martin Perez'),
            ('2026-04-09'::date, 'Rodrigo Fuentes', 'Daniela Pizarro', null, 'Nicolas Herrera', 'Martin Perez'),
            ('2026-04-10'::date, 'Constanza Silva', 'Nicolas Herrera', 'Rodrigo Fuentes', 'Daniela Pizarro', 'Martin Perez'),
            ('2026-04-11'::date, 'Daniela Pizarro', 'Constanza Silva', 'Rodrigo Fuentes', 'Nicolas Herrera', 'Martin Perez'),
            ('2026-04-12'::date, 'Constanza Silva', 'Rodrigo Fuentes', null, null, null),
            ('2026-04-13'::date, 'Nicolas Herrera', 'Martin Perez', null, 'Daniela Pizarro', 'Constanza Silva'),
            ('2026-04-14'::date, 'Rodrigo Fuentes', 'Daniela Pizarro', null, 'Nicolas Herrera', 'Martin Perez'),
            ('2026-04-15'::date, 'Constanza Silva', 'Rodrigo Fuentes', null, 'Daniela Pizarro', 'Nicolas Herrera'),
            ('2026-04-16'::date, 'Martin Perez', 'Constanza Silva', null, 'Rodrigo Fuentes', 'Daniela Pizarro'),
            ('2026-04-17'::date, 'Nicolas Herrera', 'Rodrigo Fuentes', 'Martin Perez', 'Constanza Silva', 'Daniela Pizarro'),
            ('2026-04-18'::date, 'Constanza Silva', 'Nicolas Herrera', 'Martin Perez', 'Rodrigo Fuentes', 'Daniela Pizarro'),
            ('2026-04-19'::date, 'Martin Perez', 'Rodrigo Fuentes', null, null, null),
            ('2026-04-20'::date, 'Daniela Pizarro', 'Nicolas Herrera', null, 'Constanza Silva', 'Martin Perez'),
            ('2026-04-21'::date, 'Rodrigo Fuentes', 'Constanza Silva', null, 'Nicolas Herrera', 'Daniela Pizarro'),
            ('2026-04-22'::date, 'Martin Perez', 'Rodrigo Fuentes', null, 'Constanza Silva', 'Nicolas Herrera'),
            ('2026-04-23'::date, 'Daniela Pizarro', 'Martin Perez', null, 'Rodrigo Fuentes', 'Nicolas Herrera'),
            ('2026-04-24'::date, 'Constanza Silva', 'Rodrigo Fuentes', 'Daniela Pizarro', 'Martin Perez', 'Nicolas Herrera'),
            ('2026-04-25'::date, 'Martin Perez', 'Constanza Silva', 'Daniela Pizarro', 'Rodrigo Fuentes', 'Nicolas Herrera'),
            ('2026-04-26'::date, 'Constanza Silva', 'Daniela Pizarro', null, null, null),
            ('2026-04-27'::date, 'Nicolas Herrera', 'Rodrigo Fuentes', null, 'Martin Perez', 'Constanza Silva'),
            ('2026-04-28'::date, 'Daniela Pizarro', 'Martin Perez', null, 'Nicolas Herrera', 'Rodrigo Fuentes'),
            ('2026-04-29'::date, 'Constanza Silva', 'Daniela Pizarro', null, 'Martin Perez', 'Nicolas Herrera'),
            ('2026-04-30'::date, 'Rodrigo Fuentes', 'Constanza Silva', null, 'Daniela Pizarro', 'Nicolas Herrera')
          ) as assignments(shift_date, am_1, am_2, am_3, pm_1, pm_2)
        ),
        helper_staff_shifts as (
          select
            pg_temp.seed_uuid(
              v_business_id,
              'shift:ayudante:' || replace(lower(slot.employee_name), ' ', '-') || ':' || assignments.shift_date::text
            )::text as id,
            pg_temp.seed_uuid(v_business_id, 'labor:ayudante-cocina')::text as labor_profile_id,
            slot.employee_name,
            assignments.shift_date::text as date,
            case slot.slot_name
              when 'am_3' then '10:00'
              when 'pm_1' then '15:00'
              when 'pm_2' then '15:00'
              else '10:00'
            end as start_time,
            case slot.slot_name
              when 'pm_1' then '23:00'
              when 'pm_2' then '23:00'
              else '17:00'
            end as end_time,
            30 as break_minutes,
            0 as extra_minutes,
            case
              when slot.slot_name like 'am_%' then 'Cobertura ayudante manana. Domingo cierra 17:00 y jornada AM inicia a las 10:00.'
              else 'Cobertura ayudante tarde. Turno PM finaliza al cierre de cocina a las 23:00.'
            end as notes
          from helper_day_assignments assignments
          cross join lateral (
            values
              ('am_1', assignments.am_1),
              ('am_2', assignments.am_2),
              ('am_3', assignments.am_3),
              ('pm_1', assignments.pm_1),
              ('pm_2', assignments.pm_2)
          ) as slot(slot_name, employee_name)
          where slot.employee_name is not null
        ),
        all_staff_shifts as (
          select * from recurring_staff_shifts
          union all
          select * from sunday_station_shifts
          union all
          select * from helper_staff_shifts
        )
        select jsonb_agg(jsonb_build_object(
          'id', shift.id,
          'laborProfileId', shift.labor_profile_id,
          'employeeName', shift.employee_name,
          'date', shift.date,
          'startTime', shift.start_time,
          'endTime', shift.end_time,
          'breakMinutes', shift.break_minutes,
          'extraMinutes', shift.extra_minutes,
          'notes', shift.notes
        ) order by shift.date, shift.employee_name, shift.start_time)
        from all_staff_shifts shift
      ), '[]'::jsonb),
      'eventQuotes', '[]'::jsonb
    )
  on conflict (business_id) do update
  set
    state = excluded.state,
    updated_at = now();
end $$;
