const {
    YouchamaJsonDiffer,
    ListItemFieldMatchOperator,
    make_ignore_order_func
} = require('jycm');

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
        new ListItemFieldMatchOperator('^ignore_order->\\[\\d+\\]$', 'id')
    ],
    ignore_order_func: make_ignore_order_func(['^ignore_order$'])
});

console.log(JSON.stringify(ycm.get_diff(), null, 4));
