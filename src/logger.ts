import chalk from 'chalk';
import Figlet from 'figlet';
import fs from 'fs';

const Log = {
  info: (...msg: any[]) => {
    console.log(`[${chalk.cyanBright(chalk.bold('INFO'))}]`, ...msg);
  },
  warn: (...msg: any[]) => {
    console.log(`[${chalk.yellowBright(chalk.bold('WARN'))}]`, ...msg);
  },
  error: (...msg: any[]) => {
    console.log(`[${chalk.redBright(chalk.bold('EROR'))}]`, ...msg);
  },
};

export default Log;
