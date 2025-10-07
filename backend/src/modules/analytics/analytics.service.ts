import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkspacesService } from '../workspaces/workspaces.service';

type Granularity = 'day' | 'week' | 'month';

function parseISOorRelative(
  s?: string,
  defDays = 30,
): { from: Date; to: Date } {
  const now = new Date();
  if (!s)
    return { from: new Date(now.getTime() - defDays * 86400000), to: now };

  // Support "30d", "12w", "6m"
  const m = /^(\d+)([dwm])$/.exec(s);
  if (m) {
    const n = parseInt(m[1], 10);
    const unit = m[2];
    const days = unit === 'd' ? n : unit === 'w' ? n * 7 : n * 30;
    return { from: new Date(now.getTime() - days * 86400000), to: now };
  }

  // ISO pair "from|to" -> "2025-09-01|2025-10-02"
  const parts = s.split('|');
  if (parts.length === 2)
    return { from: new Date(parts[0]), to: new Date(parts[1]) };

  // Single ISO -> from that date to now
  return { from: new Date(s), to: now };
}

@Injectable()
export class AnalyticsService {
  constructor(
    private prisma: PrismaService,
    private ws: WorkspacesService,
  ) {}

  /** Ensure user is member; return role */
  private async assertWs(userId: string, workspaceId: string) {
    return this.ws.assertMember(userId, workspaceId);
  }

  /** Active users by bucket + message count (active = sent ≥1 message in bucket) */
  async activeUsers(params: {
    userId: string;
    workspaceId: string;
    granularity?: Granularity;
    range?: string;
    tz?: string;
  }) {
    await this.assertWs(params.userId, params.workspaceId);
    const g = params.granularity ?? 'day';
    const tz = params.tz ?? 'Asia/Ho_Chi_Minh';
    const { from, to } = parseISOorRelative(params.range, 30);

    // Postgres: group by g (day/week/month) in TZ
    const rows: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT
   date_trunc($1, m."createdAt" AT TIME ZONE $2) AS bucket,
   COUNT(DISTINCT m."senderId")::int           AS active_users,
   COUNT(*)::int                               AS messages
 FROM "Message" m
 JOIN "Conversation" c ON c.id = m."conversationId"
 WHERE c."workspaceId" = $3
   AND m."deletedAt" IS NULL
   AND m."createdAt" >= $4 AND m."createdAt" < $5
 GROUP BY 1
 ORDER BY 1 ASC`,
      g,
      tz,
      params.workspaceId,
      from,
      to,
    );

    return rows.map((r: any) => ({
      bucket: new Date(r.bucket as string | number | Date).toISOString(),
      activeUsers: Number(r.active_users),
      messages: Number(r.messages),
    }));
  }

  /**
   * Retention by weekly cohort (W0..Wn), active = sent ≥1 message in that week.
   * Returns:
   * - cohorts: [{cohortStartISO, size}]
   * - matrix:  [{cohortStartISO, weekOffset, active}]
   */
  async retentionWeekly(params: {
    userId: string;
    workspaceId: string;
    weeks?: number;
    tz?: string;
    range?: string;
  }) {
    await this.assertWs(params.userId, params.workspaceId);
    const tz = params.tz ?? 'Asia/Ho_Chi_Minh';
    const weeks = Math.max(4, Math.min(52, params.weeks ?? 12));
    const { from, to } = parseISOorRelative(params.range, weeks * 7);

    // CTE: first_seen + weekly activity
    const data: any[] = await this.prisma.$queryRawUnsafe(
      `WITH msgs AS (
  SELECT m."senderId", m."createdAt" AT TIME ZONE $1 AS ts, c."workspaceId"
  FROM "Message" m JOIN "Conversation" c ON c.id = m."conversationId"
  WHERE c."workspaceId" = $2 AND m."deletedAt" IS NULL
    AND m."createdAt" >= $3 AND m."createdAt" < $4
),
first_seen AS (
  SELECT "senderId" AS "userId", date_trunc('week', MIN(ts)) AS cohort
  FROM msgs GROUP BY 1
),
activity AS (
  SELECT "senderId" AS "userId", date_trunc('week', ts) AS week
  FROM msgs GROUP BY 1,2
)
SELECT fs.cohort, a.week, COUNT(DISTINCT a."userId") AS users
FROM first_seen fs
JOIN activity a ON a."userId" = fs."userId"
WHERE a.week >= fs.cohort AND a.week < fs.cohort + ($5 || ' weeks')::interval
GROUP BY 1,2
ORDER BY 1,2`,
      tz,
      params.workspaceId,
      from,
      to,
      weeks,
    );

    const sizes: any[] = await this.prisma.$queryRawUnsafe(
      `WITH msgs AS (
  SELECT m."senderId", m."createdAt" AT TIME ZONE $1 AS ts, c."workspaceId"
  FROM "Message" m JOIN "Conversation" c ON c.id = m."conversationId"
  WHERE c."workspaceId" = $2 AND m."deletedAt" IS NULL
    AND m."createdAt" >= $3 AND m."createdAt" < $4
),
first_seen AS (
  SELECT "senderId" AS "userId", date_trunc('week', MIN(ts)) AS cohort
  FROM msgs GROUP BY 1
)
SELECT cohort, COUNT(DISTINCT "userId") AS size
FROM first_seen
GROUP BY 1
ORDER BY 1`,
      tz,
      params.workspaceId,
      from,
      to,
    );

    // Build matrix: offset = (week - cohort)/7days (integer)
    const cohorts = sizes.map((s: any) => ({
      cohortStartISO: new Date(
        s.cohort as string | number | Date,
      ).toISOString(),
      size: Number(s.size),
    }));

    const matrix = data.map((d: any) => {
      const cohort = new Date(d.cohort as string | number | Date).getTime();
      const week = new Date(d.week as string | number | Date).getTime();
      const offset = Math.round((week - cohort) / (7 * 86400000));
      return {
        cohortStartISO: new Date(
          d.cohort as string | number | Date,
        ).toISOString(),
        weekOffset: offset,
        active: Number(d.users),
      };
    });

    return { weeks, cohorts, matrix };
  }

  /** Top conversations by message count and unique senders */
  async topConversations(params: {
    userId: string;
    workspaceId: string;
    range?: string;
    limit?: number;
  }) {
    await this.assertWs(params.userId, params.workspaceId);
    // Allow all members to view; if you want admin-only, add:
    // if (role === 'MEMBER') throw new ForbiddenException('Admin only');

    const { from, to } = parseISOorRelative(params.range, 30);
    const limit = Math.max(1, Math.min(100, params.limit ?? 20));

    const rows: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT
   c.id, c.title, c.type,
   COUNT(m.id)::int                      AS messages,
   COUNT(DISTINCT m."senderId")::int     AS unique_senders,
   COALESCE(MAX(m."createdAt"), c."updatedAt") AS last_activity
 FROM "Conversation" c
 LEFT JOIN "Message" m
   ON m."conversationId" = c.id
  AND m."deletedAt" IS NULL
  AND m."createdAt" >= $2 AND m."createdAt" < $3
 WHERE c."workspaceId" = $1
 GROUP BY c.id
 ORDER BY messages DESC, last_activity DESC
 LIMIT $4`,
      params.workspaceId,
      from,
      to,
      limit,
    );

    return rows.map((r: any) => ({
      conversationId: r.id,
      title: r.title,
      type: r.type,
      messages: Number(r.messages),
      uniqueSenders: Number(r.unique_senders),
      lastActivity: new Date(
        r.last_activity as string | number | Date,
      ).toISOString(),
    }));
  }
}
