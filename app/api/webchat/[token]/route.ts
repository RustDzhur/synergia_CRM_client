import { connectDB } from "@/lib/mongodb";
import { findByToken } from "@/lib/integrations";
import { corsJson, corsPreflight } from "@/lib/channels/webchat";

export const dynamic = "force-dynamic";

export const OPTIONS = corsPreflight;

// GET — оформление виджета (заголовок, приветствие, цвет)
export async function GET(_req: Request, { params }: { params: { token: string } }) {
    await connectDB();
    const integration = await findByToken("webchat", params.token);
    if (!integration) return corsJson({ message: "Not found" }, 404);
    const { title, greeting, color } = integration.config;
    return corsJson({ title, greeting, color });
}
