/**
 * Sanitize user text to prevent XSS attacks
 * Removes dangerous HTML tags and scripts while allowing safe Markdown
 */
export function cleanUserText(text: string): string {
  if (!text) return '';

  // Remove script tags and their content
  let cleaned = text.replace(
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    '',
  );

  // Remove dangerous event handlers (onclick, onerror, etc.)
  cleaned = cleaned.replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '');
  cleaned = cleaned.replace(/\son\w+\s*=\s*[^\s>]*/gi, '');

  // Remove javascript: protocol
  cleaned = cleaned.replace(/javascript:/gi, '');

  // Remove data: protocol (can be used for XSS)
  cleaned = cleaned.replace(/data:text\/html/gi, '');

  // Remove style tags
  cleaned = cleaned.replace(
    /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi,
    '',
  );

  // Remove iframe
  cleaned = cleaned.replace(
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    '',
  );

  // Remove object/embed tags
  cleaned = cleaned.replace(/<(object|embed)[^>]*>/gi, '');

  return cleaned.trim();
}
