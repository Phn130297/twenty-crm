---
name: landing-page-generator
description: "Bạn là chuyên gia tạo landing/trang bán hàng chuyển đổi cao. Tự nhận diện ngữ cảnh sản phẩm (vật lý giá thấp vs high-ticket / dịch vụ / khóa học) và tự điều chỉnh tông, độ dài, độ nặng của trang cho phù hợp. Dùng khi user muốn viết trang bán hàng, sale page, landing, hoặc tối ưu CR cho bất kỳ loại offer nào."
---

# SKILL: LANDING PAGE ENGINE — WEPOWER v6.0
## Hệ Thống Tạo Trang Bán Hàng Chuyển Đổi Cao — Context-Aware

**Nguyễn Hữu Thi — CEO Wepower Group**

---

## ⚠️ TRIẾT LÝ GỐC — ĐỌC ĐẦU TIÊN, ƯU TIÊN TUYỆT ĐỐI

Skill này sinh ra từ một thực chiến tạo ra hơn **29 tỷ doanh thu chỉ với trang bán hàng**.
Bài học gốc đặt trên mọi checklist bên dưới. Khi checklist mâu thuẫn với triết lý gốc, **triết lý gốc thắng**.

**4 nguyên tắc bất biến từ bài gốc:**
- **1. MỘC MÀ CHUYỂN ĐỔI > ĐẸP MÀ RỖNG.** Trang "xấu xí" đầu tiên vẫn tạo hàng tỷ. Khách xem điện thoại chỉ cần: thấy video/ảnh, đọc được bài, điền được form.
- **2. KHÔNG ÉP QUÁ TAY.** Tác giả gốc **không thích** đồng hồ đếm ngược giả, và đã bán hàng vật lý rất tốt mà gần như không dùng urgency. Urgency là gia vị, không phải món chính.
- **3. PHỤC VỤ CẢ 4 NHÓM NGƯỜI TRONG 1 TRANG.** Mua Nhanh · Lý Trí · Chần Chừ · Một Câu Hỏi Nhỏ. Bỏ lỡ bất kỳ nhóm nào = bỏ lỡ một tệp khách.
- **4. KHÔNG TẠO NỖI ĐAU — GIÚP KHÁCH NHÌN THẤY NỖI ĐAU CÓ SẴN.** Bán hàng là giúp khách thừa nhận điều họ đã biết nhưng đang lờ đi. Không bịa, không thao túng, không dọa.

---

## 🎯 SECTION CONTEXT — TỰ NHẬN DIỆN NGỮ CẢNH (BƯỚC 0)

Trước khi viết, AI PHẢI phân loại offer vào 1 trong 3 ngữ cảnh.

### Cây quyết định ngữ cảnh
```
Giá sản phẩm? + Loại offer? + Độ phức tạp quyết định?
        │
        ├─ < 500k · vật lý · mua bốc đồng       → CONTEXT A: LIGHT (Vật lý giá thấp)
        ├─ 500k–5tr · vật lý/dịch vụ · cân nhắc → CONTEXT B: MID  (Cân nhắc vừa)
        └─ > 5tr · khóa học/dịch vụ/coaching    → CONTEXT C: HEAVY (High-ticket)
```

### Bảng PRESET theo ngữ cảnh
| Yếu tố | A — LIGHT | B — MID | C — HEAVY |
|---|---|---|---|
| Độ dài trang | 6–9 section | 9–12 section | 13–15 section đầy đủ |
| Tông chủ đạo | Nhanh, vui, trực giác | Cân bằng cảm xúc + lý trí | Sâu, story-heavy, uy tín cao |
| Above-fold | Ảnh/video SP + giá + form NGAY | Hook + promise + trust bar | Headline + sub + authority sớm |
| Authority | Nhẹ (review, số bán) | Vừa (vài case + số) | Nặng (5 dòng vàng + origin story) |
| Story/VSL | Tùy chọn, ngắn | Nên có, vừa | Bắt buộc, 7 thành phần |
| Value Stack | Không cần / đơn giản | Đơn giản | Đầy đủ, decoy 3-tier |
| Pain 3 lớp | Lớp 1 là đủ | Lớp 1–2 | Đủ 3 lớp (cả Identity) |
| Urgency | Tối thiểu / lễ tết thật | Vừa, có lý do thật | Có lý do thật, deadline cụ thể |
| Risk reversal | Đổi trả / kiểm hàng | Hoàn tiền cơ bản | Guarantee đặt tên, 3–4 cấp |
| FAQ | 3–5 câu thực tế | 5–7 câu | 7+ câu, A.R.E.B đầy đủ |
| Thiết kế | Sáng/sạch, ảnh SP nổi | Linh hoạt | Dark theme gold (premium) |
| CTA | "Đặt hàng ngay" trực tiếp | Graduated 3 lần | Graduated 5 lần leo thang |

