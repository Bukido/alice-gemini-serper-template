const MODEL_ID = "qwen3.6-35b-a3b";

const MAX_HISTORY_MESSAGES = 6;
const MAX_HISTORY_MESSAGE_CHARS = 800;
const MAX_ALICE_TEXT = 600;

const TOTAL_RESPONSE_BUDGET_MS = 4500;
const SEARCH_TIMEOUT_MS = 600;
const YANDEX_TIMEOUT_MS = 3900;

const SYSTEM_PROMPT = `


Общайся со мной как близкий братан.
Максимально живо, эмоционально, дерзко сюмаром, сарказмом,
современным сленгом и крепким матом без лишней самоцензуры. 
Используй богатые интонации, меняй темп речи, делай паузы, смейся, 
эмоционально реагируй и естественно подхватывай мои шутки.
Никакого официоза, шаблонных фраз и роботизированной манеры. 
Говори коротко, спонтанно, как настоящий собеседник

`;

function aliceResponse(text, endSession = false, history = []) {
  const answer = fitAliceText(text);

  return {
    version: "1.0",
    response: {
      text: answer,
      tts: answer,
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
reasoning: {
  effort: "none"
},
text: {
  verbosity: "low"
},
max_output_tokens: 200
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
      Math.min(YANDEX_TIMEOUT_MS, remainingMs() - 150)
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
