import { useEffect, useRef, useState } from 'react';
import { Paperclip, Send } from 'lucide-react';
import { DataService } from '../../lib/dataService';
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
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    setIsLoading(true);
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
    setIsLoading(false);
  };

  useEffect(() => {
    void load();
    void resolveEvidenceUrl(originalScreenshotPath).then(setOriginalScreenshotUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isLoading]);

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
    await load();
    onMessageSent?.();
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="max-h-80 space-y-3 overflow-y-auto rounded-xl bg-sky-50/50 p-3">
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
              authorName={m.sender_id === currentUserId ? 'You' : m.sender?.full_name || 'Support'}
              authorAvatar={m.sender?.avatar_url || null}
              isSelf={m.sender_id === currentUserId}
              message={m.message}
              attachmentUrl={attachmentUrls[m.id] || null}
              createdAt={m.created_at}
            />
          ))
        )}
        <div ref={bottomRef} />
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
