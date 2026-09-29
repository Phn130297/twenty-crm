#!/usr/bin/env node
// Seed 15 AI+vet products into Twenty CRM custom server
import { createProduct } from '../src/modules/products';

const API = process.env.API_URL || 'http://localhost:4000';
const API_KEY = process.env.API_KEY || '';

const products = [
  { name: "AI cho bác sĩ thú y: Prompt Handbook", price: 199000, category: "AI Education", format: "Handbook (PDF + Notion)", description: "200+ prompt cho: SOAP notes, differential diagnosis, drug lookup, discharge", features: ["200+ prompts", "SOAP notes", "Differential diagnosis", "Drug lookup", "Discharge templates"], highlights: ["PDF + Notion", "Ready-to-use prompts", "Veterinary-specific"] },
  { name: "Ebook: Ứng dụng AI vào thực hành lâm sàng thú y", price: 299000, category: "Education", format: "Ebook (80 trang)", description: "Case study thực tế: AI hỗ trợ consultation, lab interpretation, treatment plan", features: ["80 pages", "Real case studies", "Consultation AI", "Lab interpretation", "Treatment planning"], highlights: ["Practical examples", "Evidence-based", "Vietnamese context"] },
  { name: "SOAP Notes với AI: Hướng dẫn & Template", price: 249000, category: "Clinical Tools", format: "Template pack + guide", description: "Template SOAP cho từng loại khám + prompt AI tạo note nhanh", features: ["SOAP templates", "Per-exam-type templates", "AI prompt for fast notes", "Guide included"], highlights: ["Save time on documentation", "Standardized format", "AI-assisted"] },
  { name: "AI hỗ trợ chẩn đoán phân biệt: Workbook", price: 299000, category: "Diagnostics", format: "Workbook (PDF)", description: "Framework dùng AI phối hợp kiến thức lâm sàng đưa ra differential diagnosis", features: ["DDx framework", "AI + clinical knowledge", "Workbook format", "Practice exercises"], highlights: ["Systematic approach", "Evidence-based framework", "Improves diagnostic accuracy"] },
  { name: "Lab Results Interpretation với AI", price: 249000, category: "Diagnostics", format: "Guide + prompt pack", description: "Prompt AI phân tích CBC, chemistry, urinalysis — có ví dụ case thực tế", features: ["CBC analysis", "Chemistry panel", "Urinalysis", "Real case examples", "Prompt pack"], highlights: ["Lab-specific AI prompts", "Real cases", "Quick reference"] },
  { name: "Mini Course: AI thực chiến cho bác sĩ thú y", price: 999000, category: "AI Education", format: "6 video + case studies", description: "Cách dùng AI từ lúc tiếp nhận → khám → chẩn đoán → điều trị → theo dõi", features: ["6 videos", "Full clinical workflow", "Case studies", "Reception to follow-up"], highlights: ["End-to-end workflow", "Video format", "Practical demonstrations"] },
  { name: "Case Study: AI hỗ trợ bác sĩ thú y trong 100 ca khám thực tế", price: 199000, category: "Education", format: "Case study collection", description: "Data-driven: tỷ lệ chính xác, thời gian tiết kiệm, điểm cần can thiệp", features: ["100 real cases", "Accuracy metrics", "Time savings data", "Intervention points"], highlights: ["Data-driven", "Real clinic data", "Performance benchmarks"] },
  { name: "Medical Records Management với AI", price: 249000, category: "Clinical Tools", format: "Guide + template", description: "Template hồ sơ bệnh án + prompt AI tổng hợp, tóm tắt, theo dõi bệnh", features: ["Medical record templates", "AI summarization", "Disease tracking prompts", "Guide"], highlights: ["Standardized records", "AI-assisted tracking", "Improves documentation"] },
  { name: "Pharm & Toxicology AI Toolkit cho bác sĩ thú y", price: 279000, category: "Clinical Tools", format: "Toolkit", description: "Drug interaction checker, dosage calculator prompt, toxicology triage workflow", features: ["Drug interaction checker", "Dosage calculator prompts", "Toxicology triage", "Workflow guides"], highlights: ["Safety-first", "Quick reference", "Clinical decision support"] },
  { name: "AI cho Continuing Education: Học thú y thông minh hơn", price: 199000, category: "Education", format: "Guide + system", description: "Hệ thống dùng AI để học nhanh, nhớ lâu, tra cứu hiệu quả", features: ["Learning system", "Memory techniques", "Quick lookup", "CE tracking"], highlights: ["Lifelong learning", "Smart study system", "Efficient knowledge retention"] },
  { name: "Client Communication Templates với AI", price: 179000, category: "Clinical Tools", format: "Template pack", description: "Discharge instructions, follow-up, client education — AI-assisted templates", features: ["Discharge templates", "Follow-up scripts", "Client education prompts", "AI-assisted"], highlights: ["Improves client relations", "Professional communication", "Time-saving"] },
  { name: "Ebook: Chẩn đoán hình ảnh với AI trong thú y", price: 249000, category: "Diagnostics", format: "Ebook (60 trang)", description: "Giới thiệu AI radiology tools, cách đọc kết quả AI-assisted, giới hạn", features: ["AI radiology tools", "AI-assisted reading", "Limitations guide", "60 pages"], highlights: ["Radiology AI overview", "Practical guide", "Critical evaluation"] },
  { name: "Anti-biotic Stewardship + AI: Hướng dẫn chọn kháng sinh thông minh", price: 229000, category: "Clinical Tools", format: "Guide + decision tree", description: "Kết hợp guideline + AI để đưa ra đề xuất kháng sinh phù hợp", features: ["Guideline integration", "AI-assisted selection", "Decision tree", "Stewardship framework"], highlights: ["Antimicrobial stewardship", "Evidence-based", "Reduces resistance"] },
  { name: "Workshop: AI trong lâm sàng thú y — Thực hành 2 ngày", price: 2500000, category: "AI Education", format: "Workshop trực tiếp", description: "Hands-on với AI tools cho case thực tế, small group", features: ["2-day workshop", "Hands-on practice", "Real cases", "Small group"], highlights: ["In-person training", "Interactive", "Certificate included"] },
  { name: "Newsletter: Thú y & AI — Mỗi tuần 1 case study + prompt hay", price: 79000, category: "Membership", format: "Content membership", description: "Sticky content giữ chân DVMs, build authority dài hạn", features: ["Weekly case study", "Prompt of the week", "Community access", "Archive"], highlights: ["Recurring revenue", "Builds authority", "Engages DVMs weekly"] }
];

async function main() {
  let created = 0;
  for (const sp of products) {
    try {
      const res = await fetch(`${API}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}) },
        body: JSON.stringify(sp)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown' }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      created++;
      console.log(`  [${created}/${products.length}] ${sp.name} (${sp.price.toLocaleString('vi-VN')} VND)`);
    } catch (err) {
      console.error(`  FAILED: ${sp.name}`, err instanceof Error ? err.message : err);
    }
  }
  console.log(`\nDone: ${created}/${products.length} products created.`);
}

main().catch(e => { console.error(e); process.exit(1); });
