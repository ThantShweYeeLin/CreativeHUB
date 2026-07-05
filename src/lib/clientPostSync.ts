export const CLIENT_POST_UPDATED_EVENT = 'creativehub:client-post-updated';

export function dispatchClientPostUpdated(postId: string) {
  window.dispatchEvent(
    new CustomEvent(CLIENT_POST_UPDATED_EVENT, {
      detail: { postId: String(postId) },
    })
  );
}

export function subscribeClientPostUpdated(handler: (postId: string) => void) {
  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<{ postId?: string }>;
    const postId = customEvent.detail?.postId;
    if (postId) {
      handler(String(postId));
    }
  };

  window.addEventListener(CLIENT_POST_UPDATED_EVENT, listener);
  return () => window.removeEventListener(CLIENT_POST_UPDATED_EVENT, listener);
}