Revisa las PRs abiertas que el ITG tiene en `stablyai/orca`, resuelve las acciones pendientes que puedas resolver con seguridad, integra en Orca ITG lo que aún no esté en su `main` y termina con una tabla del estado de cada PR. Trabaja sin pedir confirmación.

Remotos: `origin` = `stablyai/orca` (nunca hagas push ahí), `fork` = `toni03/orca` (las ramas de las PRs y el `main` de Orca ITG viven aquí). Lee antes `docs/agents-md-refs/git-workflow.md`, `AGENTS.md` y `docs/readme/itg-windows-release.md`.

1. Lista las PRs: `gh pr list --repo stablyai/orca --author toni03 --state open --json number,title,headRefName,baseRefName,isDraft,url`. Si no hay ninguna, termina diciéndolo.
2. Para cada PR recoge:
   - estado (borrador o lista para revisar), `reviewDecision`, si es mergeable o tiene conflictos con `main` (`gh pr view <n> --repo stablyai/orca --json mergeable,mergeStateStatus,reviewDecision,statusCheckRollup`);
   - checks fallidos (`gh pr checks <n> --repo stablyai/orca`) y, si los hay, el motivo según el log del job;
   - hilos de revisión sin resolver, de personas y de bots como CodeRabbit (GraphQL `repository.pullRequest.reviewThreads` con `isResolved`, `comments { author { login } body path line url }`), comentarios generales nuevos desde el último commit y comentarios de las revisiones de bots que quedan fuera del diff (van en el cuerpo de la revisión, no en un hilo);
   - casillas sin marcar en la descripción (por ejemplo, capturas o pruebas visuales pendientes).
3. Resuelve las acciones pendientes cuando el cambio sea claro y acotado:
   - Trabaja en este worktree: `git fetch fork <rama>` y `git switch -C <rama> fork/<rama>`. Las PRs apiladas (base distinta de `main`, o que la descripción declara apiladas sobre otra) se actualizan después de la PR de la que dependen, con merge de su rama base.
   - Comentarios de revisión: aplica el cambio pedido. Si el comentario es incorrecto o pide una decisión de diseño, no cambies código; responde explicando el motivo o déjalo para el resumen como decisión pendiente.
   - Conflictos con `main`: `git fetch origin main` y `git merge origin/main`, resolviendo sin perder comportamiento de ninguna parte. No hagas rebase.
   - Checks fallidos por el cambio: corrígelos. Si el fallo no lo causa la PR (flaky, infraestructura o también falla en `main`), no lo toques y anótalo.
   - Antes de cada push ejecuta `pnpm check:changed --maxWorkers=2` y no cambies de rama en el worktree mientras se ejecuta. Si no puede terminar, no hagas push de esa rama y anótalo. Haz commits pequeños con mensajes convencionales en inglés y push normal a `fork <rama>`; nunca `--force`.
   - Tras el push, responde en inglés en cada hilo atendido con una frase sobre lo que cambiaste y el commit (para comentarios fuera del diff, en la conversación de la PR). Resuelve el hilo solo si lo abrió un bot (CodeRabbit, etc.); los de personas los resuelve quien los abrió.
4. Integra en Orca ITG (`main` del fork) las PRs abiertas que tengan cambios sin integrar. Una PR abierta, también en borrador, es una feature estable para el ITG:
   - `git fetch fork main` y crea en este worktree la rama temporal `itg/pr-merge` desde `fork/main` (`git switch -C itg/pr-merge fork/main`). No toques el checkout principal, que suele tener `main` abierta.
   - Para cada PR, en orden de dependencia (la base antes que las apiladas), cuenta los commits sin integrar de su rama publicada: `git rev-list --count HEAD..fork/<rama>`. Si es 0, ya está integrada. Si no, `git merge --no-ff fork/<rama> -m "Merge branch '<rama>'"`. Integra solo lo publicado en `fork/<rama>`, nunca commits locales sin push.
   - Si la rama tiene mergeado un `origin/main` más reciente que el de Orca ITG, el merge trae también esos commits de upstream; es aceptable, porque la siguiente sincronización con upstream los traería igualmente.
   - Si hay conflictos, resuélvelos conservando el comportamiento de las dos partes; los cambios exclusivos del ITG (lista en `docs/readme/itg-upstream-sync-prompt.md`) deben seguir funcionando. Si un conflicto no se puede resolver con seguridad, `git merge --abort`, sigue con las demás PRs y anótalo.
   - Si has integrado algo: `pnpm install` si cambió `pnpm-lock.yaml`, y `pnpm check:changed --maxWorkers=2`. Solo bloquean los fallos que provoca la integración; corrígelos con commits pequeños o, si no puedes, no publiques y anótalo.
   - Publica solo con fast-forward: `git push fork HEAD:main`, nunca `--force`. Si se rechaza porque `fork/main` avanzó, `git fetch fork main`, `git merge fork/main` y repite la comprobación.
   - No lances la release; la publica la rutina de sincronización con upstream. Actualiza la rama `main` local con `git fetch fork main:main` si no está en uso en ningún worktree (si lo está, dilo en el informe) y borra la rama temporal.
5. No marques PRs como listas para revisar, no las mergees en `stablyai/orca` ni las cierres, no cambies títulos ni descripciones salvo para corregir una casilla que ya hayas completado, y no menciones con `@` a nadie.
6. No puedes resolver tú lo que requiere a una persona: capturas o evidencias visuales, decisiones de diseño o respuestas a preguntas de los mantenedores. Déjalo en el resumen.
7. Termina con una tabla con todas las PRs abiertas, una fila por PR (en la columna PR, el enlace Markdown a la PR, sin comillas invertidas):

   | PR              | Título   | Estado         | Revisión                           | Checks                           | Conflictos | Orca ITG                                                   | Pendiente                            |
   | --------------- | -------- | -------------- | ---------------------------------- | -------------------------------- | ---------- | ---------------------------------------------------------- | ------------------------------------ |
   | `[#<n>](<url>)` | <título> | borrador/lista | aprobada/cambios pedidos/pendiente | ok/fallan (motivo)/no ejecutados | sí/no      | integrada hoy (`<sha>`)/ya integrada/sin integrar (motivo) | nada, o un resumen de pocas palabras |

   Debajo, para cada PR con actividad o pendientes:
   - Hecho hoy: cambios, commits, respuestas publicadas e integración en Orca ITG.
   - Pendiente: lo que necesita una persona, con enlace al hilo o casilla.

Reglas: no añadas trailers `Co-Authored-By` de Claude a los commits y no incluyas nombres de clientes ni datos personales en commits, comentarios o informes.
