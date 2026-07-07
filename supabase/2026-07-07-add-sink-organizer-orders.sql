alter table public.orders
  drop constraint if exists orders_style_check;

alter table public.orders
  add constraint orders_style_check
  check (
    style in (
      'L-Shaped',
      'T-Shaped',
      'Round',
      'Icy Cooling Loop Fan - White',
      'Icy Cooling Loop Fan - Black',
      'Under-Sink Pull-Out Organizer - White',
      'Under-Sink Pull-Out Organizer - Black'
    )
  );

alter table public.orders
  drop constraint if exists orders_pack_size_check;

alter table public.orders
  add constraint orders_pack_size_check
  check (pack_size in (1, 4, 8, 16, 20, 29, 33, 39, 41, 48));
