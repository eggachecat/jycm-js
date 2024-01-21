import {
    EVENT_DICT_ADD,
    EVENT_DICT_REMOVE,
    EVENT_LIST_ADD,
    EVENT_LIST_REMOVE,
    EVENT_PAIR,
    EVENT_VALUE_CHANGE,
    PLACE_HOLDER_NON_EXIST,
    make_json_path_key
} from './helper';
import { KMMatcher } from './km_matcher';
import { IJYCMOperator, getOperatorListFromJSON } from './operator';

type TreeLevelDiffFunction = (
    treeLevel: TreeLevel,
    drill: boolean
) => { skip: boolean; score: number };

function get_jycm_type(o: any) {
    if (Array.isArray(o)) {
        return 'list';
    }
    if (o instanceof Object && o.constructor === Object) {
        return 'dict';
    }

    //
    return 'primitive';
}

export class TreeLevel {
    left: any;
    right: any;
    left_path: Array<any>;
    right_path: Array<any>;
    up: TreeLevel | null;
    diff: (drill: boolean) => { skip: boolean; score: number } | null;

    constructor(
        left: any,
        right: any,
        left_path: Array<any>,
        right_path: Array<any>,
        up: TreeLevel | null,
        diff: TreeLevelDiffFunction | null = null
    ) {
        this.left = left;
        this.right = right;
        this.left_path = left_path;
        this.right_path = right_path;
        this.up = up;
        this.diff = diff ? (drill: boolean) => diff(this, drill) : null;
    }

    has_different_types() {
        return get_jycm_type(this.left) !== get_jycm_type(this.right);
    }

    get_type() {
        return get_jycm_type(this.left);
    }

    to_dict(): object {
        return {
            left: this.left,
            right: this.right,
            left_path: this.left_path,
            right_path: this.right_path
        };
    }

    get_path(): string {
        if (this.left !== PLACE_HOLDER_NON_EXIST) {
            return make_json_path_key(this.left_path);
        }
        return make_json_path_key(this.right_path);
    }

    get_key(): string {
        return `${make_json_path_key(this.left_path)}/${make_json_path_key(
            this.right_path
        )}`;
    }

    toString(): string {
        return JSON.stringify(this.to_dict());
    }
}

class JYCMRecord {
    event: string;
    level: TreeLevel;
    info: { [key: string]: any };

    constructor(event: string, level: TreeLevel, info: { [key: string]: any }) {
        this.event = event;
        this.level = level;
        this.info = info;
    }

    to_dict(): object {
        return {
            ...this.level.to_dict(),
            left_path: make_json_path_key(this.level.left_path),
            right_path: make_json_path_key(this.level.right_path),
            ...this.info
        };
    }
}

/**
 * Match parts between LCS index
 * @param target_index LCS index that being collected before
 * @param indices all candidates index
 * @param list_ list of values
 * @param container reference of collector
 */
function gather_serial_pair(
    target_index: number,
    indices: number[],
    list_: any[],
    container: any[]
): void {
    while (indices.length > 0) {
        let _index = indices.shift() as number;

        if (_index < target_index) {
            container.push(list_[_index]);
            continue;
        }

        if (_index === target_index) {
            break;
        }

        indices.unshift(_index);
        break;
    }
}

class ListItemPair {
    level: TreeLevel;
    left_index: number;
    right_index: number;

    constructor(value: TreeLevel, left_index: number, right_index: number) {
        this.level = value;
        this.left_index = left_index;
        this.right_index = right_index;
    }

    toString(): string {
        return `<left_index=[${this.left_index}],right_index=[${this.right_index}],level=[${this.level}]>`;
    }
}

type TreeLevelDiffFunc = (level: TreeLevel, drill: boolean) => boolean;
type RecordList = Array<JYCMRecord>;

export class YouchamaJsonDiffer {
    left: any;
    right: any;
    custom_operators: Array<IJYCMOperator>;
    records: { [key: string]: RecordList };
    cache: { [key: string]: any };
    key_ctr: { [key: string]: number };
    use_cache: boolean;
    debug: boolean;
    lcs_table_cache: { [key: string]: any };
    ignore_order_func: TreeLevelDiffFunc;
    event_pair_dict: { [key: string]: boolean };

