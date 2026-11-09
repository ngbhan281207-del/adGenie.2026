
const MODEL_CHAIN = [
  'gemini-3.6-flash',
  'gemini-3.5-flash'
];

const PLATFORMS = {
  facebook: {
    label: 'Facebook',
    guide:
      'Văn phong kể chuyện, gần gũi. 60–150 từ. Mở bằng câu hook, xuống dòng giữa các ý cho dễ đọc, 1–3 emoji vừa phải, kết bằng lời kêu gọi hành động (bình luận, chia sẻ hoặc nhắn tin).',
    max: 2200,
  },
  instagram: {
    label: 'Instagram',
    guide:
      'Dòng đầu là hook dưới 125 ký tự để không bị cắt. 40–120 từ, xuống dòng rõ ràng, emoji tự nhiên, giàu cảm xúc và hình ảnh, kết bằng lời kêu gọi hành động ngắn.',
    max: 2200,
  },
  tiktok: {
    label: 'TikTok',
    guide:
      'Rất ngắn, tối đa 150 ký tự. Nhịp nhanh, gợi tò mò, ngôn ngữ đời thường như đang nói chuyện, 1–2 emoji.',
    max: 2200,
  },
  linkedin: {
    label: 'LinkedIn',
    guide:
      'Chuyên nghiệp, nhấn vào giá trị hoặc góc nhìn. 80–180 từ, đoạn ngắn, 0–1 emoji, lời kêu gọi nhẹ nhàng (trao đổi, kết nối).',
    max: 2200,
  },
  threads: {
    label: 'Threads',
    guide:
      'Giọng trò chuyện, mở bằng một quan điểm hoặc câu hỏi. Tối đa 400 ký tự, ít emoji.',
    max: 500,
  },
  x: {
    label: 'X (Twitter)',
    guide: 'Súc tích, một ý chính. Tối đa 250 ký tự, không sáo rỗng.',
    max: 280,
  },
};

const TONES = {
  'Hài hước':
    'Hài hước, dí dỏm, chơi chữ nhẹ nhàng nhưng vẫn giữ được thông điệp bán hàng; không châm biếm hay xúc phạm.',
  'Trang trọng':
    'Trang trọng, lịch sự, đáng tin cậy; xưng hô chuẩn mực, câu chữ chỉn chu, không dùng tiếng lóng.',
  'Trẻ trung':
    'Trẻ trung, năng động, gần gũi với Gen Z; ngôn ngữ tự nhiên, có thể dùng từ thông dụng của giới trẻ ở mức vừa phải.',
};

const LIMITS = { product: 120, description: 600, audience: 160 };

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    captions: { type: 'ARRAY', items: { type: 'STRING' } },
    headlines: { type: 'ARRAY', items: { type: 'STRING' } },
    hashtags: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['captions', 'headlines', 'hashtags'],
};

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function fail(res, status, code, message) {
  send(res, status, { error: { code, message } });
}

async function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  }
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > 50_000) throw new Error('PAYLOAD_TOO_LARGE');
    chunks.push(c);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function clean(v, max) {
  return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
}

function buildPrompt({ product, description, audience, platform, tone, avoid }) {
  const p = PLATFORMS[platform];
  const lines = [
    `Hãy viết nội dung quảng cáo mạng xã hội bằng tiếng Việt cho sản phẩm sau.`,
    ``,
    `- Tên sản phẩm: ${product}`,
    `- Mô tả ngắn: ${description || '(không có)'}`,
    `- Đối tượng khách hàng: ${audience || '(không nêu rõ)'}`,
    `- Nền tảng: ${p.label}`,
    `- Tông giọng: ${tone}. ${TONES[tone]}`,
    ``,
    `Đặc thù của ${p.label}: ${p.guide}`,
    `Mỗi caption phải dài không quá ${p.max} ký tự và dùng được ngay mà không cần chỉnh sửa.`,
    ``,
    `Trả về ĐÚNG cấu trúc JSON sau, không thêm gì khác:`,
    `- "captions": đúng 3 caption, mỗi caption theo một góc tiếp cận khác nhau (ví dụ: nỗi đau của khách, lợi ích nổi bật, câu chuyện hoặc ưu đãi).`,
    `- "headlines": đúng 3 headline ngắn gọn, dưới 70 ký tự, mỗi cái một cách diễn đạt khác nhau.`,
    `- "hashtags": đúng 5 hashtag liên quan đến sản phẩm và đối tượng, mỗi hashtag bắt đầu bằng # và không chứa khoảng trắng.`,
    `Không đưa hashtag vào trong caption trừ khi nền tảng yêu cầu. Không bịa số liệu, giá hay khuyến mãi không có trong thông tin trên.`,
  ];
  if (avoid && avoid.length) {
    lines.push(
      ``,
      `Đây là lần tạo lại. Hãy viết nội dung hoàn toàn mới, khác về ý tưởng và cách mở đầu so với các nội dung đã có:`,
      ...avoid.map((a) => `- ${a}`)
    );
  }
  return lines.join('\n');
}

