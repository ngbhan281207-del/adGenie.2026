# AdGenie – Trình tạo caption mạng xã hội bằng AI

Tạo 3 caption, 3 headline và 5 hashtag theo từng nền tảng (Facebook, Instagram, TikTok, LinkedIn, Threads, X), có lịch sử, bộ đếm ký tự và lịch đăng bài.

## Cấu trúc
| File | Vai trò |
|---|---|
| `index.html` | Giao diện (HTML + Tailwind CDN + JS thuần) |
| `api/generate.js` | Proxy serverless gọi Gemini, giữ API key ở phía server |
| `server.js` | Máy chủ chạy local, phục vụ `index.html` và `/api/generate` |

## Chạy local (cần Node.js 18+)
1. Lấy API key tại https://aistudio.google.com/apikey
2. Sao chép `.env.example` thành `.env`, điền `GEMINI_API_KEY`
3. Chạy `node server.js`, mở http://localhost:3000

## Model
Server thử lần lượt `gemini-3.6-flash` → `gemini-3.5-flash` → `gemini-2.5-flash` → `gemini-2.0-flash`; gặp lỗi (model chưa có, quá tải, hết lượt) thì chuyển model kế tiếp. Sửa `MODEL_CHAIN` đầu file `api/generate.js` nếu cần.

## Lưu ý
- Lịch sử và lịch đăng lưu trong localStorage của trình duyệt. App không tự đăng bài, chỉ nhắc kế hoạch.
- Ngưỡng cảnh báo ký tự: vàng từ 90% giới hạn, đỏ khi vượt (2.200 cho Facebook/Instagram/TikTok/LinkedIn, 500 cho Threads, 280 cho X).