    constructor(
        left: any,
        right: any,
        parameters: {
            custom_operators?: Array<IJYCMOperator>;
            ignore_order_func?: TreeLevelDiffFunc | null;
            debug?: boolean;
            use_cache?: boolean;
        } = {}
    ) {
        const {
            custom_operators = [],
            ignore_order_func = null,
            debug = false,
            use_cache = true
        } = parameters;

        this.left = left;
        this.right = right;
        this.custom_operators = custom_operators;
        this.records = { [EVENT_PAIR]: [] }; // 假设 EVENT_PAIR 已定义
        this.cache = {};
        this.key_ctr = {};
        this.use_cache = use_cache;
        this.debug = debug;
        this.lcs_table_cache = {};
        this.ignore_order_func =
            ignore_order_func || ((level: TreeLevel, drill: boolean) => false);
        this.event_pair_dict = {};

        this.__dict_remove_diff = this.__dict_remove_diff.bind(this);
        this.__dict_add_diff = this.__dict_add_diff.bind(this);
    }

    report_pair(level: TreeLevel): void {
        const left_key = make_json_path_key(level.left_path); // 假设 make_json_path_key 已定义
        const right_key = make_json_path_key(level.right_path);
        const unique_key = `${left_key}__@__${right_key}`;

        if (
            left_key !== right_key &&
            undefined === this.event_pair_dict[unique_key]
        ) {
            this.event_pair_dict[unique_key] = true;
            this.records[EVENT_PAIR].push(
                new JYCMRecord(EVENT_PAIR, level, {})
            ); // 假设 JYCMRecord 类已转换
        }
    }

    report(
        event: string,
        level: TreeLevel,
        info: { [key: string]: any } = {}
    ): void {
        if (undefined === this.records[event]) {
            this.records[event] = [];
        }
        this.records[event].push(new JYCMRecord(event, level, info));
    }

    to_dict(no_pairs: boolean = false): { [key: string]: any } {
        const total_dict: { [key: string]: any } = {};
        const events = Object.keys(this.records);
        events.sort();
        for (const event of events) {
            const records = this.records[event];
            total_dict[event] = records.map((r) => r.to_dict());
        }

        if (no_pairs && undefined !== total_dict[EVENT_PAIR]) {
            delete total_dict[EVENT_PAIR];
        }

        return total_dict;
    }

    private _generate_lcs_pair_list(
        level: TreeLevel,
        left_size: number,
        right_size: number,
        dp_table: number[][]
    ): ListItemPair[] {
        if (left_size === 0 || right_size === 0) {
            return [];
        }

        if (
            this.diff_level(
                new TreeLevel(
                    level.left[left_size - 1],
                    level.right[right_size - 1],
                    [...level.left_path, left_size - 1],
                    [...level.right_path, right_size - 1],
                    level
                ),
                true
            ) === 1
        ) {
            return this._generate_lcs_pair_list(
                level,
                left_size - 1,
                right_size - 1,
                dp_table
            ).concat(
                new ListItemPair(
                    new TreeLevel(
                        level.left[left_size - 1],
                        level.right[right_size - 1],
                        [...level.left_path, left_size - 1],
                        [...level.right_path, right_size - 1],
                        level
                    ),
                    left_size - 1,
                    right_size - 1
                )
            );
        }

        if (
            dp_table[left_size - 1][right_size] >
            dp_table[left_size][right_size - 1]
        ) {
            return this._generate_lcs_pair_list(
                level,
                left_size - 1,
                right_size,
                dp_table
            );
        } else {
            return this._generate_lcs_pair_list(
                level,
                left_size,
                right_size - 1,
                dp_table
            );
        }
    }