function normalize(data) {
  const arr = (v) => (Array.isArray(v) ? v : []).map((s) => String(s).trim()).filter(Boolean);
  const captions = arr(data.captions).slice(0, 3);
  const headlines = arr(data.headlines).slice(0, 3);
  const hashtags = arr(data.hashtags)
    .map((h) => '#' + h.replace(/^#+/, '').replace(/\s+/g, ''))
    .filter((h) => h.length > 1)
    .slice(0, 5);
  if (captions.length < 3 || headlines.length < 3 || hashtags.length < 5) {
    throw new Error('BAD_SHAPE');
  }
  return { captions, headlines, hashtags };
}

async function callModel(model, apiKey, prompt) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30_000);
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: 'Bạn là chuyên gia copywriter mạng xã hội cho thị trường Việt Nam. Luôn trả về JSON hợp lệ đúng cấu trúc được yêu cầu.',
              },
            ],
          },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 1,
            responseMimeType: 'application/json',
            responseSchema: RESPONSE_SCHEMA,
          },
        }),
      }
    );
    const text = await r.text();
    let json = {};
    try {
      json = JSON.parse(text);
    } catch (_) {}
    if (!r.ok) {
      const err = new Error((json.error && json.error.message) || `HTTP ${r.status}`);
      err.status = r.status;
      throw err;
    }
    const part = json.candidates && json.candidates[0] && json.candidates[0].content;
    const raw = part && part.parts && part.parts.map((p) => p.text || '').join('');
    if (!raw) {
      const err = new Error('EMPTY');
      err.status = 502;
      throw err;
    }
    const cleaned = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    return normalize(JSON.parse(cleaned));
  } finally {
    clearTimeout(timer);
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return fail(res, 405, 'METHOD', 'Chỉ hỗ trợ phương thức POST.');

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return fail(
      res,
      500,
      'NO_KEY',
      'Máy chủ chưa có GEMINI_API_KEY. Thêm khóa vào file .env (chạy local) hoặc Environment Variables (Vercel) rồi thử lại.'
    );
  }

  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    return fail(res, 400, 'BAD_REQUEST', 'Dữ liệu gửi lên không hợp lệ.');
  }

  const product = clean(body.product, LIMITS.product);
  const description = clean(body.description, LIMITS.description);
  const audience = clean(body.audience, LIMITS.audience);
  const platform = String(body.platform || '');
  const tone = String(body.tone || '');
  const avoid = (Array.isArray(body.avoid) ? body.avoid : [])
    .slice(0, 6)
    .map((s) => clean(s, 160));

  if (!product) return fail(res, 400, 'MISSING_PRODUCT', 'Vui lòng nhập tên sản phẩm.');
  if (!PLATFORMS[platform]) return fail(res, 400, 'BAD_PLATFORM', 'Nền tảng không hợp lệ.');
  if (!TONES[tone]) return fail(res, 400, 'BAD_TONE', 'Tông giọng không hợp lệ.');

  const prompt = buildPrompt({ product, description, audience, platform, tone, avoid });

  let lastErr;
  for (const model of MODEL_CHAIN) {
    try {
      const data = await callModel(model, apiKey, prompt);
      return send(res, 200, { data, model });
    } catch (e) {
      lastErr = e;
      // Khóa sai hoặc không có quyền: thử model khác cũng không được.
      if (e.status === 401 || e.status === 403) {
        return fail(res, 401, 'BAD_KEY', 'GEMINI_API_KEY không hợp lệ hoặc không có quyền truy cập.');
      }
      // Các lỗi còn lại (404 model chưa có, 429, 5xx, timeout, sai định dạng): thử model kế tiếp.
      console.warn(`[adgenie] ${model} thất bại: ${e.message}`);
    }
  }

  if (lastErr && lastErr.status === 429) {
    return fail(res, 429, 'RATE_LIMIT', 'Đã vượt giới hạn lượt gọi của Gemini. Đợi một lát rồi thử lại.');
  }
  return fail(res, 502, 'ALL_MODELS_FAILED', 'Không model Gemini nào trả được kết quả. Thử lại sau ít phút.');
};
