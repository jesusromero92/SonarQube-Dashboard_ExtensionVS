export function trimTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value.codePointAt(end - 1) === 47) {
    end -= 1;
  }
  return value.slice(0, end);
}

function stringifyPrimitive(value: unknown): string {
  switch (typeof value) {
    case 'undefined':
      return 'undefined';
    case 'string':
      return value;
    case 'function':
      return Function.prototype.toString.call(value);
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number':
      return Number.prototype.toString.call(value);
    case 'bigint':
      return BigInt.prototype.toString.call(value);
    case 'symbol':
      return Symbol.prototype.toString.call(value);
    default:
      throw new TypeError('Expected a primitive value');
  }
}

function tryStringifyObjectMethod(value: object, methodName: 'toString' | 'valueOf'): string | undefined {
  const method = Reflect.get(value, methodName);
  if (typeof method !== 'function') return undefined;

  const result = Reflect.apply(method, value, []);
  if (typeof result === 'object' && result !== null) return undefined;

  return stringifyPrimitive(result);
}

function stringifyObject(value: object): string {
  const toStringResult = tryStringifyObjectMethod(value, 'toString');
  if (toStringResult !== undefined) return toStringResult;

  const valueOfResult = tryStringifyObjectMethod(value, 'valueOf');
  if (valueOfResult !== undefined) return valueOfResult;

  throw new TypeError('Cannot convert object to primitive value');
}

export function stringifyUnknown(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'object') return stringifyObject(value);
  return stringifyPrimitive(value);
}
