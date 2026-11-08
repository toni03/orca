Saca el estado del proyecto Orca ITG: funcionalidades abiertas, PRs abiertas en `stablyai/orca` y worktrees de este repositorio, con las acciones necesarias en cada caso. Es un informe de solo lectura: trabaja sin pedir confirmación y no cambies nada, salvo la limpieza de este worktree del paso 1.

Remotos: `origin` = `stablyai/orca`, `fork` = `toni03/orca` (el `main` del fork es Orca ITG). Convención de ramas: `feature/<nombre>` para desarrollar; `toni03/<nombre>` solo cuando tiene PR en upstream; `auto/*` son los worktrees de las automatizaciones; `wip/*` son copias de respaldo.

Reglas de solo lectura:

- Solo puedes ejecutar `git fetch` (para actualizar referencias remotas), comandos de git que solo lean (`worktree list`, `for-each-ref`, `rev-list`, `log`, `status`, `merge-base`, `ls-remote`) y llamadas de `gh` que solo lean.
- Fuera del paso 1, no cambies de rama, no hagas merge, rebase, commit, push, stash ni reset, y no borres ramas ni worktrees. No edites archivos, no comentes ni resuelvas hilos en GitHub, no cambies PRs y no lances `pnpm install`, checks, tests ni builds. Si una acción es necesaria, solo la propones.
- No menciones con `@` a nadie y no incluyas nombres de clientes ni datos personales en el informe.

1. Empieza siempre con este worktree limpio y actualizado, para no partir de un estado corrupto o antiguo de una ejecución anterior. Afecta solo al worktree en el que se ejecuta la automatización, nunca al checkout principal ni a otros worktrees:
   - Actualiza las referencias: `git fetch fork --prune` y `git fetch origin main`.
   - Antes de limpiar, anota para el informe lo que vas a descartar: rama actual, `git status --short` y los commits de la rama actual que no estén en su remoto ni en `fork/main`. Los commits que ya están en otra rama siguen en ella; si la rama actual es `auto/itg-pr-review` y tiene commits que no están en `fork/main`, guárdalos antes con `git branch wip/itg-project-status-<AAAA-MM-DD> HEAD`.
   - Cancela cualquier operación a medias (`git merge --abort`, `git rebase --abort`, `git cherry-pick --abort`; ignora los errores si no hay ninguna), descarta los cambios con `git reset --hard` y `git clean -fd` (sin `-x`, para conservar `node_modules`), y ejecuta `git switch -C auto/itg-pr-review fork/main`.
   - Comprueba que `git status --short` sale vacío y que `HEAD` es `fork/main`. Si no, detente y explícalo.
2. PRs abiertas: `gh pr list --repo stablyai/orca --author toni03 --state open --json number,title,headRefName,baseRefName,isDraft,url`. Para cada una recoge:
   - estado (borrador o lista), `reviewDecision` y si tiene conflictos con `main` (`gh pr view <n> --repo stablyai/orca --json mergeable,mergeStateStatus,reviewDecision`); si `mergeable` es `UNKNOWN`, repite la consulta una vez;
   - checks (`gh pr checks <n> --repo stablyai/orca`): fallidos, con el motivo según `gh run view <run-id> --log-failed --repo stablyai/orca`, o «no ejecutados» si solo pasan `clean` y CodeRabbit;
   - hilos de revisión sin resolver de personas y bots (GraphQL `repository.pullRequest.reviewThreads` con `isResolved` y `comments { author { login } body path line url }`), comentarios generales posteriores al último commit, y hallazgos de revisiones de bots fuera del diff (en el cuerpo de la revisión) que no tengan respuesta posterior en la conversación;
   - casillas sin marcar en la descripción;
   - si es apilada (base distinta de `main` o declarada en la descripción) y si su base tiene commits que ella no tiene;
   - commits publicados sin integrar en Orca ITG: `git rev-list --count fork/main..fork/<rama>`;
   - commits locales sin publicar: `git rev-list --count fork/<rama>..<rama>`, si existe la rama local.
