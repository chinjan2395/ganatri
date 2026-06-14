import { useRef } from 'react';
import introVideo from '../assets/intro.mp4';
import './IntroScreen.css';

interface Props {
  onDone: () => void;
}

export function IntroScreen({ onDone }: Props): React.ReactNode {
  const videoRef = useRef<HTMLVideoElement>(null);

  return (
    <div className="intro">
      <video
        ref={videoRef}
        className="intro__video"
        src={introVideo}
        autoPlay
        muted
        playsInline
        onEnded={onDone}
      />
      <button className="intro__skip" onClick={onDone}>
        Skip
      </button>
    </div>
  );
}
