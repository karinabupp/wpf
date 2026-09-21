-- ═══════════════════════════════════════════════════════════════════════
-- WPF Dash — Login de verdade · 21/09/2026 · PASSO 2 (só depois que a Karina
-- entrou com o login novo e os dados apareceram). Sem volta: as senhas antigas
-- em texto puro somem da seção "users" e de todos os retratos do histórico.
-- ═══════════════════════════════════════════════════════════════════════
update public.wpf_dashboard_data
set data = (
  select coalesce(jsonb_agg(case when jsonb_typeof(u) = 'object' then u - 'password' - 'mustChangePassword' else u end order by o), '[]'::jsonb)
  from jsonb_array_elements(data) with ordinality e(u, o)
), updated_at = now()
where section = 'users' and jsonb_typeof(data) = 'array';

update public.wpf_dashboard_data
set data = (
  select coalesce(jsonb_agg(
    case when jsonb_typeof(v -> 'data' -> 'users') = 'array'
      then jsonb_set(v, '{data,users}', (
        select coalesce(jsonb_agg(case when jsonb_typeof(u) = 'object' then u - 'password' - 'mustChangePassword' else u end order by o2), '[]'::jsonb)
        from jsonb_array_elements(v -> 'data' -> 'users') with ordinality e2(u, o2)))
      else v end
    order by o), '[]'::jsonb)
  from jsonb_array_elements(data) with ordinality e(v, o)
)
where section = 'historicoGeral' and jsonb_typeof(data) = 'array';
