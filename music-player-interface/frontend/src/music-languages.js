export const MUSIC_LANGUAGES = [
  'Any language',
  'English',
  'Hindi',
  'Tamil',
  'Telugu',
  'Malayalam',
  'Kannada',
  'Bengali',
  'Marathi',
  'Punjabi',
  'Spanish',
  'French',
  'Korean',
  'Japanese',
  'Mandarin',
  'Arabic',
  'Urdu',
  'Gujarati',
  'Portuguese',
  'German',
  'Italian',
  'Russian',
  'Thai',
  'Turkish',
  'Indonesian',
  'Instrumental',
];

export function addLanguageToSearch(query, language) {
  const cleanQuery = String(query || '').trim();
  if (!cleanQuery || !language || language === 'Any language') return cleanQuery;

  const escapedLanguage = language.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp(`\\b${escapedLanguage}\\b`, 'i').test(cleanQuery)) return cleanQuery;
  return `${cleanQuery} ${language}`;
}
