// WebM/Opus → Ogg/Opus без перекодирования звука.
//
// Chrome и Edge записывают голосовые через MediaRecorder в WebM (audio/webm;codecs=opus),
// а Telegram принимает голосовым сообщением только OGG/Opus, MP3 и M4A: WebM он отдаёт
// карточкой файла, и прослушать запись в клиенте нельзя. Но WebM/Opus и OGG/Opus несут
// одни и те же пакеты Opus — отличается только контейнер, поэтому звук не перекодируется:
// пакеты вынимаются из SimpleBlock/BlockGroup и раскладываются по страницам Ogg.
//
// Только Node (nodejs runtime): ни браузерных API, ни внешних зависимостей.
// Файл на диске/в CRM не трогаем — конвертация нужна только на исходящем пути в Telegram.

// ---------- EBML/Matroska ----------

// Идентификаторы нужных элементов: значение читается вместе с ведущими битами длины
const EL = {
    SEGMENT: 0x18538067,
    SEEK_HEAD: 0x114d9b74,
    INFO: 0x1549a966,
    TRACKS: 0x1654ae6b,
    TRACK_ENTRY: 0xae,
    TRACK_NUMBER: 0xd7,
    CODEC_ID: 0x86,
    CODEC_PRIVATE: 0x63a2,
    AUDIO: 0xe1,
    CHANNELS: 0x9f,
    SAMPLING_FREQUENCY: 0xb5,
    CLUSTER: 0x1f43b675,
    CUES: 0x1c53bb6b,
    SIMPLE_BLOCK: 0xa3,
    BLOCK_GROUP: 0xa0,
    BLOCK: 0xa1,
};

// Элементы верхнего уровня внутри Segment: кластер без размера (так его пишет Chrome)
// заканчивается там, где начинается следующий из них
const TOP_LEVEL = [0x1a45dfa3, EL.SEGMENT, EL.SEEK_HEAD, EL.INFO, EL.TRACKS, EL.CLUSTER, EL.CUES, 0x1254c367, 0x1941a469, 0x1043a770, 0xec];
const isTopLevel = (id: number) => TOP_LEVEL.indexOf(id) >= 0;

interface Element {
    id: number;
    from: number; // первый байт содержимого
    to: number; // за последним байтом содержимого
}

// Длина переменного целого EBML по первому байту: номер старшего единичного бита
function vintLength(first: number) {
    for (let len = 1; len <= 8; len++) if (first & (0x80 >> (len - 1))) return len;
    return 0;
}

// Идентификатор элемента: значение вместе с битами длины (0x1A45DFA3 и т.п.)
function elementId(buf: Buffer, pos: number, end: number): { id: number; next: number } | null {
    if (pos >= end) return null;
    const len = vintLength(buf[pos]);
    if (!len || pos + len > end) return null;
    let id = 0;
    for (let i = 0; i < len; i++) id = id * 256 + buf[pos + i];
    return { id, next: pos + len };
}

// Размер элемента: тот же переменный размер, но ведущий бит отбрасывается.
// Все единицы в значимых битах — «размер неизвестен» (так помечен весь Segment и кластеры).
function elementSize(buf: Buffer, pos: number, end: number): { size: number; next: number; unknown: boolean } | null {
    if (pos >= end) return null;
    const len = vintLength(buf[pos]);
    if (!len || pos + len > end) return null;
    let size = buf[pos] & (0xff >> len);
    let max = 0xff >> len;
    for (let i = 1; i < len; i++) {
        size = size * 256 + buf[pos + i];
        max = max * 256 + 0xff;
    }
    return { size, next: pos + len, unknown: size === max };
}

// Конец элемента без размера: начало следующего элемента верхнего уровня либо конец файла
function endOfUnknown(buf: Buffer, from: number, end: number) {
    let pos = from;
    while (pos < end) {
        const id = elementId(buf, pos, end);
        if (!id) return end;
        if (isTopLevel(id.id)) return pos;
        const size = elementSize(buf, id.next, end);
        if (!size || size.unknown) return end;
        pos = size.next + size.size;
    }
    return end;
}

