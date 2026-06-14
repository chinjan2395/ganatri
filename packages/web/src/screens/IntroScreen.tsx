import { useState } from 'react';
import './IntroScreen.css';

interface Props {
  onDone: () => void;
}

export function IntroScreen({ onDone }: Props): React.ReactNode {
  const [ready, setReady] = useState(false);

  return (
    <div className="intro">
      {!ready && (
        <div className="intro__loading">
          <div className="intro__spinner" />
        </div>
      )}
      <video
        className={`intro__video${ready ? ' intro__video--visible' : ''}`}
        src="/intro.mp4"
        autoPlay
        muted
        playsInline
        preload="auto"
        onCanPlay={() => setReady(true)}
        onEnded={onDone}
      />
      <button className="intro__skip" onClick={onDone}>
        Skip
      </button>
    </div>
  );
}
