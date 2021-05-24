import { prompts } from 'prompts';
import chalk from 'chalk';

const MEILING_HOST = 'https://meiling.stella-api.dev';
const CLIENT_ID = '';

function generateGetVariables(data: { [key: string]: string }) {
  let str = '';
  for (const name in data) {
    str += `&${encodeURIComponent(name)}=${encodeURIComponent(data[name])}`;
  }
  str = str.replace(/^&/g, '?');
  return str;
}

export async function retreiveTokens() {
  const getData = {
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: 'urn:ietf:wg:oauth:2.0:oob',
    scope: ['openid', 'email', 'phone', 'https://console.stella-api.dev'].join(' '),
    prompt: 'select_account',
  };

  const url = `${MEILING_HOST}/v1/oauth2/auth${generateGetVariables(getData)}`;
  console.log('Complete the login at:', chalk.cyanBright(chalk.underline(url)));

  const res = await prompts.text({
    type: 'text',
    name: 'code',
    message: 'Paste returned code here:',
  });

  console.log(res);
}
