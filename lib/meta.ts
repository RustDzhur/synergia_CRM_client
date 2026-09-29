// Graph API в одном месте: Messenger, WhatsApp и реклама ходят в один и тот же Graph, и версия у них
// должна быть одна. Meta снимает версии с поддержки примерно через два года, причём запрос к снятой
// версии отвечает не «обновитесь», а непонятной ошибкой — поэтому версия задаётся здесь, а не в каждом
// файле, и поднимается одной строкой. Переопределяется переменной META_GRAPH_VERSION.
export const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v23.0";

export const graphBase = () => (process.env.META_GRAPH_URL || `https://graph.facebook.com/${GRAPH_VERSION}`).replace(/\/+$/, "");
export const oauthDialog = () => process.env.META_OAUTH_URL || `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`;