    /**  To fill the lookup table by finding the length of LCS of substring `X[0…m-1]` and `Y[0…n-1]` */
    private _build_up_lcs_table(
        level: TreeLevel,
        left_size: number,
        right_size: number,
        dp_table: number[][]
    ): void {
        for (let i = 1; i <= left_size; i++) {
            for (let j = 1; j <= right_size; j++) {
                if (
                    this.diff_level(
                        new TreeLevel(
                            level.left[i - 1],
                            level.right[j - 1],
                            [...level.left_path, i - 1],
                            [...level.right_path, j - 1],
                            level
                        ),
                        true
                    ) === 1
                ) {
                    dp_table[i][j] = dp_table[i - 1][j - 1] + 1;
                } else {
                    dp_table[i][j] = Math.max(
                        dp_table[i - 1][j],
                        dp_table[i][j - 1]
                    );
                }
            }
        }
    }

    /**
     * Generate all ListItemPair
     *
     * Use LCS algorithm to match arrays with taking order into consideration
     */
    generate_lcs_pair_list(level: TreeLevel): ListItemPair[] {
        const left_size = level.left.length;
        const right_size = level.right.length;
        const dp_table = Array.from({ length: left_size + 1 }, () =>
            new Array(right_size + 1).fill(0)
        );

        // fill lookup table
        this._build_up_lcs_table(level, left_size, right_size, dp_table);

        // find the longest common sequence
        return this._generate_lcs_pair_list(
            level,
            left_size,
            right_size,
            dp_table
        );
    }

    private _list_with_order_partial_matching(
        left_list: TreeLevel[],
        right_list: TreeLevel[]
    ): [TreeLevel[], TreeLevel[], TreeLevel[]] {
        const size_x = 1 + left_list.length;
        const size_y = 1 + right_list.length;
        const distance_table = Array.from({ length: size_x }, () =>
            new Array(size_y).fill(0)
        );

        for (let x = size_x - 2; x >= 0; x--) {
            for (let y = size_y - 2; y >= 0; y--) {
                const prev_x_score = distance_table[x + 1][y];
                const prev_y_score = distance_table[x][y + 1];
                const level = new TreeLevel(
                    left_list[x].left,
                    right_list[y].right,
                    left_list[x].left_path,
                    right_list[y].right_path,
                    null
                );
                const score =
                    this.diff_level(level, true) + distance_table[x + 1][y + 1];

                distance_table[x][y] = Math.max(
                    prev_x_score,
                    prev_y_score,
                    score
                );
            }
        }

        const removed = [...left_list];
        const add = [...right_list];
        const delta: TreeLevel[] = [];

        let x = 0,
            y = 0;
        while (x + y < size_x + size_y - 2) {
            const curr = distance_table[x][y];
            const prev_x_score = x + 1 >= size_x ? 0 : distance_table[x + 1][y];
            const prev_y_score = y + 1 >= size_y ? 0 : distance_table[x][y + 1];

            if (curr === prev_x_score && x + 1 < size_x) {
                x++;
                continue;
            }

            if (curr === prev_y_score && y + 1 < size_y) {
                y++;
                continue;
            }

            removed.splice(removed.indexOf(left_list[x]), 1);
            add.splice(add.indexOf(right_list[y]), 1);
            delta.push(
                new TreeLevel(
                    left_list[x].left,
                    right_list[y].right,
                    left_list[x].left_path,
                    right_list[y].right_path,
                    null
                )
            );

            x++;
            y++;
        }

        return [removed, add, delta];
    }

