// Native stub — Web Speech API does not exist on iOS/Android.
// Metro resolves voiceInput.web.ts on web automatically.

export type VoiceState = 'idle' | 'listening' | 'processing' | 'success' | 'error';
export type VoiceError = 'not_supported' | 'permission_denied' | 'no_speech' | 'network' | 'unknown';

export interface VoiceResult {
  transcript: string;
  isFinal: boolean;
}

export function isVoiceSupported(): boolean {
  return false;
}

export function startListening(
  _onStateChange: (state: VoiceState) => void,
  _onResult: (result: VoiceResult) => void,
  onError: (reason: VoiceError) => void,
): void {
  onError('not_supported');
}

export function stopListening(): void {}
