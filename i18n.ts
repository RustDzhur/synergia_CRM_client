import {getRequestConfig} from 'next-intl/server';
 
export default getRequestConfig(async ({locale}) => (  console.log(locale), {
  
  messages: (await import(`./messages/${locale}.json`)).default
}));