/*
 * Copyright The OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { context, propagation } from '@opentelemetry/api';
import { logs, SeverityNumber } from '@opentelemetry/api-logs';
import { W3CTraceContextPropagator } from '@opentelemetry/core';

import {
  LoggerProvider,
  InMemoryLogRecordExporter,
  SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs';

// @ts-expect-error: not an export, but we want the prebundled version
import chai from 'chai/chai.js';
import * as sinon from 'sinon';
import { ConsoleInstrumentation } from '../src';

const assert = chai.assert;

const exporter = new InMemoryLogRecordExporter();
const provider = new LoggerProvider();
const logProcessor = new SimpleLogRecordProcessor(exporter);

provider.addLogRecordProcessor(logProcessor);
// const logger = provider.getLogger('console-instrumentation-test');
logs.setGlobalLoggerProvider(provider);

const userAgent =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.149 Safari/537.36';

describe('Console Instrumentation', () => {
  let plugin: ConsoleInstrumentation;
  const sandbox = sinon.createSandbox();

  beforeEach(() => {
    Object.defineProperty(window.document, 'readyState', {
      writable: true,
      value: 'complete',
    });
    sandbox.replaceGetter(navigator, 'userAgent', () => userAgent);
    plugin = new ConsoleInstrumentation({
      enabled: false,
    });
    plugin.setLoggerProvider(provider);
    exporter.reset();
  });

  afterEach(async () => {
    sandbox.restore();
    context.disable();
    Object.defineProperty(window.document, 'readyState', {
      writable: true,
      value: 'complete',
    });
    plugin.disable();
  });

  before(() => {
    propagation.setGlobalPropagator(new W3CTraceContextPropagator());
  });

  describe('constructor', () => {
    it('should construct an instance', () => {
      plugin = new ConsoleInstrumentation({
        enabled: false,
      });
      assert.ok(plugin instanceof ConsoleInstrumentation);
    });
  });

  it('should intercept console.log and emit logs', done => {
    plugin.enable();

    console.log('log: 1');
    console.log('log: 2');

    setTimeout(() => {
      const records = exporter.getFinishedLogRecords();
      assert.strictEqual(records.length, 2);
      assert.strictEqual(records[1].body, 'log: 2');
      assert.strictEqual(records[1].severityText, 'log');
      assert.strictEqual(records[1].severityNumber, SeverityNumber.INFO);
      done();
    });
  });

  it('should only intercept console.errors for logLevels: ["error"]', done => {
    plugin = new ConsoleInstrumentation({
      enabled: false,
      logLevels: ['error'],
    });
    plugin.enable();

    console.log('log: 1');
    console.warn('warn: 1');
    const errorText = 'Error: Cannot read property "foo" of undefined';
    console.error(errorText);

    setTimeout(() => {
      const records = exporter.getFinishedLogRecords();
      const { body, severityText, severityNumber } = records[0];
      assert.strictEqual(
        records.length,
        1,
        'only one log record should have been emitted'
      );
      assert.strictEqual(body, errorText);
      assert.strictEqual(severityText, 'error');
      assert.strictEqual(
        severityNumber,
        SeverityNumber.ERROR,
        'severityNumber should be ERROR'
      );
      done();
    });
  });
});
