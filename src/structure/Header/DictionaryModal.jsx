import { useEffect, useRef, useState } from 'react';
import { FiBookOpen, FiSearch, FiVolume2 } from 'react-icons/fi';
import ToolModal from './ToolModal';
import toolsService from '../../services/toolsService';

const MAX_DEFINITIONS = 3;
const MAX_SYNONYMS = 6;

function DictionaryModal({ show, onClose }) {
  const [query, setQuery] = useState('');
  const [entry, setEntry] = useState(null);
  const [status, setStatus] = useState('idle');
  const abortRef = useRef(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const lookup = async (word) => {
    const term = word.trim();
    if (!term) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setQuery(term);
    setStatus('loading');

    try {
      const data = await toolsService.getWordDefinitions(term, controller.signal);
      if (!data?.length) {
        setEntry(null);
        setStatus('not-found');
        return;
      }
      setEntry(data[0]);
      setStatus('success');
    } catch (error) {
      if (error.name === 'AbortError') return;
      setEntry(null);
      setStatus('error');
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    lookup(query);
  };

  const phoneticText = entry?.phonetic || entry?.phonetics?.find((p) => p.text)?.text;
  const audioUrl = entry?.phonetics?.find((p) => p.audio)?.audio;

  return (
    <ToolModal show={show} onClose={onClose} title="Dictionary" icon={<FiBookOpen />} className="dictionary-modal">
      <form className="tool-search" onSubmit={handleSubmit}>
        <FiSearch className="tool-search-icon" />
        <input
          type="text"
          className="tool-search-input"
          placeholder="Search an English word"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <button type="submit" className="tool-search-btn" disabled={!query.trim() || status === 'loading'}>
          Search
        </button>
      </form>

      {status === 'idle' && <p className="tool-state">Type a word to see its meaning.</p>}
      {status === 'loading' && <p className="tool-state">Looking up “{query}”…</p>}
      {status === 'not-found' && <p className="tool-state">No definitions found for “{query}”.</p>}
      {status === 'error' && <p className="tool-state tool-state--error">Couldn’t reach the dictionary. Please try again.</p>}

      {status === 'success' && entry && (
        <div className="dictionary-result">
          <div className="dictionary-word-row">
            <div>
              <h3 className="dictionary-word">{entry.word}</h3>
              {phoneticText && <span className="dictionary-phonetic">{phoneticText}</span>}
            </div>
            {audioUrl && (
              <button
                type="button"
                className="dictionary-audio-btn"
                aria-label="Play pronunciation"
                onClick={() => new Audio(audioUrl).play().catch(() => {})}
              >
                <FiVolume2 />
              </button>
            )}
          </div>

          {entry.meanings.map((meaning) => (
            <section key={meaning.partOfSpeech} className="dictionary-meaning">
              <h4 className="dictionary-pos">{meaning.partOfSpeech}</h4>
              <ol className="dictionary-definitions">
                {meaning.definitions.slice(0, MAX_DEFINITIONS).map(({ definition, example }) => (
                  <li key={definition}>
                    <span>{definition}</span>
                    {example && <span className="dictionary-example">“{example}”</span>}
                  </li>
                ))}
              </ol>
              {meaning.synonyms?.length > 0 && (
                <div className="dictionary-synonyms">
                  <span className="dictionary-synonyms-label">Synonyms</span>
                  {meaning.synonyms.slice(0, MAX_SYNONYMS).map((synonym) => (
                    <button type="button" key={synonym} className="dictionary-chip" onClick={() => lookup(synonym)}>
                      {synonym}
                    </button>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </ToolModal>
  );
}

export default DictionaryModal;
