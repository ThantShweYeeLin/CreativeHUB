import { useEffect, useRef, useState } from 'react';
import { Paperclip, Send } from 'lucide-react';
import { DataService } from '../../lib/dataService';
import { FeedService } from '../../lib/feedService';
import { Avatar } from '../common/Avatar';
import { DEFAULT_AVATAR_URL } from '../../lib/defaults';

interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  message: string;
  attachment_path: string | null;
  created_at: string;
  sender?: { id: string; full_name: string | null; avatar_url: string | null } | null;
}

interface TicketThreadProps {
  ticketId: string;
  /** The original report itself, rendered as the first bubble in the thread. */
  originalDescription: string;
  originalScreenshotPath: string | null;
  originalCreatedAt: string;
  originalAuthorName: string;
  originalAuthorAvatar: string | null;
  currentUserId: string;
  onMessageSent?: () => void;
  /** A closed ticket is "finished, no further action expected" — the
   * composer is replaced with a notice instead of a disabled input, since
   * the database itself rejects the insert regardless of this (see
   * support_ticket_messages' INSERT policy in
   * supabase/support_ticket_privacy_and_lifecycle.sql); this is just so
   * the user sees why rather than hitting a raw error. Replying to a
   * resolved ticket is fine — it reopens automatically. */
  ticketStatus?: string;
}

async function resolveEvidenceUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const response = await DataService.getReportEvidenceSignedUrl(path);
  return response.error ? null : response.url;
}

