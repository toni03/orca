Revisa las PRs abiertas que el ITG tiene en `stablyai/orca`, resuelve las acciones pendientes que puedas resolver con seguridad y termina con un resumen del estado de cada una. Trabaja sin pedir confirmación.

Remotos: `origin` = `stablyai/orca` (nunca hagas push ahí), `fork` = `toni03/orca` (las ramas de las PRs viven aquí). Lee antes `docs/agents-md-refs/git-workflow.md` y `AGENTS.md`.

1. Lista las PRs: `gh pr list --repo stablyai/orca --author toni03 --state open --json number,title,headRefName,baseRefName,isDraft,url`. Si no hay ninguna, termina diciéndolo.
2. Para cada PR recoge:
   - estado (borrador o lista para revisar), `reviewDecision`, si es mergeable o tiene conflictos con `main` (`gh pr view <n> --repo stablyai/orca --json mergeable,mergeStateStatus,reviewDecision,statusCheckRollup`);
   - checks fallidos (`gh pr checks <n> --repo stablyai/orca`) y, si los hay, el motivo según el log del job;
   - hilos de revisión sin resolver, de personas y de bots como CodeRabbit (GraphQL `repository.pullRequest.reviewThreads` con `isResolved`, `comments { author { login } body path line url }`), y comentarios generales nuevos desde el último commit;
   - casillas sin marcar en la descripción (por ejemplo, capturas o pruebas visuales pendientes).
3. Resuelve las acciones pendientes cuando el cambio sea claro y acotado:
   - Trabaja en este worktree: `git fetch fork <rama>` y `git switch -C <rama> fork/<rama>`. Las PRs apiladas (base distinta de `main`) se actualizan después de la PR de la que dependen, con merge de su rama base.
   - Comentarios de revisión: aplica el cambio pedido. Si el comentario es incorrecto o pide una decisión de diseño, no cambies código; responde explicando el motivo o déjalo para el resumen como decisión pendiente.
   - Conflictos con `main`: `git fetch origin main` y `git merge origin/main`, resolviendo sin perder comportamiento de ninguna parte. No hagas rebase.
   - Checks fallidos por el cambio: corrígelos. Si el fallo no lo causa la PR (flaky, infraestructura o también falla en `main`), no lo toques y anótalo.
   - Antes de cada push ejecuta `pnpm check:changed --maxWorkers=2`. Haz commits pequeños con mensajes convencionales en inglés y push normal a `fork <rama>`; nunca `--force`.
   - Tras el push, responde en inglés en cada hilo atendido con una frase sobre lo que cambiaste y el commit. Resuelve el hilo solo si lo abrió un bot (CodeRabbit, etc.); los de personas los resuelve quien los abrió.
4. No marques PRs como listas para revisar, no las mergees ni las cierres, no cambies títulos ni descripciones salvo para corregir una casilla que ya hayas completado, y no menciones con `@` a nadie.
5. No puedes resolver tú lo que requiere a una persona: capturas o evidencias visuales, decisiones de diseño o respuestas a preguntas de los mantenedores. Déjalo en el resumen.
6. Termina con un resumen por PR, en este formato:
   - `#<n> <título>` (<url>): borrador/lista · revisión: aprobada/cambios pedidos/pendiente · checks: ok/fallan (motivo) · conflictos: sí/no
   - Hecho hoy: cambios, commits y respuestas publicadas.
   - Pendiente: lo que necesita una persona, con enlace al hilo o casilla.

Reglas: no añadas trailers `Co-Authored-By` de Claude a los commits y no incluyas nombres de clientes ni datos personales en commits, comentarios o informes.