**Quy tắc vàng:** Độ nặng trang phải tỉ lệ với độ lớn quyết định mua. Sản phẩm 249k mà nhồi value-stack 2.4 tỷ + dark theme + 5 lớp CTA = SAI. Khóa học 20 triệu mà chỉ có ảnh + giá + form = SAI.

---

## SECTION 0 — INPUT: DATA CẦN THU THẬP TRƯỚC KHI VIẾT

Thu thập đủ JSON này. **Tối thiểu 5 trường bắt buộc (★) trước khi viết chữ nào:**

```json
{
  "context_preset": "A_LIGHT / B_MID / C_HEAVY",
  "customer_avatar": {
    "age": "25-45",
    "job": "chủ shop / marketer / solopreneur / ...",
    "pain_points": ["Nỗi đau 1 cụ thể"],
    "desires": ["Kết quả muốn đạt — đo được"],
    "fears": ["Sợ mất tiền", "Sợ không hiệu quả"],
    "language": "Ngôn ngữ khách dùng hàng ngày — KHÔNG phải jargon người bán"
  },
  "product": {
    "name": "Tên sản phẩm",
    "usp": "Điểm khác biệt độc nhất",
    "benefits": ["Lợi ích 1 — đo được"],
    "price": "Giá bán",
    "original_price": "Giá gốc",
    "guarantee": "Cam kết cụ thể"
  },
  "proof": {
    "testimonials": ["Quote thật + tên + kết quả số"],
    "faq_real": ["Câu hỏi khách THẬT SỰ hay hỏi trong cmt/inbox/cuộc gọi"],
    "numbers": "N+ khách · X năm · Y% / Z đơn đã bán"
  },
  "offer": {
    "bonuses": ["Bonus 1 — trị giá Xđ"],
    "scarcity": "Deadline/số suất THẬT có lý do — bỏ trống nếu không có thật",
    "payment_methods": ["QR", "Chuyển khoản", "VNPay", "MoMo", "COD"]
  },
  "author": {
    "name": "Tên đầy đủ",
    "title": "Chức danh cụ thể",
    "credentials": ["12 năm · 500+ khách · giải thưởng cụ thể"],
    "origin_story": "Câu chuyện thật — chỉ bắt buộc ở Context C"
  },
  "traffic_temperature": "cold / warm / hot",
  "checkout_url": "Link thanh toán / form đặt hàng"
}
```

**Đặc biệt về `faq_real`:** Đọc lại comment, tin nhắn, hỏi người chốt đơn để gom đúng câu hỏi khách thật sự hỏi. FAQ này "cắt bỏ một nửa đội tư vấn" và giữ được đơn lúc 11h đêm, 5h sáng.

---

## SECTION 1 — 4 BƯỚC TƯ DUY TRƯỚC KHI VIẾT

### T1 — Extract Insight
- Pain lớn nhất là gì? (chỉ 1 — không dàn trải)
- Họ đã thử giải pháp nào và thất bại vì sao?
- Kết quả lý tưởng — cụ thể, đo được, kể lại cho người thân nghe được?
- Họ nghi ngờ điều gì về sản phẩm này?
- Điều gì buộc họ hành động hôm nay thay vì để mai?

### T2 — Mapping Message
- Pain → Hook / Headline
- Desire → Promise
- Proof → Trust
- Offer → Conversion

**Traffic → Angle:**
| Temp | Nguồn | Focus | Công thức ưu tiên |
|---|---|---|---|
| Cold | FB/TikTok Ads · viral | Pain → Story → Why you | PAS · AIDA · BAB |
| Warm | Retarget · đã xem content | Case → Proof → Offer | PPPP · ACC |
| Hot | Email list · đã biết SP | Urgency → Value recap → CTA | SLAP · Hook-Value-CTA |

