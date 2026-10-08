import {getRequestConfig} from 'next-intl/server';
import {loadMessages} from '@/lib/messages';

export default getRequestConfig(async ({locale}) => ({
  messages: await loadMessages(locale)
}));
