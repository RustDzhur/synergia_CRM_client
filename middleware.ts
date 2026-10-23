import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { crmHostRedirect } from '@/lib/crmHostRedirect';

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
  // crm.firmspace.de — только вход и приложение: маркетинговые пути ведут на страницу входа
  // (маркетинг переезжает на firmspace.de, редирект обратимый — см. lib/crmHostRedirect.ts).
  // Другие хосты (firmspace.de, www, localhost) ведут себя как раньше.
  const to = crmHostRedirect(req.headers.get('host') ?? req.nextUrl.hostname ?? '', path);
  // ВРЕМЕННАЯ диагностика (убрать после проверки): какой host видит middleware
  if (!path.startsWith('/_next') && !path.startsWith('/api')) {
    console.error(`[mw-host] host=${req.headers.get('host')} urlHost=${req.nextUrl.hostname} path=${path}`);
  }
  if (to) {
    const url = req.nextUrl.clone();
    url.pathname = to;
    url.search = '';
    url.hash = '';
    return NextResponse.redirect(url, 307);
  }
  return intl(req);
}

export const config = {
  // Все пути, кроме статики Next: заголовок Next-Action проверяем везде, язык подставляем только страницам (см. выше)
  matcher: ['/((?!_next/static|_next/image).*)']
};
