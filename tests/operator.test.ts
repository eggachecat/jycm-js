import { make_ignore_order_func } from '../src/helper';
import { YouchamaJsonDiffer } from '../src/jycm';
import {
    ExpectChangeOperator,
    ListItemFieldMatchOperator
} from '../src/operator';

describe('testing with operator:ListItemFieldMatchOperator', () => {
    test('test with ListItemFieldMatchOperator', () => {
        const left = {
            v: [
                { id: 1, label: 'label:1' },
                { id: 2, label: 'label:2' },
                { id: 3, label: 'label:3' }
            ]
        };

        const right = {
            v: [
                { id: 1, label: 'label:1' },
                { id: 4, label: 'label:4' },
                { id: 2, label: 'label:22222' },
                { id: 3, label: 'label:3' }
            ]
        };
        const expected = {
            'list:add': [
                {
                    left: '__NON_EXIST__',
                    left_path: '',
                    right: { id: 4, label: 'label:4' },
                    right_path: 'v->[1]'
                }
            ],
            'operator:list:matchWithField': [
                {
                    field: 'id',
                    left: { id: 1, label: 'label:1' },
                    left_path: 'v->[0]',
                    path_regex: '^v->\\[\\d+\\]$',
                    right: { id: 1, label: 'label:1' },
                    right_path: 'v->[0]'
                },
                {
                    field: 'id',
                    left: { id: 2, label: 'label:2' },
                    left_path: 'v->[1]',
                    path_regex: '^v->\\[\\d+\\]$',
                    right: { id: 2, label: 'label:22222' },
                    right_path: 'v->[2]'
                },
                {
                    field: 'id',
                    left: { id: 3, label: 'label:3' },
                    left_path: 'v->[2]',
                    path_regex: '^v->\\[\\d+\\]$',
                    right: { id: 3, label: 'label:3' },
                    right_path: 'v->[3]'
                }
            ],
            value_changes: [
                {
                    left: 'label:2',
                    left_path: 'v->[1]->label',
                    new: 'label:22222',
                    old: 'label:2',
                    right: 'label:22222',
                    right_path: 'v->[2]->label'
                }
            ]
        };

        const ycm = new YouchamaJsonDiffer(left, right, {
            custom_operators: [
                new ListItemFieldMatchOperator('^v->\\[\\d+\\]$', 'id')
            ]
        });
        expect(ycm.get_diff(true)).toStrictEqual(expected);
    });

    test('test with ListItemFieldMatchOperator and without order', () => {
        const left = {
            ignore_order: [
                { id: 1, label: 'label:1' },
                { id: 2, label: 'label:2' },
                { id: 3, label: 'label:3' }
            ]
        };

        const right = {
            ignore_order: [
                { id: 4, label: 'label:4444' },
                { id: 2, label: 'label:2222' },
                { id: 1, label: 'label:1111' }
            ]
        };
        const expected = {
            'list:add': [
                {
                    left: '__NON_EXIST__',
                    left_path: '',
                    right: { id: 4, label: 'label:4444' },
                    right_path: 'ignore_order->[0]'
                }
            ],
            'list:remove': [
                {
                    left: { id: 3, label: 'label:3' },
                    left_path: 'ignore_order->[2]',
                    right: '__NON_EXIST__',
                    right_path: ''
                }
            ],
            'operator:list:matchWithField': [
                {
                    field: 'id',
                    path_regex: '^ignore_order->\\[\\d+\\]$',
                    left: { id: 1, label: 'label:1' },
                    left_path: 'ignore_order->[0]',
                    right: { id: 1, label: 'label:1111' },
                    right_path: 'ignore_order->[2]'
                },
                {
                    field: 'id',
                    path_regex: '^ignore_order->\\[\\d+\\]$',
                    left: { id: 2, label: 'label:2' },
                    left_path: 'ignore_order->[1]',
                    right: { id: 2, label: 'label:2222' },
                    right_path: 'ignore_order->[1]'
                }
            ],
            value_changes: [
                {
                    left: 'label:1',
                    left_path: 'ignore_order->[0]->label',
                    new: 'label:1111',
                    old: 'label:1',
                    right: 'label:1111',
                    right_path: 'ignore_order->[2]->label'
                },
                {
                    left: 'label:2',
                    left_path: 'ignore_order->[1]->label',
                    new: 'label:2222',
                    old: 'label:2',
                    right: 'label:2222',
                    right_path: 'ignore_order->[1]->label'
                }
            ]
        };

        const ycm = new YouchamaJsonDiffer(left, right, {
            custom_operators: [
                new ListItemFieldMatchOperator(
                    '^ignore_order->\\[\\d+\\]$',
                    'id'
                )
            ],
            ignore_order_func: make_ignore_order_func(['^ignore_order$'])
        });
        expect(ycm.get_diff(true)).toStrictEqual(expected);
    });
});

describe('testing with operator:ExpectChangeOperator', () => {
    test('test with ExpectChangeOperator', () => {
        const left = {
            value_expected_change_ok: 0,
            value_expected_change_not_ok: 0
        };

        const right = {
            value_expected_change_ok: 999,
            value_expected_change_not_ok: 0
        };
        const expected = {
            'operator:primitive:expectChange': [
                {
                    left: 0,
                    right: 0,
                    left_path: 'value_expected_change_not_ok',
                    right_path: 'value_expected_change_not_ok',
                    pass: false,
                    path_regex: '^value_expected_change_.*$'
                },
                {
                    left: 0,
                    right: 999,
                    left_path: 'value_expected_change_ok',
                    right_path: 'value_expected_change_ok',
                    pass: true,
                    path_regex: '^value_expected_change_.*$'
                }
            ],
            value_changes: [
                {
                    left: 0,
                    right: 999,
                    left_path: 'value_expected_change_ok',
                    right_path: 'value_expected_change_ok',
                    old: 0,
                    new: 999
                }
            ]
        };

        const ycm = new YouchamaJsonDiffer(left, right, {
            custom_operators: [
                new ExpectChangeOperator('^value_expected_change_.*$')
            ]
        });

        const actual = ycm.get_diff(true);
        expect(JSON.stringify(actual)).toMatch(JSON.stringify(expected));
    });
});
