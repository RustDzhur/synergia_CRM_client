import { NextResponse, type NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';

const intl = createMiddleware({
  // A list of all locales that are supported
  locales: ['ua', 'en', 'de', 'uz'],

  // If this locale is matched, pathnames work without a prefix (e.g. `/about`)
  defaultLocale: 'de'
});

// В проекте нет серверных действий Next (Server Actions): заголовок Next-Action приходит только от сканеров, которые
// подбирают чужие идентификаторы действий, или от устаревшей вкладки. Next на такой запрос падает внутри
// (TypeError … reading 'workers') и пишет ошибку в журнал, поэтому отвечаем 404 сразу.
export default function middleware(req: NextRequest) {
  if (req.headers.has('next-action')) return new NextResponse(null, { status: 404 });
  return intl(req);
}

export const config = {
  // Skip all paths that should not be internationalized. This example skips the
  // folders "api", "_next" and all files with an extension (e.g. favicon.ico)
  matcher: ['/((?!api|_next|.*\\..*).*)']
};
