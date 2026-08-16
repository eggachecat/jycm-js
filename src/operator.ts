import { PLACE_HOLDER_NON_EXIST } from './helper';
import { TreeLevel, YouchamaJsonDiffer } from './jycm';

export type IJYCMOperator = {
    __event__?: string;
    match: (level: TreeLevel) => boolean;
    diff: (
        level: TreeLevel,
        instance: YouchamaJsonDiffer,
        drill: boolean
    ) => { skip: boolean; score: number };
};

interface IJYCMOperatorConstructor {
    new (...args: any[]): IJYCMOperator;
}

export const OPERATOR_MAPPING: { [_: string]: IJYCMOperatorConstructor } = {};

export function register_operator(name: string, cls: IJYCMOperatorConstructor) {
    OPERATOR_MAPPING[name] = cls;
}

export function getOperatorListFromJSON(
    configList: { name: string; args: any }[]
) {
    return configList.map(
        ({ name, args }) => new OPERATOR_MAPPING[name](...args)
    );
}

export class BaseOperator {
    path_regex: string;
    regex: RegExp;
    rule_name?: string;
    constructor(path_regex: string, rule_name?: string) {
        this.path_regex = path_regex;
        this.regex = new RegExp(path_regex);
        this.rule_name = rule_name;
    }
    match(level: TreeLevel) {
        return null !== level.get_path().match(this.regex);
    }
    ruleInfo() {
        return this.rule_name ? { rule: this.rule_name } : {};
    }
}

export class ListItemFieldMatchOperator
    extends BaseOperator
    implements IJYCMOperator
{
    __operator_name__ = 'operator:list:matchWithField';
    __event__ = 'operator:list:matchWithField';
    field: string;
    constructor(path_regex: string, field: string, rule_name?: string) {
        super(path_regex, rule_name);
        this.field = field;
    }

    diff(level: TreeLevel, instance: YouchamaJsonDiffer, drill: boolean) {
        if (drill) {
            if (level.left[this.field] === level.right[this.field]) {
                return { skip: true, score: 1 };
            }
        } else {
            instance.report(this.__event__, level, {
                field: this.field,
                path_regex: this.path_regex,
                ...this.ruleInfo()
            });
        }

        return { skip: false, score: -1 };
    }
}

register_operator('operator:list:matchWithField', ListItemFieldMatchOperator);

export class ExpectChangeOperator
    extends BaseOperator
    implements IJYCMOperator
{
    __operator_name__ = 'operator:primitive:expectChange';
    __event__ = 'operator:primitive:expectChange';

    diff(level: TreeLevel, instance: YouchamaJsonDiffer, drill: boolean) {
        if (level.left === level.right) {
            if (!drill) {
                instance.report(this.__event__, level, {
                    pass: false,
                    path_regex: this.path_regex,
                    ...this.ruleInfo()
                });
            }
            return { skip: true, score: 0 };
        }

        if (!drill) {
            instance.report(this.__event__, level, {
                pass: true,
                path_regex: this.path_regex,
                ...this.ruleInfo()
            });
        }

        return { skip: true, score: 1 };
    }
}
register_operator('operator:primitive:expectChange', ExpectChangeOperator);

export class IgnoreOperator extends BaseOperator implements IJYCMOperator {
    __operator_name__ = 'ignore';
    __event__ = 'ignore';

    diff(level: TreeLevel, instance: YouchamaJsonDiffer, drill: boolean) {
        if (!drill) {
            instance.report(this.__event__, level, {
                pass: true,
                path_regex: this.path_regex,
                ...this.ruleInfo()
            });
        }
        return { skip: true, score: 1 };
    }
}
register_operator('ignore', IgnoreOperator);

export class ExpectExistOperator
    extends BaseOperator
    implements IJYCMOperator
{
    __operator_name__ = 'operator:expectExist';
    __event__ = 'operator:expectExist';

    diff(level: TreeLevel, instance: YouchamaJsonDiffer, drill: boolean) {
        const info: { [key: string]: any } = {
            pass: true,
            path_regex: this.path_regex,
            ...this.ruleInfo()
        };
        if (level.left === PLACE_HOLDER_NON_EXIST) {
            info.pass = false;
            info.left_non_exist = true;
        }
        if (level.right === PLACE_HOLDER_NON_EXIST) {
            info.pass = false;
            info.right_non_exist = true;
        }
        if (!drill) instance.report(this.__event__, level, info);
        return { skip: true, score: info.pass ? 1 : 0 };
    }
}
register_operator('operator:expectExist', ExpectExistOperator);

