import { stripBudgetMeta } from './requestBudget';
import { stripScheduleMeta } from './requestSchedule';
import { stripLocationMeta } from './requestLocation';

export interface GroupRequestMeta {
  group_id: string;
  owner_id: string;
  recipients: string[];
}

const GROUP_REQUEST_PREFIX = '[GROUP_REQUEST]';

export function buildGroupRequestMeta(ownerId: string, recipients: string[]): GroupRequestMeta {
  return {
    group_id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    owner_id: ownerId,
    recipients: Array.from(new Set(recipients.filter(Boolean))),
  };
}

export function appendGroupRequestMeta(message: string, meta: GroupRequestMeta) {
  const clean = stripGroupRequestMeta(message || '');
  const payload = `${GROUP_REQUEST_PREFIX}${JSON.stringify(meta)}`;
  return clean ? `${clean}\n\n${payload}` : payload;
}

export function parseGroupRequestMeta(...values: Array<string | null | undefined>): GroupRequestMeta | null {
  for (const value of values) {
    if (!value) {
      continue;
    }

    const start = value.indexOf(GROUP_REQUEST_PREFIX);
    if (start < 0) {
      continue;
    }

    const raw = value.slice(start + GROUP_REQUEST_PREFIX.length).trim();
    try {
      const parsed = JSON.parse(raw) as GroupRequestMeta;
      if (parsed?.group_id && parsed?.owner_id) {
        return {
          group_id: String(parsed.group_id),
          owner_id: String(parsed.owner_id),
          recipients: Array.isArray(parsed.recipients) ? parsed.recipients.map(String) : [],
        };
      }
    } catch {
      // Ignore malformed metadata payloads.
    }
  }

  return null;
}

export function stripGroupRequestMeta(value: string | null | undefined) {
  const text = String(value || '');
  const start = text.indexOf(GROUP_REQUEST_PREFIX);
  if (start < 0) {
    return text.trim();
  }

  return text.slice(0, start).trim();
}

export function stripRequestDisplayMeta(value: string | null | undefined) {
  const direct = stripLocationMeta(stripScheduleMeta(stripBudgetMeta(stripGroupRequestMeta(value || ''))));
  return direct
    .replace(/\s*(?:,\s*|\s+and\s+)?as\s+freelancer\s*$/i, '')
    .replace(/\s*(?:,\s*|\s+and\s+)?as\s+client\s*$/i, '')
    .trim();
}

export function summarizeGroupRequestMembers(
  recipients: Array<string | null | undefined> = [],
  memberNames: Array<string | null | undefined> = []
) {
  const count = recipients.filter(Boolean).length;
  if (!count) {
    return 'Group request';
  }

  return memberNames.length ? 'Group request' : `Group request: ${count} member${count === 1 ? '' : 's'}`;
}
