const LOCATION_META_PATTERN = /\[\[LOCATION_META:([^\]]*)\]\]/;

export function buildLocationMetaTag(location: string) {
  return `[[LOCATION_META:${location.replace(/[\]]/g, '')}]]`;
}

export function appendLocationMeta(message: string, location: string) {
  if (!location) {
    return message;
  }

  return `${message.trim()}\n\n${buildLocationMetaTag(location)}`;
}

export function extractLocationMeta(...texts: Array<string | null | undefined>): string | null {
  for (const text of texts) {
    const source = text || '';
    const match = source.match(LOCATION_META_PATTERN);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

export function stripLocationMeta(text: string | null | undefined) {
  return (text || '').replace(LOCATION_META_PATTERN, '').trim();
}
