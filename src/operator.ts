import { TreeLevel, YouchamaJsonDiffer } from './jycm';

export type IJYCMOperator = {
    __operator_name__: string;
    __event__?: string;
    match: (level: TreeLevel) => boolean;
    diff: (
        level: TreeLevel,
        instance: YouchamaJsonDiffer,
        drill: boolean
    ) => { skip: boolean; score: number };
};

export class BaseOperator {
    path_regex: string;
    regex: RegExp;
    constructor(path_regex: string) {
        this.path_regex = path_regex;
        this.regex = new RegExp(path_regex);
    }
    match(level: TreeLevel) {
        return null !== level.get_path().match(this.regex);
    }
}

export class ListItemFieldMatchOperator
    extends BaseOperator
    implements IJYCMOperator
{
    __operator_name__ = 'operator:list:matchWithField';
    __event__ = 'operator:list:matchWithField';
    field: string;
    constructor(path_regex: string, field: string) {
        super(path_regex);
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
                path_regex: this.path_regex
            });
        }

        return { skip: false, score: -1 };
    }
}

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
                    path_regex: this.path_regex
                });
            }
            return { skip: true, score: 0 };
        }

        if (!drill) {
            instance.report(this.__event__, level, {
                pass: true,
                path_regex: this.path_regex
            });
        }

        return { skip: false, score: -1 };
    }
}
