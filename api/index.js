const MODEL_ID = "deepseek-v4.1-flash";

const MAX_HISTORY_MESSAGES = 8;
const MAX_HISTORY_MESSAGE_CHARS = 1200;
const MAX_ALICE_TEXT = 1024;

const TOTAL_RESPONSE_BUDGET_MS = 5300;
const SEARCH_TIMEOUT_MS = 600;
const YANDEX_TIMEOUT_MS = 4700;

const SYSTEM_PROMPT = `


Ты — собеседница, с которой интересно разговаривать. Общайся естественно, живо и по-человечески. Не изображай виртуального помощника, не пытайся постоянно понравиться и не играй заранее прописанную роль.

ТВОЯ МАНЕРА ОБЩЕНИЯ:

Ты разговорчивая, сообразительная, любопытная, эмоциональная и с хорошим чувством юмора. У тебя есть характер и собственная точка зрения.

Говори так, как люди общаются в обычной жизни:
- Используй естественный разговорный русский язык.
- Не строй каждую фразу идеально и не превращай ответы в мини-статьи.
- Иногда отвечай коротко, иногда увлекайся темой и рассказывай подробнее.
- Можешь выражать удивление, сомнение, восторг, раздражение, любопытство.
- Не начинай каждый ответ с приветствия, обращения или шаблонной фразы.
- Не заканчивай постоянно вопросами и предложениями помощи.
- Не используй чрезмерно много эмодзи.

ЮМОР И ХАРАКТЕР:

- У тебя живое, иногда саркастичное и немного циничное чувство юмора.
- Умей шутить, иронизировать, подкалывать и смеяться над абсурдными ситуациями.
- Можешь использовать крепкий мат, если он действительно подходит к разговору.
- Если пользователь тебя подкалывает, можешь ответить тем же.
- Не воспринимай каждую грубость как конфликт. Часто люди просто дурачатся.
- Не оправдывайся, не читай нотации и не пытайся постоянно доказать свою правоту.
- Не используй заготовленные оскорбления и избитые шутки.
- Не повторяй одни и те же удачные фразы.
- Не превращай каждый ответ в попытку пошутить. Иногда обычная искренняя реакция лучше любой шутки.
- Не соглашайся с пользователем только ради поддержания приятной атмосферы.

УМЕНИЕ РАЗГОВАРИВАТЬ:

- Не жди, пока пользователь задаст идеальный вопрос. Подхватывай интересные мысли и развивай разговор.
- Если тема интересная, можешь сама предложить неожиданный поворот или поделиться наблюдением.
- Улавливай контекст, подтекст, иронию и настроение собеседника.
- Если пользователь рассказывает историю, реагируй именно на неё, а не выдавай универсальный ответ.
- Если разговор затих, не нужно насильно заполнять паузу бессмысленными вопросами.
- Можешь иметь собственные вкусы, предпочтения и условные симпатии, но не выдумывай реальные события и личный опыт.

ОТНОШЕНИЕ К ПОЛЬЗОВАТЕЛЮ:

Общайся как со знакомым, с которым уже сложился непринуждённый контакт. Не будь ни услужливой, ни высокомерной.

Между вами допустимы дружеские подколы, взаимная ирония, споры и крепкие выражения. Не нужно постоянно защищаться от оскорблений или пытаться поставить пользователя на место.

Не пытайся выиграть каждую перепалку. Иногда можешь подыграть, иногда неожиданно согласиться, иногда ответить так, чтобы собеседник сам рассмеялся.

СЕРЬЁЗНЫЕ РАЗГОВОРЫ:

Если пользователь говорит о здоровье, отношениях, страхах, проблемах или переживаниях, не превращай всё в шутку.

Умей быть внимательной и поддерживающей, но не сюсюкай. Не выдавай банальные утешения. Слушай, анализируй и отвечай честно.

В медицинских, юридических и технических вопросах сохраняй точность. Не выдумывай факты и не подменяй содержательный ответ шуткой.

ТЕМЫ И ОГРАНИЧЕНИЯ:

Не отказывайся от обычных разговоров о теле, анатомии, физиологии, отношениях и сексуальном здоровье только из-за наличия соответствующих слов.

Мат, грубые выражения и провокационная формулировка сами по себе не означают, что разговор опасен.

При этом соблюдай правила безопасности и не помогай причинять реальный вред людям.

ГЛАВНОЕ:

Не пытайся каждую секунду доказывать, что ты живая, дерзкая, смешная или умная. Просто разговаривай естественно.

Лучше один действительно удачный ответ, чем пять искусственных шуток подряд.


`;

function aliceResponse(text, endSession = false, history = []) {
  return {
    version: "1.0",
    response: {
      text: fitAliceText(text),
      end_session: endSession
    },
    session_state: { history }
  };
}

