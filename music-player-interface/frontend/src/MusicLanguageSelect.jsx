import React from 'react';
import { MUSIC_LANGUAGES } from './music-languages.js';
import './music-language-select.css';

export default function MusicLanguageSelect({
  value,
  onChange,
  className = '',
  label = 'Language preference',
}) {
  return (
    <label className={`music-language-select ${className}`.trim()}>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {MUSIC_LANGUAGES.map((language) => (
          <option key={language} value={language}>{language}</option>
        ))}
      </select>
      <small>Search hint only; music providers do not verify track language.</small>
    </label>
  );
}
