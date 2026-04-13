# AI Subtitle Tool

AI 驅動的字幕生成工具，專為**繁體中文**最高精準度設計。

## 特色

- 🎯 **繁體中文最準確** — BELLE-whisper (比原版 Whisper 好 24-65%) + opencc s2twp 台灣用詞
- 🎬 **長影片支援** — VAD 自動切段，無長度限制
- 📦 **多格式輸出** — SRT / VTT / ASS / TXT
- 🔥 **字幕燒錄** — 直接輸出帶字幕的 MP4
- 📂 **批量處理** — 整個資料夾一次搞定
- 🔒 **完全離線** — 100% 本地運行，隱私優先

## 安裝

```bash
cd ai-subtitle-tool
uv venv .venv --python 3.12
source .venv/bin/activate
uv pip install -e .
```

## 使用

```bash
# 基本轉錄
subtitle transcribe video.mp4

# 指定格式和語言
subtitle transcribe video.mp4 -f ass -l auto

# 批量處理
subtitle batch ./videos/

# 燒錄字幕到影片
subtitle burn video.mp4 video.srt
```

## 技術架構

```
影片/音訊 → FFmpeg 解碼 → faster-whisper (BELLE model) → opencc s2twp → SRT/VTT/ASS
                                    ↑                         ↑
                              VAD 長影片切段            簡→繁(台灣用詞)
```

## Roadmap

- [x] Phase 1: CLI 工具
- [ ] Phase 2: Web UI (FastAPI + React)
- [ ] Phase 3: Desktop App (Electron/Tauri)

## License

MIT
