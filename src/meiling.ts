import { prompts } from 'prompts';
import chalk from 'chalk';
import axios from 'axios';
import fs from 'fs';

const MEILING_HOST = 'https://meiling.stella-api.dev';
const CLIENT_ID = 'ab727c84-f9bc-47e3-bf9e-a6a8d7f2604b';

export interface TokenStore {
  access_token: string;
  refresh_token: string;
  expires_at: Date;
}

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
    scope: ['name', 'openid', 'email', 'phone', 'https://console.stella-api.dev'].join(' '),
    prompt: 'select_account',
  };

  const url = `${MEILING_HOST}/v1/oauth2/auth${generateGetVariables(getData)}`;
  console.log('Complete the login at:', chalk.cyanBright(chalk.underline(url)));

  // mitigation: @types/prompts is not good
  const authorizationCode = (await prompts.text({
    type: 'text',
    name: 'code',
    message: 'Paste returned code here:',
  })) as unknown as string;

  const result = await issueTokens('authorization_code', authorizationCode);
  return result;
}

export async function issueTokens(type: 'authorization_code' | 'refresh_token', token: string) {
  let prev: TokenStore | Record<string, never> = {};
  if (fs.existsSync('./token.json')) {
    prev = {
      ...JSON.parse(fs.readFileSync('./token.json', { encoding: 'utf-8' })),
    };
  }

  if (typeof prev.expires_at === 'string') {
    prev.expires_at = new Date(prev.expires_at);
  }

  try {
    const paramName = type === 'authorization_code' ? 'code' : type;
    const query = generateGetVariables({
      client_id: CLIENT_ID,
      grant_type: type,
      [paramName]: token,
    }).replace(/^\?/, '');

    const res = await axios.post(`${MEILING_HOST}/v1/oauth2/token`, query);

    const data = res.data;

    prev = {
      ...(prev ? prev : {}),
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: new Date(new Date().getTime() + data.expires_in * 1000),
    };

    fs.writeFileSync('./token.json', JSON.stringify(prev));
    return prev;
  } catch (e) {
    console.error(e);
    throw e;
  }
}

export async function isTokenValid(type: 'access_token' | 'refresh_token', token: string) {
  try {
    const res = await axios.post(`${MEILING_HOST}/v1/oauth2/tokeninfo`, {
      [type]: token,
    });

    return true;
  } catch (e) {
    return false;
  }
}

export async function getUserInfo(token: string) {
  try {
    const res = await axios.get(`${MEILING_HOST}/v1/oauth2/userinfo`, {
      headers: {
        Authorization: 'Bearer ' + token,
      },
    });

    return res.data;
  } catch (e) {
    return false;
  }
}
