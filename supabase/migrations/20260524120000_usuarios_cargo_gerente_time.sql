-- Perfil «Gerente do Time» (edição de valores e encerramento definitivo do ticket no faturamento).
alter table public.usuarios
  drop constraint if exists usuarios_cargo_canonico_chk;

alter table public.usuarios
  add constraint usuarios_cargo_canonico_chk
  check (
    cargo is null
    or btrim(cargo) = ''
    or cargo in (
      'Desenvolvedor',
      'Administrador',
      'Diretoria',
      'Comercial',
      'Operacional',
      'Logística',
      'Balanceiro',
      'Os Meninos',
      'Gerente do Time',
      'Faturamento',
      'Financeiro',
      'Visualizador'
    )
  );

comment on constraint usuarios_cargo_canonico_chk on public.usuarios is
  'Cargos canónicos (inclui Gerente do Time — valores editáveis e encerramento de ticket no faturamento).';
