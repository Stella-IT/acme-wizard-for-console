import chalk from 'chalk';
import Figlet from 'figlet';
import fs from 'fs';

const Log = {
  info: (...msg: any[]) => {
    console.log(`${chalk.cyanBright(chalk.bold('i'))}`, ...msg);
  },
  warn: (...msg: any[]) => {
    console.log(`${chalk.yellowBright(chalk.bold('W'))}`, ...msg);
  },
  error: (...msg: any[]) => {
    console.log(`${chalk.redBright(chalk.bold('X'))}`, ...msg);
  },
};

export default Log;
