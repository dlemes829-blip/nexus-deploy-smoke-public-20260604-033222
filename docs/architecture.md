# Arquitetura

Projeto: Create tiny static landing page called Nexus Deploy Sm

## Banco

Supabase e o banco padrao. Rode o SQL em `supabase/schema.sql` e preencha as variaveis do `.env.example`.

## Fluxo do Agent Nexus

1. Recebe o pedido.
2. Monta plano.
3. Gera arquivos.
4. Roda smoke tests.
5. Corrige se quebrar.
6. Entrega preview e ZIP.
