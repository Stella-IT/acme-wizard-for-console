import ACME from 'acme-client';
import axios from 'axios';
import { showBanner } from './banner';
import Log from './logger';
import { getUserInfo, issueTokens, isTokenValid, retreiveTokens, TokenStore } from './meiling';
import fs from 'fs';
import { prompts } from 'prompts';
import chalk from 'chalk';

const CONSOLE_API_HOST = 'https://console.stella-api.dev';
const TOKEN_FILE = './token.json';
const ACME_CRED_FILE = './acme.credentials.json';

showBanner();

let tokens: TokenStore | undefined = undefined;

(async () => {
  let reAuthRequired = false;

  if (fs.existsSync(TOKEN_FILE)) {
    tokens = JSON.parse(fs.readFileSync(TOKEN_FILE, { encoding: 'utf-8' })) as TokenStore;

    if (
      !(await isTokenValid('access_token', tokens.access_token)) ||
      tokens.expires_at < new Date().getTime() - 120 * 1000
    ) {
      if (!(await isTokenValid('refresh_token', tokens.refresh_token))) {
        Log.error('Invalid Refersh Token! Reissue required!');
        reAuthRequired = true;
      } else {
        await issueTokens('refresh_token', tokens.refresh_token);
      }
      tokens = JSON.parse(fs.readFileSync(TOKEN_FILE, { encoding: 'utf-8' })) as TokenStore;
    }
  } else {
    reAuthRequired = true;
  }

  if (reAuthRequired) {
    await retreiveTokens();
    tokens = JSON.parse(fs.readFileSync(TOKEN_FILE, { encoding: 'utf-8' })) as TokenStore;
  }

  const http = await axios.get(CONSOLE_API_HOST + '/v1/http', {
    headers: {
      Authorization: 'Bearer ' + tokens?.access_token,
    },
  });

  const user = await getUserInfo(tokens?.access_token as string);
  Log.info(`Welcome! ${chalk.bold(user.name)}`);

  const httpProxies: any[] = http.data;

  // Mitigation since @types/prompts sucks.
  const selectedProxy = await (prompts.select({
    type: 'select',
    name: 'Select',
    message: 'Select a proxy target to setup https certificate via ACME',
    choices: httpProxies.map((n: any) => {
      const vmDescription = n.vm ? 'VM Label: ' + n.vm.label : '';
      const letsEncryptDesc = n?.metadata?.https?.letsencrypt ? "Using Let's Encrypt" : '';

      const description = [vmDescription, letsEncryptDesc].filter((n) => n.trim() !== '').join(' / ');

      return {
        title: n.hostname,
        value: n,
        description,
      };
    }),
  }) as unknown as Promise<any>);

  let wasUsingLetsEncrypt = false;
  let accountKey: string | undefined = undefined;

  let email: string = user.email;

  if (selectedProxy.metadata?.https?.letsencrypt) {
    Log.info("This domain has been registered via Let's Encrypt. Retrieving data from Stella IT Console API");
    accountKey = selectedProxy.metadata.https.letsencrypt.accountKey;
    email = selectedProxy.metadata.https.letsencrypt.email;

    wasUsingLetsEncrypt = true;
  }

  let tosAgree = false;

  if (!wasUsingLetsEncrypt) {
    if (fs.existsSync(ACME_CRED_FILE) && !accountKey) {
      const useSaved = await (prompts.confirm({
        type: 'confirm',
        name: 'useSaved',
        message: 'It seems there is saved ACME credentials found on ./acme.credentials.json, Should I use it?',
      }) as unknown as Promise<boolean>);

      if (useSaved) {
        const creds = JSON.parse(fs.readFileSync(ACME_CRED_FILE, { encoding: 'utf-8' }));

        accountKey = creds.accountKey;
        email = creds.email;
      }
    }

    if (!accountKey) {
      const letsEncryptedTargets = httpProxies.filter((n) => {
        return (
          n?.metadata?.https?.letsencrypt?.accountKey !== undefined &&
          n?.metadata?.https?.letsencrypt?.email !== undefined
        );
      });

      let choice:
        | {
            accountKey: string;
            email: string;
            url?: string;
          }
        | 'other' = 'other';

      if (letsEncryptedTargets.length > 0) {
        const choices = letsEncryptedTargets.map((n: any) => {
          const credentialEmail = n?.metadata?.https?.letsencrypt?.email;
          const credentialURL = n?.metadata?.https?.letsencrypt?.url;

          let description = n.vm ? 'VM Label: ' + n.vm.label : '';
          description += ' / Email: ' + credentialEmail;
          description += credentialURL ? ' / URL: ' + credentialURL : '';

          return {
            title: n.hostname,
            value: n.metadata.https.letsencrypt,
            description,
          };
        });

        choices.push({
          title: 'Other',
          value: 'other',
          description:
            "This option should be used for generating new let's encrypt account. [Not Recommended unless there are issues with your Let's Encrypt account]",
        });

        choice = await (prompts.select({
          type: 'select',
          name: 'Select',
          message: 'Select a proxy target to be used for ACME Credentials',
          choices,
        }) as unknown as Promise<any>);
      }

      if (typeof choice === 'string' && choice === 'other') {
        const shouldIGenerateOne = await (prompts.confirm({
          type: 'confirm',
          name: 'generateOne',
          message: "It seems you don't have Let's Encrypt account key. Should I generate one?",
        }) as unknown as Promise<boolean>);

        if (shouldIGenerateOne) {
          accountKey = await (await ACME.forge.createPrivateKey()).toString();
          fs.writeFileSync(
            ACME_CRED_FILE,
            JSON.stringify({
              accountKey,
              email,
            }),
          );
        }
      } else {
        accountKey = choice.accountKey;
        email = choice.email;
      }
    }

    if (!accountKey) {
      Log.error("Setup can not continue. Account Key generation is required to request Let's Encrypt Server.");
      return;
    }

    tosAgree = await (prompts.confirm({
      type: 'confirm',
      name: 'tos',
      message: `Do you agree to Let's Encrypt Terms of Service? (${chalk.cyanBright(
        chalk.underline('https://letsencrypt.org/repository/'),
      )})`,
    }) as unknown as Promise<boolean>);

    if (!tosAgree) {
      Log.error("Setup can not continue. Consenting to Let's Encrypt ToS is required to issue valid certificate.");
      return;
    }

    email = await (prompts.text({
      type: 'text',
      name: 'email',
      message: 'Enter the email:',
      validate: (input) => {
        return /^(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])$/g.test(
          input,
        )
          ? true
          : 'Not a valid email';
      },
      initial: email,
    }) as unknown as Promise<string>);
  } else {
    Log.info("This domain was previously registered on Let's Encrypt. Skipping ToS Agreement");
    tosAgree = true;
  }

  if (!accountKey) {
    throw new Error('Unexpected error occurred. accountKey was not properly generated.');
  }

  const client = new ACME.Client({
    directoryUrl: ACME.directory.letsencrypt.production,
    accountKey,
  });

  let accountURL;
  try {
    accountURL = client.getAccountUrl();
  } catch (e) {}

  fs.writeFileSync(
    ACME_CRED_FILE,
    JSON.stringify({
      accountKey,
      email,
      url: accountURL,
    }),
  );

  const hostname = selectedProxy.hostname;

  Log.info('Generating CSR for ' + hostname);
  const [certificateKey, certificateCsr] = await ACME.forge.createCsr({
    commonName: hostname,
  });

  const cert = await client.auto({
    csr: certificateCsr,
    email,
    termsOfServiceAgreed: tosAgree,
    challengePriority: ['http-01'],
    skipChallengeVerification: true,
    challengeCreateFn: async (authz, challenge, key) => {
      Log.info('Requesting Console API to apply ACME challenge on Stella IT HTTP Proxy');

      const metadata = {
        ...selectedProxy?.metadata,
        routes: {
          ...selectedProxy?.metadata?.routes,
          ['/.well-known/acme-challenge/' + challenge.token]: {
            code: 200,
            content: key,
            headers: {
              'Content-Type': 'text/plain',
            },
          },
        },
        https: {
          ...selectedProxy?.metadata?.https,
          force: false,
        },
      };

      await axios.put(
        CONSOLE_API_HOST + '/v1/http/' + selectedProxy.uid,
        {
          metadata,
        },
        {
          headers: {
            Authorization: 'Bearer ' + tokens?.access_token,
          },
        },
      );

      Log.info('Applied to Stella IT HTTP Proxy. Waiting 10 seconds to fully applied.');
      await (() => {
        return new Promise<void>((res) => {
          setTimeout(() => {
            res();
          }, 10000);
        });
      })();

      Log.info("Requesting Let's Encrypt server to check validation data");
    },
    challengeRemoveFn: async (authz, challenge, key) => {
      Log.info('Requesting Console API to remove ACME challenge from Stella IT HTTP Proxy');

      await axios.put(
        CONSOLE_API_HOST + '/v1/http/' + selectedProxy.uid,
        {
          metadata: selectedProxy.metadata,
        },
        {
          headers: {
            Authorization: 'Bearer ' + tokens?.access_token,
          },
        },
      );
    },
  });
  Log.info("Issued Let's Encrypt Certificate. Applying to Stella IT HTTP Proxy...");

  try {
    accountURL = client.getAccountUrl();
  } catch (e) {}

  const metadata = {
    ...selectedProxy?.metadata,
    https: {
      ...selectedProxy?.metadata?.https,
      letsencrypt: {
        email,
        accountKey,
        url: accountURL,
      },
      cert: {
        key: certificateKey.toString(),
        cert: cert.toString(),
      },
    },
  };

  await axios.put(
    CONSOLE_API_HOST + '/v1/http/' + selectedProxy.uid,
    {
      metadata,
    },
    {
      headers: {
        Authorization: 'Bearer ' + tokens?.access_token,
      },
    },
  );

  Log.info("Applied Let's Encrypt Certificate. It might take 10 minutes or longer to take effect.");

  fs.writeFileSync(
    ACME_CRED_FILE,
    JSON.stringify({
      accountKey,
      email,
      url: accountURL,
    }),
  );
})().catch((e) => {
  Log.error('Exception has occurred. Please check the following log for more information');
  Log.error(e);
});
