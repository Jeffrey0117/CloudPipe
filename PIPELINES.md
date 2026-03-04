# CloudPipe Pipelines

Multi-step workflows that chain together multiple MCP tools.

## 🆕 New Pipelines

### Brand Asset Kit Generator

**ID**: `brand-asset-kit`
**Purpose**: 一鍵生成品牌素材包（去背 logo + 全套 favicon + 社群圖）

**Input**:
- `url` (required): Logo 圖片 URL
- `projectName` (optional): 專案名稱（用於檔案命名）

**Steps**:
1. 檢查圖片 metadata（尺寸、格式）
2. 移除背景（REPIC remove_background）
3. 生成 favicon 套件（16/32/180/192/512）
4. 生成 OG image (1200x630)
5. 生成 Twitter card (800x418)
6. 上傳原圖到 duk.tw
7. 上傳去背圖到 duk.tw

**Usage (MCP)**:
```javascript
mcp__cloudpipe__pipeline_brand-asset-kit({
  url: 'https://example.com/logo.png',
  projectName: 'myapp'
})
```

**Usage (Gateway API)**:
```bash
curl -X POST http://localhost:8787/api/gateway/pipeline \
  -H "Authorization: Bearer internal_service_token_change_me" \
  -H "Content-Type: application/json" \
  -d '{
    "pipeline": "brand-asset-kit",
    "input": {
      "url": "https://example.com/logo.png",
      "projectName": "myapp"
    }
  }'
```

---

### Complete Video Learning Package

**ID**: `video-learning-complete`
**Purpose**: 影片學習全餐（下載 → 逐字稿 → 翻譯 → 字彙 → 金句 → 閃卡）

**Input**:
- `url` (required): 影片 URL（YouTube/Instagram/Bilibili/TikTok）
- `pages` (optional): 閃卡頁數，預設 4

**Steps**:
1. 處理影片（ReelScript process_video）— 下載 + Whisper 逐字稿
2. 取得影片詳細資訊（ReelScript get_video）
3. 翻譯逐字稿成中文（ReelScript translate_video）
4. 分析字彙（ReelScript analyze_vocabulary）— 片語/慣用語/搭配詞
5. 生成內容賞析（ReelScript appreciate_video）— 主題 + 金句
6. 生成部落格文章（ReelScript get_article）— 完整內容包
7. 產生閃卡（AutoCard generate_content）

**Usage (MCP)**:
```javascript
mcp__cloudpipe__pipeline_video-learning-complete({
  url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  pages: 4
})
```

**Usage (Gateway API)**:
```bash
curl -X POST http://localhost:8787/api/gateway/pipeline \
  -H "Authorization: Bearer internal_service_token_change_me" \
  -H "Content-Type: application/json" \
  -d '{
    "pipeline": "video-learning-complete",
    "input": {
      "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "pages": 4
    }
  }'
```

**Note**: 這個 pipeline 會花幾分鐘執行，因為需要：
- 下載影片
- Whisper 語音辨識
- DeepSeek AI 翻譯/分析
- Gemini AI 生成閃卡

---

## 現有 Pipelines

### Content Pool Refresh
**ID**: `content-pool-refresh`
AI 建議主題 → 生成閃卡 → 存入內容池

### Daily Learning Digest
**ID**: `daily-learning-digest`
取得今日學習片段 + 金句

### Notebook → Flashcards
**ID**: `notebook-to-flashcards`
向 NotebookLM 提問 → 生成閃卡

### Test REPIC Background Removal
**ID**: `test-repic-bg-removal`
測試 REPIC 去背功能

### Trending → Flashcards
**ID**: `trending-to-flashcards`
取得 YouTube 熱門影片 → 生成閃卡

### Video Vocabulary Extract
**ID**: `video-vocabulary-extract`
處理影片 → 字彙 + 賞析

### YouTube → Flashcards
**ID**: `youtube-to-flashcards`
搜尋 YouTube → 生成閃卡 → 上傳縮圖

---

## How to Create New Pipelines

1. 在 `data/pipelines/` 建立 JSON 檔案
2. 定義 input schema 和 steps
3. 使用 `{{input.xxx}}` 引用輸入
4. 使用 `{{steps.xxx.data.yyy}}` 引用前一步結果
5. 重啟 CloudPipe gateway 或 MCP server 自動註冊

**Pipeline 結構**:
```json
{
  "id": "my-pipeline",
  "name": "My Pipeline",
  "description": "What it does",
  "input": {
    "param1": { "type": "string", "required": true, "description": "..." },
    "param2": { "type": "number", "required": false }
  },
  "steps": [
    {
      "id": "step1",
      "tool": "project_tool_name",
      "params": { "arg": "{{input.param1}}" }
    },
    {
      "id": "step2",
      "tool": "another_tool",
      "params": { "data": "{{steps.step1.data.result}}" },
      "continueOnError": true
    }
  ]
}
```

---

## Testing Pipelines

```bash
# List all pipelines
curl http://localhost:8787/api/gateway/pipelines \
  -H "Authorization: Bearer internal_service_token_change_me"

# Run a pipeline
curl -X POST http://localhost:8787/api/gateway/pipeline \
  -H "Authorization: Bearer internal_service_token_change_me" \
  -H "Content-Type: application/json" \
  -d '{"pipeline": "pipeline-id", "input": {...}}'
```

---

## MCP Integration

Pipelines 會自動註冊為 MCP tools，命名規則：
- Pipeline ID: `my-pipeline`
- MCP Tool: `mcp__cloudpipe__pipeline_my-pipeline`

重啟 Claude Code session 後即可使用。
