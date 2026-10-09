/**
 * Utility functions for formatting, sanitizing, and generating placeholders
 */

/**
 * Format seconds into mm:ss
 * @param {number} seconds 
 * @returns {string}
 */
export function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

/**
 * Escape HTML to prevent XSS
 * @param {string} str 
 * @returns {string}
 */
export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generate a dynamic SVG data URI placeholder for missing album/artist artwork
 * @param {string} text 
 * @returns {string}
 */
export function getPlaceholderSvg(text = 'Music') {
  const initial = (text || 'M').charAt(0).toUpperCase();
  const colors = [
    ['#1db954', '#191414'],
    ['#6366f1', '#18181b'],
    ['#ec4899', '#18181b'],
    ['#8b5cf6', '#09090b'],
    ['#06b6d4', '#111827'],
    ['#f59e0b', '#1c1917']
  ];
  
  // Pick deterministic color based on text
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colorPair = colors[Math.abs(hash) % colors.length];

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${colorPair[0]}" />
        <stop offset="100%" stop-color="${colorPair[1]}" />
      </linearGradient>
    </defs>
    <rect width="300" height="300" fill="url(#grad)" rx="16" />
    <circle cx="150" cy="150" r="70" fill="rgba(255,255,255,0.08)" />
    <text x="50%" y="54%" font-family="system-ui, -apple-system, sans-serif" font-size="72" font-weight="700" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${initial}</text>
    <path d="M120 220 C140 215, 160 215, 180 220" stroke="rgba(255,255,255,0.2)" stroke-width="4" stroke-linecap="round" fill="none" />
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
