-- Seed operativo completo para maqueta de marisqueria premium chilena
-- Ejecutar despues de:
-- 1) cleanup_catalog_for_reseed.sql
-- 2) seed_marisqueria_premium_base.sql
-- Reemplaza v_owner_email por el correo real del dueno del negocio.
--
-- Este script:
-- 1. Carga materias primas tipicas de mar premium chileno
-- 2. Crea recetas base y platos finales
-- 3. Arma menus degustacion
-- 4. Carga compras, inventario, produccion, ventas y proyecciones
-- 5. Reconstruye app_snapshots para el frontend actual

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

  insert into public.packaging_costs (id, business_id, name, channel, unit, unit_cost)
  values
    (pg_temp.seed_uuid(v_business_id, 'packaging:delivery-mar-premium'), v_business_id, 'Packaging premium mar premium', 'Delivery', 'unidad', 1250)
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
    (pg_temp.seed_uuid(v_business_id, 'ingredient:corvina-filete'), v_business_id, cat_ing_pescados, pg_temp.seed_uuid(v_business_id, 'sanitary:fish'), pg_temp.seed_uuid(v_business_id, 'supplier:caleta-valparaiso-premium'), 'Corvina filete premium', 'kg', 'g', 21000, 23.8636, 88, 12, 3, 18, current_date - 1, 4, 'Refrigerado', 'Filetes protegidos sobre hielo con drenaje.', '0 C a 2 C', 0, 2, 1.1, 'Alto', '#1976D2', 'Azul', 'PES-001', 'CVP-COR-01', 'Camara pescados A', current_date - 1, current_date + 3, 'LOT-COR-2605', 'Bodega AM'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:reineta-filete'), v_business_id, cat_ing_pescados, pg_temp.seed_uuid(v_business_id, 'sanitary:fish'), pg_temp.seed_uuid(v_business_id, 'supplier:caleta-valparaiso-premium'), 'Reineta filete premium', 'kg', 'g', 16500, 18.3333, 90, 14, 4, 20, current_date - 1, 4, 'Refrigerado', 'Filetes porcionados y rotulados.', '0 C a 2 C', 0, 2, 1.0, 'Alto', '#1976D2', 'Azul', 'PES-002', 'CVP-REI-02', 'Camara pescados A', current_date - 1, current_date + 3, 'LOT-REI-2605', 'Bodega AM'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:congrio-dorado'), v_business_id, cat_ing_pescados, pg_temp.seed_uuid(v_business_id, 'sanitary:fish'), pg_temp.seed_uuid(v_business_id, 'supplier:caleta-valparaiso-premium'), 'Congrio dorado', 'kg', 'g', 26000, 31.7073, 82, 10, 3, 15, current_date - 1, 4, 'Refrigerado', 'Mantener entero o en porciones grandes protegidas.', '0 C a 2 C', 0, 2, 1.2, 'Alto', '#1976D2', 'Azul', 'PES-003', 'CVP-CON-03', 'Camara pescados A', current_date - 1, current_date + 3, 'LOT-CON-2605', 'Bodega AM'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:merluza-austral'), v_business_id, cat_ing_pescados, pg_temp.seed_uuid(v_business_id, 'sanitary:fish'), pg_temp.seed_uuid(v_business_id, 'supplier:caleta-valparaiso-premium'), 'Merluza austral', 'kg', 'g', 22500, 26.1628, 86, 12, 3, 18, current_date - 1, 4, 'Refrigerado', 'Filetes limpios en GN cerrada.', '0 C a 2 C', 0, 2, 1.1, 'Alto', '#1976D2', 'Azul', 'PES-004', 'CVP-MER-04', 'Camara pescados A', current_date - 1, current_date + 3, 'LOT-MER-2605', 'Bodega AM'),

    (pg_temp.seed_uuid(v_business_id, 'ingredient:ostiones-limpios'), v_business_id, cat_ing_mariscos, pg_temp.seed_uuid(v_business_id, 'sanitary:fish'), pg_temp.seed_uuid(v_business_id, 'supplier:sur-mariscos-australes'), 'Ostiones limpios', 'kg', 'g', 28500, 28.5000, 100, 10, 2, 14, current_date - 1, 4, 'Refrigerado', 'Mantener muy frio y protegido.', '0 C a 2 C', 0, 2, 1.0, 'Alto', '#1976D2', 'Azul', 'MAR-005', 'SMA-OST-05', 'Camara mariscos', current_date - 1, current_date + 3, 'LOT-OST-2605', 'Bodega AM'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:machas-limpias'), v_business_id, cat_ing_mariscos, pg_temp.seed_uuid(v_business_id, 'sanitary:fish'), pg_temp.seed_uuid(v_business_id, 'supplier:sur-mariscos-australes'), 'Machas limpias', 'kg', 'g', 16000, 29.0909, 55, 14, 4, 20, current_date - 1, 3, 'Refrigerado', 'Conservacion sobre hielo en malla drenada.', '0 C a 2 C', 0, 2, 1.0, 'Alto', '#1976D2', 'Azul', 'MAR-006', 'SMA-MAC-06', 'Camara mariscos', current_date - 1, current_date + 2, 'LOT-MAC-2605', 'Bodega AM'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:almejas-limpias'), v_business_id, cat_ing_mariscos, pg_temp.seed_uuid(v_business_id, 'sanitary:fish'), pg_temp.seed_uuid(v_business_id, 'supplier:sur-mariscos-australes'), 'Almejas limpias', 'kg', 'g', 9800, 21.7778, 45, 16, 5, 24, current_date - 1, 3, 'Refrigerado', 'Mantener vivas, ventiladas y drenadas.', '0 C a 2 C', 0, 2, 1.1, 'Alto', '#1976D2', 'Azul', 'MAR-007', 'SMA-ALM-07', 'Camara mariscos', current_date - 1, current_date + 2, 'LOT-ALM-2605', 'Bodega AM'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:erizo-fresco'), v_business_id, cat_ing_mariscos, pg_temp.seed_uuid(v_business_id, 'sanitary:fish'), pg_temp.seed_uuid(v_business_id, 'supplier:sur-mariscos-australes'), 'Erizo fresco', 'kg', 'g', 42000, 42.0000, 100, 5, 1, 8, current_date - 1, 2, 'Refrigerado', 'Mantener tapado y muy frio.', '0 C a 2 C', 0, 2, 1.0, 'Alto', '#1976D2', 'Azul', 'MAR-008', 'SMA-ERI-08', 'Camara mariscos', current_date - 1, current_date + 1, 'LOT-ERI-2605', 'Bodega AM'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:centolla-cocida'), v_business_id, cat_ing_mariscos, pg_temp.seed_uuid(v_business_id, 'sanitary:ready'), pg_temp.seed_uuid(v_business_id, 'supplier:sur-mariscos-australes'), 'Centolla cocida desmenuzada', 'kg', 'g', 68000, 68.0000, 100, 6, 1.5, 10, current_date - 2, 5, 'Refrigerado', 'Siempre tapada, fechada y separada de crudos.', '2 C a 4 C', 2, 4, 3.1, 'Alto', '#7B1FA2', 'Morado', 'MAR-009', 'SMA-CEN-09', 'Camara listos', current_date - 2, current_date + 3, 'LOT-CEN-2605', 'Bodega PM'),

    (pg_temp.seed_uuid(v_business_id, 'ingredient:cochayuyo-premium'), v_business_id, cat_ing_algas, pg_temp.seed_uuid(v_business_id, 'sanitary:drygoods'), pg_temp.seed_uuid(v_business_id, 'supplier:algas-pacifico'), 'Cochayuyo premium', 'kg', 'g', 7200, 9.0000, 80, 6, 1, 10, current_date - 4, 180, 'Seco', 'Guardar cerrado en contenedor seco.', '15 C a 25 C', 15, 25, 20.0, 'Bajo', '#424242', 'Gris oscuro', 'ALG-010', 'ADP-COC-10', 'Secos premium', current_date - 4, current_date + 150, 'LOT-COC-2605', 'Bodega seca'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:luche-seco'), v_business_id, cat_ing_algas, pg_temp.seed_uuid(v_business_id, 'sanitary:drygoods'), pg_temp.seed_uuid(v_business_id, 'supplier:algas-pacifico'), 'Luche seco', 'kg', 'g', 18500, 18.5000, 100, 2, 0.4, 4, current_date - 4, 180, 'Seco', 'Conservar lejos de humedad.', '15 C a 25 C', 15, 25, 20.0, 'Bajo', '#424242', 'Gris oscuro', 'ALG-011', 'ADP-LUC-11', 'Secos premium', current_date - 4, current_date + 150, 'LOT-LUC-2605', 'Bodega seca'),

    (pg_temp.seed_uuid(v_business_id, 'ingredient:limon-sutil'), v_business_id, cat_ing_citricos, pg_temp.seed_uuid(v_business_id, 'sanitary:fruits'), pg_temp.seed_uuid(v_business_id, 'supplier:huerta-costera'), 'Limon sutil', 'kg', 'g', 1900, 1.9000, 100, 16, 4, 24, current_date - 1, 10, 'Refrigerado o ambiente controlado', 'Separar por maduracion y rotacion diaria.', '4 C a 8 C', 4, 8, 7.0, 'Bajo/Medio', '#8BC34A', 'Verde claro', 'CIT-012', 'HUC-LIM-12', 'Camara citricos', current_date - 1, current_date + 8, 'LOT-LIM-2605', 'Bodega AM'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:pomelo-rosado'), v_business_id, cat_ing_citricos, pg_temp.seed_uuid(v_business_id, 'sanitary:fruits'), pg_temp.seed_uuid(v_business_id, 'supplier:huerta-costera'), 'Pomelo rosado', 'kg', 'g', 2200, 2.2000, 100, 10, 2, 16, current_date - 1, 10, 'Refrigerado o ambiente controlado', 'Guardar ventilado y seco.', '4 C a 8 C', 4, 8, 7.1, 'Bajo/Medio', '#8BC34A', 'Verde claro', 'CIT-013', 'HUC-POM-13', 'Camara citricos', current_date - 1, current_date + 8, 'LOT-POM-2605', 'Bodega AM'),

    (pg_temp.seed_uuid(v_business_id, 'ingredient:cebolla-morada'), v_business_id, cat_ing_verduras, pg_temp.seed_uuid(v_business_id, 'sanitary:vegetables'), pg_temp.seed_uuid(v_business_id, 'supplier:huerta-costera'), 'Cebolla morada', 'kg', 'g', 1500, 1.5000, 100, 12, 3, 18, current_date - 1, 20, 'Refrigerado', 'Separada de crudos animales.', '3 C a 5 C', 3, 5, 4.3, 'Medio', '#388E3C', 'Verde', 'VER-014', 'HUC-CEM-14', 'Camara verduras', current_date - 1, current_date + 14, 'LOT-CEM-2605', 'Bodega AM'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:cilantro'), v_business_id, cat_ing_verduras, pg_temp.seed_uuid(v_business_id, 'sanitary:vegetables'), pg_temp.seed_uuid(v_business_id, 'supplier:huerta-costera'), 'Cilantro', 'kg', 'g', 8500, 8.5000, 100, 4, 0.8, 6, current_date - 1, 5, 'Refrigerado', 'Mantener humedo y ventilado.', '3 C a 5 C', 3, 5, 4.0, 'Medio', '#388E3C', 'Verde', 'VER-015', 'HUC-CIL-15', 'Camara hierbas', current_date - 1, current_date + 4, 'LOT-CIL-2605', 'Bodega AM'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:hinojo'), v_business_id, cat_ing_verduras, pg_temp.seed_uuid(v_business_id, 'sanitary:vegetables'), pg_temp.seed_uuid(v_business_id, 'supplier:huerta-costera'), 'Hinojo', 'kg', 'g', 3200, 3.2000, 100, 6, 1, 9, current_date - 1, 8, 'Refrigerado', 'Contenedor ventilado y seco.', '3 C a 5 C', 3, 5, 4.2, 'Medio', '#388E3C', 'Verde', 'VER-016', 'HUC-HIN-16', 'Camara verduras', current_date - 1, current_date + 6, 'LOT-HIN-2605', 'Bodega AM'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:pepino'), v_business_id, cat_ing_verduras, pg_temp.seed_uuid(v_business_id, 'sanitary:vegetables'), pg_temp.seed_uuid(v_business_id, 'supplier:huerta-costera'), 'Pepino', 'kg', 'g', 1700, 1.7000, 100, 8, 2, 12, current_date - 1, 7, 'Refrigerado', 'Contenedor ventilado.', '3 C a 5 C', 3, 5, 4.1, 'Medio', '#388E3C', 'Verde', 'VER-017', 'HUC-PEP-17', 'Camara verduras', current_date - 1, current_date + 5, 'LOT-PEP-2605', 'Bodega AM'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:palta-hass'), v_business_id, cat_ing_verduras, pg_temp.seed_uuid(v_business_id, 'sanitary:fruits'), pg_temp.seed_uuid(v_business_id, 'supplier:huerta-costera'), 'Palta hass', 'kg', 'g', 6200, 6.2000, 100, 10, 2, 14, current_date - 1, 6, 'Refrigerado o ambiente controlado', 'Separar por maduracion.', '4 C a 8 C', 4, 8, 7.0, 'Bajo/Medio', '#8BC34A', 'Verde claro', 'VER-018', 'HUC-PAL-18', 'Camara verduras', current_date - 1, current_date + 5, 'LOT-PAL-2605', 'Bodega AM'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:coliflor'), v_business_id, cat_ing_verduras, pg_temp.seed_uuid(v_business_id, 'sanitary:vegetables'), pg_temp.seed_uuid(v_business_id, 'supplier:huerta-costera'), 'Coliflor', 'kg', 'g', 2600, 2.6000, 100, 12, 3, 18, current_date - 1, 8, 'Refrigerado', 'Mantener ventilada y limpia.', '3 C a 5 C', 3, 5, 4.1, 'Medio', '#388E3C', 'Verde', 'VER-019', 'HUC-COL-19', 'Camara verduras', current_date - 1, current_date + 6, 'LOT-COL-2605', 'Bodega AM'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:papa-chilota'), v_business_id, cat_ing_verduras, pg_temp.seed_uuid(v_business_id, 'sanitary:vegetables'), pg_temp.seed_uuid(v_business_id, 'supplier:huerta-costera'), 'Papa chilota', 'kg', 'g', 2200, 2.2000, 100, 20, 5, 30, current_date - 1, 18, 'Refrigerado', 'Guardar seca y ventilada.', '3 C a 5 C', 3, 5, 4.5, 'Medio', '#388E3C', 'Verde', 'VER-020', 'HUC-PCH-20', 'Camara verduras', current_date - 1, current_date + 12, 'LOT-PCH-2605', 'Bodega AM'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:aji-verde'), v_business_id, cat_ing_verduras, pg_temp.seed_uuid(v_business_id, 'sanitary:vegetables'), pg_temp.seed_uuid(v_business_id, 'supplier:huerta-costera'), 'Aji verde', 'kg', 'g', 2400, 2.4000, 100, 4, 1, 6, current_date - 1, 7, 'Refrigerado', 'Mantener ventilado.', '3 C a 5 C', 3, 5, 4.2, 'Medio', '#388E3C', 'Verde', 'VER-021', 'HUC-AJV-21', 'Camara verduras', current_date - 1, current_date + 5, 'LOT-AJV-2605', 'Bodega AM'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:ajo'), v_business_id, cat_ing_verduras, pg_temp.seed_uuid(v_business_id, 'sanitary:vegetables'), pg_temp.seed_uuid(v_business_id, 'supplier:huerta-costera'), 'Ajo', 'kg', 'g', 4200, 4.2000, 100, 3, 0.6, 5, current_date - 1, 25, 'Refrigerado', 'Mantener seco y ventilado.', '3 C a 5 C', 3, 5, 4.4, 'Medio', '#388E3C', 'Verde', 'VER-022', 'HUC-AJO-22', 'Camara verduras', current_date - 1, current_date + 18, 'LOT-AJO-2605', 'Bodega AM'),

    (pg_temp.seed_uuid(v_business_id, 'ingredient:crema-fresca'), v_business_id, cat_ing_lacteos, pg_temp.seed_uuid(v_business_id, 'sanitary:dairy'), pg_temp.seed_uuid(v_business_id, 'supplier:lacteos-artesanos'), 'Crema fresca', 'litro', 'ml', 4600, 4.6000, 100, 24, 6, 30, current_date - 2, 10, 'Refrigerado', 'Mantener cerrada y en FIFO.', '2 C a 5 C', 2, 5, 4.0, 'Medio/Alto', '#F5F5F5', 'Blanco', 'LAC-023', 'LAS-CRE-23', 'Camara lacteos', current_date - 2, current_date + 7, 'LOT-CRE-2605', 'Bodega PM'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:mantequilla-premium'), v_business_id, cat_ing_lacteos, pg_temp.seed_uuid(v_business_id, 'sanitary:dairy'), pg_temp.seed_uuid(v_business_id, 'supplier:lacteos-artesanos'), 'Mantequilla premium', 'kg', 'g', 7200, 7.2000, 100, 10, 2, 14, current_date - 2, 20, 'Refrigerado', 'Mantener cerrada y sin transferencia de olores.', '2 C a 5 C', 2, 5, 4.1, 'Medio/Alto', '#F5F5F5', 'Blanco', 'LAC-024', 'LAS-MAN-24', 'Camara lacteos', current_date - 2, current_date + 14, 'LOT-MAN-2605', 'Bodega PM'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:parmesano'), v_business_id, cat_ing_lacteos, pg_temp.seed_uuid(v_business_id, 'sanitary:dairy'), pg_temp.seed_uuid(v_business_id, 'supplier:lacteos-artesanos'), 'Parmesano', 'kg', 'g', 24000, 24.0000, 100, 5, 1, 8, current_date - 2, 20, 'Refrigerado', 'Mantener envase cerrado y rotulado.', '2 C a 5 C', 2, 5, 4.2, 'Medio/Alto', '#F5F5F5', 'Blanco', 'LAC-025', 'LAS-PAR-25', 'Camara lacteos', current_date - 2, current_date + 15, 'LOT-PAR-2605', 'Bodega PM'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:leche-entera'), v_business_id, cat_ing_lacteos, pg_temp.seed_uuid(v_business_id, 'sanitary:dairy'), pg_temp.seed_uuid(v_business_id, 'supplier:lacteos-artesanos'), 'Leche entera', 'litro', 'ml', 1500, 1.5000, 100, 18, 4, 24, current_date - 2, 8, 'Refrigerado', 'Mantener cerrada.', '2 C a 5 C', 2, 5, 4.0, 'Medio/Alto', '#F5F5F5', 'Blanco', 'LAC-026', 'LAS-LEC-26', 'Camara lacteos', current_date - 2, current_date + 5, 'LOT-LEC-2605', 'Bodega PM'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:huevos'), v_business_id, cat_ing_lacteos, pg_temp.seed_uuid(v_business_id, 'sanitary:eggs'), pg_temp.seed_uuid(v_business_id, 'supplier:lacteos-artesanos'), 'Huevos', 'unidad', 'unidad', 240, 240.0000, 100, 180, 36, 240, current_date - 2, 18, 'Refrigerado', 'Mantener en bandeja original.', '2 C a 5 C', 2, 5, 4.2, 'Alto', '#FFF3CD', 'Crema', 'LAC-027', 'LAS-HUE-27', 'Camara lacteos', current_date - 2, current_date + 14, 'LOT-HUE-2605', 'Bodega PM'),

    (pg_temp.seed_uuid(v_business_id, 'ingredient:aceite-oliva'), v_business_id, cat_ing_bodega, pg_temp.seed_uuid(v_business_id, 'sanitary:drygoods'), pg_temp.seed_uuid(v_business_id, 'supplier:bodega-chef'), 'Aceite de oliva', 'litro', 'ml', 7600, 7.6000, 100, 18, 4, 24, current_date - 4, 365, 'Seco', 'Mantener lejos de la luz.', '15 C a 25 C', 15, 25, 20.0, 'Bajo', '#424242', 'Gris oscuro', 'BOD-028', 'BCS-ACO-28', 'Secos premium', current_date - 4, current_date + 300, 'LOT-ACO-2605', 'Bodega seca'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:sal-cahuil'), v_business_id, cat_ing_algas, pg_temp.seed_uuid(v_business_id, 'sanitary:drygoods'), pg_temp.seed_uuid(v_business_id, 'supplier:algas-pacifico'), 'Sal de Cahuil', 'kg', 'g', 1800, 1.8000, 100, 8, 1.5, 12, current_date - 4, 365, 'Seco', 'Mantener cerrada y seca.', '15 C a 25 C', 15, 25, 20.0, 'Bajo', '#424242', 'Gris oscuro', 'BOD-029', 'ADP-SAL-29', 'Secos premium', current_date - 4, current_date + 300, 'LOT-SAL-2605', 'Bodega seca'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:pimienta-blanca'), v_business_id, cat_ing_bodega, pg_temp.seed_uuid(v_business_id, 'sanitary:drygoods'), pg_temp.seed_uuid(v_business_id, 'supplier:bodega-chef'), 'Pimienta blanca', 'kg', 'g', 22000, 22.0000, 100, 1, 0.2, 2, current_date - 4, 365, 'Seco', 'Mantener cerrada.', '15 C a 25 C', 15, 25, 20.0, 'Bajo', '#424242', 'Gris oscuro', 'BOD-030', 'BCS-PIM-30', 'Secos premium', current_date - 4, current_date + 300, 'LOT-PIM-2605', 'Bodega seca'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:caldo-pescado-concentrado'), v_business_id, cat_ing_bodega, pg_temp.seed_uuid(v_business_id, 'sanitary:drygoods'), pg_temp.seed_uuid(v_business_id, 'supplier:bodega-chef'), 'Caldo de pescado concentrado', 'litro', 'ml', 9500, 9.5000, 100, 10, 2, 14, current_date - 4, 180, 'Seco', 'Mantener cerrado y rotulado.', '15 C a 25 C', 15, 25, 20.0, 'Bajo', '#424242', 'Gris oscuro', 'BOD-031', 'BCS-CAL-31', 'Secos premium', current_date - 4, current_date + 150, 'LOT-CAL-2605', 'Bodega seca'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:pan-brioche'), v_business_id, cat_ing_bodega, pg_temp.seed_uuid(v_business_id, 'sanitary:bakery'), pg_temp.seed_uuid(v_business_id, 'supplier:bodega-chef'), 'Pan brioche individual', 'unidad', 'unidad', 650, 650.0000, 100, 120, 24, 160, current_date - 1, 3, 'Seco', 'Mantener protegido de humedad.', '15 C a 25 C', 15, 25, 20.0, 'Bajo/Medio', '#795548', 'Cafe', 'BOD-032', 'BCS-BRI-32', 'Panaderia premium', current_date - 1, current_date + 2, 'LOT-BRI-2605', 'Panaderia'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:panko'), v_business_id, cat_ing_bodega, pg_temp.seed_uuid(v_business_id, 'sanitary:drygoods'), pg_temp.seed_uuid(v_business_id, 'supplier:bodega-chef'), 'Panko', 'kg', 'g', 3200, 3.2000, 100, 8, 1.5, 12, current_date - 4, 180, 'Seco', 'Mantener en contenedor seco.', '15 C a 25 C', 15, 25, 20.0, 'Bajo', '#424242', 'Gris oscuro', 'BOD-033', 'BCS-PAN-33', 'Secos premium', current_date - 4, current_date + 150, 'LOT-PAN-2605', 'Bodega seca'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:azucar'), v_business_id, cat_ing_bodega, pg_temp.seed_uuid(v_business_id, 'sanitary:drygoods'), pg_temp.seed_uuid(v_business_id, 'supplier:bodega-chef'), 'Azucar granulada', 'kg', 'g', 1400, 1.4000, 100, 10, 2, 16, current_date - 4, 365, 'Seco', 'Mantener seca y ventilada.', '15 C a 25 C', 15, 25, 20.0, 'Bajo', '#424242', 'Gris oscuro', 'BOD-034', 'BCS-AZU-34', 'Secos premium', current_date - 4, current_date + 300, 'LOT-AZU-2605', 'Bodega seca'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:vainilla'), v_business_id, cat_ing_bodega, pg_temp.seed_uuid(v_business_id, 'sanitary:drygoods'), pg_temp.seed_uuid(v_business_id, 'supplier:bodega-chef'), 'Extracto de vainilla', 'litro', 'ml', 15500, 15.5000, 100, 1, 0.2, 2, current_date - 4, 365, 'Seco', 'Mantener lejos del calor.', '15 C a 25 C', 15, 25, 20.0, 'Bajo', '#424242', 'Gris oscuro', 'BOD-035', 'BCS-VAI-35', 'Secos premium', current_date - 4, current_date + 300, 'LOT-VAI-2605', 'Bodega seca'),
    (pg_temp.seed_uuid(v_business_id, 'ingredient:gelatina'), v_business_id, cat_ing_bodega, pg_temp.seed_uuid(v_business_id, 'sanitary:drygoods'), pg_temp.seed_uuid(v_business_id, 'supplier:bodega-chef'), 'Gelatina sin sabor', 'kg', 'g', 24000, 24.0000, 100, 1, 0.2, 2, current_date - 4, 365, 'Seco', 'Mantener sellada.', '15 C a 25 C', 15, 25, 20.0, 'Bajo', '#424242', 'Gris oscuro', 'BOD-036', 'BCS-GEL-36', 'Secos premium', current_date - 4, current_date + 300, 'LOT-GEL-2605', 'Bodega seca'),

    (pg_temp.seed_uuid(v_business_id, 'ingredient:vino-blanco-seco'), v_business_id, cat_ing_bebidas, pg_temp.seed_uuid(v_business_id, 'sanitary:drygoods'), pg_temp.seed_uuid(v_business_id, 'supplier:cava-litoral'), 'Vino blanco seco', 'litro', 'ml', 5200, 5.2000, 100, 18, 4, 24, current_date - 4, 365, 'Seco', 'Botellas cerradas en cava ventilada.', '15 C a 25 C', 15, 25, 19.0, 'Bajo', '#424242', 'Gris oscuro', 'BEB-037', 'CVL-VBL-37', 'Cava de servicio', current_date - 4, current_date + 300, 'LOT-VBL-2605', 'Bodega seca')
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
    (pg_temp.seed_uuid(v_business_id, 'yield:corvina'), v_business_id, pg_temp.seed_uuid(v_business_id, 'ingredient:corvina-filete'), current_date - 1, 1, 0.92, 0.88, 0.88, 12, 88, 'Operacional', 0.05, 0, 0, 0.03, 0.04, 0, 0, 'Recorte fino y porcionado premium.'),
    (pg_temp.seed_uuid(v_business_id, 'yield:congrio'), v_business_id, pg_temp.seed_uuid(v_business_id, 'ingredient:congrio-dorado'), current_date - 1, 1, 0.88, 0.82, 0.82, 18, 82, 'Operacional', 0.08, 0, 0.04, 0.02, 0.04, 0, 0, 'Limpieza de espina y porcionado.'),
    (pg_temp.seed_uuid(v_business_id, 'yield:machas'), v_business_id, pg_temp.seed_uuid(v_business_id, 'ingredient:machas-limpias'), current_date - 1, 1, 0.60, 0.55, 0.55, 45, 55, 'Limpieza', 0, 0, 0, 0.10, 0.35, 0, 0, 'Merma de concha y jugo de purga.'),
    (pg_temp.seed_uuid(v_business_id, 'yield:almejas'), v_business_id, pg_temp.seed_uuid(v_business_id, 'ingredient:almejas-limpias'), current_date - 1, 1, 0.48, 0.45, 0.45, 55, 45, 'Limpieza', 0, 0, 0, 0.10, 0.45, 0, 0, 'Merma por limpieza y concha.'),
    (pg_temp.seed_uuid(v_business_id, 'yield:cochayuyo'), v_business_id, pg_temp.seed_uuid(v_business_id, 'ingredient:cochayuyo-premium'), current_date - 2, 1, 0.86, 0.80, 0.80, 20, 80, 'Limpieza', 0.08, 0.04, 0, 0, 0.08, 0, 0, 'Hidratacion, limpieza y corte fino.')
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
    (pg_temp.seed_uuid(v_business_id, 'recipe:leche-tigre-premium'), v_business_id, cat_dish_crudos, 'base', 'Leche de tigre premium', 1200, 'ml', 'ml', 25, pg_temp.seed_uuid(v_business_id, 'labor:partida-fria'), 18, 'Procesar base citrica, colar fino y mantener muy fria.', 'Acidez limpia, picor sutil y textura ligera.', array['Pescado'], 'Base de crudos marinos.'),
    (pg_temp.seed_uuid(v_business_id, 'recipe:aceite-cilantro'), v_business_id, cat_dish_crudos, 'base', 'Aceite de cilantro', 280, 'ml', 'ml', 12, pg_temp.seed_uuid(v_business_id, 'labor:partida-fria'), 8, 'Blanquear, procesar, colar y enfriar.', 'Color verde brillante y sin amargor.', array[]::text[], 'Terminacion de crudos y frios.'),
    (pg_temp.seed_uuid(v_business_id, 'recipe:vinagreta-hinojo'), v_business_id, cat_dish_frios, 'base', 'Vinagreta de hinojo y limon', 950, 'ml', 'ml', 15, pg_temp.seed_uuid(v_business_id, 'labor:partida-fria'), 10, 'Mezclar citricos, aceite y vegetales finos.', 'Equilibrio entre frescor, grasa y salinidad.', array[]::text[], 'Base fria para machas, almejas y tartares.'),
    (pg_temp.seed_uuid(v_business_id, 'recipe:mantequilla-cochayuyo'), v_business_id, cat_dish_calientes, 'base', 'Mantequilla de cochayuyo', 850, 'g', 'g', 20, pg_temp.seed_uuid(v_business_id, 'labor:partida-caliente'), 15, 'Reducir vino, integrar cochayuyo y montar mantequilla.', 'Brillo, salinidad y textura emulsionada.', array['Lacteos'], 'Salsa de fondo marino premium.'),
    (pg_temp.seed_uuid(v_business_id, 'recipe:fondo-corto-marino'), v_business_id, cat_dish_fondos, 'base', 'Fondo corto marino', 2200, 'ml', 'ml', 45, pg_temp.seed_uuid(v_business_id, 'labor:partida-caliente'), 30, 'Sudado aromatico, vino blanco, caldo y reduccion controlada.', 'Fondo limpio, salino y sin turbidez.', array['Pescado'], 'Base de coccion y salseo.'),
    (pg_temp.seed_uuid(v_business_id, 'recipe:pil-pil-marino'), v_business_id, cat_dish_calientes, 'base', 'Pil pil marino', 1800, 'g', 'g', 18, pg_temp.seed_uuid(v_business_id, 'labor:partida-caliente'), 12, 'Saltear mariscos y ligar con mantequilla, vino y ajo.', 'Marisco jugoso y salsa corta brillante.', array['Mariscos', 'Lacteos'], 'Base del caliente premium.'),
    (pg_temp.seed_uuid(v_business_id, 'recipe:chupe-centolla'), v_business_id, cat_dish_calientes, 'base', 'Chupe de centolla', 2800, 'g', 'g', 50, pg_temp.seed_uuid(v_business_id, 'labor:partida-caliente'), 35, 'Sudar base, ligar con lacteos y gratinar al pase.', 'Cremosidad alta, centolla protagonista y gratinado limpio.', array['Crustaceos', 'Lacteos', 'Gluten'], 'Base del chupe premium.'),
    (pg_temp.seed_uuid(v_business_id, 'recipe:pure-coliflor'), v_business_id, cat_dish_fondos, 'base', 'Pure de coliflor', 2200, 'g', 'g', 28, pg_temp.seed_uuid(v_business_id, 'labor:partida-caliente'), 18, 'Cocer, escurrir y emulsionar con lacteos.', 'Textura sedosa y sabor suave.', array['Lacteos'], 'Guarnicion de reineta.'),
    (pg_temp.seed_uuid(v_business_id, 'recipe:panacota-limon'), v_business_id, cat_dish_postres, 'base', 'Panacota de limon sutil', 1800, 'g', 'g', 25, pg_temp.seed_uuid(v_business_id, 'labor:pastelero'), 18, 'Calentar lacteos, gelificar y porcionar.', 'Cuajo limpio, frescor citrico elegante.', array['Lacteos'], 'Postre ligero de cierre.'),
    (pg_temp.seed_uuid(v_business_id, 'recipe:leche-asada-vainilla'), v_business_id, cat_dish_postres, 'base', 'Leche asada de vainilla', 1800, 'g', 'g', 35, pg_temp.seed_uuid(v_business_id, 'labor:pastelero'), 24, 'Mezclar, hornear a baja temperatura y enfriar.', 'Textura firme, caramelizacion pareja.', array['Huevos', 'Lacteos'], 'Postre tradicional refinado.')
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
      pg_temp.seed_uuid(v_business_id, 'recipe:leche-tigre-premium'),
      pg_temp.seed_uuid(v_business_id, 'recipe:aceite-cilantro'),
      pg_temp.seed_uuid(v_business_id, 'recipe:vinagreta-hinojo'),
      pg_temp.seed_uuid(v_business_id, 'recipe:mantequilla-cochayuyo'),
      pg_temp.seed_uuid(v_business_id, 'recipe:fondo-corto-marino'),
      pg_temp.seed_uuid(v_business_id, 'recipe:pil-pil-marino'),
      pg_temp.seed_uuid(v_business_id, 'recipe:chupe-centolla'),
      pg_temp.seed_uuid(v_business_id, 'recipe:pure-coliflor'),
      pg_temp.seed_uuid(v_business_id, 'recipe:panacota-limon'),
      pg_temp.seed_uuid(v_business_id, 'recipe:leche-asada-vainilla')
    );

  insert into public.recipe_items (id, business_id, recipe_id, ingredient_id, quantity, unit, waste_percent)
  values
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:leche-tigre:corvina'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:leche-tigre-premium'), pg_temp.seed_uuid(v_business_id, 'ingredient:corvina-filete'), 300, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:leche-tigre:limon'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:leche-tigre-premium'), pg_temp.seed_uuid(v_business_id, 'ingredient:limon-sutil'), 260, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:leche-tigre:pomelo'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:leche-tigre-premium'), pg_temp.seed_uuid(v_business_id, 'ingredient:pomelo-rosado'), 120, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:leche-tigre:cebolla'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:leche-tigre-premium'), pg_temp.seed_uuid(v_business_id, 'ingredient:cebolla-morada'), 180, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:leche-tigre:cilantro'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:leche-tigre-premium'), pg_temp.seed_uuid(v_business_id, 'ingredient:cilantro'), 20, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:leche-tigre:aji'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:leche-tigre-premium'), pg_temp.seed_uuid(v_business_id, 'ingredient:aji-verde'), 35, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:leche-tigre:caldo'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:leche-tigre-premium'), pg_temp.seed_uuid(v_business_id, 'ingredient:caldo-pescado-concentrado'), 150, 'ml', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:leche-tigre:sal'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:leche-tigre-premium'), pg_temp.seed_uuid(v_business_id, 'ingredient:sal-cahuil'), 10, 'g', 0),

    (pg_temp.seed_uuid(v_business_id, 'recipe-item:aceite-cilantro:cilantro'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:aceite-cilantro'), pg_temp.seed_uuid(v_business_id, 'ingredient:cilantro'), 60, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:aceite-cilantro:aceite'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:aceite-cilantro'), pg_temp.seed_uuid(v_business_id, 'ingredient:aceite-oliva'), 250, 'ml', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:aceite-cilantro:limon'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:aceite-cilantro'), pg_temp.seed_uuid(v_business_id, 'ingredient:limon-sutil'), 20, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:aceite-cilantro:sal'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:aceite-cilantro'), pg_temp.seed_uuid(v_business_id, 'ingredient:sal-cahuil'), 4, 'g', 0),

    (pg_temp.seed_uuid(v_business_id, 'recipe-item:vinagreta:hinojo'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:vinagreta-hinojo'), pg_temp.seed_uuid(v_business_id, 'ingredient:hinojo'), 250, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:vinagreta:limon'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:vinagreta-hinojo'), pg_temp.seed_uuid(v_business_id, 'ingredient:limon-sutil'), 160, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:vinagreta:aceite'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:vinagreta-hinojo'), pg_temp.seed_uuid(v_business_id, 'ingredient:aceite-oliva'), 350, 'ml', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:vinagreta:cilantro'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:vinagreta-hinojo'), pg_temp.seed_uuid(v_business_id, 'ingredient:cilantro'), 20, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:vinagreta:cebolla'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:vinagreta-hinojo'), pg_temp.seed_uuid(v_business_id, 'ingredient:cebolla-morada'), 80, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:vinagreta:sal'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:vinagreta-hinojo'), pg_temp.seed_uuid(v_business_id, 'ingredient:sal-cahuil'), 10, 'g', 0),

    (pg_temp.seed_uuid(v_business_id, 'recipe-item:mantequilla:butter'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:mantequilla-cochayuyo'), pg_temp.seed_uuid(v_business_id, 'ingredient:mantequilla-premium'), 700, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:mantequilla:cochayuyo'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:mantequilla-cochayuyo'), pg_temp.seed_uuid(v_business_id, 'ingredient:cochayuyo-premium'), 120, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:mantequilla:vino'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:mantequilla-cochayuyo'), pg_temp.seed_uuid(v_business_id, 'ingredient:vino-blanco-seco'), 100, 'ml', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:mantequilla:limon'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:mantequilla-cochayuyo'), pg_temp.seed_uuid(v_business_id, 'ingredient:limon-sutil'), 40, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:mantequilla:ajo'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:mantequilla-cochayuyo'), pg_temp.seed_uuid(v_business_id, 'ingredient:ajo'), 20, 'g', 0),

    (pg_temp.seed_uuid(v_business_id, 'recipe-item:fondo:congrio'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:fondo-corto-marino'), pg_temp.seed_uuid(v_business_id, 'ingredient:congrio-dorado'), 500, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:fondo:vino'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:fondo-corto-marino'), pg_temp.seed_uuid(v_business_id, 'ingredient:vino-blanco-seco'), 350, 'ml', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:fondo:hinojo'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:fondo-corto-marino'), pg_temp.seed_uuid(v_business_id, 'ingredient:hinojo'), 250, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:fondo:cebolla'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:fondo-corto-marino'), pg_temp.seed_uuid(v_business_id, 'ingredient:cebolla-morada'), 200, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:fondo:ajo'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:fondo-corto-marino'), pg_temp.seed_uuid(v_business_id, 'ingredient:ajo'), 30, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:fondo:cilantro'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:fondo-corto-marino'), pg_temp.seed_uuid(v_business_id, 'ingredient:cilantro'), 30, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:fondo:caldo'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:fondo-corto-marino'), pg_temp.seed_uuid(v_business_id, 'ingredient:caldo-pescado-concentrado'), 300, 'ml', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:fondo:sal'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:fondo-corto-marino'), pg_temp.seed_uuid(v_business_id, 'ingredient:sal-cahuil'), 12, 'g', 0),

    (pg_temp.seed_uuid(v_business_id, 'recipe-item:pilpil:ostiones'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:pil-pil-marino'), pg_temp.seed_uuid(v_business_id, 'ingredient:ostiones-limpios'), 700, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:pilpil:machas'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:pil-pil-marino'), pg_temp.seed_uuid(v_business_id, 'ingredient:machas-limpias'), 450, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:pilpil:butter'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:pil-pil-marino'), pg_temp.seed_uuid(v_business_id, 'ingredient:mantequilla-premium'), 220, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:pilpil:wine'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:pil-pil-marino'), pg_temp.seed_uuid(v_business_id, 'ingredient:vino-blanco-seco'), 200, 'ml', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:pilpil:ajo'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:pil-pil-marino'), pg_temp.seed_uuid(v_business_id, 'ingredient:ajo'), 30, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:pilpil:aji'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:pil-pil-marino'), pg_temp.seed_uuid(v_business_id, 'ingredient:aji-verde'), 30, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:pilpil:cilantro'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:pil-pil-marino'), pg_temp.seed_uuid(v_business_id, 'ingredient:cilantro'), 20, 'g', 0),

    (pg_temp.seed_uuid(v_business_id, 'recipe-item:chupe:centolla'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:chupe-centolla'), pg_temp.seed_uuid(v_business_id, 'ingredient:centolla-cocida'), 850, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:chupe:crema'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:chupe-centolla'), pg_temp.seed_uuid(v_business_id, 'ingredient:crema-fresca'), 1000, 'ml', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:chupe:leche'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:chupe-centolla'), pg_temp.seed_uuid(v_business_id, 'ingredient:leche-entera'), 500, 'ml', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:chupe:butter'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:chupe-centolla'), pg_temp.seed_uuid(v_business_id, 'ingredient:mantequilla-premium'), 120, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:chupe:cebolla'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:chupe-centolla'), pg_temp.seed_uuid(v_business_id, 'ingredient:cebolla-morada'), 220, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:chupe:ajo'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:chupe-centolla'), pg_temp.seed_uuid(v_business_id, 'ingredient:ajo'), 25, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:chupe:brioche'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:chupe-centolla'), pg_temp.seed_uuid(v_business_id, 'ingredient:pan-brioche'), 4, 'unidad', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:chupe:parmesano'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:chupe-centolla'), pg_temp.seed_uuid(v_business_id, 'ingredient:parmesano'), 180, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:chupe:vino'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:chupe-centolla'), pg_temp.seed_uuid(v_business_id, 'ingredient:vino-blanco-seco'), 120, 'ml', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:chupe:panko'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:chupe-centolla'), pg_temp.seed_uuid(v_business_id, 'ingredient:panko'), 80, 'g', 0),

    (pg_temp.seed_uuid(v_business_id, 'recipe-item:pure:coliflor'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:pure-coliflor'), pg_temp.seed_uuid(v_business_id, 'ingredient:coliflor'), 2200, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:pure:crema'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:pure-coliflor'), pg_temp.seed_uuid(v_business_id, 'ingredient:crema-fresca'), 350, 'ml', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:pure:butter'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:pure-coliflor'), pg_temp.seed_uuid(v_business_id, 'ingredient:mantequilla-premium'), 80, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:pure:sal'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:pure-coliflor'), pg_temp.seed_uuid(v_business_id, 'ingredient:sal-cahuil'), 10, 'g', 0),

    (pg_temp.seed_uuid(v_business_id, 'recipe-item:panacota:crema'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:panacota-limon'), pg_temp.seed_uuid(v_business_id, 'ingredient:crema-fresca'), 1200, 'ml', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:panacota:leche'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:panacota-limon'), pg_temp.seed_uuid(v_business_id, 'ingredient:leche-entera'), 500, 'ml', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:panacota:azucar'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:panacota-limon'), pg_temp.seed_uuid(v_business_id, 'ingredient:azucar'), 180, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:panacota:gelatina'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:panacota-limon'), pg_temp.seed_uuid(v_business_id, 'ingredient:gelatina'), 28, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:panacota:vainilla'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:panacota-limon'), pg_temp.seed_uuid(v_business_id, 'ingredient:vainilla'), 18, 'ml', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:panacota:limon'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:panacota-limon'), pg_temp.seed_uuid(v_business_id, 'ingredient:limon-sutil'), 70, 'g', 0),

    (pg_temp.seed_uuid(v_business_id, 'recipe-item:leche-asada:leche'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:leche-asada-vainilla'), pg_temp.seed_uuid(v_business_id, 'ingredient:leche-entera'), 1500, 'ml', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:leche-asada:huevos'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:leche-asada-vainilla'), pg_temp.seed_uuid(v_business_id, 'ingredient:huevos'), 12, 'unidad', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:leche-asada:azucar'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:leche-asada-vainilla'), pg_temp.seed_uuid(v_business_id, 'ingredient:azucar'), 240, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:leche-asada:vainilla'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:leche-asada-vainilla'), pg_temp.seed_uuid(v_business_id, 'ingredient:vainilla'), 20, 'ml', 0),
    (pg_temp.seed_uuid(v_business_id, 'recipe-item:leche-asada:sal'), v_business_id, pg_temp.seed_uuid(v_business_id, 'recipe:leche-asada-vainilla'), pg_temp.seed_uuid(v_business_id, 'ingredient:sal-cahuil'), 4, 'g', 0);

  insert into public.dishes (
    id, business_id, category_id, name, service, labor_profile_id, labor_minutes,
    indirect_cost_share, target_food_cost, desired_margin, allergens, plating_notes,
    quality_checklist, technical_notes, shelf_life_hours, sales_count, image_url
  )
  values
    (pg_temp.seed_uuid(v_business_id, 'dish:ostiones-leche-tigre'), v_business_id, cat_dish_crudos, 'Ostiones crudos, leche de tigre y aceite de cilantro', 'Cena', pg_temp.seed_uuid(v_business_id, 'labor:partida-fria'), 8, 1.0, 0.30, 0.75, array['Mariscos', 'Pescado'], 'Servir muy frio, ostion entero y gotas controladas de aceite.', array['120 g ostiones', 'Leche de tigre cristalina', 'Plato helado'], 'Crudo premium de apertura.', 2, 24, null),
    (pg_temp.seed_uuid(v_business_id, 'dish:tostada-erizo'), v_business_id, cat_dish_crudos, 'Tostada de brioche con erizo y mantequilla de cochayuyo', 'Cena', pg_temp.seed_uuid(v_business_id, 'labor:partida-fria'), 7, 1.0, 0.30, 0.75, array['Mariscos', 'Lacteos', 'Gluten'], 'Brioche tibio, erizo fresco y acabado brillante.', array['1 brioche', '45 g erizo', '12 g mantequilla'], 'Bocado costero de alto ticket.', 2, 18, null),
    (pg_temp.seed_uuid(v_business_id, 'dish:tiradito-reineta'), v_business_id, cat_dish_crudos, 'Tiradito de reineta, pomelo y hinojo', 'Cena', pg_temp.seed_uuid(v_business_id, 'labor:partida-fria'), 8, 1.0, 0.30, 0.75, array['Pescado'], 'Laminado fino, acidez precisa y hinojo crocante.', array['120 g reineta', 'Pomelo fileteado', 'Emplatado lineal'], 'Crudo citrico de perfil elegante.', 3, 22, null),
    (pg_temp.seed_uuid(v_business_id, 'dish:ceviche-corvina'), v_business_id, cat_dish_crudos, 'Ceviche de corvina y aji verde', 'Cena', pg_temp.seed_uuid(v_business_id, 'labor:partida-fria'), 9, 1.0, 0.30, 0.75, array['Pescado'], 'Cubos regulares, acidez viva y picor moderado.', array['130 g corvina', '70 ml leche de tigre', 'Cebolla fresca'], 'Ceviche premium de carta corta.', 3, 20, null),

    (pg_temp.seed_uuid(v_business_id, 'dish:machas-vinagreta'), v_business_id, cat_dish_frios, 'Machas con vinagreta de hinojo y limon', 'Cena', pg_temp.seed_uuid(v_business_id, 'labor:partida-fria'), 7, 1.0, 0.31, 0.75, array['Mariscos'], 'Macha bien limpia, vinagreta apenas ligada.', array['140 g machas', '30 ml vinagreta'], 'Frio marino de alta rotacion.', 3, 16, null),
    (pg_temp.seed_uuid(v_business_id, 'dish:almejas-pepino'), v_business_id, cat_dish_frios, 'Almejas frescas, pepino y sal de Cahuil', 'Cena', pg_temp.seed_uuid(v_business_id, 'labor:partida-fria'), 7, 1.0, 0.31, 0.75, array['Mariscos'], 'Montaje limpio, pepino crocante y sal final.', array['140 g almejas', 'Pepino fino'], 'Frio salino y refrescante.', 3, 14, null),
    (pg_temp.seed_uuid(v_business_id, 'dish:tartar-centolla'), v_business_id, cat_dish_frios, 'Tartar de centolla, palta y pepino', 'Cena', pg_temp.seed_uuid(v_business_id, 'labor:partida-fria'), 10, 1.1, 0.31, 0.75, array['Crustaceos'], 'Molde compacto y hierbas finas al pase.', array['100 g centolla', '45 g palta', 'Aliño sutil'], 'Entrada fria premium.', 4, 18, null),

    (pg_temp.seed_uuid(v_business_id, 'dish:pilpil-ostiones-machas'), v_business_id, cat_dish_calientes, 'Pil pil de ostiones y machas', 'Cena', pg_temp.seed_uuid(v_business_id, 'labor:partida-caliente'), 11, 1.2, 0.33, 0.75, array['Mariscos', 'Lacteos'], 'Sarten corta, marisco jugoso y salsa emulsionada.', array['260 g base pil pil', 'Calor alto y corto'], 'Caliente premium de mariscos.', 2, 19, null),
    (pg_temp.seed_uuid(v_business_id, 'dish:chupe-centolla-gratinado'), v_business_id, cat_dish_calientes, 'Chupe gratinado de centolla', 'Cena', pg_temp.seed_uuid(v_business_id, 'labor:partida-caliente'), 12, 1.2, 0.33, 0.75, array['Crustaceos', 'Lacteos', 'Gluten'], 'Costra dorada, interior cremoso y centolla visible.', array['320 g chupe', 'Gratinado parejo'], 'Caliente de confort premium.', 4, 17, null),
    (pg_temp.seed_uuid(v_business_id, 'dish:ostiones-gratinados'), v_business_id, cat_dish_calientes, 'Ostiones gratinados con parmesano', 'Cena', pg_temp.seed_uuid(v_business_id, 'labor:partida-caliente'), 9, 1.1, 0.33, 0.75, array['Mariscos', 'Lacteos', 'Gluten'], 'Gratinado rapido para no sobrecocer.', array['150 g ostiones', 'Parmesano justo'], 'Caliente corto de barra premium.', 2, 15, null),

    (pg_temp.seed_uuid(v_business_id, 'dish:congrio-cochayuyo'), v_business_id, cat_dish_fondos, 'Congrio dorado con mantequilla de cochayuyo y papa chilota', 'Cena', pg_temp.seed_uuid(v_business_id, 'labor:partida-caliente'), 16, 1.4, 0.36, 0.75, array['Pescado', 'Lacteos'], 'Punto nacarado, salsa brillante y papa glaseada.', array['220 g congrio', '45 g mantequilla', '180 g papa'], 'Fondo marino de firma.', 4, 26, null),
    (pg_temp.seed_uuid(v_business_id, 'dish:reineta-fondo-corto'), v_business_id, cat_dish_fondos, 'Reineta en fondo corto con pure de coliflor', 'Cena', pg_temp.seed_uuid(v_business_id, 'labor:partida-caliente'), 15, 1.3, 0.36, 0.75, array['Pescado', 'Lacteos'], 'Pescado sellado suave, pure sedoso y salsa corta.', array['210 g reineta', '70 ml fondo', '130 g pure'], 'Fondo elegante de baja grasa.', 4, 24, null),
    (pg_temp.seed_uuid(v_business_id, 'dish:merluza-austral-almejas'), v_business_id, cat_dish_fondos, 'Merluza austral con almejas y fondo corto marino', 'Cena', pg_temp.seed_uuid(v_business_id, 'labor:partida-caliente'), 16, 1.3, 0.36, 0.75, array['Pescado', 'Mariscos'], 'Merluza brillante, almejas abiertas y fondo limpio.', array['210 g merluza', '90 g almejas'], 'Fondo delicado de estilo costero.', 3, 21, null),

    (pg_temp.seed_uuid(v_business_id, 'dish:panacota-limon'), v_business_id, cat_dish_postres, 'Panacota de limon sutil', 'Cena', pg_temp.seed_uuid(v_business_id, 'labor:pastelero'), 5, 0.9, 0.24, 0.75, array['Lacteos'], 'Servir muy fria y desmoldado limpio.', array['140 g panacota', 'Textura temblorosa'], 'Postre fresco de carta premium.', 12, 18, null),
    (pg_temp.seed_uuid(v_business_id, 'dish:leche-asada-vainilla'), v_business_id, cat_dish_postres, 'Leche asada de vainilla', 'Cena', pg_temp.seed_uuid(v_business_id, 'labor:pastelero'), 6, 0.9, 0.24, 0.75, array['Huevos', 'Lacteos'], 'Cubos limpios y caramelizacion pareja.', array['160 g porcion', 'Caramelo uniforme'], 'Postre tradicional de cierre.', 18, 16, null)
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
      pg_temp.seed_uuid(v_business_id, 'dish:ostiones-leche-tigre'),
      pg_temp.seed_uuid(v_business_id, 'dish:tostada-erizo'),
      pg_temp.seed_uuid(v_business_id, 'dish:tiradito-reineta'),
      pg_temp.seed_uuid(v_business_id, 'dish:ceviche-corvina'),
      pg_temp.seed_uuid(v_business_id, 'dish:machas-vinagreta'),
      pg_temp.seed_uuid(v_business_id, 'dish:almejas-pepino'),
      pg_temp.seed_uuid(v_business_id, 'dish:tartar-centolla'),
      pg_temp.seed_uuid(v_business_id, 'dish:pilpil-ostiones-machas'),
      pg_temp.seed_uuid(v_business_id, 'dish:chupe-centolla-gratinado'),
      pg_temp.seed_uuid(v_business_id, 'dish:ostiones-gratinados'),
      pg_temp.seed_uuid(v_business_id, 'dish:congrio-cochayuyo'),
      pg_temp.seed_uuid(v_business_id, 'dish:reineta-fondo-corto'),
      pg_temp.seed_uuid(v_business_id, 'dish:merluza-austral-almejas'),
      pg_temp.seed_uuid(v_business_id, 'dish:panacota-limon'),
      pg_temp.seed_uuid(v_business_id, 'dish:leche-asada-vainilla')
    );

  insert into public.dish_components (id, business_id, dish_id, component_type, ref_id, quantity, unit, waste_percent)
  values
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:ostiones:ostiones'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:ostiones-leche-tigre'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:ostiones-limpios'), 120, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:ostiones:leche-tigre'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:ostiones-leche-tigre'), 'baseRecipe', pg_temp.seed_uuid(v_business_id, 'recipe:leche-tigre-premium'), 60, 'ml', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:ostiones:aceite'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:ostiones-leche-tigre'), 'baseRecipe', pg_temp.seed_uuid(v_business_id, 'recipe:aceite-cilantro'), 5, 'ml', 0),

    (pg_temp.seed_uuid(v_business_id, 'dishcomp:erizo:brioche'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:tostada-erizo'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:pan-brioche'), 1, 'unidad', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:erizo:erizo'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:tostada-erizo'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:erizo-fresco'), 45, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:erizo:mantequilla'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:tostada-erizo'), 'baseRecipe', pg_temp.seed_uuid(v_business_id, 'recipe:mantequilla-cochayuyo'), 12, 'g', 0),

    (pg_temp.seed_uuid(v_business_id, 'dishcomp:tiradito:reineta'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:tiradito-reineta'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:reineta-filete'), 120, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:tiradito:leche'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:tiradito-reineta'), 'baseRecipe', pg_temp.seed_uuid(v_business_id, 'recipe:leche-tigre-premium'), 45, 'ml', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:tiradito:pomelo'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:tiradito-reineta'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:pomelo-rosado'), 25, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:tiradito:hinojo'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:tiradito-reineta'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:hinojo'), 18, 'g', 0),

    (pg_temp.seed_uuid(v_business_id, 'dishcomp:ceviche:corvina'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:ceviche-corvina'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:corvina-filete'), 130, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:ceviche:leche'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:ceviche-corvina'), 'baseRecipe', pg_temp.seed_uuid(v_business_id, 'recipe:leche-tigre-premium'), 70, 'ml', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:ceviche:cebolla'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:ceviche-corvina'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:cebolla-morada'), 20, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:ceviche:cilantro'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:ceviche-corvina'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:cilantro'), 6, 'g', 0),

    (pg_temp.seed_uuid(v_business_id, 'dishcomp:machas:machas'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:machas-vinagreta'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:machas-limpias'), 140, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:machas:vinagreta'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:machas-vinagreta'), 'baseRecipe', pg_temp.seed_uuid(v_business_id, 'recipe:vinagreta-hinojo'), 30, 'ml', 0),

    (pg_temp.seed_uuid(v_business_id, 'dishcomp:almejas:almejas'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:almejas-pepino'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:almejas-limpias'), 140, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:almejas:pepino'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:almejas-pepino'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:pepino'), 40, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:almejas:vinagreta'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:almejas-pepino'), 'baseRecipe', pg_temp.seed_uuid(v_business_id, 'recipe:vinagreta-hinojo'), 20, 'ml', 0),

    (pg_temp.seed_uuid(v_business_id, 'dishcomp:tartar:centolla'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:tartar-centolla'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:centolla-cocida'), 100, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:tartar:palta'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:tartar-centolla'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:palta-hass'), 45, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:tartar:pepino'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:tartar-centolla'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:pepino'), 20, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:tartar:vinagreta'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:tartar-centolla'), 'baseRecipe', pg_temp.seed_uuid(v_business_id, 'recipe:vinagreta-hinojo'), 18, 'ml', 0),

    (pg_temp.seed_uuid(v_business_id, 'dishcomp:pilpil:base'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:pilpil-ostiones-machas'), 'baseRecipe', pg_temp.seed_uuid(v_business_id, 'recipe:pil-pil-marino'), 260, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:chupe:base'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:chupe-centolla-gratinado'), 'baseRecipe', pg_temp.seed_uuid(v_business_id, 'recipe:chupe-centolla'), 320, 'g', 0),

    (pg_temp.seed_uuid(v_business_id, 'dishcomp:ostiones-grat:ostiones'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:ostiones-gratinados'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:ostiones-limpios'), 150, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:ostiones-grat:crema'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:ostiones-gratinados'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:crema-fresca'), 40, 'ml', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:ostiones-grat:parmesano'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:ostiones-gratinados'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:parmesano'), 18, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:ostiones-grat:butter'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:ostiones-gratinados'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:mantequilla-premium'), 15, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:ostiones-grat:wine'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:ostiones-gratinados'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:vino-blanco-seco'), 20, 'ml', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:ostiones-grat:panko'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:ostiones-gratinados'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:panko'), 10, 'g', 0),

    (pg_temp.seed_uuid(v_business_id, 'dishcomp:congrio:congrio'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:congrio-cochayuyo'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:congrio-dorado'), 220, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:congrio:mantequilla'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:congrio-cochayuyo'), 'baseRecipe', pg_temp.seed_uuid(v_business_id, 'recipe:mantequilla-cochayuyo'), 45, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:congrio:fondo'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:congrio-cochayuyo'), 'baseRecipe', pg_temp.seed_uuid(v_business_id, 'recipe:fondo-corto-marino'), 40, 'ml', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:congrio:papa'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:congrio-cochayuyo'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:papa-chilota'), 180, 'g', 0),

    (pg_temp.seed_uuid(v_business_id, 'dishcomp:reineta:reineta'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:reineta-fondo-corto'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:reineta-filete'), 210, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:reineta:fondo'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:reineta-fondo-corto'), 'baseRecipe', pg_temp.seed_uuid(v_business_id, 'recipe:fondo-corto-marino'), 70, 'ml', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:reineta:pure'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:reineta-fondo-corto'), 'baseRecipe', pg_temp.seed_uuid(v_business_id, 'recipe:pure-coliflor'), 130, 'g', 0),

    (pg_temp.seed_uuid(v_business_id, 'dishcomp:merluza:merluza'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:merluza-austral-almejas'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:merluza-austral'), 210, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:merluza:almejas'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:merluza-austral-almejas'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:almejas-limpias'), 90, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:merluza:fondo'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:merluza-austral-almejas'), 'baseRecipe', pg_temp.seed_uuid(v_business_id, 'recipe:fondo-corto-marino'), 60, 'ml', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:merluza:hinojo'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:merluza-austral-almejas'), 'ingredient', pg_temp.seed_uuid(v_business_id, 'ingredient:hinojo'), 30, 'g', 0),

    (pg_temp.seed_uuid(v_business_id, 'dishcomp:panacota:base'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:panacota-limon'), 'baseRecipe', pg_temp.seed_uuid(v_business_id, 'recipe:panacota-limon'), 140, 'g', 0),
    (pg_temp.seed_uuid(v_business_id, 'dishcomp:leche-asada:base'), v_business_id, pg_temp.seed_uuid(v_business_id, 'dish:leche-asada-vainilla'), 'baseRecipe', pg_temp.seed_uuid(v_business_id, 'recipe:leche-asada-vainilla'), 160, 'g', 0);

  insert into public.menus (id, business_id, name)
  values
    (pg_temp.seed_uuid(v_business_id, 'menu:bahia-premium'), v_business_id, 'Menu Bahia Premium'),
    (pg_temp.seed_uuid(v_business_id, 'menu:roca-premium'), v_business_id, 'Menu Roca Premium'),
    (pg_temp.seed_uuid(v_business_id, 'menu:austral-premium'), v_business_id, 'Menu Austral Premium')
  on conflict (id) do update
  set name = excluded.name;

  insert into public.menu_categories (id, business_id, menu_id, category_id)
  values
    (pg_temp.seed_uuid(v_business_id, 'menucat:bahia:crudos'), v_business_id, pg_temp.seed_uuid(v_business_id, 'menu:bahia-premium'), cat_dish_crudos),
    (pg_temp.seed_uuid(v_business_id, 'menucat:bahia:frios'), v_business_id, pg_temp.seed_uuid(v_business_id, 'menu:bahia-premium'), cat_dish_frios),
    (pg_temp.seed_uuid(v_business_id, 'menucat:bahia:fondos'), v_business_id, pg_temp.seed_uuid(v_business_id, 'menu:bahia-premium'), cat_dish_fondos),
    (pg_temp.seed_uuid(v_business_id, 'menucat:bahia:postres'), v_business_id, pg_temp.seed_uuid(v_business_id, 'menu:bahia-premium'), cat_dish_postres),
    (pg_temp.seed_uuid(v_business_id, 'menucat:roca:crudos'), v_business_id, pg_temp.seed_uuid(v_business_id, 'menu:roca-premium'), cat_dish_crudos),
    (pg_temp.seed_uuid(v_business_id, 'menucat:roca:calientes'), v_business_id, pg_temp.seed_uuid(v_business_id, 'menu:roca-premium'), cat_dish_calientes),
    (pg_temp.seed_uuid(v_business_id, 'menucat:roca:fondos'), v_business_id, pg_temp.seed_uuid(v_business_id, 'menu:roca-premium'), cat_dish_fondos),
    (pg_temp.seed_uuid(v_business_id, 'menucat:roca:postres'), v_business_id, pg_temp.seed_uuid(v_business_id, 'menu:roca-premium'), cat_dish_postres),
    (pg_temp.seed_uuid(v_business_id, 'menucat:austral:crudos'), v_business_id, pg_temp.seed_uuid(v_business_id, 'menu:austral-premium'), cat_dish_crudos),
    (pg_temp.seed_uuid(v_business_id, 'menucat:austral:frios'), v_business_id, pg_temp.seed_uuid(v_business_id, 'menu:austral-premium'), cat_dish_frios),
    (pg_temp.seed_uuid(v_business_id, 'menucat:austral:fondos'), v_business_id, pg_temp.seed_uuid(v_business_id, 'menu:austral-premium'), cat_dish_fondos),
    (pg_temp.seed_uuid(v_business_id, 'menucat:austral:postres'), v_business_id, pg_temp.seed_uuid(v_business_id, 'menu:austral-premium'), cat_dish_postres)
  on conflict (id) do update
  set
    menu_id = excluded.menu_id,
    category_id = excluded.category_id;

  insert into public.menu_items (id, business_id, menu_id, dish_id)
  values
    (pg_temp.seed_uuid(v_business_id, 'menuitem:bahia:1'), v_business_id, pg_temp.seed_uuid(v_business_id, 'menu:bahia-premium'), pg_temp.seed_uuid(v_business_id, 'dish:ostiones-leche-tigre')),
    (pg_temp.seed_uuid(v_business_id, 'menuitem:bahia:2'), v_business_id, pg_temp.seed_uuid(v_business_id, 'menu:bahia-premium'), pg_temp.seed_uuid(v_business_id, 'dish:machas-vinagreta')),
    (pg_temp.seed_uuid(v_business_id, 'menuitem:bahia:3'), v_business_id, pg_temp.seed_uuid(v_business_id, 'menu:bahia-premium'), pg_temp.seed_uuid(v_business_id, 'dish:reineta-fondo-corto')),
    (pg_temp.seed_uuid(v_business_id, 'menuitem:bahia:4'), v_business_id, pg_temp.seed_uuid(v_business_id, 'menu:bahia-premium'), pg_temp.seed_uuid(v_business_id, 'dish:panacota-limon')),
    (pg_temp.seed_uuid(v_business_id, 'menuitem:roca:1'), v_business_id, pg_temp.seed_uuid(v_business_id, 'menu:roca-premium'), pg_temp.seed_uuid(v_business_id, 'dish:tiradito-reineta')),
    (pg_temp.seed_uuid(v_business_id, 'menuitem:roca:2'), v_business_id, pg_temp.seed_uuid(v_business_id, 'menu:roca-premium'), pg_temp.seed_uuid(v_business_id, 'dish:pilpil-ostiones-machas')),
    (pg_temp.seed_uuid(v_business_id, 'menuitem:roca:3'), v_business_id, pg_temp.seed_uuid(v_business_id, 'menu:roca-premium'), pg_temp.seed_uuid(v_business_id, 'dish:congrio-cochayuyo')),
    (pg_temp.seed_uuid(v_business_id, 'menuitem:roca:4'), v_business_id, pg_temp.seed_uuid(v_business_id, 'menu:roca-premium'), pg_temp.seed_uuid(v_business_id, 'dish:leche-asada-vainilla')),
    (pg_temp.seed_uuid(v_business_id, 'menuitem:austral:1'), v_business_id, pg_temp.seed_uuid(v_business_id, 'menu:austral-premium'), pg_temp.seed_uuid(v_business_id, 'dish:ceviche-corvina')),
    (pg_temp.seed_uuid(v_business_id, 'menuitem:austral:2'), v_business_id, pg_temp.seed_uuid(v_business_id, 'menu:austral-premium'), pg_temp.seed_uuid(v_business_id, 'dish:tartar-centolla')),
    (pg_temp.seed_uuid(v_business_id, 'menuitem:austral:3'), v_business_id, pg_temp.seed_uuid(v_business_id, 'menu:austral-premium'), pg_temp.seed_uuid(v_business_id, 'dish:merluza-austral-almejas')),
    (pg_temp.seed_uuid(v_business_id, 'menuitem:austral:4'), v_business_id, pg_temp.seed_uuid(v_business_id, 'menu:austral-premium'), pg_temp.seed_uuid(v_business_id, 'dish:panacota-limon'))
  on conflict (id) do update
  set
    menu_id = excluded.menu_id,
    dish_id = excluded.dish_id;

  insert into public.projections (id, business_id, name, period)
  values
    (pg_temp.seed_uuid(v_business_id, 'projection:invierno-premium'), v_business_id, 'Invierno mar premium', 'mes')
  on conflict (id) do update
  set
    name = excluded.name,
    period = excluded.period;

  delete from public.projection_days
  where business_id = v_business_id
    and projection_id = pg_temp.seed_uuid(v_business_id, 'projection:invierno-premium');

  insert into public.projection_days (id, business_id, projection_id, day_name, projected_customers, avg_food_ticket, avg_beverage_ticket)
  values
    (pg_temp.seed_uuid(v_business_id, 'projection-day:lun'), v_business_id, pg_temp.seed_uuid(v_business_id, 'projection:invierno-premium'), 'Lunes', 22, 42800, 14800),
    (pg_temp.seed_uuid(v_business_id, 'projection-day:mar'), v_business_id, pg_temp.seed_uuid(v_business_id, 'projection:invierno-premium'), 'Martes', 24, 43200, 15000),
    (pg_temp.seed_uuid(v_business_id, 'projection-day:mie'), v_business_id, pg_temp.seed_uuid(v_business_id, 'projection:invierno-premium'), 'Miercoles', 28, 43800, 15200),
    (pg_temp.seed_uuid(v_business_id, 'projection-day:jue'), v_business_id, pg_temp.seed_uuid(v_business_id, 'projection:invierno-premium'), 'Jueves', 32, 44600, 15800),
    (pg_temp.seed_uuid(v_business_id, 'projection-day:vie'), v_business_id, pg_temp.seed_uuid(v_business_id, 'projection:invierno-premium'), 'Viernes', 42, 45900, 16800),
    (pg_temp.seed_uuid(v_business_id, 'projection-day:sab'), v_business_id, pg_temp.seed_uuid(v_business_id, 'projection:invierno-premium'), 'Sabado', 48, 46900, 17500),
    (pg_temp.seed_uuid(v_business_id, 'projection-day:dom'), v_business_id, pg_temp.seed_uuid(v_business_id, 'projection:invierno-premium'), 'Domingo', 34, 44800, 16000);

  insert into public.purchases (id, business_id, supplier_id, ordered_at, status, notes)
  values
    (pg_temp.seed_uuid(v_business_id, 'purchase:pescados'), v_business_id, pg_temp.seed_uuid(v_business_id, 'supplier:caleta-valparaiso-premium'), current_date - 1, 'received', 'Abastecimiento de pescados premium de costa.'),
    (pg_temp.seed_uuid(v_business_id, 'purchase:mariscos'), v_business_id, pg_temp.seed_uuid(v_business_id, 'supplier:sur-mariscos-australes'), current_date - 1, 'received', 'Mariscos premium para crudos, frios y calientes.'),
    (pg_temp.seed_uuid(v_business_id, 'purchase:algas-sal'), v_business_id, pg_temp.seed_uuid(v_business_id, 'supplier:algas-pacifico'), current_date - 4, 'received', 'Algas y sales del concepto.'),
    (pg_temp.seed_uuid(v_business_id, 'purchase:verduras'), v_business_id, pg_temp.seed_uuid(v_business_id, 'supplier:huerta-costera'), current_date - 1, 'received', 'Rotacion diaria de vegetales, hierbas y citricos.'),
    (pg_temp.seed_uuid(v_business_id, 'purchase:lacteos'), v_business_id, pg_temp.seed_uuid(v_business_id, 'supplier:lacteos-artesanos'), current_date - 2, 'received', 'Lacteos premium y huevos de pasteleria.'),
    (pg_temp.seed_uuid(v_business_id, 'purchase:bodega'), v_business_id, pg_temp.seed_uuid(v_business_id, 'supplier:bodega-chef'), current_date - 4, 'received', 'Secos premium, pan brioche y condimentos.'),
    (pg_temp.seed_uuid(v_business_id, 'purchase:vinos'), v_business_id, pg_temp.seed_uuid(v_business_id, 'supplier:cava-litoral'), current_date - 4, 'received', 'Vino blanco seco para cocina y servicio.')
  on conflict (id) do update
  set
    supplier_id = excluded.supplier_id,
    ordered_at = excluded.ordered_at,
    status = excluded.status,
    notes = excluded.notes;

  delete from public.purchase_items
  where business_id = v_business_id
    and purchase_id in (
      pg_temp.seed_uuid(v_business_id, 'purchase:pescados'),
      pg_temp.seed_uuid(v_business_id, 'purchase:mariscos'),
      pg_temp.seed_uuid(v_business_id, 'purchase:algas-sal'),
      pg_temp.seed_uuid(v_business_id, 'purchase:verduras'),
      pg_temp.seed_uuid(v_business_id, 'purchase:lacteos'),
      pg_temp.seed_uuid(v_business_id, 'purchase:bodega'),
      pg_temp.seed_uuid(v_business_id, 'purchase:vinos')
    );

  insert into public.purchase_items (id, business_id, purchase_id, ingredient_id, quantity, unit, unit_price, received_quantity)
  values
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:pescados:corvina'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:pescados'), pg_temp.seed_uuid(v_business_id, 'ingredient:corvina-filete'), 12, 'kg', 21000, 12),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:pescados:reineta'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:pescados'), pg_temp.seed_uuid(v_business_id, 'ingredient:reineta-filete'), 14, 'kg', 16500, 14),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:pescados:congrio'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:pescados'), pg_temp.seed_uuid(v_business_id, 'ingredient:congrio-dorado'), 10, 'kg', 26000, 10),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:pescados:merluza'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:pescados'), pg_temp.seed_uuid(v_business_id, 'ingredient:merluza-austral'), 12, 'kg', 22500, 12),

    (pg_temp.seed_uuid(v_business_id, 'purchase-item:mariscos:ostiones'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:mariscos'), pg_temp.seed_uuid(v_business_id, 'ingredient:ostiones-limpios'), 10, 'kg', 28500, 10),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:mariscos:machas'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:mariscos'), pg_temp.seed_uuid(v_business_id, 'ingredient:machas-limpias'), 14, 'kg', 16000, 14),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:mariscos:almejas'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:mariscos'), pg_temp.seed_uuid(v_business_id, 'ingredient:almejas-limpias'), 16, 'kg', 9800, 16),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:mariscos:erizo'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:mariscos'), pg_temp.seed_uuid(v_business_id, 'ingredient:erizo-fresco'), 5, 'kg', 42000, 5),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:mariscos:centolla'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:mariscos'), pg_temp.seed_uuid(v_business_id, 'ingredient:centolla-cocida'), 6, 'kg', 68000, 6),

    (pg_temp.seed_uuid(v_business_id, 'purchase-item:algas:cochayuyo'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:algas-sal'), pg_temp.seed_uuid(v_business_id, 'ingredient:cochayuyo-premium'), 6, 'kg', 7200, 6),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:algas:luche'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:algas-sal'), pg_temp.seed_uuid(v_business_id, 'ingredient:luche-seco'), 2, 'kg', 18500, 2),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:algas:sal'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:algas-sal'), pg_temp.seed_uuid(v_business_id, 'ingredient:sal-cahuil'), 8, 'kg', 1800, 8),

    (pg_temp.seed_uuid(v_business_id, 'purchase-item:verduras:limon'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:verduras'), pg_temp.seed_uuid(v_business_id, 'ingredient:limon-sutil'), 16, 'kg', 1900, 16),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:verduras:pomelo'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:verduras'), pg_temp.seed_uuid(v_business_id, 'ingredient:pomelo-rosado'), 10, 'kg', 2200, 10),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:verduras:cebolla'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:verduras'), pg_temp.seed_uuid(v_business_id, 'ingredient:cebolla-morada'), 12, 'kg', 1500, 12),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:verduras:cilantro'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:verduras'), pg_temp.seed_uuid(v_business_id, 'ingredient:cilantro'), 4, 'kg', 8500, 4),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:verduras:hinojo'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:verduras'), pg_temp.seed_uuid(v_business_id, 'ingredient:hinojo'), 6, 'kg', 3200, 6),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:verduras:pepino'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:verduras'), pg_temp.seed_uuid(v_business_id, 'ingredient:pepino'), 8, 'kg', 1700, 8),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:verduras:palta'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:verduras'), pg_temp.seed_uuid(v_business_id, 'ingredient:palta-hass'), 10, 'kg', 6200, 10),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:verduras:coliflor'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:verduras'), pg_temp.seed_uuid(v_business_id, 'ingredient:coliflor'), 12, 'kg', 2600, 12),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:verduras:papa'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:verduras'), pg_temp.seed_uuid(v_business_id, 'ingredient:papa-chilota'), 20, 'kg', 2200, 20),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:verduras:aji'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:verduras'), pg_temp.seed_uuid(v_business_id, 'ingredient:aji-verde'), 4, 'kg', 2400, 4),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:verduras:ajo'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:verduras'), pg_temp.seed_uuid(v_business_id, 'ingredient:ajo'), 3, 'kg', 4200, 3),

    (pg_temp.seed_uuid(v_business_id, 'purchase-item:lacteos:crema'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:lacteos'), pg_temp.seed_uuid(v_business_id, 'ingredient:crema-fresca'), 24, 'litro', 4600, 24),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:lacteos:mantequilla'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:lacteos'), pg_temp.seed_uuid(v_business_id, 'ingredient:mantequilla-premium'), 10, 'kg', 7200, 10),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:lacteos:parmesano'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:lacteos'), pg_temp.seed_uuid(v_business_id, 'ingredient:parmesano'), 5, 'kg', 24000, 5),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:lacteos:leche'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:lacteos'), pg_temp.seed_uuid(v_business_id, 'ingredient:leche-entera'), 18, 'litro', 1500, 18),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:lacteos:huevos'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:lacteos'), pg_temp.seed_uuid(v_business_id, 'ingredient:huevos'), 180, 'unidad', 240, 180),

    (pg_temp.seed_uuid(v_business_id, 'purchase-item:bodega:aceite'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:bodega'), pg_temp.seed_uuid(v_business_id, 'ingredient:aceite-oliva'), 18, 'litro', 7600, 18),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:bodega:caldo'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:bodega'), pg_temp.seed_uuid(v_business_id, 'ingredient:caldo-pescado-concentrado'), 10, 'litro', 9500, 10),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:bodega:brioche'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:bodega'), pg_temp.seed_uuid(v_business_id, 'ingredient:pan-brioche'), 120, 'unidad', 650, 120),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:bodega:panko'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:bodega'), pg_temp.seed_uuid(v_business_id, 'ingredient:panko'), 8, 'kg', 3200, 8),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:bodega:azucar'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:bodega'), pg_temp.seed_uuid(v_business_id, 'ingredient:azucar'), 10, 'kg', 1400, 10),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:bodega:vainilla'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:bodega'), pg_temp.seed_uuid(v_business_id, 'ingredient:vainilla'), 1, 'litro', 15500, 1),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:bodega:gelatina'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:bodega'), pg_temp.seed_uuid(v_business_id, 'ingredient:gelatina'), 1, 'kg', 24000, 1),
    (pg_temp.seed_uuid(v_business_id, 'purchase-item:bodega:pimienta'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:bodega'), pg_temp.seed_uuid(v_business_id, 'ingredient:pimienta-blanca'), 1, 'kg', 22000, 1),

    (pg_temp.seed_uuid(v_business_id, 'purchase-item:vinos:vblanco'), v_business_id, pg_temp.seed_uuid(v_business_id, 'purchase:vinos'), pg_temp.seed_uuid(v_business_id, 'ingredient:vino-blanco-seco'), 18, 'litro', 5200, 18);

  delete from public.inventory_movements
  where business_id = v_business_id
    and notes like 'OC mar premium %';

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
    'OC mar premium ' || p.id::text
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
    (pg_temp.seed_uuid(v_business_id, 'audit:corvina'), v_business_id, pg_temp.seed_uuid(v_business_id, 'ingredient:corvina-filete'), current_date, 'Bodega AM', 11.2, 'kg', 1.1, 'Camara pescados A', 'Pescado firme, sin deshidratacion y bien rotulado.'),
    (pg_temp.seed_uuid(v_business_id, 'audit:ostiones'), v_business_id, pg_temp.seed_uuid(v_business_id, 'ingredient:ostiones-limpios'), current_date, 'Bodega AM', 8.6, 'kg', 1.0, 'Camara mariscos', 'Stock activo para crudos y gratinados.'),
    (pg_temp.seed_uuid(v_business_id, 'audit:centolla'), v_business_id, pg_temp.seed_uuid(v_business_id, 'ingredient:centolla-cocida'), current_date, 'Bodega PM', 4.8, 'kg', 3.1, 'Camara listos', 'Producto en correcto rango y uso restringido.'),
    (pg_temp.seed_uuid(v_business_id, 'audit:cochayuyo'), v_business_id, pg_temp.seed_uuid(v_business_id, 'ingredient:cochayuyo-premium'), current_date, 'Bodega seca', 5.4, 'kg', 20.0, 'Secos premium', 'Seco, sellado y sin humedad.'),
    (pg_temp.seed_uuid(v_business_id, 'audit:crema'), v_business_id, pg_temp.seed_uuid(v_business_id, 'ingredient:crema-fresca'), current_date, 'Bodega PM', 18, 'litro', 4.0, 'Camara lacteos', 'Producto en rotacion para chupes y postres.')
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
    (pg_temp.seed_uuid(v_business_id, 'production:viernes-premium'), v_business_id, 'Mise en place servicio premium viernes', current_date + 1, 'Sous chef PM', 'Pendiente')
  on conflict (id) do update
  set
    name = excluded.name,
    scheduled_for = excluded.scheduled_for,
    responsible = excluded.responsible,
    status = excluded.status;

  delete from public.production_plan_items
  where business_id = v_business_id
    and production_plan_id = pg_temp.seed_uuid(v_business_id, 'production:viernes-premium');

  insert into public.production_plan_items (id, business_id, production_plan_id, ref_type, ref_id, quantity)
  values
    (pg_temp.seed_uuid(v_business_id, 'production-item:leche-tigre'), v_business_id, pg_temp.seed_uuid(v_business_id, 'production:viernes-premium'), 'baseRecipe', pg_temp.seed_uuid(v_business_id, 'recipe:leche-tigre-premium'), 2),
    (pg_temp.seed_uuid(v_business_id, 'production-item:vinagreta'), v_business_id, pg_temp.seed_uuid(v_business_id, 'production:viernes-premium'), 'baseRecipe', pg_temp.seed_uuid(v_business_id, 'recipe:vinagreta-hinojo'), 1),
    (pg_temp.seed_uuid(v_business_id, 'production-item:pilpil'), v_business_id, pg_temp.seed_uuid(v_business_id, 'production:viernes-premium'), 'baseRecipe', pg_temp.seed_uuid(v_business_id, 'recipe:pil-pil-marino'), 1),
    (pg_temp.seed_uuid(v_business_id, 'production-item:pure-coliflor'), v_business_id, pg_temp.seed_uuid(v_business_id, 'production:viernes-premium'), 'baseRecipe', pg_temp.seed_uuid(v_business_id, 'recipe:pure-coliflor'), 1),
    (pg_temp.seed_uuid(v_business_id, 'production-item:panacota'), v_business_id, pg_temp.seed_uuid(v_business_id, 'production:viernes-premium'), 'baseRecipe', pg_temp.seed_uuid(v_business_id, 'recipe:panacota-limon'), 1);

  insert into public.waste_records (
    id, business_id, ingredient_id, quantity, unit, reason_type, responsible, waste_date, cost_impact
  )
  values
    (pg_temp.seed_uuid(v_business_id, 'waste:machas'), v_business_id, pg_temp.seed_uuid(v_business_id, 'ingredient:machas-limpias'), 0.8, 'kg', 'Limpieza', 'Bodega AM', current_date - 1, 12800),
    (pg_temp.seed_uuid(v_business_id, 'waste:crema'), v_business_id, pg_temp.seed_uuid(v_business_id, 'ingredient:crema-fresca'), 1.0, 'litro', 'Produccion', 'Pastelero', current_date - 1, 4600)
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
    (pg_temp.seed_uuid(v_business_id, 'sale:viernes-premium'), v_business_id, current_date - 1, 'Salon'),
    (pg_temp.seed_uuid(v_business_id, 'sale:sabado-premium'), v_business_id, current_date, 'Salon'),
    (pg_temp.seed_uuid(v_business_id, 'sale:domingo-premium'), v_business_id, current_date + 1, 'Salon')
  on conflict (id) do update
  set
    sold_at = excluded.sold_at,
    channel = excluded.channel;

  delete from public.sale_items
  where business_id = v_business_id
    and sale_id in (
      pg_temp.seed_uuid(v_business_id, 'sale:viernes-premium'),
      pg_temp.seed_uuid(v_business_id, 'sale:sabado-premium'),
      pg_temp.seed_uuid(v_business_id, 'sale:domingo-premium')
    );

  insert into public.sale_items (id, business_id, sale_id, dish_id, quantity, unit_price, discount)
  values
    (pg_temp.seed_uuid(v_business_id, 'saleitem:vie:ostiones'), v_business_id, pg_temp.seed_uuid(v_business_id, 'sale:viernes-premium'), pg_temp.seed_uuid(v_business_id, 'dish:ostiones-leche-tigre'), 8, 18900, 0),
    (pg_temp.seed_uuid(v_business_id, 'saleitem:vie:tartar'), v_business_id, pg_temp.seed_uuid(v_business_id, 'sale:viernes-premium'), pg_temp.seed_uuid(v_business_id, 'dish:tartar-centolla'), 6, 22900, 0),
    (pg_temp.seed_uuid(v_business_id, 'saleitem:vie:reineta'), v_business_id, pg_temp.seed_uuid(v_business_id, 'sale:viernes-premium'), pg_temp.seed_uuid(v_business_id, 'dish:reineta-fondo-corto'), 9, 28900, 0),
    (pg_temp.seed_uuid(v_business_id, 'saleitem:sab:tiradito'), v_business_id, pg_temp.seed_uuid(v_business_id, 'sale:sabado-premium'), pg_temp.seed_uuid(v_business_id, 'dish:tiradito-reineta'), 7, 17900, 0),
    (pg_temp.seed_uuid(v_business_id, 'saleitem:sab:pilpil'), v_business_id, pg_temp.seed_uuid(v_business_id, 'sale:sabado-premium'), pg_temp.seed_uuid(v_business_id, 'dish:pilpil-ostiones-machas'), 10, 24900, 0),
    (pg_temp.seed_uuid(v_business_id, 'saleitem:sab:congrio'), v_business_id, pg_temp.seed_uuid(v_business_id, 'sale:sabado-premium'), pg_temp.seed_uuid(v_business_id, 'dish:congrio-cochayuyo'), 11, 32900, 0),
    (pg_temp.seed_uuid(v_business_id, 'saleitem:sab:panacota'), v_business_id, pg_temp.seed_uuid(v_business_id, 'sale:sabado-premium'), pg_temp.seed_uuid(v_business_id, 'dish:panacota-limon'), 8, 9900, 0),
    (pg_temp.seed_uuid(v_business_id, 'saleitem:dom:ceviche'), v_business_id, pg_temp.seed_uuid(v_business_id, 'sale:domingo-premium'), pg_temp.seed_uuid(v_business_id, 'dish:ceviche-corvina'), 6, 16900, 0),
    (pg_temp.seed_uuid(v_business_id, 'saleitem:dom:machas'), v_business_id, pg_temp.seed_uuid(v_business_id, 'sale:domingo-premium'), pg_temp.seed_uuid(v_business_id, 'dish:machas-vinagreta'), 5, 15900, 0),
    (pg_temp.seed_uuid(v_business_id, 'saleitem:dom:merluza'), v_business_id, pg_temp.seed_uuid(v_business_id, 'sale:domingo-premium'), pg_temp.seed_uuid(v_business_id, 'dish:merluza-austral-almejas'), 8, 29900, 0),
    (pg_temp.seed_uuid(v_business_id, 'saleitem:dom:leche-asada'), v_business_id, pg_temp.seed_uuid(v_business_id, 'sale:domingo-premium'), pg_temp.seed_uuid(v_business_id, 'dish:leche-asada-vainilla'), 7, 8900, 0);

  update public.dishes d
  set sales_count = coalesce((
    select sum(si.quantity)::integer
    from public.sale_items si
    where si.business_id = v_business_id
      and si.dish_id = d.id
  ), d.sales_count)
  where d.business_id = v_business_id
    and d.id in (
      pg_temp.seed_uuid(v_business_id, 'dish:ostiones-leche-tigre'),
      pg_temp.seed_uuid(v_business_id, 'dish:tostada-erizo'),
      pg_temp.seed_uuid(v_business_id, 'dish:tiradito-reineta'),
      pg_temp.seed_uuid(v_business_id, 'dish:ceviche-corvina'),
      pg_temp.seed_uuid(v_business_id, 'dish:machas-vinagreta'),
      pg_temp.seed_uuid(v_business_id, 'dish:almejas-pepino'),
      pg_temp.seed_uuid(v_business_id, 'dish:tartar-centolla'),
      pg_temp.seed_uuid(v_business_id, 'dish:pilpil-ostiones-machas'),
      pg_temp.seed_uuid(v_business_id, 'dish:chupe-centolla-gratinado'),
      pg_temp.seed_uuid(v_business_id, 'dish:ostiones-gratinados'),
      pg_temp.seed_uuid(v_business_id, 'dish:congrio-cochayuyo'),
      pg_temp.seed_uuid(v_business_id, 'dish:reineta-fondo-corto'),
      pg_temp.seed_uuid(v_business_id, 'dish:merluza-austral-almejas'),
      pg_temp.seed_uuid(v_business_id, 'dish:panacota-limon'),
      pg_temp.seed_uuid(v_business_id, 'dish:leche-asada-vainilla')
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
          'customerFacingPrice', null,
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
      'staffShifts', '[]'::jsonb,
      'eventQuotes', '[]'::jsonb
    )
  on conflict (business_id) do update
  set
    state = excluded.state,
    updated_at = now();
end $$;
