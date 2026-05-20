alter table public.dishes
  add column if not exists customer_facing_price numeric(14, 4);