// Список дочерних элементов: обходим строго по размерам, ничего не выискивая в содержимом
function elements(buf: Buffer, start: number, end: number, top: boolean): Element[] {
    const out: Element[] = [];
    let pos = start;
    while (pos < end && out.length < 1000000) {
        const id = elementId(buf, pos, end);
        if (!id) break;
        const size = elementSize(buf, id.next, end);
        if (!size) break;
        const from = size.next;
        const to = !size.unknown
            ? Math.min(from + size.size, end)
            : id.id === EL.SEGMENT
              ? end
              : top
                ? endOfUnknown(buf, from, end)
                : end;
        out.push({ id: id.id, from, to });
        if (to <= pos) break; // защита от зацикливания на битом файле
        pos = to;
    }
    return out;
}

// Целое без знака (в EBML — big-endian, длина 1..8 байт)
function uint(buf: Buffer, el: Element) {
    let value = 0;
    for (let i = el.from; i < el.to; i++) value = value * 256 + buf[i];
    return value;
}

// Float размером 4 или 8 байт (SamplingFrequency в Audio)
function float(buf: Buffer, el: Element) {
    const len = el.to - el.from;
    if (len === 4) return buf.readFloatBE(el.from);
    if (len === 8) return buf.readDoubleBE(el.from);
    return NaN;
}

function ascii(buf: Buffer, el: Element) {
    return buf.subarray(el.from, el.to).toString("latin1");
}

interface OpusTrack {
    number: number;
    channels: number;
    rate: number;
    head?: Buffer; // CodecPrivate — он же пакет OpusHead
}

// Дорожка Opus в Tracks: нужны её номер, число каналов и OpusHead из CodecPrivate
function findOpusTrack(buf: Buffer, tracks: Element): OpusTrack | null {
    for (const entry of elements(buf, tracks.from, tracks.to, false)) {
        if (entry.id !== EL.TRACK_ENTRY) continue;
        const fields = elements(buf, entry.from, entry.to, false);
        const priv = fields.find((f) => f.id === EL.CODEC_PRIVATE);
        const codec = fields.find((f) => f.id === EL.CODEC_ID);
        const head = priv ? buf.subarray(priv.from, priv.to) : null;
        const isOpus = (codec ? ascii(buf, codec) : "").indexOf("A_OPUS") === 0 || (!!head && head.length >= 19 && head.subarray(0, 8).toString("latin1") === "OpusHead");
        if (!isOpus) continue;
        let channels = 1;
        let rate = 48000;
        const audio = fields.find((f) => f.id === EL.AUDIO);
        if (audio) {
            const sub = elements(buf, audio.from, audio.to, false);
            const ch = sub.find((f) => f.id === EL.CHANNELS);
            if (ch) channels = uint(buf, ch) || 1;
            const freq = sub.find((f) => f.id === EL.SAMPLING_FREQUENCY);
            if (freq) rate = Math.round(float(buf, freq)) || 48000;
        }
        const num = fields.find((f) => f.id === EL.TRACK_NUMBER);
        return { number: num ? uint(buf, num) : 1, channels, rate, head: head && head.length >= 19 ? Buffer.from(head) : undefined };
    }
    return null;
}

// Кадры одного блока: заголовок (номер дорожки, время, флаги) и упаковка кадров (lacing)
function blockFrames(payload: Buffer, track: number, out: Buffer[]) {
    const num = elementSize(payload, 0, payload.length); // номер дорожки — тот же переменный размер
    if (!num || num.unknown) return;
    let pos = num.next;
    if (pos + 3 > payload.length) return;
    pos += 2; // время относительно начала кластера, нам не нужно
    const flags = payload[pos++];
    if (track && num.size !== track) return;
    const lacing = (flags >> 1) & 0x03;
    const end = payload.length;
    if (lacing === 0) {
        if (end > pos) out.push(payload.subarray(pos, end));
        return;
    }
    if (pos >= end) return;
    const count = payload[pos++] + 1;
    const sizes: number[] = [];
    if (lacing === 1) {
        // Xiph: размеры кадров, кроме последнего, — суммы байтов до байта, отличного от 255
        for (let i = 0; i < count - 1; i++) {
            let size = 0;
            for (;;) {
                if (pos >= end) return;
                const b = payload[pos++];
                size += b;
                if (b !== 255) break;
            }
            sizes.push(size);
        }
    } else if (lacing === 2) {
        // фиксированный: одинаковая длина у всех кадров
        const left = end - pos;
        if (left % count) return;
        for (let i = 0; i < count - 1; i++) sizes.push(left / count);
    } else {
        // EBML: первый размер — обычное переменное целое, дальше — приращения со знаком
        let prev = 0;
        for (let i = 0; i < count - 1; i++) {
            const start = pos;
            const v = elementSize(payload, pos, end);
            if (!v || v.unknown) return;
            pos = v.next;
            const size = i === 0 ? v.size : prev + v.size - (Math.pow(2, 7 * (v.next - start) - 1) - 1);
            if (size < 0) return;
            sizes.push(size);
            prev = size;
        }
    }
    const used = sizes.reduce((a, b) => a + b, 0);
    const last = end - pos - used;
    if (last < 0) return;
    sizes.push(last);
    for (const size of sizes) {
        if (size > 0) out.push(payload.subarray(pos, pos + size));
        pos += size;
    }
}

