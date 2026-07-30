-- Efeito visual da página-presente, escolhido pelo comprador no editor.
--
-- Ex.: "coracoes" (chuva de corações caindo durante a música), "nenhum".
-- Guarda a chave do efeito; null/"nenhum" = sem efeito. Igual a cor_destaque
-- e versao_preferida: decisão de quem MONTA o presente, aplicada no /p/$token.

alter table public.musicas
  add column if not exists efeito text;
