-- handle_new_user() suma la creación de taste_profiles a partir de los
-- géneros y el año de nacimiento que el signup ya manda en
-- raw_user_meta_data (issue #80), sin arriesgar el signup en sí.
--
-- CREATE OR REPLACE reemplaza la función entera y resetea cualquier
-- cláusula que no se vuelva a declarar explícitamente — por eso se restatea
-- `security definer set search_path = public` acá, aunque no cambien, en
-- vez de asumir que sobreviven de la versión anterior.
--
-- El insert en profiles queda igual que en 20260829030000. El de
-- taste_profiles va en un bloque BEGIN/EXCEPTION propio: la extracción de
-- género y año ya es defensiva por construcción (tipo/rango se validan
-- antes de castear nada), pero la subtransacción es la red de contención
-- final — cualquier error ahí, previsto o no, se degrada a un warning en
-- vez de tirar abajo el INSERT en auth.users que dispara este trigger.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := new.raw_user_meta_data;
  safe_genres text[];
  safe_birth_year smallint;
begin
  insert into public.profiles (id, username, avatar_url, location)
  values (
    new.id,
    meta->>'full_name',
    meta->>'avatar_url',
    meta->>'location'
  );

  begin
    if jsonb_typeof(meta->'genres') = 'array' then
      select array_agg(gk.key order by gk.first_ord)
      into safe_genres
      from (
        select g.key, min(elems.ordinality) as first_ord
        from jsonb_array_elements_text(meta->'genres') with ordinality as elems(val, ordinality)
        join public.genres g on g.key = elems.val
        group by g.key
        order by min(elems.ordinality)
        limit 5
      ) gk;
    end if;

    if (meta->>'birth_year') ~ '^\d{4}$'
      and (meta->>'birth_year')::int
        between extract(year from now())::int - 100 and extract(year from now())::int - 13
    then
      safe_birth_year := (meta->>'birth_year')::smallint;
    end if;

    insert into public.taste_profiles (user_id, favorite_genre_keys, birth_year)
    values (new.id, coalesce(safe_genres, '{}'), safe_birth_year);
  exception when others then
    raise warning 'handle_new_user: no se pudo crear taste_profiles para %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;
