// Web-only voice input using the Web Speech API.
// Metro resolves this file on web; the native stub (voiceInput.ts) loads elsewhere.
// Language: sq-AL (Albanian). Falls back gracefully if Albanian STT isn't available in the browser.

export type VoiceState = 'idle' | 'listening' | 'processing' | 'success' | 'error';
export type VoiceError = 'not_supported' | 'permission_denied' | 'no_speech' | 'network' | 'unknown';

export interface VoiceResult {
  transcript: string;
  isFinal: boolean;
}

function getSpeechRecognitionCtor(): (new () => any) | null {
  if (typeof window === 'undefined') return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

let activeRecognition: any = null;

export function isVoiceSupported(): boolean {
  return getSpeechRecognitionCtor() !== null;
}

export function startListening(
  onStateChange: (state: VoiceState) => void,
  onResult: (result: VoiceResult) => void,
  onError: (reason: VoiceError) => void,
): void {
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) {
    onError('not_supported');
    return;
  }

  stopListening();

  const recognition = new Ctor();
  recognition.lang = 'sq-AL';
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  let hadError = false;
  let finalTranscript = '';

  recognition.onstart = () => {
    onStateChange('listening');
  };

  recognition.onresult = (event: any) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const t = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += t;
      } else {
        interim += t;
      }
    }
    const combined = finalTranscript + interim;
    onResult({ transcript: combined, isFinal: interim === '' });
  };

  recognition.onerror = (event: any) => {
    hadError = true;
    activeRecognition = null;
    let mapped: VoiceError;
    switch (event.error) {
      case 'not-allowed':
      case 'service-not-allowed':
        mapped = 'permission_denied'; break;
      case 'no-speech':
        mapped = 'no_speech'; break;
      case 'network':
        mapped = 'network'; break;
      default:
        mapped = 'unknown';
    }
    onError(mapped);
    onStateChange('error');
  };

  recognition.onend = () => {
    activeRecognition = null;
    if (!hadError) {
      onStateChange('processing');
    }
  };

  activeRecognition = recognition;
  try {
    recognition.start();
  } catch {
    activeRecognition = null;
    onError('unknown');
  }
}

export function stopListening(): void {
  if (activeRecognition) {
    try { activeRecognition.stop(); } catch { /* ignore */ }
    activeRecognition = null;
  }
}
