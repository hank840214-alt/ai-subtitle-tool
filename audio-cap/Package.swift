// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "audio-cap",
    platforms: [.macOS(.v14)],
    targets: [
        .executableTarget(name: "audio-cap", path: "Sources"),
    ]
)