    private _compare_list_with_order(level: TreeLevel, drill: boolean): number {
        const lcs_pair_list = this.generate_lcs_pair_list(level);
        // this.debug && console.log(`lcs_pair_list: ${lcs_pair_list}`);
        const left_indices = Array.from(Array(level.left.length).keys());
        const right_indices = Array.from(Array(level.right.length).keys());

        const left_data: TreeLevel[] = level.left.map(
            (item: any, i: number) =>
                new TreeLevel(
                    item,
                    PLACE_HOLDER_NON_EXIST,
                    [...level.left_path, i],
                    [],
                    null
                )
        );
        const right_data: TreeLevel[] = level.right.map(
            (item: any, i: number) =>
                new TreeLevel(
                    PLACE_HOLDER_NON_EXIST,
                    item,
                    [],
                    [...level.right_path, i],
                    null
                )
        );

        const serial_pair_list: [TreeLevel[], TreeLevel[]][] = [];
        let total_score = 0;

        for (const lcs_pair of lcs_pair_list) {
            const _serial_pair_left: TreeLevel[] = [];
            const _serial_pair_right: TreeLevel[] = [];

            // can be different without drill
            const score = this.diff_level(lcs_pair.level, drill);
            total_score += score;

            if (!drill) {
                this.report_pair(level);
            }

            // fuzzy matching
            gather_serial_pair(
                lcs_pair.left_index,
                left_indices,
                left_data,
                _serial_pair_left
            );
            gather_serial_pair(
                lcs_pair.right_index,
                right_indices,
                right_data,
                _serial_pair_right
            );

            serial_pair_list.push([_serial_pair_left, _serial_pair_right]);
        }

        serial_pair_list.push([
            left_indices.map(
                (i) =>
                    new TreeLevel(
                        level.left[i],
                        PLACE_HOLDER_NON_EXIST,
                        [...level.left_path, i],
                        [],
                        null
                    )
            ),
            right_indices.map(
                (i) =>
                    new TreeLevel(
                        PLACE_HOLDER_NON_EXIST,
                        level.right[i],
                        [],
                        [...level.right_path, i],
                        null
                    )
            )
        ]);

        // fuzzy matching
        for (const [left_serial, right_serial] of serial_pair_list) {
            // this.debug &&
            //     console.log(`list compare: ${left_serial} and ${right_serial}`);
            const [removed, add, delta] =
                this._list_with_order_partial_matching(
                    left_serial,
                    right_serial
                );

            if (!drill) {
                removed.forEach((tl) => this.report(EVENT_LIST_REMOVE, tl));
                add.forEach((tl) => this.report(EVENT_LIST_ADD, tl));
            }

            for (const tl of delta) {
                const score = this.diff_level(tl, drill);
                total_score += score;

                if (!drill) {
                    this.report_pair(tl);
                }
            }
        }

        return total_score / Math.max(level.left.length, level.right.length);
    }

    public compare_list_with_order(level: TreeLevel, drill: boolean): number {
        const max_len = Math.max(level.left.length, level.right.length);

        // if (this.debug) {
        //     console.log(`compare_list_with_order>>> ${level}`);
        // }

        if (max_len === 0) {
            return 1;
        }
        const score = this._compare_list_with_order(level, drill);

        // if (this.debug) {
        //     console.log(`list score = ${score} for ${level}`);
        // }

        return score;
    }

    private _list_without_order_partial_matching(
        left_list: TreeLevel[],
        right_list: TreeLevel[]
    ): [TreeLevel[], TreeLevel[], TreeLevel[]] {
        const removed = [...left_list];
        const add = [...right_list];
        const delta: TreeLevel[] = [];

        const size_left = left_list.length;
        const size_right = right_list.length;

        if (size_left === 0 || size_right === 0) {
            return [removed, add, delta];
        }

        const distance_table: number[][] = Array.from(
            { length: size_left },
            () => new Array(size_right).fill(0.0)
        );

        for (let li = 0; li < size_left; li++) {
            for (let ri = 0; ri < size_right; ri++) {
                const level = new TreeLevel(
                    left_list[li].left,
                    right_list[ri].right,
                    [...left_list[li].left_path],
                    [...right_list[ri].right_path],
                    null
                );
                const score = this.diff_level(level, true);
                distance_table[li][ri] = score;
            }
        }

        const matcher = new KMMatcher(distance_table);
        const [_, pairs] = matcher.solve();

        for (const [li, ri] of pairs) {
            if (distance_table[li][ri] !== 0) {
                removed.splice(removed.indexOf(left_list[li]), 1);
                add.splice(add.indexOf(right_list[ri]), 1);
                delta.push(
                    new TreeLevel(
                        left_list[li].left,
                        right_list[ri].right,
                        left_list[li].left_path,
                        right_list[ri].right_path,
                        null
                    )
                );
            }
        }

        return [removed, add, delta];
    }

