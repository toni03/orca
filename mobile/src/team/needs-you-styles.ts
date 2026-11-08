import { themedStyleSheet } from '../theme/themed-styles'
import { colors, radii, spacing, typography } from '../theme/mobile-theme'

export const needsYouStyles = themedStyleSheet(() => ({
  screen: { flex: 1, backgroundColor: colors.bgBase },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle
  },
  grow: { flex: 1, minWidth: 0 },
  title: { color: colors.textPrimary, fontSize: typography.titleSize, fontWeight: '600' },
  count: {
    color: colors.statusAmber,
    fontSize: typography.metaSize,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: colors.statusAmber,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2
  },
  card: {
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radii.surface,
    backgroundColor: colors.bgPanel,
    padding: spacing.md,
    gap: spacing.sm
  },
  cardTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '500' },
  detail: { color: colors.textSecondary, fontSize: typography.bodySize, lineHeight: 20 },
  meta: { color: colors.textSecondary, fontSize: typography.metaSize, lineHeight: 18 },
  error: { color: colors.statusRed, fontSize: typography.bodySize, lineHeight: 21 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  button: {
    minHeight: 44,
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radii.control,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bgRaised
  },
  primaryButton: { backgroundColor: colors.textPrimary },
  buttonText: { color: colors.textPrimary, fontSize: typography.bodySize, fontWeight: '600' },
  primaryText: { color: colors.bgBase },
  disabled: { opacity: 0.45 }
}))