export function TicketThread({
  ticketId,
  originalDescription,
  originalScreenshotPath,
  originalCreatedAt,
  originalAuthorName,
  originalAuthorAvatar,
  currentUserId,
  onMessageSent,
  ticketStatus,
}: TicketThreadProps) {
  const isClosed = ticketStatus === 'closed';
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [originalScreenshotUrl, setOriginalScreenshotUrl] = useState<string | null>(null);
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({});
  const [reply, setReply] = useState('');
  const [replyFile, setReplyFile] = useState<File | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // `silent` skips the isLoading toggle — used by every reload EXCEPT the
  // very first one. Toggling isLoading swaps the whole message list out for
  // a "Loading conversation…" placeholder and back, which unmounts every
  // bubble; the now much-shorter placeholder makes the browser clamp the
  // scrollable box's scrollTop down near 0, and when the real messages
  // remount a moment later they render at that clamped (top) position
  // instead of back at the bottom. A silent reload just patches `messages`
  // in place, so React only adds the new bubble instead of tearing down
  // and rebuilding the whole list, leaving scroll position undisturbed.
  const load = async (options?: { silent?: boolean }) => {
    if (!options?.silent) setIsLoading(true);
    const response = await DataService.getSupportTicketMessages(ticketId);
    if (!response.error) {
      setMessages(response.data);
      const urls: Record<string, string> = {};
      await Promise.all(
        response.data
          .filter((m: TicketMessage) => m.attachment_path)
          .map(async (m: TicketMessage) => {
            const url = await resolveEvidenceUrl(m.attachment_path);
            if (url) urls[m.id] = url;
          })
      );
      setAttachmentUrls(urls);
    }
    if (!options?.silent) setIsLoading(false);
  };

  useEffect(() => {
    void load();
    void resolveEvidenceUrl(originalScreenshotPath).then(setOriginalScreenshotUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  // Without this, the other side's reply (admin replying to a user, or a
  // user replying to their own ticket while an admin has it open) only ever
  // showed up after a manual reload — this component only ever reloaded
  // after ITS OWN send.
  useEffect(() => {
    const channel = FeedService.subscribeToTicketMessages(ticketId, () => {
      void load({ silent: true });
      onMessageSent?.();
    });

    return () => {
      channel.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  // Sets scrollTop directly on the box itself rather than
  // scrollIntoView()-ing a marker at the bottom — scrollIntoView walks up
  // through EVERY scrollable ancestor (this box, but also the page around
  // it), so its actual result depends on how much other content the
  // surrounding page happens to have above/below this component, which is
  // exactly why this worked on one ticket page and not another despite
  // both rendering the same TicketThread. Setting scrollTop here only ever
  // touches this one box, regardless of what page it's embedded in. Re-runs
  // on the attachment/screenshot URL maps too, not just messages — those
  // resolve slightly after the messages themselves (a separate async step),
  // and their images loading in afterward was growing the thread taller
  // than what an earlier scroll had already accounted for.
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length, isLoading, attachmentUrls, originalScreenshotUrl]);

  const handleSend = async () => {
    if (!reply.trim() || isSending) return;
    setIsSending(true);
    setError(null);

    let attachmentPath: string | null = null;
    if (replyFile) {
      const uploadResponse = await DataService.uploadReportEvidencePhoto(currentUserId, replyFile);
      if (uploadResponse.error || !uploadResponse.path) {
        setError('Unable to upload the attachment.');
        setIsSending(false);
        return;
      }
      attachmentPath = uploadResponse.path;
    }

    const response = await DataService.addSupportTicketMessage({
      ticketId,
      senderId: currentUserId,
      message: reply.trim(),
      attachmentPath,
    });

    setIsSending(false);

    if (response.error) {
      setError((response.error as any).message || 'Unable to send message.');
      return;
    }

    setReply('');
    setReplyFile(null);
    await load({ silent: true });
    onMessageSent?.();
  };

  return (
    <div className="flex flex-col gap-3">
      <div ref={scrollContainerRef} className="max-h-80 space-y-3 overflow-y-auto rounded-xl bg-sky-50/50 p-3">
        <ThreadBubble
          authorName={originalAuthorName}
          authorAvatar={originalAuthorAvatar}
          isSelf={originalAuthorName === 'You'}
          message={originalDescription}
          attachmentUrl={originalScreenshotUrl}
          createdAt={originalCreatedAt}
        />
        {isLoading ? (
          <p className="py-2 text-center text-xs text-gray-500">Loading conversation…</p>
        ) : (
          messages.map((m) => (
            <ThreadBubble
              key={m.id}
              authorName={m.sender_id === currentUserId ? 'You' : m.sender?.full_name || 'CreativeHUB Support'}
              authorAvatar={m.sender?.avatar_url || null}
              isSelf={m.sender_id === currentUserId}
              message={m.message}
              attachmentUrl={attachmentUrls[m.id] || null}
              createdAt={m.created_at}
            />
          ))
        )}
      </div>

      {error && <p className="text-xs font-semibold text-red-600">{error}</p>}

      {isClosed ? (
        <p className="rounded-lg bg-gray-50 px-3 py-2.5 text-xs text-gray-500">
          This ticket is closed, so it's read-only. If you still need help, open a new ticket referencing this one.
        </p>
      ) : (
        <>
          <div className="flex items-end gap-2">
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => {
                // Shift+Enter still inserts a newline — only a plain Enter sends.
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              placeholder="Write a reply…"
              rows={1}
              className="min-h-[38px] flex-1 resize-none rounded-lg border border-sky-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
            />
            <label className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-sky-100 text-gray-500 hover:bg-sky-50">
              <Paperclip className="h-4 w-4" />
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setReplyFile(e.target.files?.[0] || null)} />
            </label>
            <button
              onClick={() => void handleSend()}
              disabled={!reply.trim() || isSending}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/30 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          {replyFile && <p className="text-xs text-gray-500">Attached: {replyFile.name}</p>}
        </>
      )}
    </div>
  );
}

function ThreadBubble({
  authorName,
  authorAvatar,
  isSelf,
  message,
  attachmentUrl,
  createdAt,
}: {
  authorName: string;
  authorAvatar: string | null;
  isSelf: boolean;
  message: string;
  attachmentUrl: string | null;
  createdAt: string;
}) {
  return (
    <div className={`flex gap-2 ${isSelf ? 'flex-row-reverse text-right' : ''}`}>
      <Avatar src={authorAvatar || DEFAULT_AVATAR_URL} alt={authorName} sizeClassName="h-7 w-7" />
      <div className={`max-w-[80%] ${isSelf ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <span className="text-[11px] font-semibold text-gray-500">{authorName}</span>
        <div
          className={`rounded-2xl px-3 py-2 text-sm ${
            isSelf ? 'rounded-br-sm bg-gradient-to-r from-sky-500 to-blue-600 text-white' : 'rounded-bl-sm bg-white text-gray-800 shadow-sm'
          }`}
        >
          <p className="whitespace-pre-wrap">{message}</p>
          {attachmentUrl && (
            <a href={attachmentUrl} target="_blank" rel="noreferrer" className="mt-2 block">
              <img src={attachmentUrl} alt="Attachment" className="max-h-40 rounded-lg object-cover" />
            </a>
          )}
        </div>
        <span className="text-[10px] text-gray-400">{new Date(createdAt).toLocaleString()}</span>
      </div>
    </div>
  );
}
