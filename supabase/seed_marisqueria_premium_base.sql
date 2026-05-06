-- Base de posicionamiento para convertir la maqueta a marisqueria premium chilena
-- Ejecutar despues de cleanup_catalog_for_reseed.sql
-- Reemplaza v_owner_email por el correo real del dueno del negocio.
-- Este script deja:
-- 1. Identidad y configuracion del negocio
-- 2. Categorias del nuevo concepto
-- 3. Proveedores base del nuevo abastecimiento
-- 4. Objetivos de food cost para el nuevo mix

create or replace function pg_temp.seed_uuid(base uuid, slug text)
returns uuid
language sql
immutable
as $$
  select uuid_generate_v5(uuid_ns_url(), base::text || ':' || slug);
$$;

do $$
declare
  v_owner_email text := 'pablo@goupevents.cl';
  v_business_id uuid;

  cat_ing_pescados uuid;
  cat_ing_mariscos uuid;
  cat_ing_algas uuid;
  cat_ing_verduras uuid;
  cat_ing_citricos uuid;
  cat_ing_lacteos uuid;
  cat_ing_bodega uuid;
  cat_ing_bebidas uuid;

  cat_dish_crudos uuid;
  cat_dish_frios uuid;
  cat_dish_calientes uuid;
  cat_dish_fondos uuid;
  cat_dish_postres uuid;
  cat_menu_degus uuid;
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
    name = 'Marisqueria premium chilena',
    business_type = 'Restaurante',
    target_food_cost = 0.34,
    target_margin = 0.75,
    fixed_costs_monthly = 9200000,
    worker_count = 16,
    opening_hours = 'Martes a domingo 13:00-23:30',
    internal_categories = array['Crudos', 'Entradas frias', 'Calientes', 'Fondos marinos', 'Postres', 'Menus degustacion']
  where id = v_business_id;

  cat_ing_pescados := pg_temp.seed_uuid(v_business_id, 'category:ingredient:pescados');
  cat_ing_mariscos := pg_temp.seed_uuid(v_business_id, 'category:ingredient:mariscos');
  cat_ing_algas := pg_temp.seed_uuid(v_business_id, 'category:ingredient:algas');
  cat_ing_verduras := pg_temp.seed_uuid(v_business_id, 'category:ingredient:verduras');
  cat_ing_citricos := pg_temp.seed_uuid(v_business_id, 'category:ingredient:citricos');
  cat_ing_lacteos := pg_temp.seed_uuid(v_business_id, 'category:ingredient:lacteos');
  cat_ing_bodega := pg_temp.seed_uuid(v_business_id, 'category:ingredient:bodega');
  cat_ing_bebidas := pg_temp.seed_uuid(v_business_id, 'category:ingredient:bebidas');

  cat_dish_crudos := pg_temp.seed_uuid(v_business_id, 'category:dish:crudos');
  cat_dish_frios := pg_temp.seed_uuid(v_business_id, 'category:dish:frios');
  cat_dish_calientes := pg_temp.seed_uuid(v_business_id, 'category:dish:calientes');
  cat_dish_fondos := pg_temp.seed_uuid(v_business_id, 'category:dish:fondos-marinos');
  cat_dish_postres := pg_temp.seed_uuid(v_business_id, 'category:dish:postres');
  cat_menu_degus := pg_temp.seed_uuid(v_business_id, 'category:menu:degustacion-marina');

  insert into public.categories (id, business_id, type, name)
  values
    (cat_ing_pescados, v_business_id, 'ingredient', 'Pescados premium'),
    (cat_ing_mariscos, v_business_id, 'ingredient', 'Mariscos y moluscos'),
    (cat_ing_algas, v_business_id, 'ingredient', 'Algas y sal marina'),
    (cat_ing_verduras, v_business_id, 'ingredient', 'Verduras y hierbas'),
    (cat_ing_citricos, v_business_id, 'ingredient', 'Citricos y acidos'),
    (cat_ing_lacteos, v_business_id, 'ingredient', 'Lacteos y mantequillas'),
    (cat_ing_bodega, v_business_id, 'ingredient', 'Bodega seca premium'),
    (cat_ing_bebidas, v_business_id, 'ingredient', 'Vinos y destilados de cocina'),
    (cat_dish_crudos, v_business_id, 'dish', 'Crudos'),
    (cat_dish_frios, v_business_id, 'dish', 'Entradas frias'),
    (cat_dish_calientes, v_business_id, 'dish', 'Calientes'),
    (cat_dish_fondos, v_business_id, 'dish', 'Fondos marinos'),
    (cat_dish_postres, v_business_id, 'dish', 'Postres'),
    (cat_menu_degus, v_business_id, 'menu', 'Menu degustacion marino')
  on conflict (id) do update
  set
    business_id = excluded.business_id,
    type = excluded.type,
    name = excluded.name;

  insert into public.suppliers (
    id, business_id, name, rut, contact_name, phone, email, product_category,
    payment_terms, lead_time_days, quality_score, delivery_score, notes
  )
  values
    (pg_temp.seed_uuid(v_business_id, 'supplier:caleta-valparaiso-premium'), v_business_id, 'Caleta Valparaiso Premium', '76.410.223-1', 'Josefa Arancibia', '+56 9 6123 4411', 'ventas@caletapremium.cl', 'Pescados de costa', '24 horas', 1, 4.9, 4.8, 'Pesca fresca de corvina, reineta, congrio y pesca del dia.'),
    (pg_temp.seed_uuid(v_business_id, 'supplier:sur-mariscos-australes'), v_business_id, 'Sur Mariscos Australes', '77.221.108-4', 'Martin Gallardo', '+56 9 7330 1102', 'pedidos@surmariscos.cl', 'Mariscos premium', '48 horas', 2, 4.9, 4.7, 'Ostiones, almejas, machas, navajuelas, centolla y erizo segun temporada.'),
    (pg_temp.seed_uuid(v_business_id, 'supplier:algas-pacifico'), v_business_id, 'Algas del Pacifico', '76.778.411-0', 'Claudia Mella', '+56 9 7888 5210', 'contacto@algaspacifico.cl', 'Algas y sales', 'Contado', 2, 4.7, 4.6, 'Cochayuyo premium, luche, chicoria de mar y sal de Cahuil.'),
    (pg_temp.seed_uuid(v_business_id, 'supplier:huerta-costera'), v_business_id, 'Huerta Costera', '76.908.120-4', 'Sofia Morales', '+56 9 7154 2020', 'pedidos@huertacostera.cl', 'Verduras y hierbas', 'Contado', 1, 4.7, 4.8, 'Hojas, citricos, hierbas y hortalizas de rotacion diaria.'),
    (pg_temp.seed_uuid(v_business_id, 'supplier:lacteos-artesanos'), v_business_id, 'Lacteos Artesanos del Sur', '76.554.230-8', 'Marcela Muñoz', '+56 9 6111 4556', 'comercial@lacteosartesanos.cl', 'Mantequillas y cremas', '30 dias', 2, 4.8, 4.7, 'Mantequilla premium, crema, quesos frescos y cultivos.'),
    (pg_temp.seed_uuid(v_business_id, 'supplier:bodega-chef'), v_business_id, 'Bodega Chef Selection', '77.664.200-9', 'Juan Pablo Saez', '+56 9 7440 2211', 'abastecimiento@bodegachef.cl', 'Bodega seca premium', '30 dias', 3, 4.6, 4.5, 'Aceites, vinagres, arroz, especias, fumets y conservas.'),
    (pg_temp.seed_uuid(v_business_id, 'supplier:cava-litoral'), v_business_id, 'Cava Litoral', '77.801.440-6', 'Mauricio Araya', '+56 9 6991 9001', 'ventas@cavalitoral.cl', 'Vinos y espumantes', '30 dias', 3, 4.5, 4.5, 'Vinos blancos, espumantes y destilados para cocina y maridaje.')
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

  insert into public.food_cost_targets (id, business_id, scope_type, scope_id, target_percent)
  values
    (pg_temp.seed_uuid(v_business_id, 'fct:business'), v_business_id, 'business', v_business_id::text, 0.34),
    (pg_temp.seed_uuid(v_business_id, 'fct:category:crudos'), v_business_id, 'category', cat_dish_crudos::text, 0.30),
    (pg_temp.seed_uuid(v_business_id, 'fct:category:frios'), v_business_id, 'category', cat_dish_frios::text, 0.31),
    (pg_temp.seed_uuid(v_business_id, 'fct:category:calientes'), v_business_id, 'category', cat_dish_calientes::text, 0.33),
    (pg_temp.seed_uuid(v_business_id, 'fct:category:fondos-marinos'), v_business_id, 'category', cat_dish_fondos::text, 0.36),
    (pg_temp.seed_uuid(v_business_id, 'fct:category:postres'), v_business_id, 'category', cat_dish_postres::text, 0.24)
  on conflict (id) do update
  set
    scope_type = excluded.scope_type,
    scope_id = excluded.scope_id,
    target_percent = excluded.target_percent;

  delete from public.app_snapshots
  where business_id = v_business_id;
end $$;
