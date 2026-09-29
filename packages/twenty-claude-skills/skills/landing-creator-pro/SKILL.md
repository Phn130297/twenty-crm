---
name: landing-creator-pro
description: >
  Tạo landing page bán hàng chuyển đổi cao + tích hợp thanh toán SePay tự động.
  Dùng skill này khi: tạo landing page mới, tạo trang bán khoá học/sản phẩm/dịch vụ/workshop,
  thêm thanh toán SePay, tạo checkout page, setup QR banking tự động, tạo form thu thập lead,
  hoặc bất kỳ yêu cầu nào có chữ "landing", "thanh toán", "đăng ký", "mua", "checkout".
---

# SKILL: Landing Page + SePay Payment — Template Chuẩn

---

## BƯỚC 0 — THU THẬP INPUT (BẮT BUỘC HỎI TRƯỚC KHI VIẾT)

AI hỏi tuần tự từng nhóm. **Không được bắt đầu viết code khi chưa đủ thông tin nhóm A.**

---

### NHÓM A — Thông tin sản phẩm (bắt buộc)

```
1. Tên sản phẩm / khoá học / dịch vụ là gì?
   VD: "Workshop AI Marketing", "Khoá học Canva", "Coaching 1-1"

2. Giá bán chính thức (giá thường) là bao nhiêu?
   VD: 5.000.000đ

3. Có giá ưu đãi / early bird không? Nếu có là bao nhiêu?
   VD: 3.500.000đ — hết ngày DD/MM/YYYY

4. Chương trình diễn ra như thế nào?
   (Offline / Online / Hybrid? Ngày nào? Ở đâu? Bao nhiêu buổi?)

5. Đối tượng khách hàng là ai?
   (Chủ shop, marketer, nhân viên văn phòng, chủ doanh nghiệp...)

6. Khách hàng đang gặp vấn đề gì mà sản phẩm này giải quyết?
   (Liệt kê 3-5 nỗi đau cụ thể)

7. Sau khi mua xong, khách nhận được gì?
   (Liệt kê 3-6 lợi ích cụ thể, đo được)

8. Còn bao nhiêu suất? Deadline ưu đãi là khi nào?
```

---

### NHÓM B — Thông tin kỹ thuật (bắt buộc)

```
9.  Tên miền / subdomain muốn đặt landing là gì?
    VD: "bam.huuthi.com", "workshop.tenmien.com"

10. Đã có hosting chưa? Dùng hosting nào?
    (cPanel / Vercel / GitHub Pages / WordPress...)

11. Google Sheets ID để lưu lead đăng ký?
    (Lấy từ URL sheet: docs.google.com/spreadsheets/d/[SHEET_ID]/edit)
    Nếu chưa có → AI hướng dẫn tạo mới

12. Google Apps Script URL (để nhận data từ form)?
    Nếu chưa có → AI tạo code Apps Script mẫu cho

13. Có dùng thanh toán SePay không?
    Nếu có → cần:
    a. Program slug (URL-safe, chữ thường, VD: "workshop-ai")
    b. Product slug (ngắn, VD: "ws")
    c. Subdomain name trong hệ thống SePay
    d. URL checkout SePay (api.huuthi.com hay server khác?)
```

---

### NHÓM C — Thương hiệu & Design (tuỳ chọn)

```
14. Tên thương hiệu / công ty?

15. Màu chủ đạo của thương hiệu? (hex code hoặc mô tả)
    Nếu không có → dùng Design System BAM mặc định

16. Logo URL (nếu có)?

17. Có ảnh sản phẩm / ảnh sự kiện / ảnh học viên không?
    (URL hoặc upload)

18. GA4 Measurement ID để tracking?
    VD: G-XXXXXXXXXX
    Nếu không có → bỏ qua hoặc hướng dẫn tạo
```

---

### NHÓM D — Nội dung bổ sung (tuỳ chọn)

```
19. Có testimonial / feedback từ khách hàng cũ không?
    (Tên + chức danh + quote + kết quả cụ thể)

20. Thông tin người dạy / founder?
    (Tên, chức danh, kinh nghiệm, credential)

21. Có FAQ thường gặp không?
    (Liệt kê 3-5 câu hỏi + trả lời)

22. Chính sách hoàn tiền / cam kết?
    VD: "Hoàn 100% trong 7 ngày nếu không hài lòng"
```

