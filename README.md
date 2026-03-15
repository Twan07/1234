# Mini Control Panel

Một repo mẫu kiểu control panel mini để:

- tạo project từ `git` hoặc `template`
- sửa file trực tiếp trên web
- mở shell theo từng project
- chạy app và xem log realtime
- proxy route ra ngoài

## Stack

- Node.js + Express
- WebSocket (`ws`) cho shell và log realtime
- `http-proxy` để route traffic ra app/service khác
- Frontend thuần HTML/CSS/JS để dễ sửa

## Chạy nhanh

```bash
npm install
npm run start
```

Mặc định web panel chạy ở:

```bash
http://localhost:3000
```

## Cấu trúc

```text
src/
  lib/
  routes/
public/
templates/
runtime/
projects/
```

## Tính năng hiện có

### 1) Tạo project

- từ Git URL bằng `git clone`
- từ template có sẵn:
  - `blank`
  - `static-site`
  - `node-api`

### 2) Sửa file trên web

- xem tree thư mục
- đọc file
- lưu file
- chặn path traversal

### 3) Shell

- shell theo project qua WebSocket
- dùng `/bin/bash`, `/bin/sh`, `powershell.exe` hoặc `cmd.exe` tùy hệ điều hành

> Bản này là shell dạng stream stdin/stdout, đủ cho đa số lệnh dòng lệnh. Nếu bạn muốn TTY đầy đủ cho ứng dụng kiểu `htop`, `vim`, `nano`, có thể nâng cấp sang `node-pty` + terminal frontend.

### 4) Run app + log

- chạy 1 process cho mỗi project
- dừng/restart project
- xem log realtime
- giữ log gần nhất trong memory

### 5) Proxy route

- map `pathPrefix -> target`
- ví dụ `/apps/demo` -> `http://127.0.0.1:5173`
- giữ nguyên stream response

## API chính

### Projects

- `GET /api/projects`
- `POST /api/projects/create`
- `GET /api/projects/:id/tree?path=`
- `GET /api/projects/:id/file?path=`
- `PUT /api/projects/:id/file`

### Runtime

- `POST /api/projects/:id/run`
- `POST /api/projects/:id/stop`
- `GET /api/projects/:id/logs`

### Proxy

- `GET /api/proxy-routes`
- `POST /api/proxy-routes`
- `DELETE /api/proxy-routes/:id`

## Ví dụ workflow

1. Tạo project từ template `node-api`
2. Mở file `package.json` và `server.js` để sửa
3. Bấm Run với lệnh `npm install && npm start`
4. Xem log ở tab Logs
5. Tạo proxy route:
   - prefix: `/apps/api`
   - target: `http://127.0.0.1:4010`
6. Truy cập:
   - `http://localhost:3000/apps/api`

## Lưu ý bảo mật

Repo này đang hướng tới self-host / dùng cá nhân trên VPS nội bộ, nên chưa có:

- auth/login
- sandbox process
- quota CPU/RAM
- ACL file system
- audit log

Nếu bạn muốn đem ra internet công khai, nên thêm ít nhất:

- đăng nhập + session
- allowlist thư mục
- rate limit
- tách runner vào worker riêng
- giới hạn command shell
- reverse proxy ngoài bằng Nginx/Caddy

