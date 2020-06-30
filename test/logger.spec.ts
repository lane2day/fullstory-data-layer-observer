import { expect } from 'chai';
import 'mocha';
import { Logger, LogLevel, LogEvent } from '../src/utils/logger';
import { FullStory } from './vendor/fullstory-recording';
import { expectParams, MockClass, expectNoCalls } from './mock';

class MockConsole extends MockClass {

  error(message: string): void { }

  warn(message: string): void { }

  info(message: string): void { }

  debug(message: string): void { }
}

describe('logger unit tests', () => {

  it('it should create a console logger with warn and error levels by default', () => {
    const mockDatalayer = 'digitalData.user';
    const console = new MockConsole();
    // @ts-ignore
    globalThis.console = console;

    const logger = Logger.getInstance();

    logger.error('Data layer not found', mockDatalayer);
    logger.warn('Data layer not ready', mockDatalayer);

    const [ error ] = expectParams(console, 'error');
    expect(error).to.eq(`Data layer not found (${mockDatalayer})`);

    const [ warn ] = expectParams(console, 'warn');
    expect(warn).to.eq(`Data layer not ready (${mockDatalayer})`);

    logger.info('Data layer rules loaded', mockDatalayer);
    expectNoCalls(console, 'info');

    logger.debug('Operator output', mockDatalayer);
    expectNoCalls(console, 'debug');

  });

  it('it should allow setting higher log levels', () => {
    const console = new MockConsole();
    // @ts-ignore
    globalThis.console = console;

    const logger = Logger.getInstance();
    logger.level = LogLevel.DEBUG;

    logger.info('Data layer rules loaded');
    const [ info ] = expectParams(console, 'info');
    expect(info).to.eq(`Data layer rules loaded`);

    logger.debug('Operator output');
    const [ debug ] = expectParams(console, 'debug');
    expect(debug).to.eq(`Operator output`);
  });

  it('it should allow setting a custom appender', () => {
    const mockDatalayer = 'digitalData.user';

    const FS = new FullStory();

    const logger = Logger.getInstance();
    logger.appender = {
      log(event: LogEvent) {
        const { level: level_int, message: message_str, datalayer: datalayer_str } = event;
        FS.event('Data Layer Observer', { level_int, message_str, datalayer_str }, 'dataLayerObserver');
      }
    };

    logger.error('Data layer not found', mockDatalayer);

    const [eventName, payload, source] = expectParams(FS, 'event');
    expect(eventName).to.eq('Data Layer Observer');
    expect(payload.level_int).to.eq(LogLevel.ERROR);
    expect(payload.message_str).to.eq('Data layer not found');
    expect(payload.datalayer_str).to.eq(mockDatalayer);
    expect(source).to.eq('dataLayerObserver');

  });

});