# Mini Exocore-Style Panel

Repo mẫu kiểu **mini control panel** lấy cảm hứng từ `Twan07/exocore-web`, tập trung vào các chức năng chính:

- tạo project từ **git** hoặc **template**
- sửa file trực tiếp trên web
- mở **shell** theo từng project
- chạy app và xem **log realtime**
- tạo **proxy route** để publish app/service ra ngoài

## Điểm giống hướng exocore-web

Bản này bám theo kiểu panel nhiều màn thay vì một trang duy nhất:

- `panel.html`: trang tổng quan
- `project.html`: tạo project
- `dashboard.html`: project overview + proxy + system info
- `manager.html`: file manager + editor
- `shell.html`: terminal theo project
- `console.html`: run app + logs realtime

## Stack

- Node.js + Express
- WebSocket (`ws`) cho shell và logs realtime
- `http-proxy` cho reverse proxy
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
- `GET /api/projects/:id`
- `DELETE /api/projects/:id`
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
- `WS /ws/shell?projectId=...`

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
2. Tạo project từ template `node-api`
3. Sang `manager.html` để sửa `package.json` hoặc `server.js`
4. Sang `console.html` chạy `npm install && npm start`
5. Xem log realtime
6. Tạo proxy route:
   - prefix: `/apps/api`
   - target: `http://127.0.0.1:4010`
7. Truy cập app qua:
   - `http://localhost:3000/apps/api`

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

## Khác với exocore-web ở chỗ nào?

- không dùng hardcoded credential
- không có các màn auth/profile/plans
- code gọn hơn để dễ sửa tiếp
- không dùng CodeMirror hay SolidJS, thay bằng frontend thuần

Nếu muốn, có thể nâng cấp tiếp sang:

- Monaco editor / CodeMirror
- `node-pty` cho terminal chuẩn TTY
- upload/download file hoặc zip project
- process auto-restart kiểu PM2 mini