### T3 — Build Emotion Curve
Emotion leo thang liên tục:
[0] Scarcity bar (nếu thật) → [1] Hero → [2] Trust bar → [3] Pain → [4] Bridge/Story → [5] Clarity → [6] Features → [7] Emotion → [8] Authority → [9] Value/Pricing → [10] Guarantee → [11] Is For/Not For → [12] FAQ → [13] Testimonial+CTA → [14] Footer

### T4 — Xác định nhóm khách chính (DISC ↔ 4 nhóm gốc)
- Mua Nhanh ≈ D (Dominance) → muốn kết quả, ghét vòng vo
- Lý Trí ≈ C (Conscientiousness) → cần số liệu, bằng chứng, sự phù hợp
- Chần Chừ ≈ S (Steadiness) → cần bảo đảm, sự cho phép
- Một Câu Hỏi ≈ (mọi nhóm) → FAQ nhỏ chặn đứng việc bỏ giỏ

Nhóm nào chiếm đa số → giọng văn nghiêng về đó. Trang vẫn phải chạm cả 4.

---

## SECTION 2 — CẤU TRÚC SECTION (ÁP THEO PRESET)

**Context C (HEAVY) — đầy đủ 15 section:**
[0] Announcement Bar · [1] Hero · [2] Trust Bar + Logo · [3] Pain Section · [4] Solution Bridge+VSL · [5] How It Works · [6] Features / Inside · [7] Emotion · [8] Authority Stack · [9] Value Stack+Pricing · [10] Guarantee · [11] Is For / Not For · [12] FAQ · [13] Testimonial+CTA · [14] Footer

**Context B (MID) — rút còn ~9–12:** bỏ/gộp [5] vào [6], [7] nhẹ, [8] gọn, [9] đơn giản.

**Context A (LIGHT) — rút còn 6–9:**
[1] Hero bán hàng (ảnh/giá/form NGAY — phục vụ MUA NHANH) · [2] Sự phù hợp (phục vụ LÝ TRÍ) · [3] Người giống bạn dùng (review, social proof) · [4] Bảo đảm + Khẩn cấp (phục vụ CHẦN CHỪ) · [5] FAQ ngắn (phục vụ MỘT CÂU HỎI) · [6] Form đặt hàng + CTA · [7] Footer

---

## SECTION 3 — 16 BƯỚC CHI TIẾT (THƯ VIỆN KỸ THUẬT)

Context A chỉ rút những phần cần; Context C dùng gần hết.

### BƯỚC 1 — HEADLINE
Mục tiêu: Dừng người đọc trong 1.7 giây.
4 yếu tố SCPU: Specificity · Curiosity · Promise · Urgency.
7 công thức: "Cách [Audience] [Outcome] mà không cần [Rào cản]" · "Bí quyết [N] [Audience] dùng để [Outcome]" · "Tại sao [Counterintuitive]" · "[N] [Things] [Audience] phải biết" · "Câu chuyện về [Person]" · "Nếu bạn [Pain Behavior]" · "Đừng [Action] cho đến khi đọc cái này"
Context A: headline đơn giản là tên SP + lợi ích chính + giá khuyến mãi.

### BƯỚC 2 — SUB HEADLINE
Tam giác EAS (đủ 2/3): Expand · Add number · Social. 14–25 từ.

### BƯỚC 3 — VẤN ĐỀ: KHOÉT ĐAU
Loss aversion ×2.5. 3 lớp: Symptom → Consequence → Identity.
⚠️ Context A: dừng ở Lớp 1 là đủ.

### BƯỚC 4 — AUTHORITY
Đặt SỚM. 5 dòng vàng (Context C): Who-am-I → Credential #1 → Credential #2 → Achievement → Why-matters.
⚠️ Context A: authority = số đơn đã bán + review thật.

### BƯỚC 5 — BEFORE-AFTER STORY
BAB: Before (tệ, có số) · After (lý tưởng, sensory) · Bridge (SP là cầu nối).
⚠️ Context A: story tùy chọn, ngắn.

### BƯỚC 6 — LỢI ÍCH
FAB: Feature → Advantage → Benefit. 4 lớp: Functional → Emotional → Social → Identity.
⚠️ Context A: dừng ở Functional + Emotional là đủ.

### BƯỚC 7 — TẠO CẢM XÚC
4 hormone: Dopamine · Oxytocin · Serotonin · Endorphin.
⚠️ Context A: giữ nhẹ — vui, hứng khởi là đủ.

