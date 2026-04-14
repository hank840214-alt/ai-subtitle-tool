// Runs in audio thread — collects PCM samples and posts to main thread
class PcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = [];
    this._sampleCount = 0;
    // Send every 2 seconds of audio (16kHz * 2 = 32000 samples)
    this._chunkSize = 32000;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    // Input is 44.1kHz/48kHz float32 — downsample to 16kHz
    const samples = input[0];
    const ratio = sampleRate / 16000;

    for (let i = 0; i < samples.length; i += ratio) {
      const idx = Math.floor(i);
      if (idx < samples.length) {
        // Convert float32 [-1,1] to int16
        const s = Math.max(-1, Math.min(1, samples[idx]));
        this._buffer.push(s < 0 ? s * 0x8000 : s * 0x7fff);
        this._sampleCount++;
      }
    }

    if (this._sampleCount >= this._chunkSize) {
      const pcm = new Int16Array(this._buffer.splice(0, this._chunkSize));
      this._sampleCount -= this._chunkSize;
      this.port.postMessage(pcm.buffer, [pcm.buffer]);
    }

    return true;
  }
}

registerProcessor("pcm-processor", PcmProcessor);
