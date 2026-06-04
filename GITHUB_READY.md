# GitHub ready

Projeto preparado pelo Agent Nexus para subir ao GitHub.

## Projeto

- Nome: Create tiny static landing page called Nexus Deploy Sm
- ID: proj_create-tiny-static-landing-page-called-nexus-dep_b43cd728
- Visibilidade sugerida: private

## Segurança

- `.env`, `.env.*`, `node_modules`, builds e logs estao ignorados no Git.
- Use `.env.example` como referencia.
- Nao suba chaves reais em commits.

## Comandos manuais

```bash
git init
git add .
git commit -m "Initial Agent Nexus project"
gh repo create nexus-deploy-smoke-20260604-031943 --private --source . --remote origin --push
```
