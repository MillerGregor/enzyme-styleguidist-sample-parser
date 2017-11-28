import ArgParse from 'argparse';
import log from 'loglevel';
import { buildGuide } from '../sampleParser';

const argParser = new ArgParse.ArgumentParser({
  version: '0.1.0',
  addHelp: true,
  description: 'parse sample into react-styleguidist examples',
});

argParser.addArgument(['-d', '--dev'], {
  defaultValue: false,
  action: 'storeTrue',
  help: 'generate Development styleguide',
});

argParser.addArgument(['-p', '--prod'], {
  defaultValue: false,
  action: 'storeTrue',
  help: 'generate Production styleguide',
});

argParser.addArgument(samples, {
  help: 'samples from which to build the guide(s)',
});

const opts = argParser.parseArgs();
log.debug({ opts });

if (opts.dev || opts.prod) {
  const { samples, ...rest } = opts;
  buildGuide(samples, rest);
}
