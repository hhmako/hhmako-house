export function normalizeGroupEvent(input) {
  const event = input?.event || input;
  const message = event?.message || {};
  const sender = event?.sender || {};
  const content = parseJson(message.content);
  const extracted = extractContent(message.message_type, content);
  return {
    eventId: input?.header?.event_id || input?.event_id || message.message_id,
    messageId: message.message_id,
    chatId: message.chat_id,
    chatType: message.chat_type,
    messageType: message.message_type,
    createTime: normalizeTimestamp(message.create_time),
    senderId: sender.sender_id?.open_id || sender.sender_id?.user_id || sender.sender_id?.union_id || "unknown",
    senderType: sender.sender_type || "",
    threadId: message.thread_id || "",
    rootId: message.root_id || "",
    text: extracted.text,
    imageKeys: extracted.imageKeys,
    mentions: (message.mentions || []).map((item) => ({
      name: item.name || "",
      openId: item.id?.open_id || "",
      key: item.key || "",
    })),
    raw: input,
  };
}

function normalizeTimestamp(value) {
  const number = Number(value || Date.now());
  return number > 0 && number < 100000000000 ? number * 1000 : number;
}

export function groupSourceUrl(event) {
  const query = new URLSearchParams({
    openChatId: event.chatId,
    openMessageId: event.messageId,
  });
  return `https://applink.feishu.cn/client/chat/open?${query}`;
}

function extractContent(type, content) {
  if (type === "text") return { text: content.text || "", imageKeys: [] };
  if (type === "image") return { text: "", imageKeys: [content.image_key].filter(Boolean) };
  if (type === "post") {
    const locales = Object.values(content).filter((locale) => locale && typeof locale === "object");
    const blocks = locales.flatMap((locale) => locale.content || []);
    const elements = blocks.flat();
    return {
      text: [
        ...locales.map((locale) => locale.title || ""),
        ...elements.map((item) => item.text || item.content || ""),
      ].filter(Boolean).join("\n"),
      imageKeys: elements.map((item) => item.image_key).filter(Boolean),
    };
  }
  return { text: content.text || content.file_name || "", imageKeys: [content.image_key].filter(Boolean) };
}

function parseJson(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return { text: String(value) };
  }
}

export class MessageBatcher {
  constructor({ waitMs = 6000, onFlush }) {
    this.waitMs = waitMs;
    this.onFlush = onFlush;
    this.pending = new Map();
  }

  add(event) {
    const key = `${event.chatId}:${event.senderId}:${event.threadId || "root"}`;
    const current = this.pending.get(key) || { events: [], timer: null };
    current.events.push(event);
    clearTimeout(current.timer);
    current.timer = setTimeout(async () => {
      this.pending.delete(key);
      await this.onFlush(mergeEvents(current.events));
    }, this.waitMs);
    this.pending.set(key, current);
  }

  async flushAll() {
    for (const [key, current] of this.pending) {
      clearTimeout(current.timer);
      this.pending.delete(key);
      await this.onFlush(mergeEvents(current.events));
    }
  }
}

export function mergeEvents(events) {
  const sorted = [...events].sort((a, b) => a.createTime - b.createTime);
  const first = sorted[0];
  return {
    ...first,
    messageIds: sorted.map((item) => item.messageId),
    text: sorted.map((item) => item.text).filter(Boolean).join("\n"),
    imageRefs: sorted.flatMap((item) => item.imageKeys.map((fileKey) => ({ messageId: item.messageId, fileKey }))),
    mentions: sorted.flatMap((item) => item.mentions),
    latestMessageId: sorted.at(-1)?.messageId || first.messageId,
    createTime: sorted.at(-1)?.createTime || first.createTime,
  };
}