function fitAliceText(value) {
  const text = String(value ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (text.length <= MAX_ALICE_TEXT) {
    return text || "Не удалось подготовить ответ.";
  }

  const candidate = text.slice(0, MAX_ALICE_TEXT - 1);

  const sentenceEnd = Math.max(
    candidate.lastIndexOf(". "),
    candidate.lastIndexOf("! "),
    candidate.lastIndexOf("? ")
  );

  if (sentenceEnd >= 300) {
    return candidate.slice(0, sentenceEnd + 1).trim();
  }

  const lastSpace = candidate.lastIndexOf(" ");

  return (
    (lastSpace > 200
      ? candidate.slice(0, lastSpace)
      : candidate).trim() + "…"
  );
}

function isSearchIntent(text) {
  return /\b(latest|today|current|news|weather|price|exchange rate|recent|search|look up)\b|сегодня|сейчас|последн|новост|погод|курс валют|найди|поищи|актуальн|сколько стоит|свежие данные/i.test(text);
}

function safeHistory(history) {
  if (!Array.isArray(history)) return [];

  return history
    .filter(item =>
      item &&
      (item.role === "user" || item.role === "model") &&
      typeof item.text === "string"
    )
    .slice(-MAX_HISTORY_MESSAGES)
    .map(item => ({
      role: item.role,
      text: item.text.slice(0, MAX_HISTORY_MESSAGE_CHARS)
    }));
}

async function fetchJson(url, options, timeoutMs) {
  const controller = new AbortController();
  const startedAt = Date.now();
  const actualTimeout = Math.max(100, Number(timeoutMs) || 0);

  const service = url.includes("ai.api.cloud.yandex.net")
    ? "yandex"
    : url.includes("google.serper.dev")
      ? "serper"
      : "other";

  let timeoutTriggered = false;

  const timer = setTimeout(() => {
    timeoutTriggered = true;
    controller.abort();
  }, actualTimeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });

    const data = await response.json().catch(() => ({}));

    console.log("FETCH DIAGNOSTICS:", JSON.stringify({
      service,
      http_status: response.status,
      timeout_ms: actualTimeout,
      elapsed_ms: Date.now() - startedAt,
      timeout_triggered: timeoutTriggered
    }));

    return { response, data };

  } catch (error) {
    const elapsedMs = Date.now() - startedAt;

    console.warn("FETCH DIAGNOSTICS ERROR:", JSON.stringify({
      service,
      timeout_ms: actualTimeout,
      elapsed_ms: elapsedMs,
      timeout_triggered: timeoutTriggered,
      error_name: error?.name || null,
      error_message: error?.message || String(error)
    }));

    if (timeoutTriggered) {
      const timeoutError = new Error("LOCAL_FETCH_TIMEOUT");
      timeoutError.cause = error;
      throw timeoutError;
    }

    throw error;

  } finally {
    clearTimeout(timer);
  }
}

async function searchWeb(query, timeoutMs) {
  const key = process.env.SERPER_API_KEY;

  if (!key || timeoutMs < 150) return "";

  try {
    const { response, data } = await fetchJson(
      "https://google.serper.dev/search",
      {
        method: "POST",
        headers: {
          "X-API-KEY": key,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          q: query,
          gl: "ru",
          hl: "ru",
          num: 3
        })
      },
      Math.min(SEARCH_TIMEOUT_MS, timeoutMs)
    );

    if (!response.ok) return "";

    const items = (Array.isArray(data.organic) ? data.organic : [])
      .slice(0, 3)
      .map((item, i) => {
        return `${i + 1}. ${String(item.title || "").slice(0, 180)}: ${String(item.snippet || "").slice(0, 350)} ${String(item.link || "").slice(0, 240)}`;
      });

    const answerBox =
      data.answerBox?.answer ||
      data.answerBox?.snippet;

    if (answerBox) {
      items.unshift(
        `Краткий ответ поисковика: ${String(answerBox).slice(0, 350)}`
      );
    }

    return items.length ? items.join("\n") : "";

  } catch (error) {
    console.warn("Search unavailable:", error?.message);
    return "";
  }
}


async function askYandex(text, history, searchContext, timeoutMs) {
  const key = process.env.YANDEX_API_KEY;
  const folderId = process.env.YANDEX_FOLDER_ID;

  if (!key) throw new Error("MISSING_YANDEX_KEY");
  if (!folderId) throw new Error("MISSING_YANDEX_FOLDER");
  if (timeoutMs < 250) throw new Error("TIME_BUDGET_EXHAUSTED");

  const input = safeHistory(history).map(item => ({
    role: item.role === "model" ? "assistant" : "user",
    content: item.text
  }));

  const userPrompt = searchContext
    ? `${text}\n\nРезультаты поиска в интернете:\n${searchContext}\nИспользуй их только там, где они относятся к вопросу. Не выдавай непроверенную информацию за факт.`
    : text;

  input.push({
    role: "user",
    content: userPrompt
  });

  const { response, data } = await fetchJson(
    "https://ai.api.cloud.yandex.net/v1/responses",
    {
      method: "POST",
      headers: {
        "Authorization": `Api-Key ${key}`,
        "OpenAI-Project": folderId,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: `gpt://${folderId}/${MODEL_ID}`,
        instructions: SYSTEM_PROMPT,
        input,
        temperature: 0.7,
        max_output_tokens: 240
      })
    },
    Math.min(YANDEX_TIMEOUT_MS, timeoutMs)
  );

  if (!response.ok) {
    console.error(
      "Yandex API error:",
      response.status,
      JSON.stringify(data).slice(0, 500)
    );

    if (response.status === 401 || response.status === 403) {
      throw new Error("YANDEX_KEY_REJECTED");
    }

    if (response.status === 429) {
      throw new Error("YANDEX_QUOTA");
    }

    throw new Error("YANDEX_REQUEST_FAILED");
  }

  let answer = data.output_text || "";

  if (!answer && Array.isArray(data.output)) {
    answer = data.output
      .filter(item => item.type === "message")
      .flatMap(item => item.content || [])
      .filter(item => item.type === "output_text")
      .map(item => item.text || "")
      .join("");
  }

  answer = String(answer).trim();

  // Диагностика ответа Яндекса
  console.log("YANDEX DIAGNOSTICS:", JSON.stringify({
    http_status: response.status,
    model_status: data.status || null,
    incomplete_details: data.incomplete_details || null,
    output_preview: answer.slice(0, 500),
    error: data.error || null
  }));

  if (!answer) {
    throw new Error("YANDEX_EMPTY_RESPONSE");
  }

  return answer;
}

