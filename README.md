# Request Mocker (Chrome Extension)

Mock routes in the browser by intercepting `fetch` and `XMLHttpRequest` and returning custom responses (JSON, text, XML, etc.).

## Features

- Add/edit/delete mock routes
- Match by **includes**, **exact**, or **regex**
- Filter by **HTTP method**
- Configure **status code**, **Content-Type**, **headers**, and **delay**
- Side-effect checks:
  - Invalid regex detection
  - JSON validation when Content-Type contains `json`
  - Large body warning
  - Overlap/duplicate route detection (first match wins)
- Monitoring:
  - Per-route hit counts + last activity
  - Recent events (success/error)

## Development

### Install

```bash
npm install
```

### Build

```bash
npm run build
```

Vite outputs a Chrome-loadable extension bundle to `dist/`.

### Watch mode (rebuild on changes)

```bash
npm run dev
```

## Load into Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `dist/` folder

## Notes / Limitations

- This extension mocks requests by overriding `fetch` and `XMLHttpRequest` in the **page context**. It won’t affect:
  - Requests made by the browser outside the page JS runtime
  - Service-worker initiated requests that bypass the page context
- Order matters: the **first matching enabled route wins**.

