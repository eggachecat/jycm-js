/** RFC 6902 JSON Patch generation and application for JYCM. */

export type JsonPatchOperation =
    | { op: 'add' | 'replace' | 'test'; path: string; value: any }
    | { op: 'remove'; path: string }
    | { op: 'move' | 'copy'; path: string; from: string };

export class JsonPatchError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'JsonPatchError';
        Object.setPrototypeOf(this, JsonPatchError.prototype);
    }
}

export class JsonPatchTestFailed extends JsonPatchError {
    constructor(message: string) {
        super(message);
        this.name = 'JsonPatchTestFailed';
        Object.setPrototypeOf(this, JsonPatchTestFailed.prototype);
    }
}

type JsonPath = Array<string | number>;
type Equivalent = (
    left: any,
    right: any,
    leftPath: JsonPath,
    rightPath: JsonPath
) => boolean;

function cloneValue<T>(value: T): T {
    if (Array.isArray(value)) {
        return value.map(cloneValue) as T;
    }
    if (value !== null && typeof value === 'object') {
        return Object.keys(value as object).reduce((copy, key) => {
            (copy as any)[key] = cloneValue((value as any)[key]);
            return copy;
        }, {} as T);
    }
    return value;
}

function escapeToken(token: string | number): string {
    return String(token).replace(/~/g, '~0').replace(/\//g, '~1');
}

function tokens(path: string): string[] {
    if (path === '') return [];
    if (typeof path !== 'string' || !path.startsWith('/')) {
        throw new JsonPatchError("JSON Pointer paths must be empty or start with '/'");
    }
    return path
        .slice(1)
        .split('/')
        .map((token) => token.replace(/~1/g, '/').replace(/~0/g, '~'));
}

function join(path: string, token: string | number): string {
    return `${path}/${escapeToken(token)}`;
}

function arrayIndex(token: string, length: number, allowEnd = false): number {
    if (token === '-' && allowEnd) return length;
    if (!/^(0|[1-9]\d*)$/.test(token)) {
        throw new JsonPatchError(`Invalid array index: ${token}`);
    }
    const index = Number(token);
    const upper = allowEnd ? length : length - 1;
    if (index > upper) {
        throw new JsonPatchError(`Array index out of bounds: ${index}`);
    }
    return index;
}

function resolve(document: any, path: string): any {
    let value = document;
    for (const token of tokens(path)) {
        if (Array.isArray(value)) {
            value = value[arrayIndex(token, value.length)];
        } else if (
            value !== null &&
            typeof value === 'object' &&
            Object.prototype.hasOwnProperty.call(value, token)
        ) {
            value = value[token];
        } else {
            throw new JsonPatchError(`Path does not exist: ${path}`);
        }
    }
    return value;
}

function parent(document: any, path: string): [any, string] {
    const pathTokens = tokens(path);
    if (pathTokens.length === 0) return [null, ''];
    let value = document;
    for (const token of pathTokens.slice(0, -1)) {
        if (Array.isArray(value)) {
            value = value[arrayIndex(token, value.length)];
        } else if (
            value !== null &&
            typeof value === 'object' &&
            Object.prototype.hasOwnProperty.call(value, token)
        ) {
            value = value[token];
        } else {
            throw new JsonPatchError(`Parent path does not exist: ${path}`);
        }
    }
    return [value, pathTokens[pathTokens.length - 1]];
}

function add(document: any, path: string, value: any): any {
    if (path === '') return value;
    const [container, token] = parent(document, path);
    if (Array.isArray(container)) {
        container.splice(arrayIndex(token, container.length, true), 0, value);
    } else if (container !== null && typeof container === 'object') {
        container[token] = value;
    } else {
        throw new JsonPatchError(`Add target is not a container: ${path}`);
    }
    return document;
}

function remove(document: any, path: string): any {
    if (path === '') {
        throw new JsonPatchError('Removing the document root is not supported');
    }
    const [container, token] = parent(document, path);
    if (Array.isArray(container)) {
        container.splice(arrayIndex(token, container.length), 1);
    } else if (
        container !== null &&
        typeof container === 'object' &&
        Object.prototype.hasOwnProperty.call(container, token)
    ) {
        delete container[token];
    } else {
        throw new JsonPatchError(`Remove path does not exist: ${path}`);
    }
    return document;
}

function equal(left: any, right: any): boolean {
    if (left === right) return true;
    if (Array.isArray(left) && Array.isArray(right)) {
        return (
            left.length === right.length &&
            left.every((value, index) => equal(value, right[index]))
        );
    }
    if (
        left !== null &&
        right !== null &&
        typeof left === 'object' &&
        typeof right === 'object'
    ) {
        const leftKeys = Object.keys(left);
        const rightKeys = Object.keys(right);
        return (
            leftKeys.length === rightKeys.length &&
            leftKeys.every(
                (key) =>
                    Object.prototype.hasOwnProperty.call(right, key) &&
                    equal(left[key], right[key])
            )
        );
    }
    return false;
}

export function apply_json_patch(
    document: any,
    patch: JsonPatchOperation[],
    inPlace = false
): any {
    let result = inPlace ? document : cloneValue(document);
    for (const operation of patch) {
        if (!operation || !operation.op || operation.path === undefined) {
            throw new JsonPatchError("Each patch operation requires 'op' and 'path'");
        }
        switch (operation.op) {
            case 'test':
                if (!Object.prototype.hasOwnProperty.call(operation, 'value')) {
                    throw new JsonPatchError("Test operation requires 'value'");
                }
                if (!equal(resolve(result, operation.path), operation.value)) {
                    throw new JsonPatchTestFailed(`Test failed at path: ${operation.path}`);
                }
                break;
            case 'add':
                if (!Object.prototype.hasOwnProperty.call(operation, 'value')) {
                    throw new JsonPatchError("Add operation requires 'value'");
                }
                result = add(result, operation.path, cloneValue(operation.value));
                break;
            case 'remove':
                result = remove(result, operation.path);
                break;
            case 'replace':
                if (!Object.prototype.hasOwnProperty.call(operation, 'value')) {
                    throw new JsonPatchError("Replace operation requires 'value'");
                }
                if (operation.path !== '') {
                    resolve(result, operation.path);
                    result = remove(result, operation.path);
                }
                result = add(result, operation.path, cloneValue(operation.value));
                break;
            case 'move':
            case 'copy': {
                if (!Object.prototype.hasOwnProperty.call(operation, 'from')) {
                    throw new JsonPatchError(
                        `${operation.op === 'move' ? 'Move' : 'Copy'} operation requires 'from'`
                    );
                }
                const value = cloneValue(resolve(result, operation.from));
                if (operation.op === 'move') result = remove(result, operation.from);
                result = add(result, operation.path, value);
                break;
            }
            default:
                throw new JsonPatchError(`Unsupported patch operation: ${(operation as any).op}`);
        }
    }
    return result;
}

export function make_json_patch(
    left: any,
    right: any,
    equivalent?: Equivalent,
    includeTests = false
): JsonPatchOperation[] {
    const operations: JsonPatchOperation[] = [];
    const addTest = (path: string, value: any) => {
        if (includeTests) operations.push({ op: 'test', path, value: cloneValue(value) });
    };

    const walk = (
        leftValue: any,
        rightValue: any,
        leftPath: JsonPath,
        rightPath: JsonPath,
        pointer: string
    ) => {
        if (equal(leftValue, rightValue)) return;
        if (equivalent && equivalent(leftValue, rightValue, leftPath, rightPath)) return;

        const leftObject = leftValue !== null && typeof leftValue === 'object' && !Array.isArray(leftValue);
        const rightObject = rightValue !== null && typeof rightValue === 'object' && !Array.isArray(rightValue);
        if (leftObject && rightObject) {
            const leftKeys = Object.keys(leftValue);
            const rightKeys = Object.keys(rightValue);
            const removed = leftKeys.filter((key) => !rightKeys.includes(key)).sort();
            const added = rightKeys.filter((key) => !leftKeys.includes(key)).sort();
            const common = leftKeys.filter((key) => rightKeys.includes(key)).sort();
            removed.forEach((key) => {
                const child = join(pointer, key);
                addTest(child, leftValue[key]);
                operations.push({ op: 'remove', path: child });
            });
            common.forEach((key) =>
                walk(leftValue[key], rightValue[key], [...leftPath, key], [...rightPath, key], join(pointer, key))
            );
            added.forEach((key) =>
                operations.push({ op: 'add', path: join(pointer, key), value: cloneValue(rightValue[key]) })
            );
            return;
        }

        if (Array.isArray(leftValue) && Array.isArray(rightValue)) {
            const shared = Math.min(leftValue.length, rightValue.length);
            for (let index = 0; index < shared; index++) {
                walk(leftValue[index], rightValue[index], [...leftPath, index], [...rightPath, index], join(pointer, index));
            }
            for (let index = leftValue.length - 1; index >= shared; index--) {
                const child = join(pointer, index);
                addTest(child, leftValue[index]);
                operations.push({ op: 'remove', path: child });
            }
            for (let index = shared; index < rightValue.length; index++) {
                operations.push({ op: 'add', path: join(pointer, index), value: cloneValue(rightValue[index]) });
            }
            return;
        }

        addTest(pointer, leftValue);
        operations.push({ op: 'replace', path: pointer, value: cloneValue(rightValue) });
    };

    walk(left, right, [], [], '');
    return operations;
}

export const applyJsonPatch = apply_json_patch;
export const makeJsonPatch = make_json_patch;
