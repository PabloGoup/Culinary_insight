-- Importacion desde:
-- 1) /Users/ptoledos/Downloads/exel gestion (2).xlsx
-- 2) /Users/ptoledos/Downloads/platillos .xlsx
--
-- Alcance:
-- - Proveedores
-- - Categorias faltantes
-- - Materias primas con precio, proveedor y rendimiento
-- - Recetas base estimadas para costeo
-- - Platos finales con gramajes operativos estimados por porcion
--
-- Criterio:
-- - Se crean RUT sinteticos para proveedores cuando la planilla no los trae.
-- - La planilla de platos no trae gramajes. Este script completa el costeo con gramajes estimados
--   por estandar operativo de restaurante para poder calcular costos reales por plato.
-- - Los supuestos de gramaje mas inferidos quedan explicitados en technical_notes.

create or replace function pg_temp.seed_uuid(base uuid, slug text)
returns uuid
language sql
immutable
as $$
  select uuid_generate_v5(uuid_ns_url(), base::text || ':' || slug);
$$;

create or replace function pg_temp.import_slug(value text)
returns text
language sql
immutable
as $$
  select regexp_replace(lower(value), '[^a-z0-9]+', '-', 'g');
$$;

do $$
declare
  v_owner_email text := 'pablo@goupevents.cl';
  v_business_id uuid;

  cat_ing_pescados uuid;
  cat_ing_mariscos uuid;
  cat_ing_verduras uuid;
  cat_ing_citricos uuid;
  cat_ing_lacteos uuid;
  cat_ing_bodega uuid;
  cat_ing_frutas uuid;
  cat_ing_reposteria uuid;

  cat_dish_crudos uuid;
  cat_dish_frios uuid;
  cat_dish_calientes uuid;
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

  cat_ing_pescados := pg_temp.seed_uuid(v_business_id, 'category:ingredient:pescados');
  cat_ing_mariscos := pg_temp.seed_uuid(v_business_id, 'category:ingredient:mariscos');
  cat_ing_verduras := pg_temp.seed_uuid(v_business_id, 'category:ingredient:verduras');
  cat_ing_citricos := pg_temp.seed_uuid(v_business_id, 'category:ingredient:citricos');
  cat_ing_lacteos := pg_temp.seed_uuid(v_business_id, 'category:ingredient:lacteos');
  cat_ing_bodega := pg_temp.seed_uuid(v_business_id, 'category:ingredient:bodega');
  cat_ing_frutas := pg_temp.seed_uuid(v_business_id, 'category:ingredient:frutas-pulpas');
  cat_ing_reposteria := pg_temp.seed_uuid(v_business_id, 'category:ingredient:reposteria-masas');

  cat_dish_crudos := pg_temp.seed_uuid(v_business_id, 'category:dish:crudos');
  cat_dish_frios := pg_temp.seed_uuid(v_business_id, 'category:dish:frios');
  cat_dish_calientes := pg_temp.seed_uuid(v_business_id, 'category:dish:calientes');
  cat_dish_fondos := pg_temp.seed_uuid(v_business_id, 'category:dish:fondos-marinos');
  cat_dish_postres := pg_temp.seed_uuid(v_business_id, 'category:dish:postres');

  insert into public.categories (id, business_id, type, name)
  values
    (cat_ing_frutas, v_business_id, 'ingredient', 'Frutas y pulpas'),
    (cat_ing_reposteria, v_business_id, 'ingredient', 'Reposteria y masas')
  on conflict (id) do update
  set
    type = excluded.type,
    name = excluded.name;

  create temporary table pg_temp.import_ingredients (
    provider_name text,
    ingredient_name text,
    purchase_qty numeric,
    package_unit text,
    total_price numeric,
    yield_ratio numeric
  ) on commit drop;

  insert into pg_temp.import_ingredients (
    provider_name, ingredient_name, purchase_qty, package_unit, total_price, yield_ratio
  )
  values
    ('Ahorro cordillera', 'Camarón 36/40', 1, 'kg', 6290, 0.6),
    ('Ricon de la oliva', 'Aceite de oliva', 5, 'litro', 26000, 1.0),
    ('Myfood', 'Ajo', 1, 'kg', 5800, 0.95),
    ('Huerto Hurbano', 'Aji cacho de cabra', 1, 'kg', 28640, 0.9),
    ('Huerto Hurbano', 'Limon', 1, 'kg', 890, 0.5),
    ('Huerto Hurbano', 'Cilantro', 1, 'kg', 8000, 0.7),
    ('Pedregal', 'Ostiones', 1, 'kg', 15990, 1.0),
    ('De gallardo', 'Queso Parmesano', 1, 'kg', 10690, 1.0),
    ('El guapo', 'Mantequilla', 1, 'kg', 9390, 1.0),
    ('El guapo', 'Vino blanco', 1, 'litro', 2000, 1.0),
    ('Huertita', 'Limon de pica', 1, 'kg', 2990, 0.6),
    ('Hausnuse', 'Pimienta', 1, 'kg', 15290, 1.0),
    ('Hausnuse', 'Sal', 1, 'kg', 530, 1.0),
    ('Nutrisco market', 'Cebolla', 1, 'kg', 1490, 0.9),
    ('Nutrisco market', 'Papa', 1, 'kg', 712, 0.85),
    ('Fruteria premium', 'Zanahoria', 1, 'kg', 990, 0.88),
    ('BioFresco', 'Pimenton', 1, 'kg', 2200, 0.8),
    ('Huerto Hurbano', 'Apio', 1, 'kg', 1390, 0.8),
    ('La Oferta', 'Aceite vegetal', 5, 'litro', 9625, 1.0),
    ('EATTUCH', 'Aji de color', 1, 'kg', 5120, 1.0),
    ('Service Ceshop', 'Oregano', 1, 'kg', 8290, 1.0),
    ('El rincon huerto', 'Congrio', 1, 'kg', 9990, 0.7),
    ('Myfood', 'Puerro', 1, 'kg', 4450, 0.85),
    ('Finnca', 'Menta', 1, 'kg', 16000, 1.0),
    ('Casa Deli', 'Mix berries', 1, 'kg', 6490, 1.0),
    ('Casa Deli', 'Pulpa de maracuya', 1, 'kg', 7990, 1.0),
    ('El guapo', 'Crema de leche', 1, 'litro', 3990, 1.0),
    ('Bodega market', 'Harina', 25, 'kg', 16990, 1.0),
    ('La Oferta', 'Azucar', 25, 'kg', 17654, 1.0),
    ('El Paiquito', 'Esencia de vainilla', 1, 'litro', 1690, 1.0),
    ('Puntadiamante', 'Colapez', 1, 'kg', 67000, 1.0),
    ('Amparo Reposteria', 'Azucar flor', 1, 'kg', 2490, 1.0),
    ('Mayorista Antupiren', 'Huevos', 180, 'unidad', 38900, 1.0),
    ('Centro abasto', 'Leche condensada', 6, 'kg', 23865, 1.0),
    ('Central Mayorista', 'Manjar', 6, 'kg', 24190, 1.0),
    ('San Crescente SpA', 'Helado de vainilla', 5, 'litro', 24000, 1.0),
    ('Mar Adentro', 'Reineta', 1, 'kg', 9990, 0.9),
    ('La pesquera', 'Salmon', 1, 'kg', 16140, 0.9),
    ('Ocean Blue', 'Camaron 51/60', 1, 'kg', 7500, 0.9),
    ('El estuario del malton', 'Pulpo', 1, 'kg', 12000, 0.9),
    ('Maifud', 'Cebolla morada', 1, 'kg', 1490, 0.85),
    ('Huertita', 'Aji amarillo', 1, 'kg', 8000, 0.9),
    ('Eco tienda Pewen', 'Jengibre', 1, 'kg', 8500, 0.88),
    ('Maifud', 'Camote', 1, 'kg', 2290, 0.9),
    ('Rincon de campo', 'Maiz cancha', 1, 'kg', 7800, 1.0),
    ('Sabor peruano', 'Choclo peruano', 1, 'kg', 5980, 0.9),
    ('Insumitus', 'Ajinomoto', 1, 'kg', 3500, 1.0),
    ('Josegonzalez', 'Leche evaporada', 1, 'litro', 3408, 1.0),
    ('Enuss', 'Tomillo', 1, 'kg', 14000, 1.0),
    ('Tomates verde', 'Lechuga lollo green', 1, 'kg', 3000, 0.73),
    ('Green green', 'Lechuga lollo rose', 1, 'kg', 5000, 0.73),
    ('Paltas Ranquilco', 'Palta', 10, 'kg', 24990, 0.7),
    ('Frest', 'Tomate cherry', 1, 'kg', 3960, 0.95),
    ('Leefoodservice', 'Vinagre de manzana', 5, 'litro', 4860, 1.0),
    ('Importacion propia', 'Leche entera', 1, 'litro', 1500, 1.0),
    ('Importacion propia', 'Cabezas de congrio', 1, 'kg', 2500, 0.5),
    ('Importacion propia', 'Cascara de camaron', 1, 'kg', 1200, 0.4),
    ('Importacion propia', 'Vinagre blanco', 1, 'litro', 1800, 1.0);

  with supplier_names as (
    select distinct
      provider_name,
      regexp_replace(lower(provider_name), '[^a-z0-9]+', '-', 'g') as supplier_slug
    from pg_temp.import_ingredients
  ),
  supplier_seed as (
    select
      provider_name,
      supplier_slug,
      row_number() over (order by supplier_slug, provider_name) as seq
    from supplier_names
  )
  insert into public.suppliers (
    id, business_id, name, rut, contact_name, phone, email, product_category,
    payment_terms, lead_time_days, quality_score, delivery_score, notes
  )
  select
    pg_temp.seed_uuid(v_business_id, 'supplier:' || supplier_slug),
    v_business_id,
    provider_name,
    lpad((76000000 + seq)::text, 8, '0') || '-' || chr((75 + (seq % 10))::integer),
    'Contacto comercial',
    '+56 9 6000 ' || lpad(seq::text, 4, '0'),
    supplier_slug || '@proveedor.local',
    'Importado desde Excel',
    '30 dias',
    2,
    4.5,
    4.5,
    'Proveedor creado desde planilla de gestion. RUT sintetico por ausencia de dato de origen.'
  from supplier_seed
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

  insert into public.ingredients (
    id, business_id, category_id, sanitary_category_id, primary_supplier_id, name,
    purchase_unit, use_unit, purchase_price, useful_unit_cost, usable_yield_percent,
    current_stock, min_stock, max_stock, last_purchase_date, shelf_life_days,
    storage_type, storage_conditions, storage_temperature, recommended_min_temp, recommended_max_temp,
    current_storage_temp, risk_level, color_hex, color_name, internal_code, supplier_code,
    storage_location, received_date, expiry_date, lot_code, responsible
  )
  select
    pg_temp.seed_uuid(v_business_id, 'ingredient:' || regexp_replace(lower(i.ingredient_name), '[^a-z0-9]+', '-', 'g')),
    v_business_id,
    case
      when lower(i.ingredient_name) in ('reineta', 'salmon', 'congrio', 'cabezas de congrio') then cat_ing_pescados
      when lower(i.ingredient_name) in ('camarón 36/40', 'camaron 51/60', 'ostiones', 'pulpo', 'cascara de camaron') then cat_ing_mariscos
      when lower(i.ingredient_name) in ('limon', 'limon de pica') then cat_ing_citricos
      when lower(i.ingredient_name) in ('queso parmesano', 'mantequilla', 'crema de leche', 'leche evaporada', 'leche entera', 'helado de vainilla', 'huevos') then cat_ing_lacteos
      when lower(i.ingredient_name) in ('mix berries', 'pulpa de maracuya') then cat_ing_frutas
      when lower(i.ingredient_name) in ('harina', 'azucar', 'esencia de vainilla', 'colapez', 'azucar flor', 'leche condensada', 'manjar') then cat_ing_reposteria
      when lower(i.ingredient_name) in ('aceite de oliva', 'vino blanco', 'pimienta', 'sal', 'aceite vegetal', 'aji de color', 'oregano', 'maiz cancha', 'ajinomoto', 'tomillo', 'vinagre de manzana', 'vinagre blanco') then cat_ing_bodega
      else cat_ing_verduras
    end,
    case
      when lower(i.ingredient_name) in ('reineta', 'salmon', 'congrio', 'cabezas de congrio', 'camarón 36/40', 'camaron 51/60', 'ostiones', 'pulpo', 'cascara de camaron')
        then pg_temp.seed_uuid(v_business_id, 'sanitary:fish')
      when lower(i.ingredient_name) in ('queso parmesano', 'mantequilla', 'crema de leche', 'helado de vainilla', 'leche evaporada', 'leche entera', 'leche condensada')
        then pg_temp.seed_uuid(v_business_id, 'sanitary:dairy')
      when lower(i.ingredient_name) = 'huevos'
        then pg_temp.seed_uuid(v_business_id, 'sanitary:eggs')
      when lower(i.ingredient_name) in ('limon', 'limon de pica', 'mix berries', 'pulpa de maracuya', 'palta')
        then pg_temp.seed_uuid(v_business_id, 'sanitary:fruits')
      when lower(i.ingredient_name) in ('harina')
        then pg_temp.seed_uuid(v_business_id, 'sanitary:bakery')
      else pg_temp.seed_uuid(v_business_id, 'sanitary:drygoods')
    end,
    pg_temp.seed_uuid(v_business_id, 'supplier:' || regexp_replace(lower(i.provider_name), '[^a-z0-9]+', '-', 'g')),
    i.ingredient_name,
    case when lower(i.package_unit) in ('kg', 'kilo', 'kilos') then 'kg'
         when lower(i.package_unit) in ('litro', 'litros') then 'litro'
         else 'unidad' end::unit_type,
    case when lower(i.package_unit) in ('kg', 'kilo', 'kilos') then 'g'
         when lower(i.package_unit) in ('litro', 'litros') then 'ml'
         else 'unidad' end::unit_type,
    round((i.total_price / nullif(i.purchase_qty, 0))::numeric, 4),
    round((
      case
        when lower(i.package_unit) in ('kg', 'kilo', 'kilos') then (i.total_price / nullif(i.purchase_qty, 0)) / (1000 * nullif(i.yield_ratio, 0))
        when lower(i.package_unit) in ('litro', 'litros') then (i.total_price / nullif(i.purchase_qty, 0)) / (1000 * nullif(i.yield_ratio, 0))
        else (i.total_price / nullif(i.purchase_qty, 0)) / nullif(i.yield_ratio, 0)
      end
    )::numeric, 4),
    round((i.yield_ratio * 100)::numeric, 2),
    i.purchase_qty,
    greatest(round((i.purchase_qty * 0.25)::numeric, 2), 1),
    round((i.purchase_qty * 1.5)::numeric, 2),
    current_date,
    case
      when lower(i.ingredient_name) in ('reineta', 'salmon', 'congrio', 'camarón 36/40', 'camaron 51/60', 'ostiones', 'pulpo') then 4
      when lower(i.ingredient_name) in ('cilantro', 'menta', 'lechuga lollo green', 'lechuga lollo rose') then 5
      when lower(i.ingredient_name) in ('crema de leche', 'helado de vainilla', 'leche entera') then 10
      else 120
    end,
    case
      when lower(i.ingredient_name) in ('reineta', 'salmon', 'congrio', 'camarón 36/40', 'camaron 51/60', 'ostiones', 'pulpo') then 'Refrigerado'
      when lower(i.ingredient_name) in ('crema de leche', 'helado de vainilla', 'leche evaporada', 'leche entera', 'leche condensada', 'mantequilla', 'queso parmesano', 'huevos') then 'Refrigerado'
      else 'Seco'
    end,
    case
      when lower(i.ingredient_name) in ('reineta', 'salmon', 'congrio', 'camarón 36/40', 'camaron 51/60', 'ostiones', 'pulpo') then 'Mantener en frio, rotulado y separado por especie.'
      when lower(i.ingredient_name) in ('crema de leche', 'helado de vainilla', 'leche evaporada', 'leche entera', 'leche condensada', 'mantequilla', 'queso parmesano', 'huevos') then 'Mantener refrigerado y en FIFO.'
      else 'Conservar cerrado, seco y rotulado.'
    end,
    case
      when lower(i.ingredient_name) in ('reineta', 'salmon', 'congrio', 'camarón 36/40', 'camaron 51/60', 'ostiones', 'pulpo') then '0 C a 4 C'
      when lower(i.ingredient_name) in ('crema de leche', 'helado de vainilla', 'leche evaporada', 'leche entera', 'leche condensada', 'mantequilla', 'queso parmesano', 'huevos') then '2 C a 5 C'
      else '15 C a 25 C'
    end,
    case
      when lower(i.ingredient_name) in ('reineta', 'salmon', 'congrio', 'camarón 36/40', 'camaron 51/60', 'ostiones', 'pulpo') then 0
      when lower(i.ingredient_name) in ('crema de leche', 'helado de vainilla', 'leche evaporada', 'leche entera', 'leche condensada', 'mantequilla', 'queso parmesano', 'huevos') then 2
      else 15
    end,
    case
      when lower(i.ingredient_name) in ('reineta', 'salmon', 'congrio', 'camarón 36/40', 'camaron 51/60', 'ostiones', 'pulpo') then 4
      when lower(i.ingredient_name) in ('crema de leche', 'helado de vainilla', 'leche evaporada', 'leche entera', 'leche condensada', 'mantequilla', 'queso parmesano', 'huevos') then 5
      else 25
    end,
    case
      when lower(i.ingredient_name) in ('reineta', 'salmon', 'congrio', 'camarón 36/40', 'camaron 51/60', 'ostiones', 'pulpo') then 2
      when lower(i.ingredient_name) in ('crema de leche', 'helado de vainilla', 'leche evaporada', 'leche entera', 'leche condensada', 'mantequilla', 'queso parmesano', 'huevos') then 4
      else 21
    end,
    case
      when lower(i.ingredient_name) in ('reineta', 'salmon', 'congrio', 'camarón 36/40', 'camaron 51/60', 'ostiones', 'pulpo') then 'Alto'
      when lower(i.ingredient_name) in ('crema de leche', 'helado de vainilla', 'leche evaporada', 'leche entera', 'leche condensada', 'mantequilla', 'queso parmesano', 'huevos') then 'Medio/Alto'
      else 'Bajo/Medio'
    end::risk_level,
    case
      when lower(i.ingredient_name) in ('reineta', 'salmon', 'congrio', 'camarón 36/40', 'camaron 51/60', 'ostiones', 'pulpo') then '#1976D2'
      when lower(i.ingredient_name) in ('crema de leche', 'helado de vainilla', 'leche evaporada', 'leche entera', 'leche condensada', 'mantequilla', 'queso parmesano', 'huevos') then '#F5F5F5'
      when lower(i.ingredient_name) in ('limon', 'limon de pica', 'palta') then '#8BC34A'
      else '#424242'
    end,
    case
      when lower(i.ingredient_name) in ('reineta', 'salmon', 'congrio', 'camarón 36/40', 'camaron 51/60', 'ostiones', 'pulpo') then 'Azul'
      when lower(i.ingredient_name) in ('crema de leche', 'helado de vainilla', 'leche evaporada', 'leche entera', 'leche condensada', 'mantequilla', 'queso parmesano', 'huevos') then 'Blanco'
      when lower(i.ingredient_name) in ('limon', 'limon de pica', 'palta') then 'Verde claro'
      else 'Gris oscuro'
    end,
    'XLS-' || upper(substr(regexp_replace(i.ingredient_name, '[^A-Za-z0-9]+', '', 'g'), 1, 8)) || '-' || upper(substr(md5(lower(i.ingredient_name)), 1, 4)),
    'XLS-' || upper(substr(regexp_replace(i.provider_name, '[^A-Za-z0-9]+', '', 'g'), 1, 6)),
    case
      when lower(i.ingredient_name) in ('reineta', 'salmon', 'congrio', 'camarón 36/40', 'camaron 51/60', 'ostiones', 'pulpo') then 'Camara pescados y mariscos'
      when lower(i.ingredient_name) in ('crema de leche', 'helado de vainilla', 'leche evaporada', 'leche entera', 'leche condensada', 'mantequilla', 'queso parmesano', 'huevos') then 'Camara lacteos'
      else 'Bodega seca / produccion'
    end,
    current_date,
    current_date + make_interval(days => case
      when lower(i.ingredient_name) in ('reineta', 'salmon', 'congrio', 'camarón 36/40', 'camaron 51/60', 'ostiones', 'pulpo') then 4
      when lower(i.ingredient_name) in ('cilantro', 'menta', 'lechuga lollo green', 'lechuga lollo rose') then 5
      when lower(i.ingredient_name) in ('crema de leche', 'helado de vainilla', 'leche entera') then 10
      else 120
    end),
    'XLS-' || to_char(current_date, 'YYYYMMDD') || '-' || upper(substr(regexp_replace(i.ingredient_name, '[^A-Za-z0-9]+', '', 'g'), 1, 6)),
    'Importacion Excel'
  from pg_temp.import_ingredients i
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

  insert into public.ingredient_price_history (
    id, business_id, ingredient_id, supplier_id, price_purchase, recorded_at
  )
  select
    pg_temp.seed_uuid(v_business_id, 'price:' || regexp_replace(lower(i.ingredient_name), '[^a-z0-9]+', '-', 'g')),
    v_business_id,
    pg_temp.seed_uuid(v_business_id, 'ingredient:' || regexp_replace(lower(i.ingredient_name), '[^a-z0-9]+', '-', 'g')),
    pg_temp.seed_uuid(v_business_id, 'supplier:' || regexp_replace(lower(i.provider_name), '[^a-z0-9]+', '-', 'g')),
    round((i.total_price / nullif(i.purchase_qty, 0))::numeric, 4),
    current_date
  from pg_temp.import_ingredients i
  on conflict (id) do update
  set
    supplier_id = excluded.supplier_id,
    price_purchase = excluded.price_purchase,
    recorded_at = excluded.recorded_at;

  create temporary table pg_temp.import_recipes (
    recipe_slug text,
    recipe_name text,
    category_slug text,
    yield_amount numeric,
    yield_unit unit_type,
    item_cost_unit unit_type,
    time_minutes numeric,
    labor_slug text,
    labor_minutes numeric,
    instructions text,
    quality_notes text,
    allergens text[],
    observations text
  ) on commit drop;

  insert into pg_temp.import_recipes
  values
    (
      'leche-tigre-mixta',
      'Leche de tigre mixta',
      'crudos',
      1200,
      'ml',
      'ml',
      20,
      'labor:partida-fria',
      14,
      'Licuar aromaticos, colar fino y mantener a 2 C.',
      'Acidez alta, picor medio y textura fluida.',
      array['Pescado', 'Lacteos'],
      'Gramajes estimados para costeo a partir de la composicion del Excel.'
    ),
    (
      'fondo-caldillo-nerudiano',
      'Fondo de caldillo nerudiano',
      'fondos-marinos',
      2500,
      'ml',
      'ml',
      55,
      'labor:partida-caliente',
      35,
      'Tostar restos, sudar vegetales, desglasar con vino y cocer suave.',
      'Fondo limpio, marino y sin amargor.',
      array['Pescado', 'Mariscos'],
      'Se agregan cabezas de congrio y cascara de camaron porque la planilla las menciona como base del caldo.'
    ),
    (
      'dressing-citrico-verde',
      'Dressing citrico verde',
      'frios',
      750,
      'ml',
      'ml',
      10,
      'labor:partida-fria',
      8,
      'Emulsionar aceite, acido y condimentos.',
      'Aliño fresco, estable y con punto salino corto.',
      array[]::text[],
      'Base para ensaladas y terminaciones frias.'
    ),
    (
      'pure-de-camote',
      'Pure de camote',
      'fondos-marinos',
      1800,
      'g',
      'g',
      30,
      'labor:partida-caliente',
      20,
      'Hornear o cocer camote, procesar con lacteos y condimentar.',
      'Textura sedosa y sabor dulce balanceado.',
      array['Lacteos'],
      'Base de acompanamiento del pulpo grillado.'
    ),
    (
      'panacota-vainilla',
      'Panacota de vainilla',
      'postres',
      1800,
      'g',
      'g',
      25,
      'labor:pastelero',
      18,
      'Calentar lacteos, disolver gelatina, porcionar y enfriar.',
      'Temblor ligero y cuaje firme.',
      array['Lacteos'],
      'Base del postre panacota con frutos rojos.'
    ),
    (
      'salsa-frutos-rojos',
      'Salsa de frutos rojos',
      'postres',
      600,
      'g',
      'g',
      15,
      'labor:pastelero',
      10,
      'Reducir berries con azucar hasta salsa corta.',
      'Brillo alto y acidez natural.',
      array[]::text[],
      'Usa mix berries consolidado porque la planilla no trae frambuesa, mora y arandano por separado.'
    ),
    (
      'masa-pie-maracuya',
      'Masa pie maracuya',
      'postres',
      900,
      'g',
      'g',
      25,
      'labor:pastelero',
      16,
      'Arenar harina, azucar y mantequilla; ligar con huevo y hornear.',
      'Masa crocante, estable y seca.',
      array['Gluten', 'Huevos', 'Lacteos'],
      'Estandar de masa sable para costeo.'
    ),
    (
      'relleno-maracuya',
      'Relleno de maracuya',
      'postres',
      1500,
      'g',
      'g',
      15,
      'labor:pastelero',
      12,
      'Mezclar condensada, huevo y pulpa hasta textura estable.',
      'Relleno acido, denso y de corte limpio.',
      array['Huevos', 'Lacteos'],
      'Base del pie. Gramajes estimados por receta clasica.'
    ),
    (
      'merengue-pie',
      'Merengue de pie',
      'postres',
      700,
      'g',
      'g',
      12,
      'labor:pastelero',
      10,
      'Batir huevo con azucar hasta merengue estable.',
      'Picos firmes y acabado brillante.',
      array['Huevos'],
      'La planilla solo indica merengue; se estima una formula basica para costeo.'
    ),
    (
      'bizcocho-selectino',
      'Bizcocho selectino',
      'postres',
      1600,
      'g',
      'g',
      35,
      'labor:pastelero',
      24,
      'Batir huevos, integrar secos y hornear con manjar como base de sabor.',
      'Miga humeda y corte estable.',
      array['Gluten', 'Huevos', 'Lacteos'],
      'La planilla de selectino es incompleta. Esta formula es la mas inferida del script.'
    );

  insert into public.recipes (
    id, business_id, category_id, kind, name, yield_amount, yield_unit, item_cost_unit, time_minutes,
    labor_profile_id, labor_minutes, instructions, quality_notes, allergens, observations
  )
  select
    pg_temp.seed_uuid(v_business_id, 'recipe:' || r.recipe_slug),
    v_business_id,
    case
      when r.category_slug = 'crudos' then cat_dish_crudos
      when r.category_slug = 'frios' then cat_dish_frios
      when r.category_slug = 'calientes' then cat_dish_calientes
      when r.category_slug = 'fondos-marinos' then cat_dish_fondos
      else cat_dish_postres
    end,
    'base',
    r.recipe_name,
    r.yield_amount,
    r.yield_unit,
    r.item_cost_unit,
    r.time_minutes,
    pg_temp.seed_uuid(v_business_id, r.labor_slug),
    r.labor_minutes,
    r.instructions,
    r.quality_notes,
    r.allergens,
    r.observations
  from pg_temp.import_recipes r
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
      pg_temp.seed_uuid(v_business_id, 'recipe:leche-tigre-mixta'),
      pg_temp.seed_uuid(v_business_id, 'recipe:fondo-caldillo-nerudiano'),
      pg_temp.seed_uuid(v_business_id, 'recipe:dressing-citrico-verde'),
      pg_temp.seed_uuid(v_business_id, 'recipe:pure-de-camote'),
      pg_temp.seed_uuid(v_business_id, 'recipe:panacota-vainilla'),
      pg_temp.seed_uuid(v_business_id, 'recipe:salsa-frutos-rojos'),
      pg_temp.seed_uuid(v_business_id, 'recipe:masa-pie-maracuya'),
      pg_temp.seed_uuid(v_business_id, 'recipe:relleno-maracuya'),
      pg_temp.seed_uuid(v_business_id, 'recipe:merengue-pie'),
      pg_temp.seed_uuid(v_business_id, 'recipe:bizcocho-selectino')
    );

  insert into public.recipe_items (id, business_id, recipe_id, ingredient_id, quantity, unit, waste_percent)
  values
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:leche-tigre:reineta'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:leche-tigre-mixta'), pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Reineta')), 100, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:leche-tigre:limon'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:leche-tigre-mixta'), pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Limon')), 300, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:leche-tigre:apio'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:leche-tigre-mixta'), pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Apio')), 120, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:leche-tigre:jengibre'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:leche-tigre-mixta'), pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Jengibre')), 40, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:leche-tigre:aji-amarillo'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:leche-tigre-mixta'), pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Aji amarillo')), 50, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:leche-tigre:cilantro'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:leche-tigre-mixta'), pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Cilantro')), 25, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:leche-tigre:leche-evaporada'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:leche-tigre-mixta'), pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Leche evaporada')), 250, 'ml', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:leche-tigre:ajinomoto'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:leche-tigre-mixta'), pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Ajinomoto')), 6, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:leche-tigre:sal'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:leche-tigre-mixta'), pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Sal')), 6, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:leche-tigre:pimienta'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:leche-tigre-mixta'), pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Pimienta')), 2, 'g', 0),

    (pg_temp.seed_uuid(v_business_id, 'recipe-item:fondo:cabezas-congrio'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:fondo-caldillo-nerudiano'), pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Cabezas de congrio')), 900, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:fondo:cascara-camaron'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:fondo-caldillo-nerudiano'), pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Cascara de camaron')), 300, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:fondo:apio'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:fondo-caldillo-nerudiano'), pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Apio')), 180, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:fondo:cebolla'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:fondo-caldillo-nerudiano'), pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Cebolla')), 250, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:fondo:puerro'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:fondo-caldillo-nerudiano'), pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Puerro')), 150, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:fondo:zanahoria'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:fondo-caldillo-nerudiano'), pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Zanahoria')), 180, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:fondo:vino'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:fondo-caldillo-nerudiano'), pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Vino blanco')), 150, 'ml', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:fondo:oregano'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:fondo-caldillo-nerudiano'), pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Oregano')), 4, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:fondo:sal'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:fondo-caldillo-nerudiano'), pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Sal')), 10, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:fondo:aceite'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:fondo-caldillo-nerudiano'), pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Aceite vegetal')), 20, 'ml', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:fondo:cilantro'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:fondo-caldillo-nerudiano'), pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Cilantro')), 20, 'g', 0),

    (pg_temp.seed_uuid(v_business_id, 'recipe-item:dressing:aceite-oliva'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:dressing-citrico-verde'), pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Aceite de oliva')), 420, 'ml', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:dressing:vinagre-blanco'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:dressing-citrico-verde'), pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Vinagre blanco')), 120, 'ml', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:dressing:limon'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:dressing-citrico-verde'), pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Limon')), 180, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:dressing:sal'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:dressing-citrico-verde'), pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Sal')), 8, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:dressing:pimienta'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:dressing-citrico-verde'), pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Pimienta')), 2, 'g', 0),

    (pg_temp.seed_uuid(v_business_id, 'recipe-item:pure-camote:camote'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:pure-de-camote'), pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Camote')), 1500, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:pure-camote:mantequilla'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:pure-de-camote'), pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Mantequilla')), 90, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:pure-camote:leche-entera'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:pure-de-camote'), pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Leche entera')), 250, 'ml', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:pure-camote:sal'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:pure-de-camote'), pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Sal')), 8, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:pure-camote:pimienta'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:pure-de-camote'), pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Pimienta')), 2, 'g', 0),

    (pg_temp.seed_uuid(v_business_id, 'recipe-item:panacota:crema'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:panacota-vainilla'), pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Crema de leche')), 1000, 'ml', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:panacota:leche-entera'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:panacota-vainilla'), pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Leche entera')), 500, 'ml', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:panacota:colapez'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:panacota-vainilla'), pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Colapez')), 18, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:panacota:azucar'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:panacota-vainilla'), pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Azucar')), 140, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:panacota:vainilla'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:panacota-vainilla'), pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Esencia de vainilla')), 10, 'ml', 0),

    (pg_temp.seed_uuid(v_business_id, 'recipe-item:salsa-berries:mix-berries'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:salsa-frutos-rojos'), pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Mix berries')), 450, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:salsa-berries:azucar'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:salsa-frutos-rojos'), pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Azucar')), 80, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:salsa-berries:limon'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:salsa-frutos-rojos'), pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Limon')), 30, 'g', 0),

    (pg_temp.seed_uuid(v_business_id, 'recipe-item:masa-pie:harina'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:masa-pie-maracuya'), pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Harina')), 500, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:masa-pie:azucar-flor'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:masa-pie-maracuya'), pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Azucar flor')), 180, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:masa-pie:mantequilla'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:masa-pie-maracuya'), pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Mantequilla')), 250, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:masa-pie:huevos'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:masa-pie-maracuya'), pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Huevos')), 2, 'unidad', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:masa-pie:sal'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:masa-pie-maracuya'), pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Sal')), 3, 'g', 0),

    (pg_temp.seed_uuid(v_business_id, 'recipe-item:relleno-maracuya:condensada'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:relleno-maracuya'), pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Leche condensada')), 900, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:relleno-maracuya:pulpa'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:relleno-maracuya'), pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Pulpa de maracuya')), 250, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:relleno-maracuya:huevos'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:relleno-maracuya'), pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Huevos')), 5, 'unidad', 0),

    (pg_temp.seed_uuid(v_business_id, 'recipe-item:merengue:huevos'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:merengue-pie'), pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Huevos')), 4, 'unidad', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:merengue:azucar'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:merengue-pie'), pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Azucar')), 220, 'g', 0),

    (pg_temp.seed_uuid(v_business_id, 'recipe-item:bizcocho-selectino:harina'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:bizcocho-selectino'), pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Harina')), 350, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:bizcocho-selectino:azucar'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:bizcocho-selectino'), pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Azucar')), 220, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:bizcocho-selectino:aceite-vegetal'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:bizcocho-selectino'), pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Aceite vegetal')), 180, 'ml', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:bizcocho-selectino:huevos'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:bizcocho-selectino'), pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Huevos')), 6, 'unidad', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:bizcocho-selectino:leche-entera'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:bizcocho-selectino'), pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Leche entera')), 300, 'ml', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:bizcocho-selectino:manjar'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:bizcocho-selectino'), pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Manjar')), 250, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:bizcocho-selectino:sal'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:bizcocho-selectino'), pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Sal')), 3, 'g', 0)
  on conflict (id) do update
  set
    business_id = excluded.business_id,
    recipe_id = excluded.recipe_id,
    ingredient_id = excluded.ingredient_id,
    quantity = excluded.quantity,
    unit = excluded.unit,
    waste_percent = excluded.waste_percent;

  create temporary table pg_temp.import_dishes (
    dish_slug text,
    dish_name text,
    category_slug text,
    labor_slug text,
    labor_minutes numeric,
    target_food_cost numeric,
    allergens text[],
    plating_notes text,
    technical_notes text,
    shelf_life_hours numeric
  ) on commit drop;

  insert into pg_temp.import_dishes
  values
    (
      'ceviche-mixto',
      'Ceviche mixto',
      'crudos',
      'labor:partida-fria',
      10,
      0.30,
      array['Pescado', 'Mariscos'],
      'Servir muy frio, con montaje limpio y acidez marcada.',
      'Importado desde Excel con gramajes estimados para costeo. La base acida se resuelve con receta de leche de tigre mixta y porcion de proteinas combinadas.',
      3
    ),
    (
      'camarones-al-pil-pil',
      'Camarones al pil pil',
      'calientes',
      'labor:partida-caliente',
      11,
      0.33,
      array['Mariscos'],
      'Sarten corta, camarones jugosos y salsa ligada.',
      'Importado desde Excel con gramajes operativos estimados. Preparacion resuelta como salteado corto con aromatizacion directa.',
      2
    ),
    (
      'ostiones-a-la-parmesana',
      'Ostiones a la parmesana',
      'calientes',
      'labor:partida-caliente',
      9,
      0.33,
      array['Mariscos', 'Lacteos'],
      'Gratinado rapido y parejo, sin sobrecoccion.',
      'Importado desde Excel con gramajes estimados para gratinado individual.',
      2
    ),
    (
      'caldillo-de-congrio-a-la-nerudiana',
      'Caldillo de congrio a la nerudiana',
      'fondos-marinos',
      'labor:partida-caliente',
      18,
      0.36,
      array['Pescado', 'Mariscos', 'Lacteos'],
      'Caldo limpio, congrio jugoso y vegetales cocidos al punto.',
      'Importado desde Excel con gramajes estimados. Se construye fondo base nerudiano con cabezas de congrio y cascara de camaron porque la planilla lo menciona como parte del plato.',
      3
    ),
    (
      'salmon-a-la-plancha-con-mix-de-ensalada',
      'Salmon a la plancha con mix de ensalada',
      'fondos-marinos',
      'labor:partida-caliente',
      14,
      0.36,
      array['Pescado', 'Lacteos'],
      'Salmon marcado, ensalada fresca y aliño controlado.',
      'Importado desde Excel con gramajes estimados. Se agrega dressing citrico verde para costear el aliño de ensalada.',
      4
    ),
    (
      'pulpo-grillado-con-pure-de-camote',
      'Pulpo grillado con pure de camote',
      'fondos-marinos',
      'labor:partida-caliente',
      16,
      0.36,
      array['Mariscos', 'Lacteos'],
      'Pulpo marcado, pure sedoso y terminacion limpia.',
      'Importado desde Excel con gramajes estimados. El acompanamiento se modela como pure de camote base.',
      3
    ),
    (
      'panacota-de-frutos-rojos',
      'Panacota de frutos rojos',
      'postres',
      'labor:pastelero',
      6,
      0.24,
      array['Lacteos'],
      'Servir muy fria con salsa de berries y hoja de menta.',
      'Importado desde Excel con gramajes estimados. Se modela una base de panacota y una salsa de frutos rojos.',
      24
    ),
    (
      'pie-de-maracuya',
      'Pie de maracuya',
      'postres',
      'labor:pastelero',
      9,
      0.24,
      array['Gluten', 'Huevos', 'Lacteos'],
      'Corte limpio, relleno firme y merengue estable.',
      'Importado desde Excel con gramajes estimados. Se modelan masa sable, relleno de maracuya y merengue basico para costeo.',
      24
    ),
    (
      'selectino-mas-helado-de-vainilla',
      'Selectino mas helado de vainilla',
      'postres',
      'labor:pastelero',
      8,
      0.24,
      array['Gluten', 'Huevos', 'Lacteos'],
      'Postre emplatado con helado y montaje de vitrina/pase.',
      'Importado desde Excel con gramajes estimados. La formula del selectino es la mas inferida porque la planilla no trae suficientes datos estructurales; se resolvio como bizcocho de manjar con helado.',
      18
    );

  insert into public.dishes (
    id, business_id, category_id, name, service, labor_profile_id, labor_minutes,
    indirect_cost_share, target_food_cost, desired_margin, allergens, plating_notes,
    quality_checklist, technical_notes, shelf_life_hours, sales_count, image_url
  )
  select
    pg_temp.seed_uuid(v_business_id, 'dish:' || d.dish_slug),
    v_business_id,
    case
      when d.category_slug = 'crudos' then cat_dish_crudos
      when d.category_slug = 'frios' then cat_dish_frios
      when d.category_slug = 'calientes' then cat_dish_calientes
      when d.category_slug = 'fondos-marinos' then cat_dish_fondos
      else cat_dish_postres
    end,
    d.dish_name,
    'Cena',
    pg_temp.seed_uuid(v_business_id, d.labor_slug),
    d.labor_minutes,
    case
      when d.category_slug = 'crudos' then 1.0
      when d.category_slug = 'frios' then 1.0
      when d.category_slug = 'calientes' then 1.2
      when d.category_slug = 'fondos-marinos' then 1.3
      else 0.9
    end,
    d.target_food_cost,
    0.75,
    d.allergens,
    d.plating_notes,
    array[]::text[],
    d.technical_notes,
    d.shelf_life_hours,
    0,
    null
  from pg_temp.import_dishes d
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
    image_url = excluded.image_url;

  delete from public.dish_components
  where business_id = v_business_id
    and dish_id in (
      pg_temp.seed_uuid(v_business_id, 'dish:ceviche-mixto'),
      pg_temp.seed_uuid(v_business_id, 'dish:camarones-al-pil-pil'),
      pg_temp.seed_uuid(v_business_id, 'dish:ostiones-a-la-parmesana'),
      pg_temp.seed_uuid(v_business_id, 'dish:caldillo-de-congrio-a-la-nerudiana'),
      pg_temp.seed_uuid(v_business_id, 'dish:salmon-a-la-plancha-con-mix-de-ensalada'),
      pg_temp.seed_uuid(v_business_id, 'dish:pulpo-grillado-con-pure-de-camote'),
      pg_temp.seed_uuid(v_business_id, 'dish:panacota-de-frutos-rojos'),
      pg_temp.seed_uuid(v_business_id, 'dish:pie-de-maracuya'),
      pg_temp.seed_uuid(v_business_id, 'dish:selectino-mas-helado-de-vainilla')
    );

  insert into public.dish_components (id, business_id, dish_id, component_type, ref_id, quantity, unit, waste_percent)
  values
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:ceviche-mixto:reineta'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:ceviche-mixto'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Reineta')), 60, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:ceviche-mixto:salmon'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:ceviche-mixto'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Salmon')), 50, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:ceviche-mixto:camaron'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:ceviche-mixto'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Camaron 51/60')), 45, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:ceviche-mixto:pulpo'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:ceviche-mixto'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Pulpo')), 35, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:ceviche-mixto:leche-tigre'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:ceviche-mixto'), 'baseRecipe', pg_temp.seed_uuid(v_business_id, 'recipe:leche-tigre-mixta'), 80, 'ml', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:ceviche-mixto:cebolla-morada'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:ceviche-mixto'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Cebolla morada')), 18, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:ceviche-mixto:cilantro'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:ceviche-mixto'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Cilantro')), 4, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:ceviche-mixto:camote'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:ceviche-mixto'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Camote')), 60, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:ceviche-mixto:maiz-cancha'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:ceviche-mixto'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Maiz cancha')), 12, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:ceviche-mixto:choclo'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:ceviche-mixto'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Choclo peruano')), 40, 'g', 0),

    (pg_temp.seed_uuid(v_business_id, 'dishcomp:pilpil:camaron'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:camarones-al-pil-pil'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Camarón 36/40')), 180, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:pilpil:aceite-oliva'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:camarones-al-pil-pil'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Aceite de oliva')), 18, 'ml', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:pilpil:ajo'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:camarones-al-pil-pil'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Ajo')), 12, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:pilpil:aji-cacho'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:camarones-al-pil-pil'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Aji cacho de cabra')), 3, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:pilpil:limon'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:camarones-al-pil-pil'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Limon')), 20, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:pilpil:cilantro'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:camarones-al-pil-pil'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Cilantro')), 4, 'g', 0),

    (pg_temp.seed_uuid(v_business_id, 'dishcomp:ostiones-parm:ostiones'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:ostiones-a-la-parmesana'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Ostiones')), 180, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:ostiones-parm:parmesano'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:ostiones-a-la-parmesana'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Queso Parmesano')), 25, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:ostiones-parm:crema'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:ostiones-a-la-parmesana'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Crema de leche')), 35, 'ml', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:ostiones-parm:mantequilla'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:ostiones-a-la-parmesana'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Mantequilla')), 12, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:ostiones-parm:vino'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:ostiones-a-la-parmesana'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Vino blanco')), 15, 'ml', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:ostiones-parm:limon-pica'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:ostiones-a-la-parmesana'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Limon de pica')), 10, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:ostiones-parm:pimienta'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:ostiones-a-la-parmesana'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Pimienta')), 1, 'g', 0),

    (pg_temp.seed_uuid(v_business_id, 'dishcomp:caldillo:congrio'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:caldillo-de-congrio-a-la-nerudiana'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Congrio')), 180, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:caldillo:fondo'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:caldillo-de-congrio-a-la-nerudiana'), 'baseRecipe', pg_temp.seed_uuid(v_business_id, 'recipe:fondo-caldillo-nerudiano'), 250, 'ml', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:caldillo:papa'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:caldillo-de-congrio-a-la-nerudiana'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Papa')), 120, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:caldillo:cebolla'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:caldillo-de-congrio-a-la-nerudiana'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Cebolla')), 30, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:caldillo:zanahoria'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:caldillo-de-congrio-a-la-nerudiana'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Zanahoria')), 25, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:caldillo:pimenton'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:caldillo-de-congrio-a-la-nerudiana'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Pimenton')), 20, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:caldillo:ajo'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:caldillo-de-congrio-a-la-nerudiana'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Ajo')), 8, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:caldillo:cilantro'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:caldillo-de-congrio-a-la-nerudiana'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Cilantro')), 4, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:caldillo:crema'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:caldillo-de-congrio-a-la-nerudiana'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Crema de leche')), 25, 'ml', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:caldillo:aji-color'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:caldillo-de-congrio-a-la-nerudiana'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Aji de color')), 1, 'g', 0),

    (pg_temp.seed_uuid(v_business_id, 'dishcomp:salmon:salmon'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:salmon-a-la-plancha-con-mix-de-ensalada'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Salmon')), 200, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:salmon:mantequilla'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:salmon-a-la-plancha-con-mix-de-ensalada'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Mantequilla')), 10, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:salmon:aceite-oliva'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:salmon-a-la-plancha-con-mix-de-ensalada'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Aceite de oliva')), 8, 'ml', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:salmon:lollo-green'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:salmon-a-la-plancha-con-mix-de-ensalada'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Lechuga lollo green')), 35, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:salmon:lollo-rose'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:salmon-a-la-plancha-con-mix-de-ensalada'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Lechuga lollo rose')), 35, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:salmon:palta'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:salmon-a-la-plancha-con-mix-de-ensalada'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Palta')), 45, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:salmon:tomate-cherry'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:salmon-a-la-plancha-con-mix-de-ensalada'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Tomate cherry')), 50, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:salmon:dressing'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:salmon-a-la-plancha-con-mix-de-ensalada'), 'baseRecipe', pg_temp.seed_uuid(v_business_id, 'recipe:dressing-citrico-verde'), 30, 'ml', 0),

    (pg_temp.seed_uuid(v_business_id, 'dishcomp:pulpo:pulpo'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:pulpo-grillado-con-pure-de-camote'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Pulpo')), 180, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:pulpo:pure-camote'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:pulpo-grillado-con-pure-de-camote'), 'baseRecipe', pg_temp.seed_uuid(v_business_id, 'recipe:pure-de-camote'), 180, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:pulpo:aceite-vegetal'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:pulpo-grillado-con-pure-de-camote'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Aceite vegetal')), 10, 'ml', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:pulpo:sal'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:pulpo-grillado-con-pure-de-camote'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Sal')), 1, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:pulpo:pimienta'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:pulpo-grillado-con-pure-de-camote'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Pimienta')), 1, 'g', 0),

    (pg_temp.seed_uuid(v_business_id, 'dishcomp:panacota:base'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:panacota-de-frutos-rojos'), 'baseRecipe', pg_temp.seed_uuid(v_business_id, 'recipe:panacota-vainilla'), 140, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:panacota:salsa'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:panacota-de-frutos-rojos'), 'baseRecipe', pg_temp.seed_uuid(v_business_id, 'recipe:salsa-frutos-rojos'), 35, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:panacota:menta'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:panacota-de-frutos-rojos'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Menta')), 1, 'g', 0),

    (pg_temp.seed_uuid(v_business_id, 'dishcomp:pie-maracuya:masa'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:pie-de-maracuya'), 'baseRecipe', pg_temp.seed_uuid(v_business_id, 'recipe:masa-pie-maracuya'), 95, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:pie-maracuya:relleno'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:pie-de-maracuya'), 'baseRecipe', pg_temp.seed_uuid(v_business_id, 'recipe:relleno-maracuya'), 120, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:pie-maracuya:merengue'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:pie-de-maracuya'), 'baseRecipe', pg_temp.seed_uuid(v_business_id, 'recipe:merengue-pie'), 30, 'g', 0),

    (pg_temp.seed_uuid(v_business_id, 'dishcomp:selectino:bizcocho'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:selectino-mas-helado-de-vainilla'), 'baseRecipe', pg_temp.seed_uuid(v_business_id, 'recipe:bizcocho-selectino'), 130, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:selectino:helado'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:selectino-mas-helado-de-vainilla'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Helado de vainilla')), 80, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:selectino:manjar'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:selectino-mas-helado-de-vainilla'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:' || pg_temp.import_slug('Manjar')), 20, 'g', 0)
  on conflict (id) do update
  set
    business_id = excluded.business_id,
    dish_id = excluded.dish_id,
    component_type = excluded.component_type,
    ref_id = excluded.ref_id,
    quantity = excluded.quantity,
    unit = excluded.unit,
    waste_percent = excluded.waste_percent;

  insert into public.app_snapshots (business_id, state)
  values (v_business_id, '{}'::jsonb)
  on conflict (business_id) do nothing;

  update public.app_snapshots
  set
    state =
      jsonb_set(
        jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              coalesce(state, '{}'::jsonb),
              '{categories}',
              coalesce((
                select jsonb_agg(
                  jsonb_build_object(
                    'id', c.id::text,
                    'type', c.type,
                    'name', c.name
                  )
                  order by c.type, c.name
                )
                from public.categories c
                where c.business_id = v_business_id
              ), '[]'::jsonb),
              true
            ),
            '{suppliers}',
            coalesce((
              select jsonb_agg(
                jsonb_build_object(
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
                )
                order by s.name
              )
              from public.suppliers s
              where s.business_id = v_business_id
            ), '[]'::jsonb),
            true
          ),
          '{ingredients}',
          coalesce((
            select jsonb_agg(
              jsonb_build_object(
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
                  select jsonb_agg(
                    jsonb_build_object(
                      'date', iph.recorded_at::text,
                      'supplierId', coalesce(iph.supplier_id::text, ''),
                      'pricePurchase', iph.price_purchase
                    )
                    order by iph.recorded_at
                  )
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
              )
              order by i.name
            )
            from public.ingredients i
            where i.business_id = v_business_id
          ), '[]'::jsonb),
          true
        ),
        '{dishes}',
        coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', d.id::text,
              'name', d.name,
              'categoryId', coalesce(d.category_id::text, ''),
              'service', d.service,
              'directItems', coalesce((
                select jsonb_agg(
                  jsonb_build_object(
                    'id', dc.id::text,
                    'componentType', dc.component_type,
                    'refId', dc.ref_id::text,
                    'quantity', dc.quantity,
                    'unit', dc.unit,
                    'wastePercent', dc.waste_percent
                  )
                  order by dc.created_at
                )
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
            )
            order by d.name
          )
          from public.dishes d
          where d.business_id = v_business_id
        ), '[]'::jsonb),
        true
      ),
      '{baseRecipes}',
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', r.id::text,
            'name', r.name,
            'categoryId', coalesce(r.category_id::text, ''),
            'kind', r.kind,
            'yieldAmount', r.yield_amount,
            'yieldUnit', r.yield_unit,
            'itemCostUnit', r.item_cost_unit,
            'items', coalesce((
              select jsonb_agg(
                jsonb_build_object(
                  'id', ri.id::text,
                  'ingredientId', ri.ingredient_id::text,
                  'quantity', ri.quantity,
                  'unit', ri.unit,
                  'wastePercent', ri.waste_percent
                )
                order by ri.created_at
              )
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
          )
          order by r.name
        )
        from public.recipes r
        where r.business_id = v_business_id
          and r.kind = 'base'
      ), '[]'::jsonb),
      true
      ),
    updated_at = now()
  where business_id = v_business_id;
end $$;
