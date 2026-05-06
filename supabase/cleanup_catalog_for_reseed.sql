-- Limpieza del catalogo gastronomico para recargar una nueva maqueta
-- Ejecutar antes de un nuevo seed tematico.
-- Reemplaza v_owner_email por el correo real del dueno del negocio.

do $$
declare
  v_owner_email text := 'pablo@goupevents.cl';
  v_business_id uuid;
begin
  select business_id
  into v_business_id
  from public.users
  where lower(email) = lower(v_owner_email)
  limit 1;

  if v_business_id is null then
    raise exception 'No se encontro business_id para el usuario % en public.users', v_owner_email;
  end if;

  delete from public.sale_items where business_id = v_business_id;
  delete from public.sales where business_id = v_business_id;

  delete from public.production_plan_items where business_id = v_business_id;
  delete from public.production_plans where business_id = v_business_id;

  delete from public.menu_items where business_id = v_business_id;
  delete from public.menu_categories where business_id = v_business_id;
  delete from public.menus where business_id = v_business_id;

  delete from public.dish_components where business_id = v_business_id;
  delete from public.dishes where business_id = v_business_id;

  delete from public.recipe_items where business_id = v_business_id;
  delete from public.recipes where business_id = v_business_id;

  delete from public.waste_records where business_id = v_business_id;
  delete from public.warehouse_audits where business_id = v_business_id;
  delete from public.inventory_movements where business_id = v_business_id;
  delete from public.purchase_items where business_id = v_business_id;
  delete from public.purchases where business_id = v_business_id;
  delete from public.yield_records where business_id = v_business_id;
  delete from public.ingredient_price_history where business_id = v_business_id;

  delete from public.food_cost_targets
  where business_id = v_business_id
    and scope_type in ('category', 'dish', 'menu');

  delete from public.ingredients where business_id = v_business_id;
  delete from public.packaging_costs where business_id = v_business_id;

  delete from public.projection_days where business_id = v_business_id;
  delete from public.projections where business_id = v_business_id;

  delete from public.categories
  where business_id = v_business_id
    and type in ('ingredient', 'dish', 'menu');

  delete from public.suppliers where business_id = v_business_id;

  update public.businesses
  set
    internal_categories = array['Crudos', 'Entradas frias', 'Calientes', 'Fondos marinos', 'Postres', 'Menus degustacion']
  where id = v_business_id;

  delete from public.app_snapshots where business_id = v_business_id;
end $$;