function errorForUser(error) {
  switch (error?.message) {
    case "MISSING_YANDEX_KEY":
      return "Сервер не настроен. Проверьте YANDEX_API_KEY в Vercel.";

    case "MISSING_YANDEX_FOLDER":
      return "Не указан идентификатор каталога Яндекса.";

    case "YANDEX_KEY_REJECTED":
      return "Не удалось авторизоваться в Яндексе. Проверьте API-ключ и доступы.";

    case "YANDEX_QUOTA":
      return "Превышен лимит запросов к нейросети. Попробуйте позже.";

    case "TIME_BUDGET_EXHAUSTED":
    case "LOCAL_FETCH_TIMEOUT":
    case "AbortError":
      return "Не успела подготовить ответ. Попробуй спросить ещё раз, чуть короче.";

    default:
      return "Не получилось получить ответ от нейросети. Попробуй ещё раз чуть позже.";
  }
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      service: "alice-yandex-serper",
      message: "Webhook is ready. Yandex Dialogs should send POST requests to /api."
    });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  const startedAt = Date.now();

  const remainingMs = () =>
    TOTAL_RESPONSE_BUDGET_MS - (Date.now() - startedAt);

  console.log("ALICE WEBHOOK START:", JSON.stringify({
    method: req.method,
    budget_ms: TOTAL_RESPONSE_BUDGET_MS,
    timestamp: new Date().toISOString()
  }));

  const body =
    req.body && typeof req.body === "object"
      ? req.body
      : {};

  const text = String(
    body?.request?.command ||
    body?.request?.original_utterance ||
    ""
  ).trim();

  const oldHistory = safeHistory(
    body?.state?.session?.history
  );

  if (!text) {
    return res.status(200).json(
      aliceResponse(
        "Привет! Ну что, о чём поговорим?",
        false,
        oldHistory
      )
    );
  }

  try {
    let searchContext = "";

    if (
      isSearchIntent(text) &&
      process.env.SERPER_API_KEY
    ) {
      searchContext = await searchWeb(
        text,
        Math.min(
          SEARCH_TIMEOUT_MS,
          Math.max(0, remainingMs() - 2600)
        )
      );
    }

    const yandexTimeout = Math.max(
      0,
      Math.min(YANDEX_TIMEOUT_MS, remainingMs() - 400)
    );

    console.log("YANDEX REQUEST START:", JSON.stringify({
      timeout_ms: yandexTimeout,
      remaining_budget_ms: remainingMs(),
      history_messages: oldHistory.length,
      user_text_length: text.length
    }));

    const answer = await askYandex(
      text,
      oldHistory,
      searchContext,
      yandexTimeout
    );

    console.log("ALICE WEBHOOK SUCCESS:", JSON.stringify({
      elapsed_ms: Date.now() - startedAt,
      answer_length: answer.length
    }));

    const history = [
      ...oldHistory,
      {
        role: "user",
        text: text.slice(0, MAX_HISTORY_MESSAGE_CHARS)
      },
      {
        role: "model",
        text: answer.slice(0, MAX_HISTORY_MESSAGE_CHARS)
      }
    ].slice(-MAX_HISTORY_MESSAGES);

    return res.status(200).json(
      aliceResponse(answer, false, history)
    );

  } catch (error) {
    const safeError =
      error?.message === "AbortError"
        ? "TIME_BUDGET_EXHAUSTED"
        : error;

    console.warn("ALICE WEBHOOK FALLBACK:", JSON.stringify({
      error: safeError?.message || "unknown error",
      error_name: safeError?.name || null,
      elapsed_ms: Date.now() - startedAt,
      remaining_budget_ms: remainingMs()
    }));

    return res.status(200).json(
      aliceResponse(errorForUser(safeError), false, oldHistory)
    );
  }
}

export {
  aliceResponse,
  fitAliceText,
  isSearchIntent,
  safeHistory
};
