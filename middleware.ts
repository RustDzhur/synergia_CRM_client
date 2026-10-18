import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';

const intl = createMiddleware({
  // A list of all locales that are supported
  locales: ['ua', 'en', 'de'],

  // If this locale is matched, pathnames work without a prefix (e.g. `/about`)
  defaultLocale: 'de'
});

// Серверных действий Next («use server») на сайте нет и в настройках они не включены. Запрос с заголовком Next-Action — это либо сканер,
// пробующий известные дыры в серверных действиях, либо вкладка, открытая до обновления сайта: до обработчика Next он доходит и роняет
// в журнал «Cannot read properties of undefined (reading 'workers')» / «action is not a function». Отвечаем 404 сразу.
export default function middleware(req: NextRequest) {
  if (req.headers.has('next-action')) return new NextResponse('Not found', { status: 404 });
  const path = req.nextUrl.pathname;
  // как и раньше, интернационализация не касается api, _next и файлов с расширением
  if (path.startsWith('/api') || path.startsWith('/_next') || path.includes('.')) return NextResponse.next();
  return intl(req);
}

export const config = {
  // Все пути, кроме статики Next: заголовок Next-Action проверяем везде, язык подставляем только страницам (см. выше)
  matcher: ['/((?!_next/static|_next/image).*)']
};
