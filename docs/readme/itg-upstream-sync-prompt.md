Sincroniza Orca ITG (fork `toni03/orca`) con la última versión estable de `stablyai/orca` y publica una release ITG nueva. Trabaja sin pedir confirmación, pero detente sin publicar nada si algún paso no es seguro.

Remotos: `origin` = `stablyai/orca` (solo lectura, nunca hagas push ahí), `fork` = `toni03/orca`. Lee antes `docs/readme/itg-windows-release.md`.

1. Ejecuta `node config/scripts/itg-upstream-release-pending.mjs toni03/orca`. Si no termina con código 0, no hay versión nueva: termina informando de su salida.
2. `git fetch origin main --tags` y `git fetch fork main`. En este worktree crea la rama `itg/upstream-sync-<versión upstream>` desde `fork/main`. No toques el checkout principal del repositorio.
3. Haz merge de `origin/main` (no del tag de release) con `git merge --no-ff origin/main -m "Merge upstream main for v<versión>"`.
4. Si hay conflictos, resuélvelos conservando el comportamiento de las dos partes:
   - Los cambios exclusivos del ITG (distribución del fork, updater, `config/release-distribution.cjs`, `config/electron-builder.config.cjs`, `src/shared/release-distribution.ts`, `.github/workflows/itg-release-windows.yml`, `config/scripts/itg-*`, `docs/readme/itg-*`) deben seguir funcionando.
   - Si una funcionalidad del ITG ya llegó upstream (su PR aparece como merged en `stablyai/orca`), quédate con la versión de upstream.
   - Si un conflicto no se puede resolver con seguridad, ejecuta `git merge --abort`, no hagas push y termina explicando qué ficheros y por qué.
5. Ejecuta `pnpm install` y después `pnpm check:changed --maxWorkers=2`. Si algo falla, comprueba si el mismo fallo ocurre en `origin/main` sin el merge; solo bloquean los fallos que provoca el merge. Corrígelos con commits pequeños en la rama; si no puedes, no publiques y termina explicándolo.
6. Publica `main` solo con fast-forward: `git push fork HEAD:main`. Nunca uses `--force` ni reescribas historia de `main`.
7. Lanza la release: `gh workflow run itg-release-windows.yml --repo toni03/orca --ref main`. Busca el run con `gh run list --repo toni03/orca --workflow itg-release-windows.yml --limit 1` y síguelo con `gh run watch <id> --repo toni03/orca --exit-status`.
8. Verifica con `gh release view --repo toni03/orca` que la nueva `v<versión>-itg.0` es Latest, que tiene `latest.yml`, `orca-itg-windows-setup.exe` y su `.blockmap`, y que `latest.yml` declara esa versión. Si el workflow falla, revisa el log del job fallido; reintenta una vez con `gh run rerun <id> --failed --repo toni03/orca` solo si el fallo es transitorio (red, runner).
9. Actualiza la rama `main` local con `git fetch fork main:main` si no está en uso en ningún worktree; si lo está, déjala y dilo en el informe. Borra la rama local de sincronización.
10. Termina con un informe breve: versión upstream, número de commits traídos, conflictos y cómo se resolvieron, resultado de las comprobaciones, enlace a la release o motivo por el que no se publicó.

Reglas: no añadas trailers `Co-Authored-By` de Claude a los commits, no abras PRs ni comentes en `stablyai/orca`, y no incluyas nombres de clientes ni datos personales en commits o informes.
