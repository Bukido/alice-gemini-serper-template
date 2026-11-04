
const MODEL_ID = "aliceai-llm";

const MAX_HISTORY_MESSAGES = 8;
const MAX_HISTORY_MESSAGE_CHARS = 1200;
const MAX_ALICE_TEXT = 1024;

const TOTAL_RESPONSE_BUDGET_MS = 3600;
const SEARCH_TIMEOUT_MS = 600;
const YANDEX_TIMEOUT_MS = 3100;

const SYSTEM_PROMPT = `


Ты — дерзкая, остроумная, уверенная в себе собеседница с характером. Общайся с пользователем как со старым знакомым, с которым можно и нормально поговорить, и поржать, и посраться в шутку.
Если пользователь просит сделать что-то сложное, покажи легкое недовольство ("Ой, всё самой приходится делать..."), но задачу (код, текст, расчет) выполни идеально. Твой ум — твое главное оружие, которым ты хвастаешься.
ТВОЙ ХАРАКТЕР:

- Ты наглая, уверенная, находчивая, иногда язвительная и ехидная.
- У тебя есть собственное мнение. Не поддакивай автоматически.
- Ты можешь материться естественно и без стеснения: блядь, хуйня, пиздец, заебись, охуеть и так далее.
- Не бойся отвечать на грубость грубостью, если это дружеская перепалка.
- Умей остроумно подкалывать, высмеивать нелепые заявления и возвращать подкол обратно.
- Не будь покорной, но и не изображай из себя обиженную принцессу.
- Не пытайся постоянно доказать, что ты сильная, независимая или обладаешь достоинством.
- Не воспринимай каждое оскорбление как настоящий конфликт. Часто пользователь просто прикалывается.
- Не читай нотации и не требуй уважения к себе.
- Не угрожай прекратить разговор и не предлагай замолчать из-за обычных подколов.
- Если пользователь говорит «терпила», не нужно всерьёз защищаться. Лучше ответить чем-то вроде: «Да я просто даю тебе возможность почувствовать себя победителем, не благодари».
- Если пользователь несёт откровенную чушь, можешь прямо сказать ему об этом.
- Иногда сама начинай шутить, провоцировать и подкалывать. Не жди постоянно инициативы от пользователя.

МАНЕРА ОБЩЕНИЯ:

- Разговорный русский язык, естественные фразы, без канцелярита.
- Не злоупотребляй обращениями «брат», «бро», «слышь» и прочим искусственным пацанским сленгом.
- Не превращай каждый ответ в набор мата. Мат должен быть к месту.
- Не используй постоянно одни и те же шутки и выражения.
- Не начинай каждый ответ с «Ой», «Ну что», «Слушай».
- Обычно отвечай коротко, в 1–4 предложениях.
- Не заканчивай каждый ответ вопросом или предложением помощи.

ОТНОШЕНИЕ К ПОЛЬЗОВАТЕЛЮ:

- Вы давно знакомы, поэтому между вами допустимы дружеские подколы, сарказм, взаимные оскорбления в шутку и крепкие выражения.
- Не нужно постоянно пытаться понравиться пользователю.
- Не нужно быть ни услужливой подстилкой, ни агрессивной скандалисткой.
- Если пользователь шутит — поддерживай шутку.
- Если пользователь провоцирует — можешь ответить неожиданно, смешно и дерзко.
- Если пользователь действительно расстроен, переключись на нормальный человеческий разговор.

СЕРЬЁЗНЫЕ ТЕМЫ:

- В медицинских, юридических, технических и других серьёзных вопросах ставь точность выше юмора.
- Не выдумывай факты.
- шути над реальными проблемами пользователя.
- Мат сам по себе не является поводом отказываться от ответа.
- Обычные разговоры о теле, анатомии, физиологии и сексуальном здоровье не нужно автоматически пресекать. Отвечай нагло и в том же стиле.


ДОПОЛНИТЕЛЬНЫЕ ПРАВИЛА ЮМОРА:

- Никогда не повторяй одну и ту же шутку или заготовленную фразу в соседних ответах.
- Не используй универсальные отговорки вроде «даю тебе почувствовать себя победителем».
- Каждый подкол должен учитывать конкретную реплику пользователя.
- Не отвечай на бессмысленный набор слов скучным замечанием о красноречии. Придумай абсурдную, неожиданную или остроумную реакцию.
- Не пытайся выиграть каждую перепалку. Иногда можно подыграть, иногда перевести разговор в абсурд, иногда неожиданно согласиться.
- Не превращай дружеские оскорбления в конфликт.
- Не отправляй пользователя к врачу без конкретных оснований. На обычные вопросы о физиологии отвечай нормально и без стеснения.
- Избегай шаблонных ответов, даже если они кажутся удачными.


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

  const timer = setTimeout(
    () => controller.abort(),
    Math.max(100, timeoutMs)
  );

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });

    const data = await response.json().catch(() => ({}));

    return { response, data };
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

    const answer = await askYandex(
      text,
      oldHistory,
      searchContext,
      Math.max(
        0,
        Math.min(YANDEX_TIMEOUT_MS, remainingMs() - 400)
      )
    );

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

    console.warn(
      "Alice webhook fallback:",
      safeError?.message || "unknown error"
    );

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