export class NumericRangeOperator
    extends BaseOperator
    implements IJYCMOperator
{
    __operator_name__ = 'operator:floatInRange';
    __event__ = 'operator:floatInRange';
    interval_start: number;
    interval_end: number;

    constructor(
        path_regex: string,
        interval_start: number,
        interval_end: number,
        rule_name?: string
    ) {
        super(path_regex, rule_name);
        this.interval_start = interval_start;
        this.interval_end = interval_end;
    }

    diff(level: TreeLevel, instance: YouchamaJsonDiffer, drill: boolean) {
        const leftValid =
            typeof level.left === 'number' &&
            this.interval_start < level.left &&
            level.left <= this.interval_end;
        const rightValid =
            typeof level.right === 'number' &&
            this.interval_start < level.right &&
            level.right <= this.interval_end;
        const info: { [key: string]: any } = {
            pass: leftValid && rightValid,
            interval_start: this.interval_start,
            interval_end: this.interval_end,
            path_regex: this.path_regex,
            ...this.ruleInfo()
        };
        if (!leftValid) info.left_invalid = true;
        if (!rightValid) info.right_invalid = true;
        if (!drill) instance.report(this.__event__, level, info);
        return { skip: true, score: info.pass ? 1 : 0 };
    }
}
register_operator('operator:floatInRange', NumericRangeOperator);

export class NumericToleranceOperator
    extends BaseOperator
    implements IJYCMOperator
{
    __operator_name__ = 'operator:number:tolerance';
    __event__ = 'operator:number:tolerance';
    absolute_tolerance: number;
    relative_tolerance: number;

    constructor(
        path_regex: string,
        absolute_tolerance = 0,
        relative_tolerance = 0,
        rule_name?: string
    ) {
        super(path_regex, rule_name);
        if (absolute_tolerance < 0 || relative_tolerance < 0) {
            throw new Error('numeric tolerances must be non-negative');
        }
        this.absolute_tolerance = absolute_tolerance;
        this.relative_tolerance = relative_tolerance;
    }

    diff(level: TreeLevel, instance: YouchamaJsonDiffer, drill: boolean) {
        const numeric =
            typeof level.left === 'number' && typeof level.right === 'number';
        const delta = numeric ? Math.abs(level.left - level.right) : null;
        const scale = numeric
            ? Math.max(Math.abs(level.left), Math.abs(level.right))
            : 0;
        const threshold = Math.max(
            this.absolute_tolerance,
            this.relative_tolerance * scale
        );
        const pass = numeric && (delta as number) <= threshold;
        if (!drill) {
            instance.report(this.__event__, level, {
                pass,
                path_regex: this.path_regex,
                absolute_tolerance: this.absolute_tolerance,
                relative_tolerance: this.relative_tolerance,
                delta,
                threshold,
                ...this.ruleInfo()
            });
        }
        return { skip: true, score: pass ? 1 : 0 };
    }
}
register_operator('operator:number:tolerance', NumericToleranceOperator);
register_operator('numeric_tolerance', NumericToleranceOperator);

export class StringNormalizeOperator
    extends BaseOperator
    implements IJYCMOperator
{
    __operator_name__ = 'operator:string:normalize';
    __event__ = 'operator:string:normalize';
    trim: boolean;
    lowercase: boolean;
    collapse_whitespace: boolean;

    constructor(
        path_regex: string,
        trim = true,
        lowercase = false,
        collapse_whitespace = false,
        rule_name?: string
    ) {
        super(path_regex, rule_name);
        this.trim = trim;
        this.lowercase = lowercase;
        this.collapse_whitespace = collapse_whitespace;
    }

    normalize(value: any): any {
        if (typeof value !== 'string') return value;
        if (this.trim) value = value.trim();
        if (this.collapse_whitespace) value = value.split(/\s+/).join(' ');
        if (this.lowercase) value = value.toLowerCase();
        return value;
    }

    diff(level: TreeLevel, instance: YouchamaJsonDiffer, drill: boolean) {
        const strings =
            typeof level.left === 'string' && typeof level.right === 'string';
        const normalized_left = this.normalize(level.left);
        const normalized_right = this.normalize(level.right);
        const pass = strings && normalized_left === normalized_right;
        if (!drill) {
            instance.report(this.__event__, level, {
                pass,
                path_regex: this.path_regex,
                normalized_left,
                normalized_right,
                trim: this.trim,
                lowercase: this.lowercase,
                collapse_whitespace: this.collapse_whitespace,
                ...this.ruleInfo()
            });
        }
        return { skip: true, score: pass ? 1 : 0 };
    }
}
register_operator('operator:string:normalize', StringNormalizeOperator);
register_operator('string_normalize', StringNormalizeOperator);
