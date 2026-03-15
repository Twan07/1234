# Mini Exocore-Style Panel

Repo mẫu kiểu **mini control panel** lấy cảm hứng từ `Twan07/exocore-web`, tập trung vào các chức năng chính:

- tạo project từ **template**, **Git URL** hoặc **ZIP upload**
- sửa file trực tiếp trên web bằng **CodeMirror**
- mở **shell chuẩn TTY** theo từng project
- chạy app và xem **log realtime**
- tạo **proxy route** để publish app/service ra ngoài
- **import / export project dạng zip**

## Điểm giống hướng exocore-web

Bản này bám theo kiểu panel nhiều màn thay vì một trang duy nhất:

- `panel.html`: trang tổng quan
- `project.html`: tạo project
- `dashboard.html`: project overview + proxy + zip import/export + system info
- `manager.html`: file manager + CodeMirror editor
- `shell.html`: terminal xterm.js + node-pty
- `console.html`: run app + logs realtime

## Stack

- Node.js + Express
- WebSocket (`ws`) cho shell và logs realtime
- `http-proxy` cho reverse proxy
- `node-pty` cho terminal chuẩn TTY
- `adm-zip` cho import/export zip
- Frontend thuần HTML/CSS/JS để dễ sửa và dễ tự host

## Chạy nhanh

```bash
npm install
npm run start
```

Mặc định panel chạy ở:

```bash
http://localhost:3000
```

Trang mở đầu:

```bash
http://localhost:3000/panel.html
```

## Lưu ý khi cài `node-pty`

`node-pty` là native module, nên máy build cần có toolchain phù hợp.

Linux thường cần:

```bash
sudo apt install -y make python3 build-essential
```

## Cấu trúc

```text
src/
  lib/
  routes/
public/
  js/
templates/
runtime/
projects/
```

## API chính

### Projects

- `GET /api/projects`
- `GET /api/projects/templates`
- `POST /api/projects/create`
- `POST /api/projects/create-from-zip?name=...` (`application/zip`)
- `GET /api/projects/:id`
- `DELETE /api/projects/:id`
- `GET /api/projects/:id/export-zip`
- `POST /api/projects/:id/import-zip?replace=1` (`application/zip`)
- `GET /api/projects/:id/tree?path=`
- `GET /api/projects/:id/file?path=`
- `PUT /api/projects/:id/file`
- `POST /api/projects/:id/fs/create`
- `POST /api/projects/:id/fs/rename`
- `DELETE /api/projects/:id/fs/item?path=`

### Runtime

- `POST /api/runtime/:id/run`
- `POST /api/runtime/:id/stop`
- `GET /api/runtime/:id/logs`
- `WS /ws/logs?projectId=...`
- `WS /ws/shell?projectId=...&cols=...&rows=...`

### Proxy

- `GET /api/proxy-routes`
- `POST /api/proxy-routes`
- `DELETE /api/proxy-routes/:id`

### System

- `GET /api/system`

## Templates có sẵn

- `blank`
- `static-site`
- `node-api`

## Ví dụ workflow

1. Vào `project.html`
2. Tạo project từ `node-api`, Git URL hoặc upload zip
3. Sang `manager.html` để sửa code với CodeMirror
4. Sang `console.html` chạy `npm install && npm start`
5. Sang `shell.html` để thao tác terminal chuẩn hơn
6. Tạo proxy route:
   - prefix: `/apps/api`
   - target: `http://127.0.0.1:4010`
7. Truy cập app qua:
   - `http://localhost:3000/apps/api`
8. Tải backup project bằng zip ở `dashboard.html`

## Lưu ý bảo mật

Repo này hướng tới self-host / dùng cá nhân trên VPS hoặc máy riêng. Nó **chưa** có:

- auth/login
- sandbox process
- quota CPU/RAM
- ACL file system
- audit log

Nếu bạn muốn public ra internet, nên thêm ít nhất:

- đăng nhập + session
- rate limit
- allowlist thư mục
- tách runner vào worker riêng
- reverse proxy ngoài bằng Nginx hoặc Caddy
- container hóa project runner, nhất là shell / node-pty

## Khác với exocore-web ở chỗ nào?

- không dùng hardcoded credential
- không có các màn auth/profile/plans
- code gọn hơn để dễ sửa tiếp
- dùng frontend thuần thay vì app framework riêng
- editor hiện dùng CodeMirror qua CDN ESM để tích hợp nhanh

## Nâng cấp tiếp

Các bước tiếp theo hợp lý sau bản này:

- Monaco editor local bundle thay cho CDN ESM
- process auto-restart kiểu PM2 mini
- upload file drag-and-drop
- multi-user + auth + permission
- git status / commit / pull trực tiếp trên panel