    public compare_list_without_order(
        level: TreeLevel,
        drill: boolean
    ): number {
        const pair_list: ListItemPair[] = [];
        const matched_right: { [key: number]: boolean } = {};
        const matched_left: { [key: number]: boolean } = {};

        for (let li = 0; li < level.left.length; li++) {
            for (let ri = 0; ri < level.right.length; ri++) {
                if (matched_right[ri]) continue;

                const new_level = new TreeLevel(
                    level.left[li],
                    level.right[ri],
                    [...level.left_path, li],
                    [...level.right_path, ri],
                    level
                );

                if (this.diff_level(new_level, true) === 1) {
                    pair_list.push(new ListItemPair(new_level, li, ri));
                    matched_right[ri] = true;
                    matched_left[li] = true;
                    break;
                }
            }
        }

        if (!drill) {
            this._compare_list_without_order_post(pair_list, level);
        }

        return (
            pair_list.length / Math.max(level.left.length, level.right.length)
        );
    }

    private _compare_list_without_order_post(
        pair_list: ListItemPair[],
        level: TreeLevel
    ): void {
        const matched_left_index: number[] = [];
        const matched_right_index: number[] = [];

        pair_list.forEach((pair) => {
            this.diff_level(pair.level, false);
            this.report_pair(pair.level);
            matched_left_index.push(pair.left_index);
            matched_right_index.push(pair.right_index);
        });

        const partial_left = level.left
            .map((item, index) =>
                matched_left_index.includes(index)
                    ? undefined
                    : new TreeLevel(
                          item,
                          PLACE_HOLDER_NON_EXIST,
                          [...level.left_path, index],
                          [],
                          null
                      )
            )
            .filter((v) => undefined !== v);

        const partial_right = level.right
            .map((item, index) =>
                matched_right_index.includes(index)
                    ? undefined
                    : new TreeLevel(
                          PLACE_HOLDER_NON_EXIST,
                          item,
                          [],
                          [...level.right_path, index],
                          null
                      )
            )
            .filter((v) => undefined !== v);

        const [removed, add, delta] = this._list_without_order_partial_matching(
            partial_left,
            partial_right
        );

        removed.forEach((tl) => this.report(EVENT_LIST_REMOVE, tl));
        add.forEach((tl) => this.report(EVENT_LIST_ADD, tl));
        delta.forEach((tl) => {
            this.diff_level(tl, false);
            this.report_pair(tl);
        });
    }

    public compare_list(level: TreeLevel, drill: boolean): number {
        if (this.ignore_order_func(level, drill)) {
            return this.compare_list_without_order(level, drill);
        }
        return this.compare_list_with_order(level, drill);
    }

    private __dict_remove_diff(_level: TreeLevel, _drill: boolean) {
        if (!_drill) {
            this.report(
                EVENT_DICT_REMOVE,
                new TreeLevel(
                    _level.left,
                    PLACE_HOLDER_NON_EXIST,
                    [..._level.left_path],
                    [],
                    _level
                )
            );
        }
        return { skip: true, score: 0 };
    }

    private __dict_add_diff(_level: TreeLevel, _drill: boolean) {
        if (!_drill) {
            this.report(
                EVENT_DICT_ADD,
                new TreeLevel(
                    PLACE_HOLDER_NON_EXIST,
                    _level.right,
                    [],
                    [..._level.right_path],
                    _level
                )
            );
        }
        return { skip: true, score: 0 };
    }

