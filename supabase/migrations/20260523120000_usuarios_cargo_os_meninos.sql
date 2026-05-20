-- Perfil «Os Meninos» (operadores de pesagem / ticket padrão).
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
      'Faturamento',
      'Financeiro',
      'Visualizador'
    )
  );

comment on constraint usuarios_cargo_canonico_chk on public.usuarios is
  'Cargos canónicos (inclui Os Meninos — lançamento de ticket sem edição financeira posterior).';