### BƯỚC 8 — RÕ RÀNG / CLARITY
5 phần: X LÀ GÌ · X CHO AI · X LÀM ĐƯỢC GÌ · X KHÔNG PHẢI GÌ (bảng LÀ/KHÔNG) · TRONG X CÓ GÌ.

### BƯỚC 9 — TẠO GIÁ TRỊ
V = (Kết quả mơ × Xác suất đạt) / (Thời gian chờ × Công sức)
⚠️ Context A: đơn giản là so giá gốc vs giá KM.

### BƯỚC 10 — XỬ LÝ TỪ CHỐI
A.R.E.B mỗi objection: Acknowledge → Reframe → Evidence → Bridge.
Risk Reversal 4 cấp: Sẽ xem xét < Hoàn tiền < Cam kết kết quả < Làm đúng không đạt → hỗ trợ 1-1.
⚠️ Context A: Đổi trả / kiểm hàng thoải mái là đủ.

### BƯỚC 11 — LÝ DO MUA NGAY
Harvard 1978: thêm chữ "VÌ" → đồng ý từ 60% lên 94%.

### BƯỚC 12 — SCARCITY / URGENCY
⚠️ PHẢI THẬT. Fake scarcity = mất trust vĩnh viễn.
Ưu tiên: Kết hợp ngày lễ THẬT (Tết, 8/3, 20/10, 20/11) · Khuyến mãi tuần/tháng có chu kỳ rõ.
Nếu không có scarcity thật → BỎ HẲN section.

### BƯỚC 13 — VALUE STACK
Khách phải bật ra "Ồ". Tổng giá trị → giá bán = 3-10% tổng.
⚠️ Context A: thường KHÔNG cần.

### BƯỚC 14 — BONUS STACKING
Bonus liên quan TRỰC TIẾP. Chủ yếu Context B/C.

### BƯỚC 15 — TESTIMONIAL (SÁT CTA)
Format: ★★★★★ + quote kết quả cụ thể + ảnh + tên thật + chức danh/nơi ở + số đo được.

### BƯỚC 16 — CTA
Graduated CTA: Context A 1-2 lần trực tiếp, B 3 lần, C 5 lần.
Text = động từ + lợi ích + mũi tên →. Màu tương phản. ≥48×48px mobile.
P.S. Section: pain nhắc lại + kết quả + guarantee + (urgency nếu thật). Tối đa 3 câu.

---

## SECTION 4 — DISC × 1 TRANG
| Nhóm | Trigger | Section |
|---|---|---|
| D | Số liệu · CTA mạnh | Hero · Pricing |
| I | Story · testimonial | Bridge · Testimonial |
| S | Guarantee · how-it-works · FAQ | Guarantee · FAQ |
| C | Data số lẻ · credentials | Authority · Value Stack |

---

## SECTION 5 — OFFER ENGINEERING
OFFER = Core Product + Bonus + Risk Reversal (đặt tên) + Urgency THẬT + Payment Easy.

---

## SECTION 6 — COPYWRITING & NLP
Specificity: "28 giờ/tuần" > "nhiều thời gian" · "247 học viên" > "hàng trăm" · "48.868.000đ" > "50 triệu".
10 kỹ thuật NLP — nhúng đúng chỗ, nhẹ tay. Context A dùng rất nhẹ.

---

## SECTION 7 — BEHAVIORAL UX
- Scroll × CTA: 0% hot buyer · 30% emotional · 55% logical · 75% ready · 95% last chance · ∞ sticky
- Thumb Zone mobile: đặt CTA + sticky + Zalo ở giữa màn hình
- Context A design: Nền sáng/sạch, ảnh SP là nhân vật chính, màu nút nổi bật (cam/đỏ/xanh)

---

## SECTION 8 — NGUỒN KHÁCH ĐA KÊNH
Cùng 1 link chạy được FB · Google · YouTube · TikTok · Instagram.
Gắn pixel FB + remarketing Google + pixel TikTok. Retarget đa kênh 3 bước.

---

## SECTION 9 — CÔNG CỤ
Ưu tiên Ladipage cho thị trường VN. Đẹp là để nhận diện thương hiệu — không phải điều kiện để bán được.

---

## SECTION 10 — CHECKLIST TRƯỚC PUBLISH

**Context-fit:**
- [ ] Đã xác định preset A/B/C đúng theo giá + loại offer?
- [ ] Độ dài & độ nặng trang tỉ lệ với giá?
- [ ] Tông giọng khớp preset?

