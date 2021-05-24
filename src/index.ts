import ACME from 'acme-client';
import axios from 'axios';
import { showBanner } from './banner';
import Log from './logger';
import { retreiveTokens } from './meiling';

showBanner();

(async () => {
  await retreiveTokens();
})();
