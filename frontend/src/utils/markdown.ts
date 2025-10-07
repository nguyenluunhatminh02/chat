import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';

const baseMd = new MarkdownIt();
const escapeHtml = baseMd.utils.escapeHtml;

const highlightCode = (str: string, lang: string): string => {
  if (lang && hljs.getLanguage(lang)) {
    try {
      return (
        '<pre class="hljs"><code>' +
        hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
        '</code></pre>'
      );
    } catch (error) {
      console.error('Highlight.js error:', error);
    }
  }

  return '<pre class="hljs"><code>' + escapeHtml(str) + '</code></pre>';
};

// Initialize markdown-it with safe options
const md = new MarkdownIt({
  html: false, // Disable HTML tags for security
  xhtmlOut: false,
  breaks: true, // Convert '\n' to <br>
  linkify: true, // Auto-convert URLs to links
  typographer: true, // Enable smartquotes and other typographic replacements
  highlight: highlightCode,
});

// Configure link rendering to be safe
const linkOpen: NonNullable<typeof md.renderer.rules.link_open> = (
  tokens,
  idx,
  options,
  _env,
  self,
) => {
  const token = tokens[idx];
  const hrefIndex = token.attrIndex('href');

  if (hrefIndex >= 0) {
    const href = token.attrs?.[hrefIndex]?.[1];
    // Only allow http and https links
    if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
      token.attrPush(['target', '_blank']);
      token.attrPush(['rel', 'nofollow noopener noreferrer']);
    } else {
      // Block non-http(s) links
      token.attrs![hrefIndex][1] = '#';
    }
  }

  return self.renderToken(tokens, idx, options);
};

md.renderer.rules.link_open = linkOpen;

/**
 * Render Markdown text to HTML safely
 * Supports: bold, italic, code blocks, lists, links, etc.
 * Mention tokens <@userId> are preserved for later processing
 */
export function renderMarkdown(text: string): string {
  if (!text) return '';
  
  try {
    return md.render(text);
  } catch (error) {
    console.error('Markdown rendering error:', error);
    // Fallback to plain text with escaped HTML
    return escapeHtml(text);
  }
}

/**
 * Render inline Markdown (without wrapping <p> tags)
 */
export function renderMarkdownInline(text: string): string {
  if (!text) return '';
  
  try {
    return md.renderInline(text);
  } catch (error) {
    console.error('Markdown inline rendering error:', error);
    return escapeHtml(text);
  }
}

/**
 * Extract plain text from Markdown (strip formatting)
 */
export function stripMarkdown(text: string): string {
  if (!text) return '';
  
  try {
    const html = md.render(text);
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  } catch {
    return text;
  }
}