---

## BƯỚC 1 — SETUP APPS SCRIPT (nếu chưa có)

Khi user chưa có Apps Script URL, AI cung cấp code này:

```javascript
// ============================================================
// Landing Page — Google Apps Script
// HƯỚNG DẪN:
// 1. Vào script.google.com → New Project
// 2. Đặt tên: "[Tên sản phẩm] — Lead Capture"
// 3. Paste code này → Lưu
// 4. Deploy → New Deployment → Web App
//    Execute as: Me | Who has access: Anyone
// 5. Copy URL → dán vào biến SHEET_URL trong file HTML
// ============================================================

const SHEET_ID   = '{{GOOGLE_SHEET_ID}}';   // ← Thay bằng Sheet ID thật
const SHEET_NAME = '{{TÊN SHEET}}';          // ← VD: "Đăng ký Workshop"

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.openById(SHEET_ID);

    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.getRange(1, 1, 1, 6).setValues([[
        'Thời gian', 'Họ tên', 'Số điện thoại', 'Email', 'Nguồn', 'Trạng thái'
      ]]);
      sheet.getRange(1, 1, 1, 6)
        .setFontWeight('bold')
        .setBackground('#d4b35a')
        .setFontColor('#000000');
      sheet.setFrozenRows(1);
      sheet.setColumnWidth(1, 160);
      sheet.setColumnWidth(2, 180);
      sheet.setColumnWidth(3, 130);
      sheet.setColumnWidth(4, 220);
      sheet.setColumnWidth(5, 160);
      sheet.setColumnWidth(6, 120);
    }

    sheet.appendRow([
      data.time  || new Date().toLocaleString('vi-VN'),
      data.name  || '',
      data.phone || '',
      data.email || '',
      data.source || '{{TÊN SẢN PHẨM}} Landing',
      'Chờ thanh toán'
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function testConnection() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  Logger.log('Kết nối thành công: ' + ss.getName());
}
```

---

## BƯỚC 2 — SETUP SEPAY (nếu dùng)

### SQL tạo product mới trong phpMyAdmin

```sql
-- Kiểm tra subdomain_id trước
SELECT id, name FROM subdomains;

-- Tạo program
INSERT INTO programs (slug, name, subdomain_id, brand_account_id, checkout_template_id, active)
VALUES ('{{PROGRAM_SLUG}}', '{{TÊN SẢN PHẨM}}', {{SUBDOMAIN_ID}}, 1, 1, 1);

-- Tạo product (LƯU Ý: table = program_products, cột giá = price)
INSERT INTO program_products (program_id, slug, name, price, active)
VALUES (
  (SELECT id FROM programs WHERE slug = '{{PROGRAM_SLUG}}'),
  '{{PRODUCT_SLUG}}',
  '{{TÊN SẢN PHẨM}}',
  {{GIÁ_SỐ_NGUYÊN}},
  1
);

-- Kiểm tra sau khi insert
SELECT p.slug, p.subdomain_id, pp.slug as product_slug, pp.price
FROM programs p
JOIN program_products pp ON pp.program_id = p.id
WHERE p.slug = '{{PROGRAM_SLUG}}';
```

**URL checkout:**
```
https://api.huuthi.com/sepay/pay.php?program={{PROGRAM_SLUG}}&from={{SUBDOMAIN}}&product={{PRODUCT_SLUG}}
```

---

## BƯỚC 3 — CẤU TRÚC LANDING PAGE

### 13 Section theo thứ tự

```
[0]  Announce Bar     → FOMO / scarcity / deadline
[1]  Hero             → Headline + tagline + CTA chính
[2]  Trust Bar        → Số liệu uy tín
[3]  Pain Section     → 3 nhóm nỗi đau cụ thể của khách
[4]  Bridge           → Giải pháp
[5]  Programme        → Lộ trình + nội dung chi tiết (1 section)
[6]  Benefits         → 6 lợi ích cụ thể, đo được
[7]  Is For/Not For   → Ai nên / không nên tham gia
[8]  Result           → Số liệu kết quả
[9]  Stack/Tools      → Công cụ / phương pháp sử dụng
[10] CTA Banner       → Push cuối trước pricing
[11] Pricing          → Slots + giá gạch + giá ưu đãi + bao gồm gì
[12] Registration     → Form → Sheets → Redirect thanh toán
[13] Footer           → Brand info
```

