import AVFoundation
import Foundation
import ScreenCaptureKit

@main
struct AudioCap {
    static func main() async throws {
        let content = try await SCShareableContent.current
        guard let display = content.displays.first else {
            FileHandle.standardError.write("No display found\n".data(using: .utf8)!)
            exit(1)
        }

        let filter = SCContentFilter(display: display, excludingWindows: [])
        let config = SCStreamConfiguration()
        config.capturesAudio = true
        config.excludesCurrentProcessAudio = false
        config.sampleRate = 16000
        config.channelCount = 1

        let stream = SCStream(filter: filter, configuration: config, delegate: nil)
        let handler = AudioHandler()

        try stream.addStreamOutput(handler, type: .audio, sampleHandlerQueue: .main)
        try await stream.startCapture()

        FileHandle.standardError.write("audio-cap: streaming 16kHz mono PCM to stdout\n".data(using: .utf8)!)

        let sig = DispatchSource.makeSignalSource(signal: SIGINT, queue: .main)
        sig.setEventHandler {
            Task {
                try? await stream.stopCapture()
                exit(0)
            }
        }
        sig.resume()
        signal(SIGINT, SIG_IGN)

        RunLoop.main.run()
    }
}

class AudioHandler: NSObject, SCStreamOutput {
    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of type: SCStreamOutputType) {
        guard type == .audio else { return }
        guard let blockBuffer = sampleBuffer.dataBuffer else { return }

        let length = CMBlockBufferGetDataLength(blockBuffer)
        var data = Data(count: length)
        data.withUnsafeMutableBytes { rawPtr in
            CMBlockBufferCopyDataBytes(blockBuffer, atOffset: 0, dataLength: length, destination: rawPtr.baseAddress!)
        }

        let float32Count = length / 4
        var pcmData = Data(capacity: float32Count * 2)
        data.withUnsafeBytes { rawPtr in
            let floats = rawPtr.bindMemory(to: Float.self)
            for i in 0..<float32Count {
                let clamped = max(-1.0, min(1.0, floats[i]))
                var sample = Int16(clamped * 32767.0)
                pcmData.append(Data(bytes: &sample, count: 2))
            }
        }

        FileHandle.standardOutput.write(pcmData)
    }
}
