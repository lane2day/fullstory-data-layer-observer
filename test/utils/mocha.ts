import { expect } from 'chai';

import { MockClass, Call } from '../mocks/mock';
import { DataLayerDetail } from '../../src/event';
import { DataLayerObserver, DataLayerConfig } from '../../src/observer';
import MonitorFactory from '../../src/monitor-factory';
import { BuiltinOptions, OperatorFactory } from '../../src/factory';

/**
 * Tests whether a call queue has one Call and returns it.
 * @param mock the MockClass
 * @param methodName the method's name
 * @param callQueueLength (optional) expected number of Calls in the queue; default is >= 0
 */
export function expectCall(mock: MockClass, methodName: string, callQueueLength?: number): Call {
  if (callQueueLength !== undefined) {
    if (callQueueLength <= 0) throw new Error('Use expectNoCalls for empty call queues');
    expect(mock.callQueues[methodName].length).to.eq(callQueueLength);
  } else {
    expect(mock.callQueues[methodName].length).to.be.greaterThan(0);
  }

  return mock.callQueues[methodName].pop()!;
}

/**
 * Tests whether a method call has not been made.
 * @param mock the MockClass
 * @param methodName the method's name
 * @param callQueueLength (optional) expected number of Calls in the queue; default is >= 0
 */
export function expectNoCalls(mock: MockClass, methodName: string): void {
  expect(mock.callQueues[methodName].length).to.eq(0);
}

/**
 * Tests whether a call queue has one Call and returns the Call's parameters.
 * @param mock the MockClass
 * @param methodName the method's name
 * @param callQueueLength (optional) expected number of Calls in the queue; default is >= 0
 */
export function expectParams(mock: MockClass, methodName: string, callQueueLength?: number): any[] {
  const { parameters } = expectCall(mock, methodName, callQueueLength);
  expect(parameters).to.not.be.undefined;
  expect(parameters).to.not.be.null;
  return parameters;
}

/**
 * Create an EventListener that tests the events fired match expected values.
 * This harness supports async events by using Mocha's done callback.
 * @param expectedType the expected type string
 * @param expectedValue the expected value in the object event
 * @param done Mocha's done callback to signal the tests passed
 */
export function expectEventListener(type: string, expectedValue: any, done: Mocha.Done) {
  expect(expectedValue).to.not.be.undefined;

  const listener = (event: Event) => {
    // remove the listener to clean up for the next test
    window.removeEventListener(type, listener);

    expect(event).to.not.be.undefined;
    expect(event.type).to.eq(type);

    const customEvent = event as CustomEvent<DataLayerDetail>;
    expect(customEvent.detail).to.not.be.undefined;

    if (customEvent.detail.value) {
      expect(customEvent.detail.value).to.eq(expectedValue);
    }

    if (customEvent.detail.args) {
      expect(customEvent.detail.args).to.not.be.undefined;
      expect(customEvent.detail.args!.length).to.eq(expectedValue.length);
      expect(customEvent.detail.args!).to.eql(expectedValue);
    }

    done();
  };

  window.addEventListener(type, listener);
}

/**
 * Manages the lifecycle of DataLayerObservers to clean up properly.
 */
export class ExpectObserver {
  static instance: ExpectObserver;

  observers: DataLayerObserver[];

  private constructor() {
    this.observers = [];
  }

  /**
   * Creates a DataLayerObserver.
   * @param config that defines the DataLayerConfig
   * @param expectHandlers when true checks there is a handler for each rule
   */
  create(config: DataLayerConfig, expectHandlers = true): DataLayerObserver {
    const observer = new DataLayerObserver(config);
    expect(observer).to.not.be.undefined;
    expect(observer).to.not.be.null;

    if (expectHandlers) {
      // We can end up with multiple rules for a single array target
      expect(observer.handlers.length >= config.rules.length);
    }

    this.observers.push(observer);

    return observer;
  }

  /**
   * Cleans up an observer by removing its EventListener from the window.
   * If no observer is defined, all observers previously registered are cleaned up.
   * @param observer to be cleaned up.
   */
  cleanup(observer?: DataLayerObserver) {
    if (observer) {
      this.destroy(observer);
    } else {
      this.observers.forEach((o) => {
        this.destroy(o);
      });
    }
  }

  /**
   * Creates an DataLayerObserver with default DataLayerConfig.
   */
  default(): DataLayerObserver {
    const observer = new DataLayerObserver();

    expect(observer).to.not.be.undefined;
    expect(observer).to.not.be.null;

    this.observers.push(observer);

    return observer;
  }

  /**
   * Cleans up an observer by removing its EventListener from the window.
   * @param observer to be cleaned up.
   */
  private destroy(observer: DataLayerObserver) {
    observer.handlers.forEach((handler) => {
      MonitorFactory.getInstance().remove(handler.target.path, true);
      handler.stop();
    });

    const i = this.observers.indexOf(observer);
    if (i > -1) {
      this.observers.splice(i, 1);
    }
  }

  static getInstance(): ExpectObserver {
    if (!ExpectObserver.instance) {
      ExpectObserver.instance = new ExpectObserver();
    }

    return ExpectObserver.instance;
  }
}

/**
 * Expects an Operator's options to be valid.
 * @param options The OperatorOptions passed to the Operator
 * @param message An optional message that describes the use case of options
 */
export function expectValid(options: BuiltinOptions, message?: string) {
  const { name } = options;
  expect(() => OperatorFactory.create(name, options).validate(), message).to.not.throw();
}

/**
 * Expects an Operator's options to be invalid.
 * @param operatorName The Operator's name
 * @param options The OperatorOptions passed to the Operator
 * @param message An optional message that describes the use case of options
 */
export function expectInvalid(options: BuiltinOptions, message?: string) {
  const { name } = options;
  expect(() => OperatorFactory.create(name, options).validate(), message).to.throw();
}
