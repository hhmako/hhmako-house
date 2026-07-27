import fs from "node:fs";
import path from "node:path";

export class LarkOpenApi {
  constructor({ appId = process.env.LARK_APP_ID, appSecret = process.env.LARK_APP_SECRET } = {}) {
    if (!appId || !appSecret) throw new Error("缺少 LARK_APP_ID / LARK_APP_SECRET。");
    this.appId = appId;
    this.appSecret = appSecret;
    this.token = "";
    this.expiresAt = 0;
  }

  async tenantToken() {
    if (this.token && Date.now() < this.expiresAt) return this.token;
    const response = await fetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ app_id: this.appId, app_secret: this.appSecret }),
    });
    const result = await response.json();
    if (!response.ok || result.code !== 0) throw new Error(`获取 tenant token 失败：${JSON.stringify(result)}`);
    this.token = result.tenant_access_token;
    this.expiresAt = Date.now() + Math.max(60, result.expire - 120) * 1000;
    return this.token;
  }

  async downloadMessageImage(messageId, fileKey, outputFile) {
    const token = await this.tenantToken();
    const url = `https://open.feishu.cn/open-apis/im/v1/messages/${encodeURIComponent(messageId)}/resources/${encodeURIComponent(fileKey)}?type=image`;
    const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`下载群图片失败：message=${messageId}, status=${response.status}`);
    fs.mkdirSync(path.dirname(outputFile), { recursive: true });
    fs.writeFileSync(outputFile, Buffer.from(await response.arrayBuffer()));
    return outputFile;
  }

  async uploadMessageImage(file) {
    const token = await this.tenantToken();
    const form = new FormData();
    form.append("image_type", "message");
    form.append("image", new Blob([fs.readFileSync(file)]), path.basename(file));
    const response = await fetch("https://open.feishu.cn/open-apis/im/v1/images", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body: form,
    });
    const result = await response.json();
    if (!response.ok || result.code !== 0 || !result.data?.image_key) {
      throw new Error(`上传卡片图片失败：${JSON.stringify(result)}`);
    }
    return result.data.image_key;
  }
}
