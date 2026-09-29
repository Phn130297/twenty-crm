# Kế hoạch Custom Twenty CRM → CRM Riêng

## 🎯 Mục tiêu
Biến Twenty CRM (mã nguồn mở) thành CRM riêng với đầy đủ tính năng như WePower Hub.

## 📌 Hiện trạng
- ✅ Twenty CRM đã chạy tại http://localhost:3001
- ✅ Docker Compose (Postgres 16 + Redis)
- ✅ GraphQL API sẵn sàng

## 🔧 Các module cần phát triển

### Phase 1 — Cốt lõi (1-2 tuần)
Twenty CRM đã có sẵn các module này:
- [x] **Contacts** (Quản lý khách hàng)
- [x] **Companies** (Quản lý doanh nghiệp)
- [x] **Deals / Pipeline** (Quản lý cơ hội)
- [x] **Tasks** (Công việc)
- [x] **Calendar** (Lịch)
- [x] **GraphQL API + Rest API**

Cần mở rộng/tùy chỉnh:
- [ ] **Tags / Labels** — Phân nhóm khách hàng (Twenty có sẵn, cần cấu hình thêm)
- [ ] **Custom Objects** — Dùng tính năng Object Metadata của Twenty để tạo đối tượng tùy chỉnh
- [ ] **Multi-workspace** — Twenty đã hỗ trợ sẵn

### Phase 2 — Marketing & Landing Page (2-3 tuần)
- [ ] **Landing Page Builder** — Tạo trang đích từ giao diện kéo thả
  - Framework: React + Twenty-ui components
  - AI sinh nội dung (dùng OpenAI/Gemini API)
  - Mẫu có sẵn (Wepower V4.0)
  - Custom domain support
- [ ] **Email Marketing** — Gửi email chiến dịch
  - Module twenty-emails có sẵn
  - Cần thêm: campaign management, template library, stats tracking
  - Tích hợp SMTP/SendGrid
- [ ] **Drip Sequences** — Chuỗi email tự động

### Phase 3 — Thanh toán (1-2 tuần)
- [ ] **VietQR** — Tạo mã QR thanh toán trong đơn hàng
  - Dùng thư viện `qrcode` + VietQR API
  - Tự động tạo link QR khi tạo invoice
- [ ] **SePay** — Tự động đối soát giao dịch ngân hàng
  - Webhook nhận từ SePay
  - Tự động cập nhật trạng thái invoice
- [ ] **Products & Pricing** — Quản lý sản phẩm/dịch vụ (Twenty đã có object model)

### Phase 4 — Tích hợp (1 tuần)
- [ ] **Telegram Bot** — Gửi báo cáo, thông báo
  - Dùng Telegram Bot API
  - Báo cáo hàng ngày/tuần
- [ ] **VinPeti Integration** — Đồng bộ dữ liệu
  - API connect giữa Twenty CRM và VinPeti backend
  - Tự động tạo contact khi có khách hàng mới ở VinPeti
  - Đồng bộ đơn hàng, công nợ
- [ ] **Webhook** — Cho phép tích hợp bên thứ ba

### Phase 5 — Nâng cao (2-3 tuần)
- [ ] **Customer Journey** — Replay lịch sử tương tác của khách
- [ ] **Dashboard & KPI** — Báo cáo doanh thu, chuyển đổi
  - Tận dụng ClickHouse nếu cần (Twenty có hỗ trợ)
- [ ] **Workflow Automation** — Tự động hóa quy trình
- [ ] **Phân quyền / Roles** — Twenty đã có sẵn

## 🛠️ Công nghệ sử dụng
- **Frontend**: React 18, TypeScript, Linaria, Vite (giữ nguyên Twenty stack)
- **Backend**: NestJS, TypeORM, PostgreSQL, Redis, GraphQL
- **New modules**: 
  - Landing Page: Next.js hoặc React standalone
  - Email: React Email (Twenty đã dùng) + SendGrid/SMTP
  - Payment: VietQR API + SePay Webhook
  - Bot: Telegram Bot API (node-telegram-bot-api)

## 📂 Cấu trúc thư mục custom
```
packages/
├── twenty-custom/
│   ├── landing-page/        # Landing page builder
│   ├── email-marketing/     # Email campaigns
│   ├── payment/             # VietQR + SePay
│   ├── telegram/            # Telegram bot
│   └── vinpeti-bridge/      # VinPeti integration
```

## 🚀 Deploy Production
- VPS: Ubuntu 22.04+ | 2GB RAM | 2 CPU
- Docker Compose với reverse proxy (Nginx + Let's Encrypt)
- Domain: crm.tenmiencuaban.com
- Backup: tự động daily backup PostgreSQL

## 📋 Checklist hoàn thành
- [ ] Phase 1 — Core customization
- [ ] Phase 2 — Marketing & Landing
- [ ] Phase 3 — Payment
- [ ] Phase 4 — Integrations
- [ ] Phase 5 — Advanced
- [ ] Deploy production
