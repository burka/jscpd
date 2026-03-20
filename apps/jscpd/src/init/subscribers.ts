import {InFilesDetector, ProgressSubscriber, VerboseSubscriber} from '@jscpd/finder';
import {IOptions} from '@jscpd/core';
import {hasLlmReporter} from './reporters';

export function registerSubscribers(options: IOptions, detector: InFilesDetector): void {
  if (options.verbose) {
    detector.registerSubscriber(new VerboseSubscriber(options));
  }

  if (!options.silent && !hasLlmReporter(options)) {
    detector.registerSubscriber(new ProgressSubscriber(options));
  }
}
