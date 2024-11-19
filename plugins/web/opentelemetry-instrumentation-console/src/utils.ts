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
import { SeverityNumber } from '@opentelemetry/api-logs';
import { parseTraceParent, TRACE_PARENT_HEADER } from '@opentelemetry/core';

export function getTraceParent(): SpanContext | null {
  const metaElement = Array.from(document.getElementsByTagName('meta')).find(
    e => e.getAttribute('name') === TRACE_PARENT_HEADER
  );
  return parseTraceParent((metaElement && metaElement.content) || '');
}

export function getLogSeverityNumber(method: keyof Console): number {
  switch (method) {
    case 'error':
      return SeverityNumber.ERROR;
    case 'warn':
      return SeverityNumber.WARN;
    case 'log':
      return SeverityNumber.INFO;
    case 'debug':
      return SeverityNumber.DEBUG;
    default:
      return 9; // Default to info
  }
}
