-- Catálogo: mix contaminado e resíduos comerciais (cadastro de clientes / MTR)
INSERT INTO public.residuos (codigo, nome, descricao, grupo, sort_order) VALUES
  (
    'RG-R-029',
    'Mix de resíduos contaminados',
    'Mistura de resíduos com contaminação química ou oleosa',
    'II-A',
    275
  ),
  (
    'RG-R-030',
    'Resíduo comercial',
    'Resíduos comerciais segregados (não perigosos ou baixo risco operacional)',
    'II-B',
    276
  ),
  (
    'RG-R-031',
    'Resíduo Comercial classe 2',
    'Resíduos comerciais classe II (perigosos — NBR 10004)',
    'II-A',
    277
  )
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  grupo = EXCLUDED.grupo,
  sort_order = EXCLUDED.sort_order,
  ativo = true;
