-- Conserva solo ventas de los 9 platos activos mientras se trabaja la carta acotada.
with allowed_dishes as (
  select id, business_id
  from public.dishes
  where lower(translate(name, 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN')) in (
    'ceviche mixto',
    'camarones al pil pil',
    'ostiones a la parmesana',
    'caldillo de congrio a la nerudiana',
    'salmon a la plancha con mix de ensalada',
    'salmon con mix de ensaladas',
    'pulpo grillado con pure de camote',
    'panacota de frutos rojos',
    'pie de maracuya',
    'celestino mas helado de vainilla'
  )
)
delete from public.sale_items si
where not exists (
  select 1
  from allowed_dishes ad
  where ad.id = si.dish_id
    and ad.business_id = si.business_id
);

delete from public.sales s
where not exists (
  select 1
  from public.sale_items si
  where si.sale_id = s.id
    and si.business_id = s.business_id
);

update public.dishes d
set
  name = replace(replace(d.name, 'Selectino', 'Celestino'), 'selectino', 'celestino'),
  technical_notes = replace(replace(d.technical_notes, 'Selectino', 'Celestino'), 'selectino', 'celestino')
where d.name ilike '%selectino%'
   or d.technical_notes ilike '%selectino%';