// Все пакеты Opus по порядку. track = 0 — брать блоки любой дорожки (если Tracks разобрать не удалось).
function collectPackets(buf: Buffer, segment: Element, track: number): Buffer[] {
    const out: Buffer[] = [];
    for (const el of elements(buf, segment.from, segment.to, true)) {
        if (el.id !== EL.CLUSTER) continue;
        for (const child of elements(buf, el.from, el.to, false)) {
            if (child.id === EL.SIMPLE_BLOCK) {
                blockFrames(buf.subarray(child.from, child.to), track, out);
            } else if (child.id === EL.BLOCK_GROUP) {
                const block = elements(buf, child.from, child.to, false).find((f) => f.id === EL.BLOCK);
                if (block) blockFrames(buf.subarray(block.from, block.to), track, out);
            }
        }
    }
    return out;
}

// ---------- Ogg ----------

// CRC-32 из спецификации Ogg: полином 0x04C11DB7, без отражения и без начального/конечного xor
const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n << 24;
        for (let k = 0; k < 8; k++) c = c & 0x80000000 ? (c << 1) ^ 0x04c11db7 : c << 1;
        table[n] = c >>> 0;
    }
    return table;
})();

function oggCrc(buf: Buffer, from: number, to: number) {
    let crc = 0;
    for (let i = from; i < to; i++) crc = (((crc << 8) >>> 0) ^ CRC_TABLE[(crc >>> 24) ^ buf[i]]) >>> 0;
    return crc >>> 0;
}

// Значения таблицы сегментов для пакета: по 255 байт на сегмент, неполный — последним
function lacing(length: number) {
    const segs: number[] = [];
    let left = length;
    while (left >= 255) {
        segs.push(255);
        left -= 255;
    }
    segs.push(left);
    return segs;
}

// Страница Ogg: заголовок, таблица сегментов и данные. В таблице не больше 255 значений —
// столько сегментов влезает в одну страницу.
function oggPage(headerType: number, granule: bigint, seq: number, serial: number, body: Buffer, segs: number[]): Buffer {
    const page = Buffer.alloc(27 + segs.length + body.length);
    page.write("OggS", 0, "latin1");
    page[4] = 0; // версия потока
    page[5] = headerType; // 0x01 — продолжение пакета, 0x02 — начало потока, 0x04 — конец потока
    page.writeBigUInt64LE(BigInt.asUintN(64, granule), 6);
    page.writeUInt32LE(serial >>> 0, 14);
    page.writeUInt32LE(seq >>> 0, 18);
    page.writeUInt32LE(0, 22); // место под CRC: считаем по готовой странице
    page[26] = segs.length;
    Buffer.from(segs).copy(page, 27);
    body.copy(page, 27 + segs.length);
    page.writeUInt32LE(oggCrc(page, 0, page.length), 22);
    return page;
}

// Заголовок потока Opus: версия, каналы, пред-пропуск, частота входа, усиление, порядок каналов
function synthOpusHead(channels: number, rate: number) {
    const head = Buffer.alloc(19);
    head.write("OpusHead", 0, "latin1");
    head[8] = 1; // версия
    head[9] = channels;
    head.writeUInt16LE(3840, 10); // пред-пропуск по умолчанию, 80 мс
    head.writeUInt32LE(rate || 48000, 12);
    head.writeInt16LE(0, 16); // усиление
    head[18] = 0; // моно/стерео без таблицы каналов
    return head;
}

