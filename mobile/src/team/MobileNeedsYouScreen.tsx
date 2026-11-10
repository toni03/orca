import { useEffect, useState } from 'react'
import { useLocalSearchParams } from 'expo-router'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { ChevronLeft } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMobileTranslation } from '../i18n/use-mobile-translation'
import { useMobileColorScheme } from '../theme/use-mobile-color-scheme'
import { firstParam } from '../navigation/route-param-reader'
import { useRouteHandoff } from '../navigation/route-handoff'
import { useHostClient } from '../transport/connection/host-client-hooks'
import { colors, pressedStyle } from '../theme/mobile-theme'
import { MobileSegmentedControl } from '../components/MobileSegmentedControl'
import { TextField } from '../components/composer-input/TextField'
import { openExternalLink } from '../platform/external-link'
import { useTeamNeedsYou } from './use-team-needs-you'
import type {
  TeamNeedsYouDecision,
  TeamNeedsYouIssue,
  TeamNeedsYouReason
} from './team-needs-you-operations'
import { needsYouStyles as styles } from './needs-you-styles'

type Filter = 'all' | 'questions' | 'ready' | 'escalated'

const ANSWERING: readonly TeamNeedsYouReason[] = ['blocked', 'question', 'failed']

function inFilter(issue: TeamNeedsYouIssue, filter: Filter): boolean {
  const reason = issue.needsYou?.reason
  switch (filter) {
    case 'all':
      return true
    case 'questions':
      return reason !== undefined && ANSWERING.includes(reason)
    case 'ready':
      return reason === 'ready'
    case 'escalated':
      return reason === 'escalated'
  }
}

function elapsed(at: number, now: number): string {
  const minutes = Math.max(0, Math.round((now - at) / 60_000))
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h`
}

function Button({
  label,
  onPress,
  primary = false,
  disabled = false
}: {
  label: string
  onPress: () => void
  primary?: boolean
  disabled?: boolean
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary && styles.primaryButton,
        disabled && styles.disabled,
        pressed && pressedStyle
      ]}
    >
      <Text style={[styles.buttonText, primary && styles.primaryText]}>{label}</Text>
    </Pressable>
  )
}

function IssueCard({
  hostId,
  issue,
  project,
  seat,
  now,
  busy,
  onDecide
}: {
  hostId: string | undefined
  issue: TeamNeedsYouIssue
  project: string
  seat: string | undefined
  now: number
  busy: boolean
  onDecide: (issueId: string, decision: TeamNeedsYouDecision) => Promise<boolean>
}) {
  const t = useMobileTranslation()
  const router = useRouteHandoff()
  const [reply, setReply] = useState('')
  const needsYou = issue.needsYou
  if (!needsYou) {
    return null
  }
  const reason = needsYou.reason
  const answering = ANSWERING.includes(reason)
  const key = issue.tracker?.key ?? `#${issue.id.slice(0, 6)}`
  const reasonLabel = {
    ready: t('team.mobile.reasonReady', 'Ready'),
    escalated: t('team.mobile.reasonEscalated', 'Escalated'),
    blocked: t('team.mobile.reasonBlocked', 'Blocked'),
    question: t('team.mobile.reasonQuestion', 'Question'),
    failed: t('team.mobile.reasonFailed', 'Stopped')
  }[reason]
  const decide = (decision: TeamNeedsYouDecision) =>
    void onDecide(issue.id, decision).then((ok) => {
      if (ok) {
        setReply('')
      }
    })

  return (
    <View style={styles.card}>
      <Text style={styles.meta} numberOfLines={1}>
        {[project, key, reasonLabel, seat, elapsed(needsYou.at, now)].filter(Boolean).join(' · ')}
      </Text>
      <Text style={styles.cardTitle}>{issue.title}</Text>
      {needsYou.detail ? (
        <Text style={styles.detail} numberOfLines={6}>
          {needsYou.detail}
        </Text>
      ) : null}
      {answering && needsYou.options?.length ? (
        <View style={styles.actions}>
          {needsYou.options.map((option, index) => (
            <Button
              key={option}
              label={option}
              primary={index === 0}
              disabled={busy}
              onPress={() => decide({ kind: 'answer', note: option })}
            />
          ))}
        </View>
      ) : null}
      {reason === 'ready' ? (
        <View style={styles.actions}>
          {issue.worktreeId && hostId ? (
            <Button
              label={t('team.mobile.merge', 'Merge')}
              primary
              disabled={busy}
              onPress={() =>
                router.push(
                  `/h/${encodeURIComponent(hostId)}/source-control/${encodeURIComponent(
                    issue.worktreeId ?? ''
                  )}?tab=pr`
                )
              }
            />
          ) : null}
          {issue.mergeRequest ? (
            <Button
              label={t('team.mobile.openMergeRequest', 'Open MR')}
              onPress={() => openExternalLink(issue.mergeRequest?.url ?? '')}
            />
          ) : null}
          <Button
            label={t('team.mobile.markDone', 'Mark done')}
            disabled={busy}
            onPress={() => decide({ kind: 'done' })}
          />
        </View>
      ) : null}
      <TextField
        value={reply}
        onChangeText={setReply}
        editable={!busy}
        placeholder={
          answering
            ? t('team.mobile.replyPlaceholder', 'Reply…')
            : t('team.mobile.changesPlaceholder', 'Changes to request…')
        }
        accessibilityLabel={
          answering
            ? t('team.mobile.reply', 'Reply')
            : t('team.mobile.requestChanges', 'Request changes')
        }
        returnKeyType="send"
        onSubmitEditing={() => {
          if (reply.trim()) {
            decide(
              answering ? { kind: 'answer', note: reply } : { kind: 'request-changes', note: reply }
            )
          }
        }}
      />
      <View style={styles.actions}>
        <Button
          label={
            answering
              ? t('team.mobile.sendAnswer', 'Answer')
              : t('team.mobile.requestChanges', 'Request changes')
          }
          primary={!answering || !needsYou.options?.length}
          disabled={busy || !reply.trim()}
          onPress={() =>
            decide(
              answering ? { kind: 'answer', note: reply } : { kind: 'request-changes', note: reply }
            )
          }
        />
        <Button
          label={t('team.mobile.discard', 'Discard')}
          disabled={busy}
          onPress={() => decide({ kind: 'discard' })}
        />
      </View>
    </View>
  )
}

