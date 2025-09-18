// waku-frontend/src/lib/topic.ts

/**
 * Validates a Waku content topic string.
 * A valid topic must have 4 parts separated by slashes:
 * /application-name/version/topic-name/encoding
 * Example: /my-app/1/my-topic/proto
 *
 * @param topic The content topic string to validate.
 * @returns True if the topic is valid, false otherwise.
 */
export function validateContentTopic(topic: string): boolean {
  if (!topic || typeof topic !== 'string') {
    return false;
  }

  // UPDATED: This regex is more permissive and correctly handles
  // hyphens and a wider range of valid characters in each segment.
  // It checks for 4 non-empty parts separated by slashes, with the second part being a number.
  const WAKU_TOPIC_REGEX = /^\/([^\/]+)\/(\d+)\/([^\/]+)\/([^\/]+)$/;

  return WAKU_TOPIC_REGEX.test(topic);
}

/**
 * Sanitizes a community name to be used in a content topic.
 * Replaces spaces and invalid characters with hyphens and converts to lowercase.
 *
 * @param name The community name.
 * @returns A sanitized string suitable for a URL slug or content topic.
 */
export function sanitizeCommunityName(name: string): string {
  if (!name) return "";
  return name
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/[^\w-]+/g, '') // Remove all non-word chars except -
    .replace(/--+/g, '-'); // Replace multiple - with single -
}

/**
 * Generates a display name from a full content topic string.
 * Extracts the third part (the topic-name) as the display name.
 *
 * @param contentTopic The full content topic string.
 * @returns A user-friendly display name.
 */
export function generateDisplayName(contentTopic: string): string {
  const parts = contentTopic.split('/');
  // Expected format: ['', 'app', 'version', 'topic', 'encoding']
  if (parts.length === 5) {
    return parts[3]; // Return the 'topic' part
  }
  // Fallback for unexpected formats
  return contentTopic;
}
