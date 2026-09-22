// Тип для внутреннего модуля pdf-parse, минующего его самотестирующийся index.js (см. lib/ai/pdf.ts)
declare module "pdf-parse/lib/pdf-parse.js" {
    interface PdfParseResult {
        text: string;
        numpages: number;
        numrender: number;
        info: unknown;
        metadata: unknown;
        version: string;
    }
    function pdfParse(data: Buffer | Uint8Array, options?: Record<string, unknown>): Promise<PdfParseResult>;
    export default pdfParse;
}
