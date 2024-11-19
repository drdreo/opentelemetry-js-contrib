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
import { SpanContext } from '@opentelemetry/api';
import { InstrumentationBase } from '@opentelemetry/instrumentation';
/** @knipignore */
import { PACKAGE_NAME, PACKAGE_VERSION } from './version';
import { getLogSeverityNumber, getTraceParent } from './utils';
import {ConsoleInstrumentationConfig, ConsoleMethod, ConsoleMethodSignature} from './types';

/**
 * Browser console instrumentation for logging
 * @see // https://github.com/open-telemetry/opentelemetry-js/blob/main/experimental/examples/logs/index.ts
 */
export class ConsoleInstrumentation extends InstrumentationBase<ConsoleInstrumentationConfig> {
  private _levels: ConsoleMethod[] = ['log', 'warn', 'error'];
  private _originalMethods: Map<string, Function> = new Map();

  constructor(config: ConsoleInstrumentationConfig = {}) {
    super(PACKAGE_NAME, PACKAGE_VERSION, config);
  }

  override enable(): void {
    const traceParent = getTraceParent();
    this._levels = this.getConfig().logLevels ?? this._levels;
    this._levels.forEach(method => {
      this._wrapMethod(
        console,
        method,
        this._patchConsoleMethod(method, traceParent)
      );
    });
  }

  override disable(): void {
    this._levels.forEach(method => {
      this._unwrapMethod(console, method);
    });
  }

  override init(): void {}

  private _patchConsoleMethod(method: ConsoleMethod, traceParent: SpanContext | null) {
    const { logger, _diag } = this;
    return (original: ConsoleMethodSignature) => {
      return function patchConsole(this: Console, ...args: any[]) {
        try {
          logger.emit({
            body: args
              .map(arg =>
                typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
              )
              .join(' '),
            severityText: method,
            severityNumber: getLogSeverityNumber(method as keyof Console),
            attributes: {
              'trace.id': traceParent?.traceId,
              'span.id': traceParent?.spanId,
            },
          });
        } catch (err) {
          _diag.error('Logging interceptor error', err);
        }
        return original.apply(this, args);
      };
    };
  }

  private _wrapMethod(
    obj: Record<string, any>,
    method: string,
    patchFn: (original: (...args: any[]) => any) => (...args: any[]) => any
  ): void {
    const original = obj[method];
    if (typeof original !== 'function') {
      throw new Error(`${method} is not a function on the provided object`);
    }

    obj[method] = patchFn(original);

    this._originalMethods.set(method, original);
  }

  private _unwrapMethod(obj: Record<string, any>, method: string): void {
    const original = this._originalMethods.get(method);
    if (original) {
      obj[method] = original;
      this._originalMethods.delete(method);
    }
  }
}