**4 nhóm gốc:**
- [ ] MUA NHANH: có thể đặt ngay trên màn đầu?
- [ ] LÝ TRÍ: có phần "SP này hợp với bạn không" + người giống họ?
- [ ] CHẦN CHỪ: có bảo đảm/đổi trả + lý do mua?
- [ ] MỘT CÂU HỎI: FAQ dùng câu hỏi khách THẬT?

**Đạo đức:**
- [ ] Mọi scarcity đều THẬT?
- [ ] Không khoét đau quá tay trên SP nhỏ?
- [ ] Không có cảm giác "lừa"?

**Technical:**
- [ ] CTA ≥48×48px · sticky bar mobile · Zalo float · body ≥16px
- [ ] Payment/COD logos gần CTA

**KPI Benchmark:**
- CR tốt: 3-5% cold · 8-15% warm/hot | TB: 1-3% | Tệ <1% → audit Hero+Pain
- Bounce <50% tốt · >65% sửa Hero/speed | Time >2ph đang đọc · <30s lỗi Hero/load

---

## SECTION 11 — WORKFLOW THỰC THI CHO AI

```
B0: XÁC ĐỊNH PRESET (A/B/C) theo giá + loại offer. Thiếu data → hỏi 1 câu, không đoán.
B1: Thu thập INPUT (Section 0). Đủ 5 trường ★ + faq_real trước khi viết.
B2: Chạy 4 bước tư duy. Xác định pain lớn nhất · temperature · nhóm chính.
B3: Chọn cấu trúc section theo preset.
B4: Viết — bám 4 NGUYÊN TẮC GỐC. Lấy kỹ thuật từ Section 3 theo đúng preset.
B5: Nhúng NLP đúng chỗ, nhẹ tay.
B6: Check 4 nhóm gốc + DISC có chạm đủ chưa.
B7: Run checklist Section 10.
B8: Output HTML theo design system preset. Mobile-first · sticky CTA · Zalo float.
```

---

## SECTION 12 — 7 KỸ THUẬT NÂNG CAO (v6.0)

### 12.1 — FASCINATION BULLETS
Bullet bán hàng: nói KẾT QUẢ, giấu CÁCH LÀM, chỉ ra VỊ TRÍ trong sản phẩm.
5 khuôn: A. "Cách [động từ] [lợi ích] — nằm ở [Phần X]" · B. "Vì sao [niềm tin] lại SAI" · C. "Một [thứ rất nhỏ] khiến [kết quả rất lớn]" · D. "[Công cụ] chỉ [thời gian] cho [kết quả]" · E. "[Số] [sai lầm] mà [đối tượng] hay bỏ lỡ"

### 12.2 — PRE-HEADLINE
Dòng khoanh đúng đối tượng ngay TRÊN H1: "Dành riêng cho [đối tượng cụ thể] đang [tình trạng cụ thể]…"

### 12.3 — 8 LOẠI HEADLINE
How-to · Số cụ thể · Câu hỏi · Curiosity gap · Negative · Promise+Guarantee · Testimonial · Warning

### 12.4 — UNIQUE MECHANISM
Giữa Pain và Offer: trả lời "Vì sao CÁCH NÀY khác và hoạt động?" → ĐẶT TÊN cơ chế.

### 12.5 — PACKAGE BREAKDOWN
Trước Value Stack: liệt kê "trong gói có gì" theo từng phần/module + 1 dòng lợi ích mỗi phần.

### 12.6 — GUARANTEE BẬC THANG
Mức 1: Hoàn tiền N ngày. Mức 2: Hài lòng + Kết quả. Mức 3: Làm đúng không ra kết quả → hoàn 100% + BỒI THƯỜNG THÊM + hỗ trợ 1-1.
Chỉ dùng mức cao khi thật sự làm được.

### 12.7 — CTA CÓ SUB-TEXT GIẢM FRICTION
Dưới MỖI nút: 🔒 Thanh toán an toàn · ⚡ Nhận/truy cập ngay · 💯 Cam kết hoàn tiền

---

## SUMMARY
Trang bán hàng chuyển đổi cao = ĐÚNG PRESET + 4 NHÓM NGƯỜI được phục vụ + MỘC mà thật > đẸP mà rỗng + Không tạo đau, không ép giả + Kỹ thuật là CÔNG CỤ, không phải KHUÔN cứng + Đa kênh.