// Комментарии Opus (OpusTags): вендор и пустой список записей.
// Поле с числом записей обязательное: без него пакет короче, чем нужно, и декодеры спотыкаются.
function opusTags() {
    const vendor = Buffer.from("firmspace", "utf8");
    const tags = Buffer.alloc(16 + vendor.length);
    tags.write("OpusTags", 0, "latin1");
    tags.writeUInt32LE(vendor.length, 8);
    vendor.copy(tags, 12);
    tags.writeUInt32LE(0, 12 + vendor.length);
    return tags;
}

// Длительность пакета Opus в отсчётах 48 кГц: конфигурация — биты 3..7 байта TOC,
// число кадров в пакете — биты 0..1 (для кода 3 оно лежит во втором байте).
// Не разобрали пакет — считаем 20 мс, гранула от этого только чуть сдвинется.
const SILK_FRAMES = [480, 960, 1920, 2880]; // 10/20/40/60 мс
const CELT_FRAMES = [120, 240, 480, 960]; // 2.5/5/10/20 мс
function opusSamples(packet: Buffer) {
    if (packet.length < 1) return 960;
    const toc = packet[0];
    const config = toc >> 3;
    const code = toc & 0x03;
    const frame = config < 12 ? SILK_FRAMES[config & 3] : config < 16 ? (config & 1 ? 960 : 480) : CELT_FRAMES[config & 3];
    if (code === 0) return frame;
    if (code === 1 || code === 2) return frame * 2;
    if (packet.length < 2) return 960;
    const frames = packet[1] & 0x3f;
    return frames > 0 && frames <= 48 ? frame * frames : 960;
}

function buildOgg(head: Buffer, packets: Buffer[]): Buffer {
    const serial = (Math.random() * 0xffffffff) >>> 0;
    const pages: Buffer[] = [];
    let seq = 0;
    // OpusHead и OpusTags — каждый на своей странице (RFC 7845), у них гранула 0
    pages.push(oggPage(0x02, BigInt(0), seq++, serial, head, lacing(head.length)));
    const tags = opusTags();
    pages.push(oggPage(0x00, BigInt(0), seq++, serial, tags, lacing(tags.length)));
    // Дальше страницы со звуком, и начинаются они только с целого пакета. Обрывать страницу
    // на середине пакета нельзя: у такой страницы гранулы нет (-1), и декодер Chrome (ffmpeg)
    // отказывается разбирать файл. Пакет Opus в страницу влезает всегда — он не длиннее
    // 61200 байт, а это 240 сегментов из 255 допустимых.
    let body: Buffer[] = [];
    let table: number[] = [];
    let granule = 0; // суммарная длительность пакетов, попавших на страницу
    const flush = (last: boolean) => {
        if (!body.length) return;
        pages.push(oggPage(last ? 0x04 : 0x00, BigInt(granule), seq++, serial, Buffer.concat(body), table));
        body = [];
        table = [];
    };
    for (const packet of packets) {
        const segs = lacing(packet.length);
        if (segs.length > 255) throw new Error("Opus packet does not fit into an Ogg page");
        if (table.length + segs.length > 255) flush(false);
        body.push(packet);
        table.push(...segs);
        granule += opusSamples(packet);
    }
    flush(true);
    return Buffer.concat(pages);
}

/**
 * Перекладывает звук из WebM/Opus в Ogg/Opus. Звук не перекодируется: пакеты Opus
 * переносятся как есть. Бросает исключение, если файл не WebM или в нём нет пакетов Opus.
 */
export function webmOpusToOgg(data: Buffer): Buffer {
    const segment = elements(data, 0, data.length, false).find((el) => el.id === EL.SEGMENT);
    if (!segment) throw new Error("Not a WebM/Matroska file: no Segment element");
    const tracks = elements(data, segment.from, segment.to, false).find((el) => el.id === EL.TRACKS);
    const track = tracks ? findOpusTrack(data, tracks) : null;
    const packets = collectPackets(data, segment, track ? track.number : 0);
    if (!packets.length) throw new Error("No Opus packets in the file");
    const head = track?.head ?? synthOpusHead(track?.channels ?? 1, track?.rate ?? 48000);
    return buildOgg(head, packets);
}