3. PRs cerradas o mergeadas cuya rama sigue viva: `gh pr list --repo stablyai/orca --author toni03 --state closed --limit 30 --json number,state,headRefName,url`, cruzado con las ramas locales y de `fork`.
4. Funcionalidades abiertas: todas las ramas locales (`git for-each-ref refs/heads`) y de `fork` (`refs/remotes/fork`), sin contar `main` ni `auto/*`, que no correspondan a una PR abierta. Para cada una indica si está publicada en `fork`, cuántos commits tiene sin integrar en `fork/main`, su commit más reciente con fecha y si tiene un worktree.
5. Worktrees: `git worktree list --porcelain`. Para cada uno: ruta, rama o HEAD separado, cambios sin commitear (`git -C <ruta> status --porcelain`, con el número de archivos), commits sin publicar y por detrás respecto a su rama remota (si la rama no tiene upstream, compárala con `fork/<rama>`), y si su rama ya está contenida en `fork/main`. Marca los `prunable` (directorio inexistente) y el checkout principal (`main` respecto a `fork/main`).
6. Clasifica cada elemento según estos escenarios. Puede tener varios. La columna «Quién» dice si basta con una sesión de Claude a petición del usuario o hace falta una persona:

   | Código | Escenario                                                                         | Acción necesaria                                                                                                        | Quién            |
   | ------ | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------- |
   | P1     | PR con conflictos con `main`                                                      | Merge de `origin/main` en la rama (sin rebase), check y push                                                            | sesión           |
   | P2     | Hilos sin resolver o hallazgos de bots sin respuesta                              | Aplicar el cambio y responder; si piden una decisión de diseño, decidir                                                 | sesión / persona |
   | P3     | Checks fallidos por la PR                                                         | Corregir, check y push                                                                                                  | sesión           |
   | P4     | Checks fallidos ajenos a la PR (flaky, infraestructura, también fallan en `main`) | `gh run rerun <run-id> --failed --repo stablyai/orca`                                                                   | sesión           |
   | P5     | CI no ejecutado                                                                   | Nada: espera la aprobación de un mantenedor                                                                             | —                |
   | P6     | Commits publicados sin integrar en Orca ITG                                       | Integrar en `fork/main` (rama temporal `itg/pr-merge`, merge `--no-ff`, check, push fast-forward)                       | sesión           |
   | P7     | Commits locales sin publicar en la rama de la PR                                  | Revisarlos, check y push                                                                                                | sesión           |
   | P8     | PR apilada con la base por delante                                                | Actualizar la base y después hacer merge de la base en la apilada                                                       | sesión           |
   | P9     | Casillas sin marcar o evidencias visuales pendientes                              | Completar capturas o pruebas y marcar la casilla                                                                        | persona          |
   | P10    | Preguntas de mantenedores o cambios pedidos por una persona                       | Responder o decidir                                                                                                     | persona          |
   | P11    | Aprobada y sin pendientes                                                         | Esperar al merge del mantenedor                                                                                         | —                |
   | P12    | PR cerrada o mergeada con la rama aún viva                                        | Comprobar que está en `fork/main` y borrar rama local, remota y worktree                                                | sesión           |
   | F1     | Funcionalidad en desarrollo con commits sin integrar                              | Seguir; cuando esté madura, decidir si va a upstream (mover a `toni03/*` y abrir PR) o se integra en `main` y se cierra | persona          |
   | F2     | Rama solo local, sin publicar en `fork`                                           | Publicarla en `fork` para no perderla                                                                                   | sesión           |
   | F3     | Rama sin PR ya contenida en `fork/main`                                           | Borrar la rama y su worktree                                                                                            | sesión           |
   | F4     | Rama `toni03/*` sin PR abierta                                                    | Abrir la PR o renombrarla a `feature/*`                                                                                 | persona          |
   | F5     | Sin commits desde hace más de 14 días                                             | Confirmar si sigue viva o se abandona                                                                                   | persona          |
   | F6     | Rama `wip/*` de respaldo                                                          | Comprobar si su contenido ya está en otra rama y borrarla                                                               | sesión           |
   | W1     | Worktree con cambios sin commitear                                                | Commitear o descartar                                                                                                   | persona          |
   | W2     | Worktree con commits sin publicar                                                 | Push (con check antes si es rama de PR)                                                                                 | sesión           |
   | W3     | Worktree por detrás de su rama remota                                             | `git pull --ff-only`                                                                                                    | sesión           |
   | W4     | Worktree de una rama ya integrada o borrada en remoto, sin cambios                | `git worktree remove` y borrar la rama                                                                                  | sesión           |
   | W5     | Worktree `prunable` o con HEAD separado                                           | `git worktree prune`, o revisar a qué corresponde                                                                       | sesión           |
   | W6     | Worktree de automatización (`auto/*`) en una rama que no es la suya               | Volver a su rama `auto/*` tras publicar o salvar lo que tenga                                                           | sesión           |
   | W7     | Checkout principal con `main` detrás de `fork/main`                               | `git pull --ff-only`                                                                                                    | sesión           |

   Si algo no encaja en ningún escenario, descríbelo como «otro».

7. Termina con este informe:

   **PRs abiertas** (en la columna PR, el enlace Markdown, sin comillas invertidas):

   | PR                                                | Título   | Estado         | Revisión                           | Checks                           | Conflictos | Orca ITG                           | Escenarios        |
   | ------------------------------------------------- | -------- | -------------- | ---------------------------------- | -------------------------------- | ---------- | ---------------------------------- | ----------------- |
   | [#<n>](https://github.com/stablyai/orca/pull/<n>) | <título> | borrador/lista | aprobada/cambios pedidos/pendiente | ok/fallan (motivo)/no ejecutados | sí/no      | integrada/<k> commits sin integrar | P1, P6… o ninguno |

   **Funcionalidades abiertas:**

   | Rama | Publicada | Sin integrar en Orca ITG | Último commit | Worktree | Escenarios |
   | ---- | --------- | ------------------------ | ------------- | -------- | ---------- |

   **Worktrees:**

   | Ruta | Rama | Sin commitear | Sin publicar / por detrás | Escenarios |
   | ---- | ---- | ------------- | ------------------------- | ---------- |

   **Acciones necesarias:** una lista agrupada por elemento, con la acción concreta (rama, comando o enlace al hilo o casilla) y quién debe hacerla. Primero lo que necesita a una persona y después lo que puede hacer una sesión. Si no hay nada, dilo.

Al terminar, como último comando, ejecuta `git show fork/main:config/scripts/itg-stale-check-processes.mjs | node --input-type=module - --session --kill` y anota en el informe lo que pare.