/** The agent team's Needs you inbox, so the user can answer seats away from the desk. */
export function MobileNeedsYouScreen() {
  const t = useMobileTranslation()
  useMobileColorScheme()
  const params = useLocalSearchParams<{ hostId?: string | string[] }>()
  const hostId = firstParam(params.hostId)
  const { client } = useHostClient(hostId)
  const { list, error, busyId, decide } = useTeamNeedsYou(client)
  const [filter, setFilter] = useState<Filter>('all')
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [])
  const router = useRouteHandoff()
  const insets = useSafeAreaInsets()
  const issues = (list?.issues ?? [])
    .filter((issue) => issue.status === 'needs-you' && issue.needsYou)
    .sort((a, b) => (b.needsYou?.at ?? 0) - (a.needsYou?.at ?? 0))
  const visible = issues.filter((issue) => inFilter(issue, filter))
  const projectName = (repoId: string): string =>
    list?.projects.find((project) => project.repoId === repoId)?.name ?? repoId
  const seatName = (issue: TeamNeedsYouIssue): string | undefined => {
    const seatId = issue.assignments.at(-1)?.seatId
    return list?.seats.find((seat) => seat.id === seatId)?.name
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => pressed && pressedStyle}
          accessibilityRole="button"
          accessibilityLabel={t('team.mobile.back', 'Back')}
          onPress={() => router.back()}
          hitSlop={8}
        >
          <ChevronLeft size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.title, styles.grow]}>{t('team.mobile.needsYou', 'Needs you')}</Text>
        {issues.length > 0 ? <Text style={styles.count}>{issues.length}</Text> : null}
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <MobileSegmentedControl<Filter>
          tabs
          fill
          selected={filter}
          onSelect={setFilter}
          segments={[
            { value: 'all', label: t('team.mobile.all', 'All') },
            { value: 'questions', label: t('team.mobile.questions', 'Questions') },
            { value: 'ready', label: t('team.mobile.ready', 'Ready') },
            { value: 'escalated', label: t('team.mobile.escalated', 'Escalated') }
          ]}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {list === null && !error ? (
          <Text style={styles.meta}>{t('team.mobile.loading', 'Loading…')}</Text>
        ) : null}
        {list !== null && visible.length === 0 ? (
          <Text style={styles.meta}>
            {t('team.mobile.empty', 'Nothing needs you. The team keeps working.')}
          </Text>
        ) : null}
        {visible.map((issue) => (
          <IssueCard
            key={issue.id}
            hostId={hostId}
            issue={issue}
            project={projectName(issue.repoId)}
            seat={seatName(issue)}
            now={now}
            busy={busyId !== null}
            onDecide={decide}
          />
        ))}
      </ScrollView>
    </View>
  )
}