---

## DESIGN SYSTEM MẶC ĐỊNH

### Font (Google Fonts)
```
Headline:  Playfair Display — 700, 900, italic
Body/UI:   Be Vietnam Pro — 300, 400, 600, 700, 800
```

### Màu sắc
```css
--forest:       #0b1f14   /* Hero bg, featured card */
--forest-mid:   #1a4a2a   /* Border, gradient */
--forest-light: #e6f0ea   /* Tag bg, badge */
--gold-bright:  #d4b35a   /* CTA button, header bar ← MÀU CHÍNH */
--gold-dark:    #8a7030   /* Shadow, border */
--gold-pale:    #fdf5e0   /* Section bg nhẹ */
--paper:        #f4f1eb   /* Background tổng */
--cream:        #faf7f0   /* Section xen kẽ */
--ink:          #0d0d0d   /* Text chính */
--gray:         #6b6355   /* Subtext */
--border:       #ddd5c0   /* Card border */
--ember:        #c0392b   /* Pain / cảnh báo */
```

### Rules bắt buộc
```
Header bar:   nền #d4b35a · chữ #0d0d0d (KHÔNG dùng màu khác)
CTA button:   nền #d4b35a · chữ #0d0d0d · shadow 3D 4px 4px 0 #8a7030
Border radius: 4px (không bo tròn nhiều)
Shadow 3D:    4px 4px 0 [màu tối hơn 1 tông]
GA4:          Gắn vào mọi landing nếu có Measurement ID
```

---

## PATTERN FORM + REDIRECT

```html
<script>
const SHEET_URL = '{{APPS_SCRIPT_URL}}';
const CHECKOUT_URL = '{{SEPAY_URL hoặc link thanh toán khác}}';

async function submitForm() {
  const name  = document.getElementById('reg-name').value.trim();
  const phone = document.getElementById('reg-phone').value.trim();
  const email = document.getElementById('reg-email').value.trim();

  if (!name)  { alert('Vui lòng nhập họ tên.'); return; }
  if (!phone) { alert('Vui lòng nhập số điện thoại.'); return; }
  if (!email) { alert('Vui lòng nhập email.'); return; }

  // Disable button
  const btn = document.getElementById('reg-submit');
  btn.disabled = true;

  // Fire-and-forget: lưu Sheets (KHÔNG await — không block redirect)
  fetch(SHEET_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name, phone, email,
      source: '{{TÊN SẢN PHẨM}} Landing',
      time: new Date().toLocaleString('vi-VN')
    })
  });

  // GA4 event (nếu có)
  if (typeof gtag !== 'undefined') {
    gtag('event', 'dang_ky', {
      event_category: 'lead',
      event_label: '{{TÊN SẢN PHẨM}}',
      name, phone, email
    });
  }

  // Redirect sau 400ms
  setTimeout(() => {
    window.location.href = CHECKOUT_URL
      + '&name='  + encodeURIComponent(name)
      + '&phone=' + encodeURIComponent(phone)
      + '&email=' + encodeURIComponent(email);
  }, 400);
}
</script>
```

---

## CHECKLIST TRƯỚC KHI XUẤT BẢN

```
□ Announce bar màu vàng #d4b35a, chữ đen
□ Headline dùng Playfair Display
□ CTA hero nút vàng chữ đen, có mũi tên →
□ Pain section có ít nhất 2 nhóm nỗi đau
□ Pricing hiển thị đúng giá gạch + giá ưu đãi
□ Form điền → redirect đúng trang thanh toán
□ GA4 ID gắn đúng (nếu có)
□ Test trên mobile (font ≥ 16px, CTA ≥ 48px)
□ Upload index.html lên hosting
□ Test điền form → kiểm tra Google Sheets có data
□ Test thanh toán → kiểm tra QR hiện đúng giá
```

---

## OUTPUT AI TẠO RA

```
1. apps-script.js     → Code Apps Script, điền SHEET_ID + deploy
2. setup-db.sql       → SQL tạo program + product trong SePay DB (nếu dùng SePay)
3. index.html         → Landing page hoàn chỉnh, upload lên hosting
4. checklist-deploy.md → Hướng dẫn từng bước deploy trong 15 phút
```