    public compare_dict(level: TreeLevel, drill: boolean): number {
        let score = 0;
        const all_keys = Array.from(
            new Set([...Object.keys(level.left), ...Object.keys(level.right)])
        ).sort();

        // if (this.debug) {
        //     console.log(`[compare_dict>>>] ${level}`);
        // }

        for (const k of all_keys) {
            if (undefined !== level.right[k] && undefined !== level.left[k]) {
                const _score = this.diff_level(
                    new TreeLevel(
                        level.left[k],
                        level.right[k],
                        [...level.left_path, k],
                        [...level.right_path, k],
                        level
                    ),
                    drill
                );
                score += _score;
                if (!drill) {
                    this.report_pair(level);
                }
                continue;
            }

            if (undefined !== level.left[k]) {
                score += this.diff_level(
                    new TreeLevel(
                        level.left[k],
                        PLACE_HOLDER_NON_EXIST,
                        [...level.left_path, k],
                        [],
                        level,
                        this.__dict_remove_diff
                    ),
                    drill
                );
                continue;
            }

            if (undefined !== level.right[k]) {
                score += this.diff_level(
                    new TreeLevel(
                        PLACE_HOLDER_NON_EXIST,
                        level.right[k],
                        [],
                        [...level.right_path, k],
                        level,
                        this.__dict_add_diff
                    ),
                    drill
                );
                continue;
            }
        }

        return all_keys.length === 0 ? 1 : score / all_keys.length;
    }

    public compare_primitive(level: TreeLevel, drill: boolean): number {
        // this.debug && console.log(`compare_primitive: ${level}`);
        if (!drill) {
            this.report_pair(level);
        }

        if (level.left !== level.right) {
            if (!drill) {
                this.report(EVENT_VALUE_CHANGE, level, {
                    old: level.left,
                    new: level.right
                });
            }
            return 0;
        }
        return 1;
    }

    public use_custom_operators(
        level: TreeLevel,
        drill: boolean
    ): { skip: boolean; score: number } {
        for (const operator of this.custom_operators) {
            if (operator.match(level)) {
                const { skip, score } = operator.diff(level, this, drill);
                if (skip) {
                    return { skip, score };
                }
            }
        }
        return { skip: false, score: -1 };
    }

    private _diff_level(level: TreeLevel, drill: boolean): number {
        if (!drill) {
            this.report_pair(level);
        }

        let { skip, score } = this.use_custom_operators(level, drill);
        if (skip) {
            return score;
        }

        if (level.diff) {
            let { skip, score } = level.diff(drill);
            if (skip) {
                return score;
            }
        }

        if (level.has_different_types()) {
            return this.compare_primitive(level, drill);
        }

        const level_type = level.get_type();

        // if (this.debug) {
        //     console.log(`level_type: ${level_type} for ${level}`);
        // }

        if (level_type === 'list') {
            return this.compare_list(level, drill);
        }

        if (level_type === 'dict') {
            return this.compare_dict(level, drill);
        }

        return this.compare_primitive(level, drill);
    }

    public diff_level(level: TreeLevel, drill: boolean): number {
        // this.debug &&
        //     !drill &&
        //     console.log(
        //         `[diff_level]: ${JSON.stringify(
        //             level.left,
        //             null,
        //             4
        //         )} and ${JSON.stringify(level.right, null, 4)}`
        //     );

        if (this.use_cache) {
            const cache_key = `[${level.get_key()}]@[${drill}]`;
            if (undefined === this.cache[cache_key]) {
                const score = this._diff_level(level, drill);
                this.cache[cache_key] = score;
                // if (this.debug) {
                //     console.log(
                //         `save score = ${score} for cache_key = ${cache_key} with level = ${level}`
                //     );
                // }
            } else {
                // if (this.debug) {
                //     console.log(
                //         `hit cache_key = ${cache_key} for level ${level}`
                //     );
                // }
            }

            const score = this.cache[cache_key];
            // if (this.debug) {
            //     this.key_ctr[cache_key] = (this.key_ctr[cache_key] || 0) + 1;
            //     console.log(`score = ${score} for level: ${level}`);
            // }
            return score;
        }

        return this._diff_level(level, drill);
    }
    public diff(): boolean {
        const root_level = new TreeLevel(this.left, this.right, [], [], null);
        return this.diff_level(root_level, false) === 1;
    }

    public get_diff(no_pairs: boolean = false): { [key: string]: any } {
        this.diff();
        return this.to_dict(no_pairs);
    }
}

