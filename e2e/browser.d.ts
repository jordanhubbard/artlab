interface SyntheticMedia {
  cameraStream: MediaStream
  microphoneStream: MediaStream
  sourceContext: AudioContext
  oscillator: OscillatorNode
}
interface PendingMedia { resolve(stream: MediaStream): void; video: boolean }
interface SignalProbe { pending: PendingMedia[]; error: string | null; media?: SyntheticMedia }

interface Window {
  __signalInitError?: string | null
  __signalSyntheticMedia?: SyntheticMedia & { animation: number }
  __signalProbe?: SignalProbe
}
